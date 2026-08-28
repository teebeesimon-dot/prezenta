"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import AttendanceSection from "@/components/AttendanceSection";
import DeleteEventButton from "@/components/DeleteEventButton";
import EventDashboardShell from "@/components/EventDashboardShell";
import OpenInGoogleMapsButton from "@/components/OpenInGoogleMapsButton";
import SeriesPanel from "@/components/SeriesPanel";
import ShareOnWhatsAppButton from "@/components/ShareOnWhatsAppButton";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import { formatEventDate, mapFirestoreEvent } from "@/lib/events";
import { getEventLocationName } from "@/lib/location";
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

  return (
    <EventDashboardShell event={event}>
      <section className="event-panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">{SPORT_LABELS[event.sport] ?? event.sport}</span>
                <h1 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{event.title}</h1>
              </div>
              {isFootball && <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">Etapa {stageNumber}</span>}
            </div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <Summary label="Data" value={formatEventDate(event.date)} />
              <Summary label="Ora" value={`${formatTimeRange(event.time, event.durationMinutes)}${event.durationMinutes ? ` (${formatDuration(event.durationMinutes)})` : ""}`} />
              <Summary label="Locație" value={getEventLocationName(event)} />
              <Summary label="Capacitate" value={`${event.maxParticipants} participanți`} />
              {registrationOpensAt && <Summary label="Deschidere înscrieri" value={formatRegistrationOpensAt(registrationOpensAt)} />}
              {event.paymentModel !== "monthly" && event.pricePerHour && <Summary label="Cost" value={`${formatLei(event.pricePerHour)}/oră · Total ${formatLei(computeTotalCost(event.pricePerHour, event.durationMinutes ?? 60))}`} />}
            </dl>
          </div>
          <div className="flex min-h-48 items-end bg-[linear-gradient(145deg,var(--muted),var(--card))] p-5 lg:border-l lg:border-border">
            <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Următorul meci</p><p className="mt-2 text-lg font-bold text-foreground">{formatEventDate(event.date)}</p><p className="mt-1 text-sm text-muted-foreground">{event.time} · {event.locationName || getEventLocationName(event)}</p></div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:flex-wrap">
          <ShareOnWhatsAppButton event={event} className="sm:flex-1" />
          <OpenInGoogleMapsButton event={event} className="sm:flex-1" />
          <button type="button" onClick={handleCopyLink} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted">{copied ? "Link copiat" : "Copiază linkul"}</button>
          {canManage && <Link href={`/event/${event.id}/edit`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15">Editează evenimentul</Link>}
          {canManage && !event.seriesId && <DeleteEventButton eventId={event.id} className="sm:flex-1" />}
        </div>
      </section>
      {event.seriesId && <SeriesPanel seriesId={event.seriesId} currentViewedEventId={event.id} isOwner={canManage} />}
      <AttendanceSection eventId={event.id} maxParticipants={event.maxParticipants} pricePerHour={event.pricePerHour} durationMinutes={event.durationMinutes} ownerId={event.ownerId} eventDate={event.date} eventTime={event.time} canManage={canManage} paymentModel={event.paymentModel} registrationLeadValue={event.registrationLeadValue} registrationLeadUnit={event.registrationLeadUnit} registrationOpenTime={event.registrationOpenTime} view="response-confirmed" />
    </EventDashboardShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold leading-6 text-foreground">{value}</dd></div>;
}
