import { NextRequest, NextResponse } from "next/server";

const weatherLabels: Record<number, string> = {
  0: "Senin", 1: "Mai mult senin", 2: "Parțial noros", 3: "Înnorat",
  45: "Ceață", 48: "Ceață", 51: "Burniță", 53: "Burniță", 55: "Burniță",
  61: "Ploaie slabă", 63: "Ploaie", 65: "Ploaie puternică", 71: "Ninsoare",
  80: "Averse", 81: "Averse", 82: "Averse puternice", 95: "Furtună", 96: "Furtună", 99: "Furtună",
};

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: "Coordonate invalide" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const params = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude), timezone: "auto",
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,precipitation",
      hourly: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,precipitation,precipitation_probability",
      forecast_days: "7",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal, next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error("Serviciul meteo nu a răspuns");
    const data = await response.json();
    return NextResponse.json({
      current: { ...data.current, label: weatherLabels[data.current.weather_code] ?? "Vreme variabilă" },
      hourly: data.hourly.time.map((time: string, index: number) => ({
        time,
        temperature: data.hourly.temperature_2m[index],
        apparentTemperature: data.hourly.apparent_temperature[index],
        code: data.hourly.weather_code[index],
        label: weatherLabels[data.hourly.weather_code[index]] ?? "Variabil",
        windSpeed: data.hourly.wind_speed_10m[index],
        humidity: data.hourly.relative_humidity_2m[index],
        precipitation: data.hourly.precipitation[index],
        precipitationProbability: data.hourly.precipitation_probability[index],
      })),
    });
  } catch {
    return NextResponse.json({ error: "Vreme indisponibilă" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
