export const DEFAULT_DURATION_MINUTES = 90;

// 30-minute steps from 30 minutes up to 4 hours.
export const DURATION_OPTIONS: { value: number; label: string }[] = Array.from(
  { length: 8 },
  (_, i) => {
    const minutes = (i + 1) * 30;
    return { value: minutes, label: formatDuration(minutes) };
  }
);

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

// Adds a number of minutes to a "HH:MM" string and returns "HH:MM".
export function addMinutesToTime(time: string, minutes: number): string {
  if (!time || !time.includes(":")) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const total = h * 60 + m + minutes;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const endH = Math.floor(normalized / 60);
  const endM = normalized % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

// Returns the formatted "HH:MM – HH:MM" range, or just the start if no duration.
export function formatTimeRange(time: string, durationMinutes?: number): string {
  if (!time) return "";
  if (!durationMinutes || durationMinutes <= 0) return time;
  const end = addMinutesToTime(time, durationMinutes);
  return end ? `${time} – ${end}` : time;
}

// Total cost = price per hour * hours played.
export function computeTotalCost(
  pricePerHour?: number,
  durationMinutes?: number
): number {
  if (!pricePerHour || pricePerHour <= 0) return 0;
  if (!durationMinutes || durationMinutes <= 0) return 0;
  return (pricePerHour * durationMinutes) / 60;
}

// Cost per confirmed player. Splits the total among confirmed players.
export function computePerPlayer(
  totalCost: number,
  confirmedCount: number
): number {
  if (totalCost <= 0 || confirmedCount <= 0) return 0;
  return totalCost / confirmedCount;
}

/**
 * Monthly subscription cost. Product rule: cost per session (price-per-hour ×
 * the game's duration in hours) × the number of occurrences that fall in the
 * upcoming month, split across a fixed group size (every member pays,
 * regardless of who actually attends each game).
 */
export function computeMonthlySubscription(params: {
  pricePerHour?: number;
  durationMinutes?: number;
  occurrencesInMonth?: number;
  groupSize?: number;
}): { sessionCost: number; monthlyTotal: number; perPlayer: number } {
  const occurrences = params.occurrencesInMonth ?? 0;
  const group = params.groupSize ?? 0;
  const sessionCost = computeTotalCost(
    params.pricePerHour,
    params.durationMinutes
  );
  if (sessionCost <= 0 || occurrences <= 0) {
    return { sessionCost, monthlyTotal: 0, perPlayer: 0 };
  }
  const monthlyTotal = sessionCost * occurrences;
  const perPlayer = group > 0 ? monthlyTotal / group : 0;
  return { sessionCost, monthlyTotal, perPlayer };
}

// Formats a RON amount, dropping trailing ".00" for whole numbers.
export function formatLei(amount: number): string {
  if (!Number.isFinite(amount)) return "0 lei";
  const rounded = Math.round(amount * 100) / 100;
  const isWhole = Number.isInteger(rounded);
  const value = isWhole
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${value} lei`;
}
