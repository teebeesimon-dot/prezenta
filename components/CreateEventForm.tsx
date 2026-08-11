"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { useAuth } from "@/contexts/AuthProvider";
import { inputClassName, labelClassName, SPORTS } from "@/lib/event-form";
import { formatEventDateShort } from "@/lib/events";
import type { EventLocation } from "@/lib/location";
import {
  computeMonthlySubscription,
  computeTotalCost,
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  formatDuration,
  formatLei,
  formatTimeRange,
} from "@/lib/pricing";
import {
  countOccurrencesInMonth,
  generateOccurrenceDates,
  RECURRENCE_OPTIONS,
  type RecurrenceFrequency,
} from "@/lib/recurrence";
import {
  describeRegistrationLead,
  type RegistrationLeadUnit,
} from "@/lib/registration";
import { createSeries } from "@/lib/series";
import { monthLabel } from "@/lib/subscriptions";
import { FOOTBALL_FORMATS, type FootballFormat } from "@/lib/football-formats";
import type { PaymentModel, Sport } from "@/lib/types";

const PAYMENT_OPTIONS: {
  value: PaymentModel;
  label: string;
  hint: string;
}[] = [
  {
    value: "per_game",
    label: "Plată săptămânală",
    hint: "Cost teren/oră, împărțit la jucătorii confirmați la fiecare joc",
  },
  {
    value: "monthly",
    label: "Abonament lunar",
    hint: "Sumă lunară per membru, calculată automat",
  },
];

export default function CreateEventForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState<Sport>("football");
  const [paymentModel, setPaymentModel] = useState<PaymentModel>("per_game");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(
    DEFAULT_DURATION_MINUTES
  );
  const [pricePerHour, setPricePerHour] = useState("");
  const [location, setLocation] = useState<EventLocation | null>(null);
  const [footballFormat, setFootballFormat] = useState<FootballFormat>("2x6");
  const [manualMaxParticipants, setManualMaxParticipants] = useState("");
  const maxParticipants = sport === "football"
    ? String(FOOTBALL_FORMATS.find((format) => format.value === footballFormat)?.totalPlayers ?? 12)
    : manualMaxParticipants;
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [endDate, setEndDate] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [monthlyEdited, setMonthlyEdited] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationLeadValue, setRegistrationLeadValue] = useState("2");
  const [registrationLeadUnit, setRegistrationLeadUnit] =
    useState<RegistrationLeadUnit>("days");
  const [registrationOpenTime, setRegistrationOpenTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const priceValue = Number(pricePerHour);
  const totalCost = computeTotalCost(priceValue, durationMinutes);

  // Both payment models create a recurring series. The monthly subscription is
  // estimated for the month of the start date (the upcoming month).
  const monthKey = date ? date.slice(0, 7) : "";
  const occurrencesInMonth =
    paymentModel === "monthly" && date
      ? countOccurrencesInMonth(date, frequency, monthKey)
      : 0;
  // Divisor: the fixed group size; falls back to the max participants value.
  const groupSizeValue = Number(groupSize) || Number(maxParticipants) || 0;
  const { sessionCost, monthlyTotal, perPlayer } = computeMonthlySubscription({
    pricePerHour: priceValue,
    durationMinutes,
    occurrencesInMonth,
    groupSize: groupSizeValue,
  });
  const computedPerPlayer = Math.round(perPlayer);
  // The per-player field is auto-filled with the computed amount until edited.
  const monthlyFieldValue = monthlyEdited
    ? monthlyPrice
    : computedPerPlayer > 0
      ? String(computedPerPlayer)
      : "";
  const monthlyValue = Number(monthlyFieldValue);

  // Preview only: when an end date is set, show how many occurrences fall in range.
  const occurrenceDates =
    date && endDate ? generateOccurrenceDates(date, endDate, frequency) : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!location?.placeId) {
      setError("Selectează o locație din sugestiile Google.");
      return;
    }

    if (endDate && occurrenceDates.length === 0) {
      setError(
        "Data de sfârșit trebuie să fie după data de început (sau lasă-o goală pentru o serie deschisă)."
      );
      return;
    }

    if (paymentModel === "monthly" && !(monthlyValue > 0)) {
      setError(
        "Completează costul terenului/oră (și numărul de membri) ca să se calculeze abonamentul, sau introdu suma manual."
      );
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const eventId = await createSeries({
        title: title.trim(),
        sport,
        time,
        durationMinutes,
        maxParticipants: Number(maxParticipants),
        footballFormat,
        location,
        ownerId: user.uid,
        frequency,
        startDate: date,
        endDate: endDate || null,
        paymentModel,
        ...(priceValue > 0 ? { pricePerHour: priceValue } : {}),
        ...(paymentModel === "monthly" && monthlyValue > 0
          ? { monthlyPrice: monthlyValue }
          : {}),
        ...(paymentModel === "monthly" && groupSizeValue > 0
          ? { groupSize: groupSizeValue }
          : {}),
        ...(registrationEnabled && Number(registrationLeadValue) > 0
          ? {
              registrationLeadValue: Number(registrationLeadValue),
              registrationLeadUnit,
              ...(registrationLeadUnit === "days" && registrationOpenTime
                ? { registrationOpenTime }
                : {}),
            }
          : {}),
      });
      router.push(`/event/${eventId}`);
    } catch {
      setError("Nu s-a putut salva evenimentul. Încearcă din nou.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="title" className={labelClassName}>
          Titlu eveniment
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClassName}
          placeholder="Meci de fotbal"
        />
      </div>

      <div>
        <label htmlFor="sport" className={labelClassName}>
          Sport
        </label>
        <select
          id="sport"
          required
          value={sport}
          onChange={(e) => setSport(e.target.value as Sport)}
          className={inputClassName}
        >
          {SPORTS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className={labelClassName}>Tip plată</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition ${
                paymentModel === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentModel"
                  value={opt.value}
                  checked={paymentModel === opt.value}
                  onChange={() => setPaymentModel(opt.value)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-semibold text-foreground">
                  {opt.label}
                </span>
              </span>
              <span className="ml-6 text-xs text-muted-foreground">
                {opt.hint}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ambele variante creează o serie recurentă. Pe pagina principală apare
          doar apariția care urmează, restul rămân în istoric.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={labelClassName}>
            Data de început
          </label>
          <input
            id="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="time" className={labelClassName}>
            Ora de început
          </label>
          <input
            id="time"
            type="time"
            required
            step={1800}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="duration" className={labelClassName}>
            Durată
          </label>
          <select
            id="duration"
            required
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className={inputClassName}
          >
            {DURATION_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pricePerHour" className={labelClassName}>
            Cost teren / oră (lei)
          </label>
          <input
            id="pricePerHour"
            type="number"
            min={0}
            step={1}
            value={pricePerHour}
            onChange={(e) => setPricePerHour(e.target.value)}
            className={inputClassName}
            placeholder="ex. 200"
          />
        </div>
      </div>

      {time && paymentModel === "per_game" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            Interval: {formatTimeRange(time, durationMinutes)}
          </p>
          {totalCost > 0 && (
            <p className="mt-1 text-muted-foreground">
              Cost total teren:{" "}
              <span className="font-semibold text-foreground">
                {formatLei(totalCost)}
              </span>{" "}
              — se împarte automat la jucătorii confirmați.
            </p>
          )}
        </div>
      )}

      <LocationAutocomplete value={location} onChange={setLocation} required />

      {sport === "football" ? (
        <div>
          <label htmlFor="footballFormat" className={labelClassName}>
            Format meci
          </label>
          <select
            id="footballFormat"
            value={footballFormat}
            onChange={(e) => setFootballFormat(e.target.value as FootballFormat)}
            className={inputClassName}
          >
            {FOOTBALL_FORMATS.map((format) => (
              <option key={format.value} value={format.value}>{format.label} ({format.totalPlayers} în total)</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Locurile pentru participanți se calculează automat.</p>
        </div>
      ) : (
        <div>
          <label htmlFor="maxParticipants" className={labelClassName}>Număr maxim participanți</label>
          <input id="maxParticipants" type="number" required min={2} value={manualMaxParticipants} onChange={(e) => setManualMaxParticipants(e.target.value)} className={inputClassName} placeholder="10" />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="frequency" className={labelClassName}>
              Frecvență
            </label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurrenceFrequency)
              }
              className={inputClassName}
            >
              {RECURRENCE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="endDate" className={labelClassName}>
              Data de sfârșit (opțional)
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              min={date || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {endDate ? (
            occurrenceDates.length > 0 && date ? (
              <>
                Serie cu sfârșit:{" "}
                <span className="font-semibold text-foreground">
                  {occurrenceDates.length} apariții
                </span>
                , între {formatEventDateShort(occurrenceDates[0])} și{" "}
                {formatEventDateShort(
                  occurrenceDates[occurrenceDates.length - 1]
                )}
                .
              </>
            ) : (
              "Data de sfârșit trebuie să fie după data de început."
            )
          ) : (
            "Fără dată de sfârșit = serie deschisă. O poți închide oricând mai târziu, iar istoricul rămâne."
          )}
        </p>

        {paymentModel === "monthly" && (
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <label htmlFor="groupSize" className={labelClassName}>
                Membri în grup (împărțire abonament)
              </label>
              <input
                id="groupSize"
                type="number"
                min={1}
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value)}
                className={inputClassName}
                placeholder={maxParticipants || "ex. 8"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Abonamentul se împarte mereu la acest număr de membri, indiferent
                câți vin la fiecare joc.
              </p>
            </div>

            {sessionCost > 0 && occurrencesInMonth > 0 && groupSizeValue > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  Cost/ședință: {formatLei(priceValue)}/oră ×{" "}
                  {formatDuration(durationMinutes)} ={" "}
                  <span className="font-semibold text-foreground">
                    {formatLei(sessionCost)}
                  </span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Luna{" "}
                  <span className="font-medium text-foreground">
                    {monthLabel(monthKey)}
                  </span>
                  : {occurrencesInMonth}{" "}
                  {occurrencesInMonth === 1 ? "apariție" : "apariții"} ×{" "}
                  {formatLei(sessionCost)} ={" "}
                  <span className="font-semibold text-foreground">
                    {formatLei(monthlyTotal)}
                  </span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Împărțit la {groupSizeValue} membri ={" "}
                  <span className="font-semibold text-foreground">
                    {formatLei(perPlayer)}/membru
                  </span>
                </p>
              </div>
            )}

            <div>
              <label htmlFor="monthlyPrice" className={labelClassName}>
                Cost abonament lunar / membru (lei)
              </label>
              <input
            id="monthlyPrice"
            type="number"
            min={0}
            step="any"
                value={monthlyFieldValue}
                onChange={(e) => {
                  setMonthlyEdited(true);
                  setMonthlyPrice(e.target.value);
                }}
                className={inputClassName}
                placeholder="ex. 150"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {monthlyEdited
                  ? "Sumă introdusă manual."
                  : "Calculat automat — îl poți modifica. Se poate ajusta ulterior din pagina seriei."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={registrationEnabled}
            onChange={(e) => setRegistrationEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Deschidere programată a înscrierilor
            </span>
            <span className="block text-xs text-muted-foreground">
              Înscrierile (Vin / Poate / Nu vin) se blochează până la momentul
              stabilit, calculat automat înainte de fiecare apariție din serie.
            </span>
          </span>
        </label>

        {registrationEnabled && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="regLeadValue" className={labelClassName}>
                  Se deschid cu
                </label>
                <div className="flex gap-2">
                  <input
                    id="regLeadValue"
                    type="number"
                    min={1}
                    value={registrationLeadValue}
                    onChange={(e) => setRegistrationLeadValue(e.target.value)}
                    className={inputClassName}
                    placeholder="2"
                  />
                  <select
                    aria-label="Unitate"
                    value={registrationLeadUnit}
                    onChange={(e) =>
                      setRegistrationLeadUnit(
                        e.target.value as RegistrationLeadUnit
                      )
                    }
                    className={inputClassName}
                  >
                    <option value="hours">ore înainte</option>
                    <option value="days">zile înainte</option>
                  </select>
                </div>
              </div>

              {registrationLeadUnit === "days" && (
                <div>
                  <label htmlFor="regOpenTime" className={labelClassName}>
                    La ora (opțional)
                  </label>
                  <input
                    id="regOpenTime"
                    type="time"
                    step={300}
                    value={registrationOpenTime}
                    onChange={(e) => setRegistrationOpenTime(e.target.value)}
                    className={inputClassName}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gol = se folosește ora de început a jocului.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                Înscrieri:{" "}
                <span className="font-semibold text-foreground">
                  {describeRegistrationLead(
                    Number(registrationLeadValue),
                    registrationLeadUnit,
                    registrationLeadUnit === "days"
                      ? registrationOpenTime
                      : undefined
                  )}
                </span>
                . Aceeași oră pentru fiecare apariție.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Se salvează..." : "Creează eveniment"}
      </button>
    </form>
  );
}
