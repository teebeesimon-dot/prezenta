import type { Event, Series } from "@/lib/types";

export type RegistrationLeadUnit = "hours" | "days";

/** Subset of fields needed to compute when registration opens. */
export interface RegistrationConfig {
  date: string;
  time: string;
  registrationLeadValue?: number;
  registrationLeadUnit?: RegistrationLeadUnit;
  /** Fixed clock time (HH:mm) for opening when unit is "days". */
  registrationOpenTime?: string;
}

/** True when the event has a configured registration-open rule. */
export function hasRegistrationWindow(config: RegistrationConfig): boolean {
  return (
    typeof config.registrationLeadValue === "number" &&
    config.registrationLeadValue > 0 &&
    (config.registrationLeadUnit === "hours" ||
      config.registrationLeadUnit === "days")
  );
}

/**
 * Computes the exact moment registration opens for a given occurrence.
 * - unit "hours": event start minus N hours.
 * - unit "days": N days before the event date, at `registrationOpenTime`
 *   (falls back to the event start time). Always the same clock time across
 *   occurrences, so the rule respects the series recurrence automatically.
 * Returns null when no window is configured or data is invalid.
 */
export function computeRegistrationOpensAt(
  config: RegistrationConfig
): Date | null {
  if (!hasRegistrationWindow(config)) return null;
  if (!config.date || !config.time) return null;

  const [sh, sm] = config.time.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm)) return null;

  const value = config.registrationLeadValue as number;

  if (config.registrationLeadUnit === "hours") {
    const start = new Date(`${config.date}T00:00:00`);
    if (Number.isNaN(start.getTime())) return null;
    start.setHours(sh, sm, 0, 0);
    return new Date(start.getTime() - value * 60 * 60 * 1000);
  }

  // unit === "days"
  const openTime = config.registrationOpenTime || config.time;
  const [oh, om] = openTime.split(":").map(Number);
  const opens = new Date(`${config.date}T00:00:00`);
  if (Number.isNaN(opens.getTime())) return null;
  opens.setDate(opens.getDate() - value);
  opens.setHours(
    Number.isNaN(oh) ? sh : oh,
    Number.isNaN(om) ? sm : om,
    0,
    0
  );
  return opens;
}

/** Whether registration is currently open. No window configured = always open. */
export function isRegistrationOpen(
  config: RegistrationConfig,
  now: number = Date.now()
): boolean {
  const opensAt = computeRegistrationOpensAt(config);
  if (!opensAt) return true;
  return now >= opensAt.getTime();
}

/** Human-readable open datetime, e.g. "luni, 6 iulie 2026, 12:00". */
export function formatRegistrationOpensAt(date: Date): string {
  return date.toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Countdown label from a millisecond delta, e.g. "2 zile 03:14:09". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "acum";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (days > 0) return `${days} ${days === 1 ? "zi" : "zile"} ${clock}`;
  return clock;
}

/** Short description of the lead rule for forms/summaries. */
export function describeRegistrationLead(
  value?: number,
  unit?: RegistrationLeadUnit,
  openTime?: string
): string {
  if (!value || value <= 0 || !unit) return "Imediat (fără restricție)";
  if (unit === "hours") {
    return `Cu ${value} ${value === 1 ? "oră" : "ore"} înainte de joc`;
  }
  const at = openTime ? `, la ${openTime}` : "";
  return `Cu ${value} ${value === 1 ? "zi" : "zile"} înainte de joc${at}`;
}

/** Extracts the registration config from a full Event document. */
export function registrationConfigFromEvent(event: Event): RegistrationConfig {
  return {
    date: event.date,
    time: event.time,
    registrationLeadValue: event.registrationLeadValue,
    registrationLeadUnit: event.registrationLeadUnit,
    registrationOpenTime: event.registrationOpenTime,
  };
}

/** Extracts the registration config from a Series document. */
export function registrationConfigFromSeries(
  series: Series,
  occurrenceDate: string
): RegistrationConfig {
  return {
    date: occurrenceDate,
    time: series.time,
    registrationLeadValue: series.registrationLeadValue,
    registrationLeadUnit: series.registrationLeadUnit,
    registrationOpenTime: series.registrationOpenTime,
  };
}
