import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EventLocation } from "@/lib/location";
import { toFirestoreLocation } from "@/lib/location";
import {
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
  todayISO,
  type RecurrenceFrequency,
} from "@/lib/recurrence";
import { mapFirestoreEvent } from "@/lib/events";
import type { Event, PaymentModel, Series, Sport } from "@/lib/types";

export function mapFirestoreSeries(
  id: string,
  data: Record<string, unknown>
): Series {
  return {
    id,
    title: (data.title as string) ?? "",
    sport: (data.sport as Sport) ?? "football",
    time: (data.time as string) ?? "",
    durationMinutes: (data.durationMinutes as number) ?? undefined,
    maxParticipants: (data.maxParticipants as number) ?? 0,
    footballFormat: data.footballFormat as Series["footballFormat"],
    location:
      (data.locationName as string) ?? (data.location as string) ?? "",
    placeId: (data.placeId as string) ?? undefined,
    locationName: (data.locationName as string) ?? undefined,
    latitude: (data.latitude as number) ?? undefined,
    longitude: (data.longitude as number) ?? undefined,
    ownerId: (data.ownerId as string) ?? "",
    frequency: (data.frequency as RecurrenceFrequency) ?? "weekly",
    startDate: (data.startDate as string) ?? "",
    endDate: (data.endDate as string | null) ?? null,
    status: (data.status as Series["status"]) ?? "active",
    paymentModel: (data.paymentModel as PaymentModel) ?? "per_game",
    pricePerHour: (data.pricePerHour as number) ?? undefined,
    monthlyPrice: (data.monthlyPrice as number) ?? undefined,
    groupSize: (data.groupSize as number) ?? undefined,
    currentEventId: (data.currentEventId as string) ?? "",
    currentOccurrenceDate: (data.currentOccurrenceDate as string) ?? "",
    createdAt: data.createdAt,
  };
}

interface CreateSeriesInput {
  title: string;
  sport: Sport;
  time: string;
  durationMinutes: number;
  maxParticipants: number;
  footballFormat?: Series["footballFormat"];
  location: EventLocation;
  ownerId: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string | null;
  paymentModel: PaymentModel;
  pricePerHour?: number;
  monthlyPrice?: number;
  groupSize?: number;
}

/** Builds the `events` occurrence document payload for a given date. */
function buildOccurrenceData(
  series: {
    title: string;
    sport: Sport;
    time: string;
    durationMinutes: number;
    maxParticipants: number;
    ownerId: string;
    paymentModel: PaymentModel;
    footballFormat?: Series["footballFormat"];
    pricePerHour?: number;
  },
  location: ReturnType<typeof toFirestoreLocation>,
  seriesId: string,
  occurrenceDate: string
): Record<string, unknown> {
  return {
    title: series.title,
    sport: series.sport,
    time: series.time,
    durationMinutes: series.durationMinutes,
    maxParticipants: series.maxParticipants,
    ...(series.footballFormat ? { footballFormat: series.footballFormat } : {}),
    ownerId: series.ownerId,
    paymentModel: series.paymentModel,
    // Price snapshot at materialization time (history keeps its own price).
    ...(series.paymentModel === "per_game" && series.pricePerHour
      ? { pricePerHour: series.pricePerHour }
      : {}),
    date: occurrenceDate,
    occurrenceDate,
    seriesId,
    createdAt: Timestamp.now(),
    ...location,
  };
}

/**
 * Creates a series + materializes its first upcoming occurrence in one batch.
 * Returns the new occurrence event id (where the user should land).
 */
export async function createSeries(input: CreateSeriesInput): Promise<string> {
  const seriesRef = doc(collection(db, "series"));
  const eventRef = doc(collection(db, "events"));
  const location = toFirestoreLocation(input.location);

  const firstOccurrence = nextOccurrenceOnOrAfter(
    input.startDate,
    input.frequency,
    input.startDate
  );

  const batch = writeBatch(db);

  batch.set(eventRef, {
    ...buildOccurrenceData(
      {
        title: input.title,
        sport: input.sport,
        time: input.time,
        durationMinutes: input.durationMinutes,
        maxParticipants: input.maxParticipants,
        ownerId: input.ownerId,
        paymentModel: input.paymentModel,
        footballFormat: input.footballFormat,
        pricePerHour: input.pricePerHour,
      },
      location,
      seriesRef.id,
      firstOccurrence
    ),
  });

  batch.set(seriesRef, {
    title: input.title,
    sport: input.sport,
    time: input.time,
    durationMinutes: input.durationMinutes,
    maxParticipants: input.maxParticipants,
    ...(input.footballFormat ? { footballFormat: input.footballFormat } : {}),
    ownerId: input.ownerId,
    frequency: input.frequency,
    startDate: input.startDate,
    endDate: input.endDate,
    status: "active",
    paymentModel: input.paymentModel,
    ...(input.pricePerHour ? { pricePerHour: input.pricePerHour } : {}),
    ...(input.monthlyPrice ? { monthlyPrice: input.monthlyPrice } : {}),
    ...(input.groupSize ? { groupSize: input.groupSize } : {}),
    currentEventId: eventRef.id,
    currentOccurrenceDate: firstOccurrence,
    ...location,
    createdAt: Timestamp.now(),
  });

  await batch.commit();
  return eventRef.id;
}

/**
 * Advances an open series to its next occurrence when the current one is in the
 * past. Only the owner can write (guarded by caller). Returns the (possibly
 * unchanged) current event id. Past occurrences remain as history.
 */
export async function ensureCurrentOccurrence(
  series: Series,
  currentUid: string | undefined
): Promise<string> {
  if (series.status !== "active") return series.currentEventId;
  if (series.ownerId !== currentUid) return series.currentEventId;

  const today = todayISO();
  // Current occurrence still upcoming (today or later) → nothing to do.
  if (series.currentOccurrenceDate >= today) return series.currentEventId;

  const nextDate = nextOccurrenceAfter(
    series.currentOccurrenceDate,
    series.frequency
  );
  if (!nextDate) return series.currentEventId;

  // Respect end date: if the next occurrence is past the end, close the series.
  if (series.endDate && nextDate > series.endDate) {
    await updateDoc(doc(db, "series", series.id), { status: "closed" });
    return series.currentEventId;
  }

  const eventRef = doc(collection(db, "events"));
  const location = toFirestoreLocation({
    placeId: series.placeId ?? "",
    locationName: series.locationName ?? series.location,
    latitude: series.latitude ?? 0,
    longitude: series.longitude ?? 0,
  });

  const batch = writeBatch(db);
  batch.set(eventRef, {
    ...buildOccurrenceData(
      {
        title: series.title,
        sport: series.sport,
        time: series.time,
        durationMinutes: series.durationMinutes ?? 0,
        maxParticipants: series.maxParticipants,
        ownerId: series.ownerId,
        paymentModel: series.paymentModel,
        footballFormat: series.footballFormat,
        pricePerHour: series.pricePerHour,
      },
      location,
      series.id,
      nextDate
    ),
  });
  batch.update(doc(db, "series", series.id), {
    currentEventId: eventRef.id,
    currentOccurrenceDate: nextDate,
  });
  await batch.commit();
  return eventRef.id;
}

/** Subscribe to all active series owned by the given user. */
export function subscribeOwnerSeries(
  uid: string | undefined,
  onChange: (series: Series[]) => void
): () => void {
  if (!uid) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "series"), where("ownerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapFirestoreSeries(d.id, d.data()));
      onChange(list);
    },
    () => onChange([])
  );
}

/** One-time fetch of a single series. */
export async function getSeries(seriesId: string): Promise<Series | null> {
  const snap = await getDoc(doc(db, "series", seriesId));
  if (!snap.exists()) return null;
  return mapFirestoreSeries(snap.id, snap.data());
}

/**
 * Fetches all occurrences (events) of a series, newest first.
 * Includes the ownerId filter so it satisfies the events `list` security rule
 * (which requires queries to be scoped to the requesting owner).
 */
export async function getSeriesHistory(
  seriesId: string,
  ownerId: string
): Promise<Event[]> {
  const q = query(
    collection(db, "events"),
    where("ownerId", "==", ownerId),
    where("seriesId", "==", seriesId)
  );
  const snap = await getDocs(q);
  const events = snap.docs.map((d) => mapFirestoreEvent(d.id, d.data()));
  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Updates the price either for the whole series ("from now on") or just the
 * current occurrence event.
 */
export async function updateSeriesPrice(params: {
  seriesId: string;
  currentEventId: string;
  paymentModel: PaymentModel;
  newPrice: number;
  scope: "series" | "occurrence";
}): Promise<void> {
  const { seriesId, currentEventId, paymentModel, newPrice, scope } = params;
  if (paymentModel === "monthly") {
    // Monthly price lives only on the series.
    await updateDoc(doc(db, "series", seriesId), { monthlyPrice: newPrice });
    return;
  }
  if (scope === "series") {
    await updateDoc(doc(db, "series", seriesId), { pricePerHour: newPrice });
    // Also apply to the current (upcoming) occurrence.
    await updateDoc(doc(db, "events", currentEventId), {
      pricePerHour: newPrice,
    });
  } else {
    await updateDoc(doc(db, "events", currentEventId), {
      pricePerHour: newPrice,
    });
  }
}

/** Closes a series (sets an end date and marks it closed). History remains. */
export async function closeSeries(
  seriesId: string,
  endDate: string
): Promise<void> {
  await updateDoc(doc(db, "series", seriesId), {
    status: "closed",
    endDate,
  });
}

/** Reopens a closed series (clears end date, marks active). */
export async function reopenSeries(seriesId: string): Promise<void> {
  await updateDoc(doc(db, "series", seriesId), {
    status: "active",
    endDate: deleteField(),
  });
}
