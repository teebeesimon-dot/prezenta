import type { PlayerCardData, PlayerPosition } from "@/lib/player-cards";
import type { ParticipantEntry } from "@/lib/types";

export interface TeamBalanceMetrics {
  averages: number[];
  difference: number;
  ratedPlayers: number;
  unratedPlayers: number;
}

export interface BalancedTeamResult {
  teams: ParticipantEntry[][];
  metrics: TeamBalanceMetrics;
}

const POSITION_ORDER: PlayerPosition[] = ["GK", "DEF", "MID", "ATT"];

function teamScore(team: ParticipantEntry[], cards: ReadonlyMap<string, PlayerCardData>): number {
  if (!team.length) return 0;
  return team.reduce((sum, player) => sum + (cards.get(player.userId)?.overall ?? 65), 0) / team.length;
}

function positionCount(team: ParticipantEntry[], position: PlayerPosition, cards: ReadonlyMap<string, PlayerCardData>): number {
  return team.filter((player) => cards.get(player.userId)?.position === position).length;
}

export function generateBalancedTeams(
  players: readonly ParticipantEntry[],
  cards: ReadonlyMap<string, PlayerCardData>,
  teamCount: number,
): BalancedTeamResult {
  const teams = Array.from({ length: teamCount }, () => [] as ParticipantEntry[]);
  const targetSizes = Array.from({ length: teamCount }, (_, index) =>
    Math.floor(players.length / teamCount) + (index < players.length % teamCount ? 1 : 0),
  );
  const sorted = [...players].sort((a, b) => {
    const positionDiff = POSITION_ORDER.indexOf(cards.get(a.userId)?.position ?? "MID") - POSITION_ORDER.indexOf(cards.get(b.userId)?.position ?? "MID");
    if (positionDiff !== 0) return positionDiff;
    return (cards.get(b.userId)?.overall ?? 65) - (cards.get(a.userId)?.overall ?? 65);
  });

  for (const player of sorted) {
    const card = cards.get(player.userId);
    const position = card?.position ?? "MID";
    const overall = card?.overall ?? 65;
    const candidates = teams
      .map((team, index) => ({
        index,
        full: team.length >= targetSizes[index],
        positionCount: positionCount(team, position, cards),
        projectedAverage: (teamScore(team, cards) * team.length + overall) / (team.length + 1),
        size: team.length,
      }))
      .filter((candidate) => !candidate.full)
      .sort((a, b) =>
        a.positionCount - b.positionCount ||
        a.projectedAverage - b.projectedAverage ||
        a.size - b.size ||
        a.index - b.index,
      );
    teams[candidates[0]?.index ?? 0].push(player);
  }

  const averages = teams.map((team) => Math.round(teamScore(team, cards)));
  return {
    teams,
    metrics: {
      averages,
      difference: averages.length ? Math.max(...averages) - Math.min(...averages) : 0,
      ratedPlayers: players.filter((player) => cards.has(player.userId)).length,
      unratedPlayers: players.filter((player) => !cards.has(player.userId)).length,
    },
  };
}
