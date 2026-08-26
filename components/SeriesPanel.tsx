"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { formatEventDateShort } from "@/lib/events";
import {
  getHistoricalSeriesEvents,
  mergeSeriesOccurrences,
  type HistoricalSeriesEvent,
} from "@/lib/historical-series-events";
import { formatLei } from "@/lib/pricing";
import { RECURRENCE_OPTIONS, todayISO } from "@/lib/recurrence";
import {
  closeSeries,
  deleteSeriesCompletely,
  getSeriesHistory,
  mapFirestoreSeries,
  reopenSeries,
} from "@/lib/series";
import type { Event, Series } from "@/lib/types";

interface SeriesPanelProps {
  seriesId: string;
  /** The occurrence currently being viewed. */
  currentViewedEventId: string;
  isOwner: boolean;
}

type SeriesOccurrence =
  | { kind: "live"; event: Event }
  | { kind: "archived"; event: HistoricalSeriesEvent };

function compactDate(date: string): string {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${date}T12:00:00`))
    .replace(".", "")
    .toLocaleUpperCase("ro-RO");
}

function frequencyLabel(frequency: Series["frequency"]): string {
  return (
    RECURRENCE_OPTIONS.find((o) => o.value === frequency)?.label ?? "Recurent"
  );
}

export default function SeriesPanel({
  seriesId,
  currentViewedEventId: _currentViewedEventId,
  isOwner,
}: SeriesPanelProps) {
  const router = useRouter();
  const [series, setSeries] = useState<Series | null>(null);
  const [history, setHistory] = useState<Event[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [selectedHistoricalEventId, setSelectedHistoricalEventId] =
    useState("");
  const [showHistoricalView, setShowHistoricalView] = useState(false);

  // Live series doc (status, endDate, monthlyPrice, current occurrence).
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "series", seriesId),
      (snap) => {
        if (snap.exists()) setSeries(mapFirestoreSeries(snap.id, snap.data()));
        else setSeries(null);
      },
      () => setSeries(null),
    );
    return () => unsub();
  }, [seriesId]);

  // Refresh history whenever the series' current occurrence changes.
  useEffect(() => {
    if (!series?.ownerId) return;
    let active = true;
    getSeriesHistory(seriesId, series.ownerId)
      .then((list) => {
        if (active) setHistory(list);
      })
      .catch(() => {
        if (active) setHistory([]);
      });
    return () => {
      active = false;
    };
  }, [seriesId, series?.ownerId, series?.currentEventId]);

  if (!series) return null;

  const today = todayISO();
  const isClosed = series.status === "closed";
  const occurrences: SeriesOccurrence[] = mergeSeriesOccurrences(
    getHistoricalSeriesEvents(seriesId, series.title),
    history,
  );
  const historicalEvents = occurrences.flatMap((occurrence) =>
    occurrence.kind === "archived" ? [occurrence.event] : [],
  );
  const selectedHistoricalEvent = historicalEvents.find(
    (event) => event.eventId === selectedHistoricalEventId,
  );

  async function handleClose() {
    if (!series) return;
    setBusy(true);
    try {
      await closeSeries(series.id, series.currentOccurrenceDate || todayISO());
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!series) return;
    setBusy(true);
    try {
      await reopenSeries(series.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!series) return;
    setBusy(true);
    try {
      await deleteSeriesCompletely(series.id, series.ownerId);
      router.push("/");
    } catch {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  if (showHistoricalView && selectedHistoricalEvent) {
    const fullDate = new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(new Date(`${selectedHistoricalEvent.date}T12:00:00`))
      .replace(".", "")
      .toLocaleUpperCase("ro-RO");

    return (
      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <button
          type="button"
          onClick={() => setShowHistoricalView(false)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-card-foreground transition hover:bg-muted"
        >
          ← Înapoi la serie
        </button>

        <div className="mt-6 flex flex-col gap-3">
          <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Istoric
          </span>
          <div>
            <h2 className="text-balance text-2xl font-bold text-card-foreground">
              {selectedHistoricalEvent.title}
            </h2>
            <p className="mt-1 font-mono text-sm font-bold text-primary">
              {fullDate}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Detalii meci
          </h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Data</dt>
              <dd className="font-semibold text-foreground">{fullDate}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Titlu</dt>
              <dd className="font-semibold text-foreground">
                {selectedHistoricalEvent.title}
              </dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
              <dt className="text-muted-foreground">Event ID</dt>
              <dd className="break-all font-mono text-xs font-semibold text-foreground">
                {selectedHistoricalEvent.eventId}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-4 rounded-xl border border-border bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
          Detaliile acestui meci nu mai sunt disponibile deoarece datele
          istorice nu mai există în baza de date.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Serie · {frequencyLabel(series.frequency)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {series.paymentModel === "monthly"
              ? "Abonament lunar"
              : "Plată pe joc"}
          </span>
          {isClosed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Încheiată
            </span>
          )}
        </div>

        {isOwner &&
          (isClosed ? (
            <button
              type="button"
              onClick={handleReopen}
              disabled={busy}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-card-foreground transition hover:bg-muted disabled:opacity-60"
            >
              Redeschide seria
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-60"
            >
              Închide seria
            </button>
          ))}
      </div>

      {series.paymentModel === "monthly" && (
        <p className="mt-4 text-sm text-muted-foreground">
          Abonament lunar:{" "}
          <span className="font-semibold text-card-foreground">
            {series.monthlyPrice
              ? formatLei(series.monthlyPrice)
              : "nestabilit"}
          </span>{" "}
          / jucător
        </p>
      )}

      {isClosed && series.endDate && (
        <p className="mt-3 text-sm text-muted-foreground">
          Serie încheiată după {formatEventDateShort(series.endDate)}. Istoricul
          rămâne disponibil mai jos.
        </p>
      )}

      <div className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Istoric meciuri
        </h2>
        <label htmlFor="historical-match" className="sr-only">
          Selectează un meci istoric
        </label>
        <select
          id="historical-match"
          value={selectedHistoricalEventId}
          onChange={(event) => {
            const eventId = event.target.value;
            setSelectedHistoricalEventId(eventId);
            if (eventId) setShowHistoricalView(true);
          }}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground"
        >
          <option value="">Selectează un meci istoric</option>
          {historicalEvents.map((event) => (
            <option key={event.eventId} value={event.eventId}>
              {compactDate(event.date)} - {event.title}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Meciurile istorice pot fi consultate, dar detaliile lor nu mai sunt
          disponibile.
        </p>
      </div>

      {isOwner && (
        <div className="mt-6 border-t border-border pt-5">
          {confirmingDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">
                Sigur ștergi toată seria? Se vor șterge definitiv toate
                aparițiile ({history.length}), inclusiv cele din istoric.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Se șterge..." : "Da, șterge seria"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted disabled:opacity-60"
                >
                  Anulează
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
            >
              Șterge seria definitiv
            </button>
          )}
        </div>
      )}
    </section>
  );
}
