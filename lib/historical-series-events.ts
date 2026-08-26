export interface HistoricalSeriesEvent {
  seriesId: string;
  eventId: string;
  date: string;
  title: string;
}

const HISTORICAL_SERIES_EVENTS = [
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "gOqHeH3nLczGDy9ebV7X",
    date: "2026-06-29",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "OZwGBGy8KdYJLSCxVtZb",
    date: "2026-07-06",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "Z3cZFdMTTMspwFimIMR3",
    date: "2026-07-13",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "f2ickThdZMZG66LG8Zl2",
    date: "2026-07-20",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "21y1CNDcLYwgNQRtbZak",
    date: "2026-07-27",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "KQxY9DkWL7IhfCIKJbRe",
    date: "2026-08-03",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "bbWdLovjnD8Q7skZ8fo3",
    date: "2026-08-10",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "B1D46JLL7f6mw0deCL6T",
    date: "2026-08-17",
    title: "Fotbal Soho",
  },
  {
    seriesId: "tyBWTIGBa68TI0dllcR7",
    eventId: "vIla7wHvjnGpXfzpO2hR",
    date: "2026-08-24",
    title: "Fotbal Soho",
  },
  {
    seriesId: "8nIem9jI8d31gA9XWOPX",
    eventId: "7r1ca2BJRbpdH8EFlmJ3",
    date: "2026-07-07",
    title: "Tenis Arena",
  },
  {
    seriesId: "8nIem9jI8d31gA9XWOPX",
    eventId: "XVMpkOIcdPp4VYjg6Kvl",
    date: "2026-07-14",
    title: "Tenis Arena",
  },
  {
    seriesId: "8nIem9jI8d31gA9XWOPX",
    eventId: "5LDmlBELY9cQcLeU8fvU",
    date: "2026-07-21",
    title: "Tenis Arena",
  },
  {
    seriesId: "8nIem9jI8d31gA9XWOPX",
    eventId: "K7hG2cuCL5x5RaBBqCuY",
    date: "2026-07-28",
    title: "Tenis Arena",
  },
  {
    seriesId: "8nIem9jI8d31gA9XWOPX",
    eventId: "cpETICeSfwzivfvgPZvi",
    date: "2026-08-04",
    title: "Tenis Arena",
  },
  {
    seriesId: "8nIem9jI8d31gA9XWOPX",
    eventId: "32fZXh02norAqfK9EnZF",
    date: "2026-08-11",
    title: "Tenis Arena",
  },
  {
    seriesId: "8nIem9jI8d31gA9XWOPX",
    eventId: "ZIVZVbcthW4E9yuis9pL",
    date: "2026-08-18",
    title: "Tenis Arena",
  },
] as const satisfies readonly HistoricalSeriesEvent[];

export function getHistoricalSeriesEvents(
  seriesId: string,
): HistoricalSeriesEvent[] {
  return HISTORICAL_SERIES_EVENTS.filter(
    (event) => event.seriesId === seriesId,
  );
}
