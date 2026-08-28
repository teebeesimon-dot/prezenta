import Link from "next/link";
import EventWeatherPanel from "@/components/EventWeatherPanel";
import OpenInGoogleMapsButton from "@/components/OpenInGoogleMapsButton";
import { formatLabel } from "@/lib/football-formats";
import { getEventLocationName } from "@/lib/location";
import { formatDuration, formatLei, computeTotalCost } from "@/lib/pricing";
import type { Event } from "@/lib/types";

export default function EventDashboardShell({ event, active = "overview", children }: { event: Event; active?: "overview" | "group" | "confirmed" | "teams" | "cards"; children: React.ReactNode }) {
  const links = [{ id: "overview", label: "Eveniment", href: `/event/${event.id}` }, { id: "group", label: "Grup", href: `/event/${event.id}/group` }, ...(event.sport === "football" ? [{ id: "teams", label: "Echipe", href: `/event/${event.id}/teams` }, { id: "cards", label: "Player Cards", href: `/event/${event.id}/cards` }] : [])];
  return (
    <main className="mx-auto w-full max-w-[1480px] px-3 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-primary"><span aria-hidden="true">←</span> Înapoi la evenimente</Link>
        <nav aria-label="Secțiuni eveniment" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">{links.map((link) => <Link key={link.id} href={link.href} aria-current={active === link.id ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${active === link.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{link.label}</Link>)}</nav>
      </div>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 flex flex-col gap-4">{children}</div>
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
          <EventWeatherPanel latitude={event.latitude} longitude={event.longitude} eventDate={event.date} eventTime={event.time} />
          <section className="event-panel p-5"><h2 className="event-panel-title">Locație</h2><div className="mt-4 rounded-xl border border-border bg-[linear-gradient(135deg,var(--muted),var(--card))] p-5"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground" aria-hidden="true">⌖</div></div><p className="mt-4 font-semibold text-foreground">{event.locationName || "Locația evenimentului"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{getEventLocationName(event)}</p><OpenInGoogleMapsButton event={event} className="mt-4 w-full" /></section>
          <section className="event-panel p-5"><h2 className="event-panel-title">Detalii eveniment</h2><dl className="mt-4 flex flex-col gap-3 text-sm">
            <Detail label="Tip" value={event.seriesId ? "Serie" : "Eveniment unic"} />
            {event.footballFormat && <Detail label="Format" value={formatLabel(event.footballFormat)} />}
            <Detail label="Durată" value={event.durationMinutes ? formatDuration(event.durationMinutes) : "Nespecificată"} />
            <Detail label="Număr maxim" value={`${event.maxParticipants} jucători`} />
            {event.pricePerHour && <Detail label="Cost total" value={formatLei(computeTotalCost(event.pricePerHour, event.durationMinutes ?? 60))} />}
          </dl></section>
        </aside>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold text-foreground">{value}</dd></div>; }
