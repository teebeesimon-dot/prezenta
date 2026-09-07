"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { mapFirestoreSeries } from "@/lib/series";
import { occurrenceIndex } from "@/lib/recurrence";
import type { Event, Series } from "@/lib/types";

/**
 * Resolves the stage (1-based occurrence number) for a series event.
 *
 * A persisted `seriesIndex` always wins. When it is missing (older occurrences
 * materialized before we started storing it), the stage is derived
 * deterministically from the parent series grid so every occurrence keeps a
 * stable, distinct number. Standalone events fall back to 1.
 */
export function resolveOccurrenceStage(
  event: Pick<Event, "seriesIndex" | "occurrenceDate" | "date">,
  series: Pick<Series, "startDate" | "frequency"> | null | undefined
): number {
  if (typeof event.seriesIndex === "number" && event.seriesIndex > 0)
    return event.seriesIndex;
  if (series?.startDate) {
    const index = occurrenceIndex(
      series.startDate,
      series.frequency,
      event.occurrenceDate ?? event.date
    );
    if (index > 0) return index;
  }
  return 1;
}

/**
 * Subscribes to the parent series (when the event belongs to one) and returns
 * the deterministic stage number for the viewed occurrence. This keeps
 * matches, awards, team-of-the-week and player cards scoped to the occurrence
 * being viewed rather than defaulting every occurrence to "Etapa 1".
 */
export function useEventStage(event: Event | null): number {
  const [series, setSeries] = useState<Series | null>(null);
  const seriesId = event?.seriesId;

  useEffect(() => {
    if (!seriesId) {
      setSeries(null);
      return;
    }
    return onSnapshot(
      doc(db, "series", seriesId),
      (snapshot) =>
        setSeries(
          snapshot.exists()
            ? mapFirestoreSeries(snapshot.id, snapshot.data())
            : null
        ),
      () => setSeries(null)
    );
  }, [seriesId]);

  if (!event) return 1;
  return resolveOccurrenceStage(event, series);
}
