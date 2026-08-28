"use client";

import useSWR from "swr";

interface WeatherData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    precipitation: number;
    label: string;
  };
  hourly: Array<{ time: string; temperature: number; code: number; label: string; precipitation: number }>;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Vreme indisponibilă");
  return response.json() as Promise<WeatherData>;
};

/** Returns a simple category from an Open-Meteo weather code. */
function weatherKind(code: number): "clear" | "cloud" | "rain" | "snow" | "storm" {
  if (code === 0 || code === 1) return "clear";
  if (code >= 95) return "storm";
  if (code >= 71 && code <= 77) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "cloud";
}

function WeatherIcon({ code, className = "h-6 w-6" }: { code: number; className?: string }) {
  const kind = weatherKind(code);
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "clear") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-amber-400`} {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (kind === "storm") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-primary`} {...common} aria-hidden="true">
        <path d="M17.5 15a4.5 4.5 0 0 0-1-8.9A6 6 0 0 0 5 9a4 4 0 0 0 .5 8" />
        <path d="m13 12-3 4h3l-2 4" />
      </svg>
    );
  }
  if (kind === "rain") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-sky-400`} {...common} aria-hidden="true">
        <path d="M17.5 13a4.5 4.5 0 0 0-1-8.9A6 6 0 0 0 5 7a4 4 0 0 0 .5 8" />
        <path d="M8 17v3M12 17v3M16 17v3" />
      </svg>
    );
  }
  if (kind === "snow") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-sky-200`} {...common} aria-hidden="true">
        <path d="M17.5 13a4.5 4.5 0 0 0-1-8.9A6 6 0 0 0 5 7a4 4 0 0 0 .5 8" />
        <path d="M8 18h.01M12 18h.01M16 18h.01M10 21h.01M14 21h.01" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`${className} text-muted-foreground`} {...common} aria-hidden="true">
      <path d="M17.5 18a4.5 4.5 0 0 0-1-8.9A6 6 0 0 0 5 12a4 4 0 0 0 .5 8Z" />
    </svg>
  );
}

interface EventWeatherPanelProps {
  latitude?: number;
  longitude?: number;
  eventDate: string;
  eventTime: string;
  /** "panel" = full sidebar card, "inline" = compact chip for the header. */
  variant?: "panel" | "inline";
}

export default function EventWeatherPanel({
  latitude,
  longitude,
  eventDate,
  eventTime,
  variant = "panel",
}: EventWeatherPanelProps) {
  const key =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `/api/weather?lat=${latitude}&lon=${longitude}`
      : null;
  const { data, error, isLoading } = useSWR(key, fetcher, {
    refreshInterval: 30 * 60 * 1000,
    revalidateOnFocus: false,
  });
  const eventMs = new Date(`${eventDate}T${eventTime}:00`).getTime();
  const forecast = data?.hourly
    .slice()
    .sort((a, b) => Math.abs(new Date(a.time).getTime() - eventMs) - Math.abs(new Date(b.time).getTime() - eventMs))
    .slice(0, 5)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (variant === "inline") {
    if (!key || error || (!isLoading && !data)) return null;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        {isLoading || !data ? (
          <span className="text-sm text-muted-foreground">Prognoză…</span>
        ) : (
          <>
            <WeatherIcon code={data.current.weather_code} className="h-9 w-9" />
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tracking-tight text-foreground">
                {Math.round(data.current.temperature_2m)}°
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {data.current.label} · se simte ca {Math.round(data.current.apparent_temperature)}°
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="event-panel p-5" aria-labelledby="weather-title">
      <h2 id="weather-title" className="event-panel-title">
        Vremea
      </h2>
      {!key || error ? (
        <p className="mt-5 text-sm text-muted-foreground">Vreme indisponibilă pentru această locație.</p>
      ) : isLoading || !data ? (
        <p className="mt-5 text-sm text-muted-foreground">Se încarcă prognoza...</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <WeatherIcon code={data.current.weather_code} className="h-14 w-14" />
            <div>
              <p className="text-4xl font-bold tracking-tight text-foreground">
                {Math.round(data.current.temperature_2m)}°
              </p>
              <p className="text-sm text-muted-foreground">
                {data.current.label} · Se simte ca {Math.round(data.current.apparent_temperature)}°
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-muted/45 p-3 text-center">
            <div>
              <dt className="text-xs text-muted-foreground">Vânt</dt>
              <dd className="mt-1 text-sm font-semibold">{Math.round(data.current.wind_speed_10m)} km/h</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Umiditate</dt>
              <dd className="mt-1 text-sm font-semibold">{Math.round(data.current.relative_humidity_2m)}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Precipitații</dt>
              <dd className="mt-1 text-sm font-semibold">{data.current.precipitation} mm</dd>
            </div>
          </dl>
          {forecast && forecast.length > 0 && (
            <div className="mt-4 grid grid-cols-5 gap-1">
              {forecast.map((hour) => (
                <div key={hour.time} className="rounded-lg bg-muted/25 px-1 py-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    {new Date(hour.time).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <WeatherIcon code={hour.code} className="mx-auto my-1.5 h-5 w-5" />
                  <p className="text-sm font-semibold">{Math.round(hour.temperature)}°</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
