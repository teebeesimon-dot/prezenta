"use client";

import { deleteField, doc, Timestamp, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { inputClassName, labelClassName, SPORTS } from "@/lib/event-form";
import { db } from "@/lib/firebase";
import type { EventLocation } from "@/lib/location";
import { toFirestoreLocation } from "@/lib/location";
import {
  computeTotalCost,
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  formatLei,
  formatTimeRange,
} from "@/lib/pricing";
import {
  describeRegistrationLead,
  type RegistrationLeadUnit,
} from "@/lib/registration";
import { getSeries } from "@/lib/series";
import { FOOTBALL_FORMATS, getDefaultFootballFormat, type FootballFormat } from "@/lib/football-formats";
import type { Event, PaymentModel, Sport } from "@/lib/types";

interface EditEventFormProps {
  event: Event;
}

function getInitialLocation(event: Event): EventLocation | null {
  if (
    event.placeId &&
    event.locationName &&
    event.latitude != null &&
    event.longitude != null
  ) {
    return {
      placeId: event.placeId,
      locationName: event.locationName,
      latitude: event.latitude,
      longitude: event.longitude,
    };
  }
  return null;
}

export default function EditEventForm({ event }: EditEventFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(event.title);
  const [sport, setSport] = useState<Sport>(event.sport);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time);
  const [durationMinutes, setDurationMinutes] = useState(
    event.durationMinutes ?? DEFAULT_DURATION_MINUTES
  );
  const [pricePerHour, setPricePerHour] = useState(
    event.pricePerHour != null ? String(event.pricePerHour) : ""
  );
  const [location, setLocation] = useState<EventLocation | null>(() =>
    getInitialLocation(event)
  );
  const [footballFormat, setFootballFormat] = useState<FootballFormat>(
    event.footballFormat ?? getDefaultFootballFormat(event.maxParticipants)
  );
  const [maxParticipants, setMaxParticipants] = useState(String(event.maxParticipants));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(
    Boolean(event.registrationLeadValue && event.registrationLeadUnit)
  );
  const [registrationLeadValue, setRegistrationLeadValue] = useState(
    event.registrationLeadValue != null
      ? String(event.registrationLeadValue)
      : "2"
  );
  const [registrationLeadUnit, setRegistrationLeadUnit] =
    useState<RegistrationLeadUnit>(event.registrationLeadUnit ?? "days");
  const [registrationOpenTime, setRegistrationOpenTime] = useState(
    event.registrationOpenTime ?? ""
  );

  const isSeries = Boolean(event.seriesId);
  const paymentModel: PaymentModel = event.paymentModel ?? "per_game";
  // For series occurrences, choose whether a price change applies to just this
  // game or to the whole series from now on.
  const [priceScope, setPriceScope] = useState<"occurrence" | "series">(
    "occurrence"
  );
  const [monthlyPrice, setMonthlyPrice] = useState("");

  // Load the parent series' monthly price (only relevant for monthly series).
  useEffect(() => {
    if (!event.seriesId) return;
    let active = true;
    getSeries(event.seriesId)
      .then((s) => {
        if (!active || !s) return;
        setMonthlyPrice(s.monthlyPrice != null ? String(s.monthlyPrice) : "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [event.seriesId]);

  const priceValue = Number(pricePerHour);
  const monthlyValue = Number(monthlyPrice);
  const totalCost = computeTotalCost(priceValue, durationMinutes);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!location?.placeId) {
      setError("Selectează o locație din sugestiile Google.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const regFields: Record<string, unknown> =
        registrationEnabled && Number(registrationLeadValue) > 0
          ? {
              registrationLeadValue: Number(registrationLeadValue),
              registrationLeadUnit,
              registrationOpenTime:
                registrationLeadUnit === "days" && registrationOpenTime
                  ? registrationOpenTime
                  : deleteField(),
            }
          : {
              registrationLeadValue: deleteField(),
              registrationLeadUnit: deleteField(),
              registrationOpenTime: deleteField(),
            };

      const baseUpdate: Record<string, unknown> = {
        title: title.trim(),
        sport,
        date,
        time,
        durationMinutes,
        maxParticipants: sport === "football" ? (FOOTBALL_FORMATS.find((format) => format.value === footballFormat)?.totalPlayers ?? 12) : Number(maxParticipants),
        ...(sport === "football" ? { footballFormat } : {}),
        updatedAt: Timestamp.now(),
        ...regFields,
        ...toFirestoreLocation(location),
      };

      // Monthly series: price lives on the series doc, not the occurrence.
      if (isSeries && paymentModel === "monthly") {
        await updateDoc(doc(db, "events", event.id), baseUpdate);
        if (event.seriesId && sport === "football") {
          await updateDoc(doc(db, "series", event.seriesId), {
            footballFormat,
            maxParticipants: Number(baseUpdate.maxParticipants),
          });
        }
        if (event.seriesId) {
          await updateDoc(doc(db, "series", event.seriesId), {
            monthlyPrice: monthlyValue > 0 ? monthlyValue : null,
          });
        }
      } else {
        // Per-game (standalone or series): occurrence keeps its own price snapshot.
        await updateDoc(doc(db, "events", event.id), {
          ...baseUpdate,
          pricePerHour: priceValue > 0 ? priceValue : null,
        });
        // "From now on" → also update the series default for future occurrences.
        if (isSeries && event.seriesId) {
          await updateDoc(doc(db, "series", event.seriesId), {
            ...(priceScope === "series" ? { pricePerHour: priceValue > 0 ? priceValue : null } : {}),
            ...(sport === "football" ? { footballFormat, maxParticipants: Number(baseUpdate.maxParticipants) } : {}),
          });
        }
      }

      if (isSeries && event.seriesId) {
        await updateDoc(doc(db, "series", event.seriesId), regFields);
      }

      router.push(`/event/${event.id}`);
    } catch {
      setError("Nu s-a putut actualiza evenimentul. Încearcă din nou.");
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={labelClassName}>
            Data
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
        {paymentModel === "per_game" && (
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
              placeholder="Opțional, ex. 200"
            />
          </div>
        )}
      </div>

      {isSeries && paymentModel === "monthly" && (
        <div>
          <label htmlFor="monthlyPrice" className={labelClassName}>
            Cost abonament lunar / jucător (lei)
          </label>
          <input
            id="monthlyPrice"
            type="number"
            min={0}
            step="any"
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(e.target.value)}
            className={inputClassName}
            placeholder="ex. 150"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se aplică întregii serii (abonamentul e global pe lună).
          </p>
        </div>
      )}

      {isSeries && paymentModel === "per_game" && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <span className={labelClassName}>Aplică modificarea de preț</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            {(
              [
                { value: "occurrence" as const, label: "Doar acest joc" },
                {
                  value: "series" as const,
                  label: "Toată seria (de acum încolo)",
                },
              ]
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                  priceScope === opt.value
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="priceScope"
                  value={opt.value}
                  checked={priceScope === opt.value}
                  onChange={() => setPriceScope(opt.value)}
                  className="h-4 w-4 accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

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

      <LocationAutocomplete
        id="edit-location"
        value={location}
        onChange={setLocation}
        required
        initialInputValue={!event.placeId ? event.location : undefined}
      />

      {sport === "football" ? (
        <div>
          <label htmlFor="footballFormat" className={labelClassName}>Format meci</label>
          <select id="footballFormat" value={footballFormat} onChange={(e) => setFootballFormat(e.target.value as FootballFormat)} className={inputClassName}>
            {FOOTBALL_FORMATS.map((format) => <option key={format.value} value={format.value}>{format.label} ({format.totalPlayers} în total)</option>)}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Locurile pentru participanți se calculează automat.</p>
        </div>
      ) : (
        <div>
          <label htmlFor="maxParticipants" className={labelClassName}>Număr maxim participanți</label>
          <input id="maxParticipants" type="number" required min={2} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} className={inputClassName} />
        </div>
      )}

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
              {isSeries
                ? "Se aplică tuturor aparițiilor seriei (de acum încolo)."
                : "Înscrierile se blochează până la momentul stabilit."}
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

            <p className="text-sm text-muted-foreground">
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
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
        >
          {submitting ? "Se salvează..." : "Salvează modific��rile"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/event/${event.id}`)}
          className="w-full rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted sm:flex-1"
        >
          Anulează
        </button>
      </div>
    </form>
  );
}
