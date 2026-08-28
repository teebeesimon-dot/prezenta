"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import AttendanceSection from "@/components/AttendanceSection";
import DeleteEventButton from "@/components/DeleteEventButton";
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm font-medium text-primary transition hover:text-primary-hover"
      >
        ← Înapoi
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 break-words text-2xl font-extrabold tracking-tight text-card-foreground sm:text-3xl">
            {event.title}
          </h1>
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {SPORT_LABELS[event.sport] ?? event.sport}
          </span>
        </div>

        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sport
            </dt>
            <dd className="mt-1 text-card-foreground">
              {SPORT_LABELS[event.sport] ?? event.sport}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Data
            </dt>
            <dd className="mt-1 text-card-foreground">
              {formatEventDate(event.date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Interval
            </dt>
            <dd className="mt-1 text-card-foreground">
              {formatTimeRange(event.time, event.durationMinutes)}
              {event.durationMinutes ? (
                <span className="text-muted-foreground">
                  {" "}
                  ({formatDuration(event.durationMinutes)})
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Locație
            </dt>
            <dd className="mt-1 break-words text-card-foreground">
              {getEventLocationName(event)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Participanți maximi
            </dt>
            <dd className="mt-1 text-card-foreground">
              {event.maxParticipants}
            </dd>
          </div>
          {registrationOpensAt ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Deschidere înscrieri
              </dt>
              <dd className="mt-1 text-card-foreground">
                {formatRegistrationOpensAt(registrationOpensAt)}
              </dd>
            </div>
          ) : null}
          {event.paymentModel !== "monthly" && event.pricePerHour ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cost teren
              </dt>
              <dd className="mt-1 text-card-foreground">
                {formatLei(event.pricePerHour)}/oră
                {event.durationMinutes ? (
                  <span className="text-muted-foreground">
                    {" — total "}
                    <span className="font-semibold text-card-foreground">
                      {formatLei(
                        computeTotalCost(
                          event.pricePerHour,
                          event.durationMinutes,
                        ),
                      )}
                    </span>
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 border-t border-border pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ShareOnWhatsAppButton event={event} className="w-full sm:w-auto" />
            <OpenInGoogleMapsButton
              event={event}
              className="w-full sm:w-auto"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-card-foreground transition hover:bg-muted active:scale-[0.98] sm:w-auto"
            >
              Copiază linkul evenimentului
            </button>
            {canManage && (
              <Link
                href={`/event/${event.id}/edit`}
                className="inline-flex w-full items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20 active:scale-[0.98] sm:w-auto"
              >
                Editează evenimentul
              </Link>
            )}
            {canManage && !event.seriesId && (
              <DeleteEventButton
                eventId={event.id}
                className="w-full sm:w-auto"
              />
            )}
          </div>
          {copied && (
            <p className="mt-3 text-sm font-medium text-primary">
              Link copiat!
            </p>
          )}
        </div>
      </div>

      <nav
        aria-label="Secțiuni eveniment"
        className="mt-6 flex flex-wrap gap-2"
      >
        {[
          ["group", "Grup"],
          ["teams", "Echipe"],
          ...(isFootball ? [["cards", "Player Cards"]] : []),
        ].map(([path, label]) => (
          <Link
            key={path}
            href={`/event/${event.id}/${path}`}
            className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-card-foreground shadow-sm transition hover:border-primary/40 hover:text-primary active:scale-[0.98]"
          >
            {label}
          </Link>
        ))}
      </nav>

      {event.seriesId && (
        <SeriesPanel
          seriesId={event.seriesId}
          currentViewedEventId={event.id}
          isOwner={canManage}
        />
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
      />

      {isFootball && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Etapa {stageNumber}
        </p>
      )}
    </div>
  );
}
