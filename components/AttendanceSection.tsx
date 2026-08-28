"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import PlayerCard from "@/components/PlayerCard";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import type { PlayerCardData } from "@/lib/player-cards";
import {
  computeGoingLists,
  findUserGoingPosition,
  parseTimestamp,
} from "@/lib/going-list";
import { computePerPlayer, computeTotalCost, formatLei } from "@/lib/pricing";
import { isPaid, setAllPaymentStatuses, setPaymentStatus } from "@/lib/payments";
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
  view?: "all" | "response" | "lists" | "response-confirmed";
  /** FIFA-style player cards for the group, keyed by userId. */
  playerCards?: Record<string, PlayerCardData>;
  /** Opens the player card detail modal for a given user. */
  onOpenCard?: (userId: string) => void;
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
    a.name.localeCompare(b.name, "ro", { sensitivity: "base" }),
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

/** Tiny FIFA card thumbnail (clickable) with an avatar fallback. */
function PlayerCardThumb({
  card,
  name,
  photoURL,
  onOpen,
}: {
  card?: PlayerCardData;
  name: string;
  photoURL: string | null;
  onOpen?: () => void;
}) {
  if (card && onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Vezi cardul lui ${name}`}
        className="shrink-0 rounded-md transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <PlayerCard card={card} playerName={name} mini widthClass="w-12 sm:w-14" />
      </button>
    );
  }
  return <ParticipantAvatar name={name} photoURL={photoURL} />;
}

/** Position + overall sub-label derived from the player's card, if any. */
function positionOverall(card?: PlayerCardData): string | null {
  if (!card) return null;
  return `${card.position} · OVR ${card.overall}`;
}

function RankedParticipantList({
  title,
  participants,
  className,
  emptyMessage,
  playerCards,
  onOpenCard,
}: {
  title: string;
  participants: RankedParticipantEntry[];
  className: string;
  emptyMessage: string;
  playerCards?: Record<string, PlayerCardData>;
  onOpenCard?: (userId: string) => void;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {participants.map((participant) => {
            const card = playerCards?.[participant.userId];
            const sub = positionOverall(card);
            return (
              <li
                key={participant.userId}
                className="flex items-center gap-3 rounded-lg bg-card/70 px-3 py-2"
              >
                <span className="w-6 shrink-0 text-xs font-bold text-primary">
                  {participant.positionLabel}
                </span>
                <PlayerCardThumb
                  card={card}
                  name={participant.name}
                  photoURL={participant.photoURL}
                  onOpen={onOpenCard ? () => onOpenCard(participant.userId) : undefined}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {participant.name}
                  </span>
                  {sub ? (
                    <span className="block text-xs text-muted-foreground">{sub}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
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
  playerCards,
  onOpenCard,
}: {
  title: string;
  count: number;
  participants: ParticipantEntry[];
  className: string;
  playerCards?: Record<string, PlayerCardData>;
  onOpenCard?: (userId: string) => void;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({count})
      </h3>
      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nimeni încă.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {participants.map((participant) => {
            const card = playerCards?.[participant.userId];
            const sub = positionOverall(card);
            return (
              <li
                key={participant.userId}
                className="flex items-center gap-3 rounded-lg bg-card/70 px-3 py-2"
              >
                <PlayerCardThumb
                  card={card}
                  name={participant.name}
                  photoURL={participant.photoURL}
                  onOpen={onOpenCard ? () => onOpenCard(participant.userId) : undefined}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {participant.name}
                  </span>
                  {sub ? (
                    <span className="block text-xs text-muted-foreground">{sub}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
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
  view = "all",
  playerCards,
  onOpenCard,
}: AttendanceSectionProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [confirmed, setConfirmed] = useState<RankedParticipantEntry[]>([]);
  const [waitlist, setWaitlist] = useState<RankedParticipantEntry[]>([]);
  const [maybe, setMaybe] = useState<ParticipantEntry[]>([]);
  const [notGoing, setNotGoing] = useState<ParticipantEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus | null>(
    null,
  );
  const [userPosition, setUserPosition] =
    useState<RankedParticipantEntry | null>(null);
  const [submitting, setSubmitting] = useState<AttendanceStatus | null>(null);
  const [payments, setPayments] = useState<Record<string, boolean>>({});
  const [updatingPayments, setUpdatingPayments] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionMap>({});
  const [now, setNow] = useState(() => Date.now());
  const [confirmedExpanded, setConfirmedExpanded] = useState(
    view === "response-confirmed",
  );
  const showsResponse = view !== "lists";
  const showsConfirmed = view !== "response";
  const showsOtherLists = view === "all" || view === "lists";
  const inlineConfirmed = view === "response-confirmed";

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

  // Live monthly subscriptions for the event's month.
  useEffect(() => {
    if (!user || !monthKey) return;
    const unsubscribe = subscribeToMonthSubscriptions(
      monthKey,
      setSubscriptions,
    );
    return () => unsubscribe();
  }, [monthKey, user]);

  useEffect(() => {
    const q = query(
      collection(db, "responses"),
      where("eventId", "==", eventId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const goingInputs: {
          userId: string;
          name: string;
          photoURL: string | null;
          goingRegisteredAt: number;
        }[] = [];
        const maybeMap = new Map<string, ParticipantEntry>();
        const notGoingMap = new Map<string, ParticipantEntry>();
        const nextPayments: Record<string, boolean> = {};
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
            nextPayments[userId] = data.paid === true;
            goingInputs.push({
              userId,
              name: entry.name,
              photoURL: entry.photoURL,
              goingRegisteredAt: parseTimestamp(
                data.goingRegisteredAt ?? data.createdAt,
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
        setPayments(nextPayments);
        setWaitlist(lists.waitlist);
        setMaybe(sortByName(Array.from(maybeMap.values())));
        setNotGoing(sortByName(Array.from(notGoingMap.values())));
        setCurrentStatus(userStatus);
        setUserPosition(
          user && userStatus === "vin"
            ? findUserGoingPosition(user.uid, lists)
            : null,
        );
      },
      // Ignore transient permission errors fired before the auth token attaches;
      // the listener reconnects automatically once auth is ready.
      () => {},
    );

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
    await setPaymentStatus(eventId, userId, nextPaid);
  }

  async function handleBulkPayments(paid: boolean) {
    const message = paid
      ? "Marchezi toți participanții confirmați ca plătiți?"
      : "Resetezi plățile tuturor participanților confirmați?";
    if (!window.confirm(message)) return;

    setUpdatingPayments(true);
    try {
      await setAllPaymentStatuses(eventId, confirmed.map((player) => player.userId), paid);
    } finally {
      setUpdatingPayments(false);
    }
  }

  async function handleToggleSubscription(
    targetUserId: string,
    targetName: string,
    subscribed: boolean,
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
        status,
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
        <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">
          Prezență
        </h2>
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
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Prezență</h2>

      {showsResponse && (
        <div className="event-panel p-5">
          <p className="event-panel-title mb-4">Răspunsul tău</p>
          <div className="mb-4 flex items-center gap-3">
            <ParticipantAvatar
              name={user.displayName ?? "User"}
              photoURL={user.photoURL}
            />
            <div>
              <p className="font-medium text-card-foreground">
                {user.displayName}
              </p>
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
                  ? "ring-2 ring-offset-2 ring-offset-card ring-ring " +
                    VIN_BUTTON_CLASS
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
                  ? "ring-2 ring-offset-2 ring-offset-card ring-ring " +
                    MAYBE_CONFIG.buttonClass
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
                  ? "ring-2 ring-offset-2 ring-offset-card ring-ring " +
                    NOT_GOING_CONFIG.buttonClass
                  : NOT_GOING_CONFIG.buttonClass
              }`}
            >
              {submitting === "nu_vin" ? "..." : NOT_GOING_CONFIG.label}
            </button>
          </div>
        </div>
      )}

      {showsConfirmed && (
        <div className="flex flex-col gap-4">
          <div className="event-panel p-4 sm:p-5">
            <button
              type="button"
              onClick={inlineConfirmed ? undefined : () => setConfirmedExpanded((value) => !value)}
              aria-expanded={confirmedExpanded}
              className={`flex w-full flex-wrap items-start justify-between gap-3 text-left ${inlineConfirmed ? "cursor-default" : ""}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {!inlineConfirmed && (
                  <ChevronIcon
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      confirmedExpanded ? "rotate-180" : ""
                    }`}
                  />
                )}
                {inlineConfirmed ? "Cine vine" : "Confirmați"} ({confirmed.length}/{maxParticipants})
              </span>

              {paymentModel === "monthly" ? (
                <p className="text-right text-sm text-muted-foreground">
                  {confirmed.filter((p) => subscriptions[p.userId]).length} din{" "}
                  {confirmed.length} au abonament
                  {monthKey ? ` · ${monthLabel(monthKey)}` : ""}
                </p>
              ) : totalCost > 0 ? (
                <div className="text-right text-sm text-muted-foreground">
                  <p className="text-lg font-extrabold tracking-tight text-foreground">
                    {payers.length > 0
                      ? formatLei(perPlayer)
                      : formatLei(totalCost)}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      {payers.length > 0 ? "/ jucător" : "cost total"}
                    </span>
                  </p>
                  <p className="mt-0.5">
                    Strâns:{" "}
                    <span className="font-semibold text-primary">
                      {formatLei(collected)}
                    </span>{" "}
                    / {formatLei(perPlayer * payers.length)} · Teren{" "}
                    {formatLei(totalCost)}
                  </p>
                </div>
              ) : null}
            </button>

            {paymentModel === "per_game" && totalCost > 0 && (
              <div className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>{confirmed.length} confirmați <span className="mx-2">|</span> {paidCount} plătiți <span className="mx-2">|</span> {Math.max(0, payers.length - paidCount)} neplătiți</p>
                  <p className="mt-1">Încasat: <span className="font-semibold text-primary">{formatLei(collected)}</span> / {formatLei(totalCost)}</p>
                </div>
                {canManage && confirmed.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={updatingPayments} onClick={() => handleBulkPayments(true)} className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50">Marchează toți ca plătiți</button>
                    <button type="button" disabled={updatingPayments} onClick={() => handleBulkPayments(false)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50">Resetează plățile</button>
                  </div>
                )}
              </div>
            )}

            {!confirmedExpanded ? (
              <p className="mt-3 text-sm font-medium text-primary">
                Vezi lista jucătorilor confirmați
              </p>
            ) : confirmed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Niciun jucător confirmat încă.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {confirmed.map((player) => {
                  const subscribed = Boolean(subscriptions[player.userId]);
                  const paid = isPaid(payments, player.userId);
                  const card = playerCards?.[player.userId];
                  const sub = positionOverall(card);
                  return (
                    <li
                      key={player.userId}
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-2.5"
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-bold text-primary">
                        {player.positionLabel}
                      </span>
                      <PlayerCardThumb
                        card={card}
                        name={player.name}
                        photoURL={player.photoURL}
                        onOpen={onOpenCard ? () => onOpenCard(player.userId) : undefined}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {player.name}
                        </span>
                        {sub ? (
                          <span className="text-xs text-muted-foreground">{sub}</span>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            Confirmat
                          </span>
                        {paymentModel === "monthly" ? (
                          subscribed ? (
                            <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-foreground">
                              Abonat
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              Fără abonament
                            </span>
                          )
                        ) : subscribed ? (
                          <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-foreground">
                            Abonament
                          </span>
                        ) : totalCost > 0 ? (
                          canManage ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleTogglePaid(player.userId, !paid)
                              }
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                paid
                                  ? "bg-primary text-primary-foreground"
                                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >
                      {paid ? "Plătită" : "Neplătit"}

                            </button>
                          ) : (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                paid
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {paid ? "Plătită" : "Neplătit"}
                            </span>
                          )
                        ) : null}

                        {canManage && monthKey && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleSubscription(
                                player.userId,
                                player.name,
                                !subscribed,
                              )
                            }
                            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                            title={`Abonament ${monthKey ? monthLabel(monthKey) : ""}`}
                          >
                            {subscribed ? "Anulează abonament" : "Abonează"}
                          </button>
                        )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {confirmedExpanded && (
              <p className="mt-3 text-xs text-muted-foreground">
                {paymentModel === "monthly"
                  ? "Abonamentul e global pe lună: acoperă toate jocurile seriei din luna respectivă."
                  : canManage
                    ? `Bifează cine a plătit. Abonații lunii ${
                        monthKey ? monthLabel(monthKey) : ""
                      } sunt acoperiți și excluși din împărțeală.`
                    : "Suma per jucător se recalculează automat pe măsură ce se confirmă participanții."}
              </p>
            )}
          </div>

          {showsOtherLists && (
            <>
              <RankedParticipantList
                title={`Listă de așteptare (${waitlist.length})`}
                participants={waitlist}
                className="border-accent/30 bg-accent/5"
                emptyMessage="Nimeni pe lista de așteptare."
                playerCards={playerCards}
                onOpenCard={onOpenCard}
              />
              <SimpleParticipantList
                title={MAYBE_CONFIG.groupTitle}
                count={maybe.length}
                participants={maybe}
                className={MAYBE_CONFIG.listClass}
                playerCards={playerCards}
                onOpenCard={onOpenCard}
              />
              <SimpleParticipantList
                title={NOT_GOING_CONFIG.groupTitle}
                count={notGoing.length}
                participants={notGoing}
                className={NOT_GOING_CONFIG.listClass}
                playerCards={playerCards}
                onOpenCard={onOpenCard}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
