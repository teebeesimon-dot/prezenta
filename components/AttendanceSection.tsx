"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import {
  computeGoingLists,
  findUserGoingPosition,
  parseTimestamp,
} from "@/lib/going-list";
import {
  computePerPlayer,
  computeTotalCost,
  formatLei,
} from "@/lib/pricing";
import {
  isPaid,
  setPaymentStatus,
} from "@/lib/payments";
import {
  computeRegistrationOpensAt,
  formatCountdown,
  formatRegistrationOpensAt,
} from "@/lib/registration";
import { saveResponse } from "@/lib/responses";
import {
  monthKeyFromDate,
  monthLabel,
  setSubscription,
  subscribeToMonthSubscriptions,
  type SubscriptionMap,
} from "@/lib/subscriptions";
import type {
  AttendanceStatus,
  ParticipantEntry,
  PaymentModel,
  RankedParticipantEntry,
} from "@/lib/types";

interface AttendanceSectionProps {
  eventId: string;
  maxParticipants: number;
  pricePerHour?: number;
  durationMinutes?: number;
  ownerId?: string;
  eventDate?: string;
  eventTime?: string;
  canManage?: boolean;
  paymentModel?: PaymentModel;
  registrationLeadValue?: number;
  registrationLeadUnit?: "hours" | "days";
  registrationOpenTime?: string;
}

const MAYBE_CONFIG = {
  status: "poate" as const,
  label: "Poate",
  groupTitle: "Poate",
  buttonClass: "bg-accent hover:bg-accent/90 text-accent-foreground",
  listClass:
    "border-accent/30 bg-accent/10 dark:border-accent/30 dark:bg-accent/10",
};

const NOT_GOING_CONFIG = {
  status: "nu_vin" as const,
  label: "Nu vin",
  groupTitle: "Nu vin",
  buttonClass:
    "bg-muted-foreground/80 hover:bg-muted-foreground text-background",
  listClass: "border-border bg-muted",
};

const VIN_BUTTON_CLASS =
  "bg-primary hover:bg-primary-hover text-primary-foreground";

function getParticipantName(data: Record<string, unknown>): string {
  return (data.userName as string) || (data.name as string) || "Necunoscut";
}

function getParticipantPhoto(data: Record<string, unknown>): string | null {
  return (data.userPhoto as string | null) ?? null;
}

function sortByName(entries: ParticipantEntry[]): ParticipantEntry[] {
  return [...entries].sort((a, b) =>
    a.name.localeCompare(b.name, "ro", { sensitivity: "base" })
  );
}

function ParticipantAvatar({
  name,
  photoURL,
}: {
  name: string;
  photoURL: string | null;
}) {
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RankedParticipantList({
  title,
  participants,
  className,
  emptyMessage,
}: {
  title: string;
  participants: RankedParticipantEntry[];
  className: string;
  emptyMessage: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {participants.map((participant) => (
            <li
              key={participant.userId}
              className="flex items-center gap-3 rounded-lg bg-card/70 px-3 py-2"
            >
              <span className="w-8 shrink-0 text-xs font-bold text-primary">
                {participant.positionLabel}
              </span>
              <ParticipantAvatar
                name={participant.name}
                photoURL={participant.photoURL}
              />
              <span className="text-sm font-medium text-foreground">
                {participant.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SimpleParticipantList({
  title,
  count,
  participants,
  className,
}: {
  title: string;
  count: number;
  participants: ParticipantEntry[];
  className: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({count})
      </h3>
      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nimeni încă.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {participants.map((participant) => (
            <li
              key={participant.userId}
              className="flex items-center gap-3 rounded-lg bg-card/70 px-3 py-2"
            >
              <ParticipantAvatar
                name={participant.name}
                photoURL={participant.photoURL}
              />
              <span className="text-sm font-medium text-foreground">
                {participant.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AttendanceSection({
  eventId,
  maxParticipants,
  pricePerHour,
  durationMinutes,
  ownerId,
  eventDate,
  eventTime,
  canManage = false,
  paymentModel = "per_game",
  registrationLeadValue,
  registrationLeadUnit,
  registrationOpenTime,
}: AttendanceSectionProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [confirmed, setConfirmed] = useState<RankedParticipantEntry[]>([]);
  const [waitlist, setWaitlist] = useState<RankedParticipantEntry[]>([]);
  const [maybe, setMaybe] = useState<ParticipantEntry[]>([]);
  const [notGoing, setNotGoing] = useState<ParticipantEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus | null>(null);
  const [userPosition, setUserPosition] = useState<RankedParticipantEntry | null>(null);
  const [submitting, setSubmitting] = useState<AttendanceStatus | null>(null);
  const [payments, setPayments] = useState<Record<string, "paid" | "unpaid">>({});
  const [subscriptions, setSubscriptions] = useState<SubscriptionMap>({});
  const [now, setNow] = useState(() => Date.now());

  const registrationOpensAt = computeRegistrationOpensAt({
    date: eventDate ?? "",
    time: eventTime ?? "",
    registrationLeadValue,
    registrationLeadUnit,
    registrationOpenTime,
  });
  const registrationOpen =
    !registrationOpensAt || now >= registrationOpensAt.getTime();

  // While registration is still locked, tick once a second for the countdown.
  useEffect(() => {
    if (registrationOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [registrationOpen]);

  const monthKey = eventDate ? monthKeyFromDate(eventDate) : "";

  // Live payment status from the event document. Gated on auth so the snapshot
  // listener doesn't fire before the Firebase token is attached (which would
  // produce a transient permission-denied on cold load).
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      doc(db, "events", eventId),
      (snap) => {
        const data = snap.data();
        setPayments(
          (data?.payments as Record<string, "paid" | "unpaid">) ?? {}
        );
      },
      () => setPayments({})
    );
    return () => unsubscribe();
  }, [eventId, user]);

  // Live monthly subscriptions for the event's month.
  useEffect(() => {
    if (!user || !monthKey) return;
    const unsubscribe = subscribeToMonthSubscriptions(monthKey, setSubscriptions);
    return () => unsubscribe();
  }, [monthKey, user]);

  useEffect(() => {
    const q = query(
      collection(db, "responses"),
      where("eventId", "==", eventId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const goingInputs: {
        userId: string;
        name: string;
        photoURL: string | null;
        goingRegisteredAt: number;
      }[] = [];
      const maybeMap = new Map<string, ParticipantEntry>();
      const notGoingMap = new Map<string, ParticipantEntry>();
      let userStatus: AttendanceStatus | null = null;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const status = data.status as AttendanceStatus;
        const userId = (data.userId as string) || docSnap.id;
        const entry: ParticipantEntry = {
          userId,
          name: getParticipantName(data),
          photoURL: getParticipantPhoto(data),
        };

        if (status === "vin") {
          goingInputs.push({
            userId,
            name: entry.name,
            photoURL: entry.photoURL,
            goingRegisteredAt: parseTimestamp(
              data.goingRegisteredAt ?? data.createdAt
            ),
          });
        } else if (status === "poate") {
          maybeMap.set(userId, entry);
        } else if (status === "nu_vin") {
          notGoingMap.set(userId, entry);
        }

        if (user && data.userId === user.uid) {
          userStatus = status;
        }
      });

      const lists = computeGoingLists(goingInputs, maxParticipants);
      setConfirmed(lists.confirmed);
      setWaitlist(lists.waitlist);
      setMaybe(sortByName(Array.from(maybeMap.values())));
      setNotGoing(sortByName(Array.from(notGoingMap.values())));
      setCurrentStatus(userStatus);
      setUserPosition(
        user && userStatus === "vin"
          ? findUserGoingPosition(user.uid, lists)
          : null
      );
    },
    // Ignore transient permission errors fired before the auth token attaches;
    // the listener reconnects automatically once auth is ready.
    () => {});

    return () => unsubscribe();
  }, [eventId, maxParticipants, user]);

  const totalCost = computeTotalCost(pricePerHour, durationMinutes);
  // Subscribed players are covered by their monthly subscription and excluded
  // from the per-game split; the cost is divided among the remaining payers.
  const payers = confirmed.filter((p) => !subscriptions[p.userId]);
  const perPlayer = computePerPlayer(totalCost, payers.length);
  const paidCount = payers.filter((p) => isPaid(payments, p.userId)).length;
  const collected = perPlayer * paidCount;

  async function handleTogglePaid(userId: string, nextPaid: boolean) {
    await setPaymentStatus(eventId, payments, userId, nextPaid);
  }

  async function handleToggleSubscription(
    targetUserId: string,
    targetName: string,
    subscribed: boolean
  ) {
    if (!user || !monthKey) return;
    await setSubscription(targetUserId, monthKey, subscribed, {
      createdBy: user.uid,
      userName: targetName,
    });
  }

  async function handleResponse(status: AttendanceStatus) {
    if (!user) return;
    if (!registrationOpen) return;

    setSubmitting(status);

    try {
      await saveResponse(
        eventId,
        user.uid,
        user.displayName ?? user.email ?? "User",
        user.photoURL,
        status
      );
    } finally {
      setSubmitting(null);
    }
  }

  if (authLoading) {
    return (
      <section className="mt-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Se încarcă...</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">Prezență</h2>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground">
            Conectează-te cu Google pentru a-ți confirma prezența.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
          >
            Conectează-te cu Google
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">Prezență</h2>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <ParticipantAvatar
            name={user.displayName ?? "User"}
            photoURL={user.photoURL}
          />
          <div>
            <p className="font-medium text-card-foreground">{user.displayName}</p>
            {currentStatus === "vin" && userPosition && (
              <p className="text-sm text-muted-foreground">
                {userPosition.isWaitlisted
                  ? `Listă de așteptare: ${userPosition.positionLabel}`
                  : `Confirmat: ${userPosition.positionLabel}`}
              </p>
            )}
            {currentStatus && currentStatus !== "vin" && (
              <p className="text-sm text-muted-foreground">
                Răspunsul tău:{" "}
                {currentStatus === "poate" ? "Poate" : "Nu vin"}
              </p>
            )}
          </div>
        </div>

        {!registrationOpen && registrationOpensAt && (
          <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Înscrierile nu sunt încă deschise
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Se deschid {formatRegistrationOpensAt(registrationOpensAt)}.
            </p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-foreground">
              {formatCountdown(registrationOpensAt.getTime() - now)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            disabled={submitting !== null || !registrationOpen}
            onClick={() => handleResponse("vin")}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
              currentStatus === "vin"
                ? "ring-2 ring-offset-2 ring-offset-card ring-ring " + VIN_BUTTON_CLASS
                : VIN_BUTTON_CLASS
            }`}
          >
            {submitting === "vin" ? "..." : "Vin"}
          </button>
          <button
            type="button"
            disabled={submitting !== null || !registrationOpen}
            onClick={() => handleResponse("poate")}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
              currentStatus === "poate"
                ? "ring-2 ring-offset-2 ring-offset-card ring-ring " + MAYBE_CONFIG.buttonClass
                : MAYBE_CONFIG.buttonClass
            }`}
          >
            {submitting === "poate" ? "..." : MAYBE_CONFIG.label}
          </button>
          <button
            type="button"
            disabled={submitting !== null || !registrationOpen}
            onClick={() => handleResponse("nu_vin")}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
              currentStatus === "nu_vin"
                ? "ring-2 ring-offset-2 ring-offset-card ring-ring " + NOT_GOING_CONFIG.buttonClass
                : NOT_GOING_CONFIG.buttonClass
            }`}
          >
            {submitting === "nu_vin" ? "..." : NOT_GOING_CONFIG.label}
          </button>
        </div>
      </div>

      {paymentModel === "monthly" && (
        <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Abonament lunar{monthKey ? ` · ${monthLabel(monthKey)}` : ""}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {confirmed.filter((p) => subscriptions[p.userId]).length} din{" "}
            {confirmed.length} confirmați au abonament activ pentru această lună.
          </p>
          {confirmed.length > 0 && (
            <ul className="mt-4 divide-y divide-border/60 border-t border-border/60">
              {confirmed.map((player) => {
                const subscribed = Boolean(subscriptions[player.userId]);
                return (
                  <li
                    key={player.userId}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {player.name}
                    </span>
                    {subscribed ? (
                      <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-foreground">
                        Abonat
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Fără abonament
                      </span>
                    )}
                    {canManage && monthKey && (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSubscription(
                            player.userId,
                            player.name,
                            !subscribed
                          )
                        }
                        className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        {subscribed ? "Anulează abonament" : "Abonează"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Abonamentul e global pe lună: acoperă toate jocurile seriei din luna
            respectivă.
          </p>
        </div>
      )}

      {paymentModel !== "monthly" && totalCost > 0 && (
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cost de plată
          </h3>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {payers.length > 0
                  ? formatLei(perPlayer)
                  : formatLei(totalCost)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {payers.length > 0
                  ? `de jucător (${payers.length} de plată)`
                  : "cost total — niciun jucător de plată"}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>
                Total teren:{" "}
                <span className="font-semibold text-foreground">
                  {formatLei(totalCost)}
                </span>
              </p>
              <p className="mt-0.5">
                Strâns:{" "}
                <span className="font-semibold text-primary">
                  {formatLei(collected)}
                </span>{" "}
                / {formatLei(perPlayer * payers.length)}
              </p>
            </div>
          </div>

          {confirmed.length > 0 && (
            <ul className="mt-4 divide-y divide-border/60 border-t border-border/60">
              {confirmed.map((player) => {
                const subscribed = Boolean(subscriptions[player.userId]);
                const paid = isPaid(payments, player.userId);
                return (
                  <li
                    key={player.userId}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {player.name}
                    </span>
                    {subscribed ? (
                      <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-foreground">
                        Abonament
                      </span>
                    ) : canManage ? (
                      <button
                        type="button"
                        onClick={() => handleTogglePaid(player.userId, !paid)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          paid
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {paid ? `Plătit · ${formatLei(perPlayer)}` : "Neplătit"}
                      </button>
                    ) : (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          paid
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {paid ? "Plătit" : `${formatLei(perPlayer)}`}
                      </span>
                    )}
                    {canManage && monthKey && (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSubscription(
                            player.userId,
                            player.name,
                            !subscribed
                          )
                        }
                        className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                        title={`Abonament ${monthLabel(monthKey)}`}
                      >
                        {subscribed ? "Anulează abonament" : "Abonează"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            {canManage
              ? `Bifează cine a plătit. Abonații lunii ${
                  monthKey ? monthLabel(monthKey) : ""
                } sunt acoperiți și excluși din împărțeală.`
              : "Suma per jucător se recalculează automat pe măsură ce se confirmă participanții."}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <RankedParticipantList
          title={`Confirmați (${confirmed.length}/${maxParticipants})`}
          participants={confirmed}
          className="border-primary/30 bg-primary/5"
          emptyMessage="Niciun jucător confirmat încă."
        />
        <RankedParticipantList
          title={`Listă de așteptare (${waitlist.length})`}
          participants={waitlist}
          className="border-accent/30 bg-accent/5"
          emptyMessage="Nimeni pe lista de așteptare."
        />
        <SimpleParticipantList
          title={MAYBE_CONFIG.groupTitle}
          count={maybe.length}
          participants={maybe}
          className={MAYBE_CONFIG.listClass}
        />
        <SimpleParticipantList
          title={NOT_GOING_CONFIG.groupTitle}
          count={notGoing.length}
          participants={notGoing}
          className={NOT_GOING_CONFIG.listClass}
        />
      </div>
    </section>
  );
}
