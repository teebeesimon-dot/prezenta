export type FootballFormat = "2x6" | "3x5" | "3x6";

export const FOOTBALL_FORMATS: {
  value: FootballFormat;
  label: string;
  teams: number;
  playersPerTeam: number;
  totalPlayers: number;
}[] = [
  { value: "2x6", label: "2 echipe × 6 jucători", teams: 2, playersPerTeam: 6, totalPlayers: 12 },
  { value: "3x5", label: "3 echipe × 5 jucători", teams: 3, playersPerTeam: 5, totalPlayers: 15 },
  { value: "3x6", label: "3 echipe × 6 jucători", teams: 3, playersPerTeam: 6, totalPlayers: 18 },
];

export function getFootballFormat(value?: string): (typeof FOOTBALL_FORMATS)[number] {
  return FOOTBALL_FORMATS.find((format) => format.value === value) ?? FOOTBALL_FORMATS[0];
}

export function formatLabel(format?: string): string {
  return getFootballFormat(format).label;
}

export function getDefaultFootballFormat(maxParticipants?: number): FootballFormat {
  return maxParticipants === 15 ? "3x5" : maxParticipants === 18 ? "3x6" : "2x6";
}
