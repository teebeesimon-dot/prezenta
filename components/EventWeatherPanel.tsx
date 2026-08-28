"use client";

import useSWR from "swr";

interface WeatherData {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; precipitation: number; label: string };
  hourly: Array<{ time: string; temperature: number; label: string; precipitation: number }>;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Vreme indisponibilă");
  return response.json() as Promise<WeatherData>;
};

export default function EventWeatherPanel({ latitude, longitude, eventDate, eventTime }: { latitude?: number; longitude?: number; eventDate: string; eventTime: string }) {
  const key = Number.isFinite(latitude) && Number.isFinite(longitude) ? `/api/weather?lat=${latitude}&lon=${longitude}` : null;
  const { data, error, isLoading } = useSWR(key, fetcher, { refreshInterval: 30 * 60 * 1000, revalidateOnFocus: false });
  const eventMs = new Date(`${eventDate}T${eventTime}:00`).getTime();
  const forecast = data?.hourly
    .slice()
    .sort((a, b) => Math.abs(new Date(a.time).getTime() - eventMs) - Math.abs(new Date(b.time).getTime() - eventMs))
    .slice(0, 5)
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <section className="event-panel p-5" aria-labelledby="weather-title">
      <h2 id="weather-title" className="event-panel-title">Vremea</h2>
      {!key || error ? <p className="mt-5 text-sm text-muted-foreground">Vreme indisponibilă pentru această locație.</p> : isLoading || !data ? <p className="mt-5 text-sm text-muted-foreground">Se încarcă prognoza...</p> : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 rounded-full border border-primary/30 bg-primary/10"><span className="absolute left-3 top-3 h-6 w-6 rounded-full bg-primary" /><span className="absolute bottom-2 right-1 h-5 w-9 rounded-full bg-muted-foreground/35" /></div>
            <div><p className="text-4xl font-bold tracking-tight text-foreground">{Math.round(data.current.temperature_2m)}°</p><p className="text-sm text-muted-foreground">{data.current.label} · Se simte ca {Math.round(data.current.apparent_temperature)}°</p></div>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-muted/45 p-3 text-center">
            <div><dt className="text-xs text-muted-foreground">Vânt</dt><dd className="mt-1 text-sm font-semibold">{Math.round(data.current.wind_speed_10m)} km/h</dd></div>
            <div><dt className="text-xs text-muted-foreground">Umiditate</dt><dd className="mt-1 text-sm font-semibold">{Math.round(data.current.relative_humidity_2m)}%</dd></div>
            <div><dt className="text-xs text-muted-foreground">Precipitații</dt><dd className="mt-1 text-sm font-semibold">{data.current.precipitation} mm</dd></div>
          </dl>
          {forecast && forecast.length > 0 && <div className="mt-4 grid grid-cols-5 gap-1">{forecast.map((hour) => <div key={hour.time} className="rounded-lg bg-muted/25 px-1 py-2 text-center"><p className="text-xs text-muted-foreground">{new Date(hour.time).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</p><span className="mx-auto my-2 block h-3 w-3 rounded-full bg-primary/80" /><p className="text-sm font-semibold">{Math.round(hour.temperature)}°</p></div>)}</div>}
        </>
      )}
    </section>
  );
}
