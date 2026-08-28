"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import AttendanceSection from "@/components/AttendanceSection";
import DeleteEventButton from "@/components/DeleteEventButton";
import EventDashboardShell from "@/components/EventDashboardShell";
import EventHeroImage from "@/components/EventHeroImage";
import EventWeatherPanel from "@/components/EventWeatherPanel";
import OpenInGoogleMapsButton from "@/components/OpenInGoogleMapsButton";
import PlayerCardModal from "@/components/PlayerCardModal";
import SeriesPanel from "@/components/SeriesPanel";
import ShareOnWhatsAppButton from "@/components/ShareOnWhatsAppButton";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import { formatEventDate, mapFirestoreEvent } from "@/lib/events";
import { getEventLocationName } from "@/lib/location";
import { getPlayerCards, type PlayerCardData } from "@/lib/player-cards";
import {
  computeRegistrationOpensAt,
  formatRegistrationOpensAt,
} from "@/lib/registration";
import { SPORT_LABELS } from "@/lib/labels";
import {
  computeTotalCost,
  formatDuration,
  formatLei,
  formatTimeRange,
} from "@/lib/pricing";
import type { Event } from "@/lib/types";

interface EventPageClientProps {
  id: string;
}

export default function EventPageClient({ id }: EventPageClientProps) {
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [playerCards, setPlayerCards] = useState<Record<string, PlayerCardData>>({});
  const [selectedCardUserId, setSelectedCardUserId] = useState<string | null>(null);

  useEffect(() => {
    // Wait for the initial auth state to resolve before reading the event.
    // Reading while signed out (e.g. right after a Google redirect that
    // hasn't finished yet) is denied by Firestore rules and would otherwise
    // get stuck showing "Eveniment negăsit" forever, since this effect only
    // re-runs when `id` or `user` change.
    if (authLoading) {
      return;
    }

    if (!user) {
      // Not signed in: don't attempt the read (it would be denied), just
      // show the sign-in state via the "not found"/login UI below.
      setEvent(null);
      setPermissionDenied(false);
      setLoaded(true);
      return;
    }

    setLoaded(false);
    const unsubscribe = onSnapshot(
      doc(db, "events", id),
      (snapshot) => {
        setPermissionDenied(false);
        if (snapshot.exists()) {
          setEvent(mapFirestoreEvent(snapshot.id, snapshot.data()));
        } else {
          setEvent(null);
        }
        setLoaded(true);
      },
      (error) => {
        // permission-denied can happen transiently right after sign-in while
        // the auth token hasn't propagated to Firestore yet. Surface it
        // distinctly so we don't tell the user the event doesn't exist.
        setPermissionDenied(
          (error as { code?: string })?.code === "permission-denied",
        );
        setEvent(null);
        setLoaded(true);
      },
    );

    return () => unsubscribe();
  }, [id, user, authLoading]);

  // Load the group's player cards so confirmed players can show FIFA-style
  // thumbnails and open a detail card. Group id is the series (persistent
  // roster) when present, otherwise the standalone event.
  const groupId = event?.seriesId ?? event?.id ?? null;
  useEffect(() => {
    if (!user || !groupId) return;
    let active = true;
    getPlayerCards(groupId)
      .then((cards) => {
        if (!active) return;
        const map: Record<string, PlayerCardData> = {};
        cards.forEach((card) => {
          map[card.userId] = card;
        });
        setPlayerCards(map);
      })
      .catch(() => {
        if (active) setPlayerCards({});
      });
    return () => {
      active = false;
    };
  }, [user, groupId]);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (!loaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Se încarcă...</p>
      </div>
    );
  }

  if (!event && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Autentificare necesară
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conectează-te cu Google (butonul din header) pentru a vedea acest
          eveniment.
        </p>
      </div>
    );
  }

  if (!event && permissionDenied) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Se finalizează autentificarea...
        </h1>
        <p className="mt-2 text-muted-foreground">
          Reîncarcă pagina în câteva secunde dacă evenimentul nu apare.
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Eveniment negăsit
        </h1>
        <p className="mt-2 text-muted-foreground">
          Acest eveniment nu există sau a fost șters.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
        >
          Înapoi acasă
        </Link>
      </div>
    );
  }

  const canManage = user?.uid === event.ownerId || isSuperAdmin;
  const registrationOpensAt = computeRegistrationOpensAt({
    date: event.date,
    time: event.time,
    registrationLeadValue: event.registrationLeadValue,
    registrationLeadUnit: event.registrationLeadUnit,
    registrationOpenTime: event.registrationOpenTime,
  });
  const isFootball = event.sport === "football";
  const stageNumber = event.seriesIndex ?? 1;
  const timeValue = `${formatTimeRange(event.time, event.durationMinutes)}${
    event.durationMinutes ? ` (${formatDuration(event.durationMinutes)})` : ""
  }`;
  const selectedCard = selectedCardUserId ? playerCards[selectedCardUserId] : null;

  return (
    <EventDashboardShell event={event}>
      <section className="event-panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
          <EventHeroImage
            event={event}
            canManage={canManage}
            className="min-h-52 rounded-none border-0 lg:min-h-full"
          />
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                  {SPORT_LABELS[event.sport] ?? event.sport}
                </span>
                <h1 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  {event.title}
                </h1>
              </div>
              {isFootball && (
                <span className="shrink-0 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Etapa {stageNumber}
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <dl className="grid min-w-0 flex-1 gap-3 text-sm sm:grid-cols-2">
                <MetaRow icon={<CalendarIcon />} value={formatEventDate(event.date)} />
                <MetaRow icon={<ClockIcon />} value={timeValue} />
                <MetaRow icon={<PinIcon />} value={getEventLocationName(event)} />
                <MetaRow icon={<UsersIcon />} value={`${event.maxParticipants} participanți`} />
                {event.paymentModel !== "monthly" && event.pricePerHour && (
                  <MetaRow
                    icon={<MoneyIcon />}
                    value={`${formatLei(event.pricePerHour)}/oră · Total ${formatLei(
                      computeTotalCost(event.pricePerHour, event.durationMinutes ?? 60),
                    )}`}
                  />
                )}
                {registrationOpensAt && (
                  <MetaRow icon={<LockIcon />} value={`Înscrieri: ${formatRegistrationOpensAt(registrationOpensAt)}`} />
                )}
              </dl>
              <div className="lg:w-56 lg:shrink-0">
                <EventWeatherPanel
                  latitude={event.latitude}
                  longitude={event.longitude}
                  eventDate={event.date}
                  eventTime={event.time}
                  variant="inline"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:flex-wrap">
          <ShareOnWhatsAppButton event={event} className="sm:flex-1" />
          <OpenInGoogleMapsButton event={event} className="sm:flex-1" />
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            {copied ? "Link copiat" : "Copiază linkul"}
          </button>
          {canManage && (
            <Link
              href={`/event/${event.id}/edit`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15"
            >
              Editează evenimentul
            </Link>
          )}
          {canManage && !event.seriesId && (
            <DeleteEventButton eventId={event.id} className="sm:flex-1" />
          )}
        </div>
      </section>
      {event.seriesId && (
        <SeriesPanel seriesId={event.seriesId} currentViewedEventId={event.id} isOwner={canManage} />
      )}
      <AttendanceSection
        eventId={event.id}
        maxParticipants={event.maxParticipants}
        pricePerHour={event.pricePerHour}
        durationMinutes={event.durationMinutes}
        ownerId={event.ownerId}
        eventDate={event.date}
        eventTime={event.time}
        canManage={canManage}
        paymentModel={event.paymentModel}
        registrationLeadValue={event.registrationLeadValue}
        registrationLeadUnit={event.registrationLeadUnit}
        registrationOpenTime={event.registrationOpenTime}
        view="response-confirmed"
        playerCards={playerCards}
        onOpenCard={(userId) => setSelectedCardUserId(userId)}
      />
      {selectedCard && (
        <PlayerCardModal
          card={selectedCard}
          playerName={selectedCard.playerName?.trim() || "Jucător"}
          onClose={() => setSelectedCardUserId(null)}
        />
      )}
    </EventDashboardShell>
  );
}

function MetaRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 break-words font-medium leading-5 text-foreground">{value}</span>
    </div>
  );
}

const iconProps = {
  className: "h-4 w-4",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function MoneyIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
