import Link from "next/link";
import { getEventLocationName } from "@/lib/location";
import { SPORT_LABELS } from "@/lib/labels";
import { RECURRENCE_OPTIONS } from "@/lib/recurrence";
import type { Event, Series } from "@/lib/types";

interface EventCardProps {
  event: Event;
  series?: Series;
  /** True when the user is only a member/invitee of this event (not the owner). */
  invited?: boolean;
}

function formatDate(date: string): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("ro-RO", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function frequencyLabel(frequency: Series["frequency"]): string {
  return (
    RECURRENCE_OPTIONS.find((o) => o.value === frequency)?.label ?? "Recurent"
  );
}

export default function EventCard({ event, series, invited }: EventCardProps) {
  const isClosed = series?.status === "closed";

  return (
    <Link
      href={`/event/${event.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-primary opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold tracking-tight text-card-foreground">
          {event.title}
        </h3>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {invited ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Invitat
            </span>
          ) : null}
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {SPORT_LABELS[event.sport] ?? event.sport}
          </span>
        </div>
      </div>

      {series ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
      ) : null}

      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        <p>
          {series && !isClosed ? (
            <span className="font-medium text-foreground">Următoarea: </span>
          ) : null}
          {formatDate(event.date)}
          {event.time ? ` · ${event.time}` : ""}
        </p>
        <p>{getEventLocationName(event)}</p>
      </div>

      <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        Max {event.maxParticipants} participanți
      </p>
    </Link>
  );
}
