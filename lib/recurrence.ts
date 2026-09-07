export type RecurrenceFrequency = "weekly" | "biweekly";

export const RECURRENCE_OPTIONS: {
  value: RecurrenceFrequency;
  label: string;
  intervalDays: number;
}[] = [
  { value: "weekly", label: "Săptămânal", intervalDays: 7 },
  { value: "biweekly", label: "La 2 săptămâni", intervalDays: 14 },
];

/** Maximum number of occurrences generated for a single series (safety cap). */
export const MAX_OCCURRENCES = 104;

function intervalForFrequency(frequency: RecurrenceFrequency): number {
  return (
    RECURRENCE_OPTIONS.find((o) => o.value === frequency)?.intervalDays ?? 7
  );
}

/**
 * Returns an array of ISO date strings (YYYY-MM-DD), starting at `startDate`
 * and repeating every interval until `endDate` (inclusive).
 * Dates are computed in a timezone-safe way using UTC noon.
 */
export function generateOccurrenceDates(
  startDate: string,
  endDate: string,
  frequency: RecurrenceFrequency
): string[] {
  if (!startDate || !endDate) return [];

  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < start) return [];

  const intervalDays = intervalForFrequency(frequency);
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end && dates.length < MAX_OCCURRENCES) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + intervalDays);
  }

  return dates;
}

/**
 * Returns the 1-based position of `occurrenceDate` on the series grid anchored
 * at `startDate` (i.e. its stage number). The first occurrence is 1. Returns 0
 * when the inputs are invalid or the date precedes the series start.
 */
export function occurrenceIndex(
  startDate: string,
  frequency: RecurrenceFrequency,
  occurrenceDate: string
): number {
  if (!startDate || !occurrenceDate) return 0;
  const start = new Date(`${startDate}T12:00:00Z`);
  const occurrence = new Date(`${occurrenceDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(occurrence.getTime()))
    return 0;

  const diffDays = Math.round(
    (occurrence.getTime() - start.getTime()) / 86_400_000
  );
  if (diffDays < 0) return 0;

  return Math.floor(diffDays / intervalForFrequency(frequency)) + 1;
}

/** Today's date as an ISO string (YYYY-MM-DD), timezone-safe local. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/** Returns the next occurrence date >= `fromDate`, aligned to the series grid. */
export function nextOccurrenceOnOrAfter(
  startDate: string,
  frequency: RecurrenceFrequency,
  fromDate: string
): string {
  if (!startDate) return "";
  const start = new Date(`${startDate}T12:00:00Z`);
  const from = new Date(`${(fromDate || startDate)}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(from.getTime())) return "";

  const intervalDays = intervalForFrequency(frequency);
  const cursor = new Date(start);
  let guard = 0;
  while (cursor < from && guard < MAX_OCCURRENCES * 4) {
    cursor.setUTCDate(cursor.getUTCDate() + intervalDays);
    guard += 1;
  }
  return cursor.toISOString().slice(0, 10);
}

/** Returns the occurrence date strictly after `date`. */
export function nextOccurrenceAfter(
  date: string,
  frequency: RecurrenceFrequency
): string {
  if (!date) return "";
  const cursor = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return "";
  cursor.setUTCDate(cursor.getUTCDate() + intervalForFrequency(frequency));
  return cursor.toISOString().slice(0, 10);
}

/**
 * Counts how many occurrences (grid anchored at `startDate`) fall within the
 * given month (`monthKey` = "YYYY-MM"). Used to estimate a monthly subscription
 * for the upcoming month.
 */
export function countOccurrencesInMonth(
  startDate: string,
  frequency: RecurrenceFrequency,
  monthKey: string
): number {
  if (!startDate || !monthKey) return 0;
  const start = new Date(`${startDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) return 0;

  const intervalDays = intervalForFrequency(frequency);
  const cursor = new Date(start);
  let count = 0;
  let guard = 0;

  while (guard < MAX_OCCURRENCES * 4) {
    const key = cursor.toISOString().slice(0, 7);
    if (key === monthKey) count += 1;
    // Grid only moves forward, so once we pass the month we can stop.
    if (key > monthKey) break;
    cursor.setUTCDate(cursor.getUTCDate() + intervalDays);
    guard += 1;
  }

  return count;
}
