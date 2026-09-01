import type { PlayerPosition } from "@/lib/player-cards";

export type MatchPosition = PlayerPosition;
export type FootballCardType = "standard" | "evolution-1" | "evolution-2" | "evolution-3" | "evolution-4" | "evolution-5" | "stage-player" | "stage-goalkeeper" | "legend" | "toty";

export interface MatchPlayer {
  userId: string;
  name: string;
  teamIndex: number;
  position: MatchPosition;
  goals: number;
}

export interface FootballMatch {
  id: string;
  groupId: string;
  eventId: string;
  stageNumber: number;
  matchOrder: number;
  playedAt: number;
  teamNames: string[];
  teamIndexes: number[];
  ownGoals: number[];
  scores: number[];
  penaltyWinnerIndex: number | null;
  players: MatchPlayer[];
}

export type ScoringKey = "win" | "loss" | "goal" | "penaltyWin" | "penaltyLoss" | "cleanSheet" | "goalConceded" | "winStreak";
export type PositionScoring = Record<ScoringKey, number | null>;
export type ScoringSettings = Record<MatchPosition, PositionScoring>;
export interface EvolutionLevel { level: 1 | 2 | 3 | 4 | 5; points: number | null; overallBonus: number | null }

export interface PlayerMatchBreakdown {
  matchId: string;
  stageNumber: number;
  position: MatchPosition;
  won: boolean;
  lost: boolean;
  penaltyWin: boolean;
  penaltyLoss: boolean;
  goals: number;
  goalsConceded: number;
  cleanSheet: boolean;
  winStreak: number;
  points: number | null;
  criteria: Partial<Record<ScoringKey, number>>;
}

export interface PlayerProgress {
  userId: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  penaltyWins: number;
  penaltyLosses: number;
  goals: number;
  goalsConceded: number;
  cleanSheets: number;
  currentWinStreak: number;
  longestWinStreak: number;
  points: number | null;
  outfieldPoints: number | null;
  goalkeeperPoints: number | null;
  evolutionLevel: number;
  evolutionBonus: number;
  awardBonus: number;
  initialOverall: number;
  currentOverall: number;
  positionAppearances: Record<MatchPosition, number>;
  breakdown: PlayerMatchBreakdown[];
}

export interface RecalculationResult {
  configured: boolean;
  progress: PlayerProgress[];
  stageLeaders: Array<{ stageNumber: number; fieldPlayerIds: string[]; goalkeeperIds: string[] }>;
}

export function calculateMatchScores(players: MatchPlayer[], ownGoals: number[], teamCount = 2): number[] {
  return Array.from({ length: teamCount }, (_, teamIndex) =>
    players
      .filter((player) => player.teamIndex === teamIndex)
      .reduce((sum, player) => sum + Math.max(0, Math.trunc(Number(player.goals) || 0)), 0) +
    Math.max(0, Math.trunc(Number(ownGoals[teamIndex]) || 0)),
  );
}

export function validateFootballMatchWinner<T extends Omit<FootballMatch, "id"> | FootballMatch>(match: T): T {
  if (match.teamNames.length !== 2 || match.teamIndexes.length !== 2 || new Set(match.teamIndexes).size !== 2) {
    throw new Error("Selectează exact două echipe diferite.");
  }
  if (match.matchOrder < 1 || !Number.isInteger(match.matchOrder)) {
    throw new Error("Numărul meciului trebuie să fie un număr întreg pozitiv.");
  }
  if (match.players.some((player) => !Number.isInteger(player.goals) || player.goals < 0) || match.ownGoals.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error("Golurile și autogolurile trebuie să fie numere întregi pozitive sau zero.");
  }
  const scores = calculateMatchScores(match.players, match.ownGoals, 2);
  const tied = scores[0] === scores[1];
  if (tied && (match.penaltyWinnerIndex === null || ![0, 1].includes(match.penaltyWinnerIndex))) {
    throw new Error("Selectează obligatoriu echipa care a câștigat la penalty.");
  }
  return { ...match, scores, penaltyWinnerIndex: tied ? match.penaltyWinnerIndex : null };
}

export function emptyPositionScoring(): PositionScoring {
  return { win: null, loss: null, goal: null, penaltyWin: null, penaltyLoss: null, cleanSheet: null, goalConceded: null, winStreak: null };
}
export function emptyScoringSettings(): ScoringSettings {
  return { GK: emptyPositionScoring(), DEF: emptyPositionScoring(), MID: emptyPositionScoring(), ATT: emptyPositionScoring() };
}

const SCORING_KEYS: ScoringKey[] = ["win", "loss", "goal", "penaltyWin", "penaltyLoss", "cleanSheet", "goalConceded", "winStreak"];

function isScoringConfigured(settings: ScoringSettings | null): settings is ScoringSettings {
  if (!settings) return false;
  return (["GK", "DEF", "MID", "ATT"] as MatchPosition[]).every((position) =>
    settings[position] && SCORING_KEYS.every((key) => settings[position][key] !== null && settings[position][key] !== undefined),
  );
}

function evolutionFor(points: number | null, levels: EvolutionLevel[]) {
  if (points === null) return { level: 0, bonus: 0 };
  return levels
    .filter((item) => item.points !== null && item.overallBonus !== null && points >= item.points)
    .sort((a, b) => b.level - a.level)
    .map((item) => ({ level: item.level, bonus: item.overallBonus ?? 0 }))[0] ?? { level: 0, bonus: 0 };
}

export function recalculateFootballSystem(
  matches: FootballMatch[],
  initialOverallByUser: Record<string, number>,
  scoring: ScoringSettings | null,
  evolutionLevels: EvolutionLevel[],
  awardBonusByUser: Record<string, number> = {},
  excludedUserIds = new Set<string>(),
): RecalculationResult {
  const configured = isScoringConfigured(scoring);
  const map = new Map<string, PlayerProgress>();
  const sorted = [...matches].sort((a, b) => a.stageNumber - b.stageNumber || a.matchOrder - b.matchOrder || a.playedAt - b.playedAt);

  for (const match of sorted) {
    const maxScore = Math.max(...match.scores);
    const winnerIndexes = match.scores.map((score, index) => score === maxScore ? index : -1).filter((i) => i >= 0);
    const decidedByPenalties = winnerIndexes.length > 1;
    const winnerIndex = decidedByPenalties ? match.penaltyWinnerIndex : winnerIndexes[0];
    if (winnerIndex === null || !winnerIndexes.includes(winnerIndex)) {
      throw new Error(`Meciul ${match.id} nu are un câștigător valid.`);
    }
    for (const player of match.players) {
      if (excludedUserIds.has(player.userId)) continue;
      const won = player.teamIndex === winnerIndex;
      const lost = !won;
      const goalsConceded = match.scores.reduce((sum, score, index) => index === player.teamIndex ? sum : sum + score, 0);
      const cleanSheet = player.position === "GK" && goalsConceded === 0;
      const current = map.get(player.userId) ?? {
        userId: player.userId, name: player.name, matches: 0, wins: 0, losses: 0, penaltyWins: 0, penaltyLosses: 0,
        goals: 0, goalsConceded: 0, cleanSheets: 0, currentWinStreak: 0, longestWinStreak: 0,
        points: configured ? 0 : null,
        outfieldPoints: configured ? 0 : null,
        goalkeeperPoints: configured ? 0 : null,
        evolutionLevel: 0, evolutionBonus: 0,
        awardBonus: awardBonusByUser[player.userId] ?? 0,
        initialOverall: initialOverallByUser[player.userId] ?? 50,
        currentOverall: initialOverallByUser[player.userId] ?? 50,
        positionAppearances: { GK: 0, DEF: 0, MID: 0, ATT: 0 }, breakdown: [],
      };
      current.matches += 1;
      current.wins += won && !decidedByPenalties ? 1 : 0;
      current.losses += lost && !decidedByPenalties ? 1 : 0;
      current.penaltyWins += won && decidedByPenalties ? 1 : 0;
      current.penaltyLosses += lost && decidedByPenalties ? 1 : 0;
      current.goals += Math.max(0, player.goals);
      current.goalsConceded += player.position === "GK" ? goalsConceded : 0;
      current.cleanSheets += cleanSheet ? 1 : 0;
      current.currentWinStreak = won ? current.currentWinStreak + 1 : 0;
      current.longestWinStreak = Math.max(current.longestWinStreak, current.currentWinStreak);
      current.positionAppearances[player.position] += 1;
      const criteria: Partial<Record<ScoringKey, number>> = {};
      let matchPoints: number | null = null;
      if (configured) {
        const rules = scoring[player.position];
        if (decidedByPenalties) {
          criteria[won ? "penaltyWin" : "penaltyLoss"] = won ? rules.penaltyWin! : rules.penaltyLoss!;
        } else {
          criteria[won ? "win" : "loss"] = won ? rules.win! : rules.loss!;
        }
        criteria.goal = player.goals * rules.goal!;
        if (cleanSheet) criteria.cleanSheet = rules.cleanSheet!;
        if (player.position === "GK" && goalsConceded > 0) criteria.goalConceded = goalsConceded * rules.goalConceded!;
        if (won && current.currentWinStreak >= 3) criteria.winStreak = rules.winStreak!;
        matchPoints = Object.values(criteria).reduce((sum, value) => sum + (value ?? 0), 0);
        current.points = (current.points ?? 0) + matchPoints;
        if (player.position === "GK") current.goalkeeperPoints = (current.goalkeeperPoints ?? 0) + matchPoints;
        else current.outfieldPoints = (current.outfieldPoints ?? 0) + matchPoints;
      }
      current.breakdown.push({ matchId: match.id, stageNumber: match.stageNumber, position: player.position, won, lost, penaltyWin: won && decidedByPenalties, penaltyLoss: lost && decidedByPenalties, goals: player.goals, goalsConceded, cleanSheet, winStreak: current.currentWinStreak, points: matchPoints, criteria });
      map.set(player.userId, current);
    }
  }

  for (const player of map.values()) {
    const evolution = evolutionFor(player.points, evolutionLevels);
    player.evolutionLevel = evolution.level;
    player.evolutionBonus = evolution.bonus;
    player.currentOverall = Math.min(99, player.initialOverall + player.evolutionBonus + player.awardBonus);
  }

  const stages = [...new Set(sorted.map((match) => match.stageNumber))];
  const stageLeaders = stages.map((stageNumber) => {
    const roleScores = (position: "goalkeeper" | "outfield") => [...map.values()].flatMap((player) => {
      const rows = player.breakdown.filter((row) => row.stageNumber === stageNumber && (position === "goalkeeper" ? row.position === "GK" : row.position !== "GK"));
      return rows.length ? [{ userId: player.userId, points: rows.reduce((sum, row) => sum + (row.points ?? 0), 0) }] : [];
    });
    const leaders = (scores: Array<{ userId: string; points: number }>, excluded = new Set<string>()) => {
      const candidates = scores.filter((item) => !excluded.has(item.userId));
      const top = Math.max(...candidates.map((item) => item.points), -Infinity);
      return Number.isFinite(top) ? candidates.filter((item) => item.points === top).map((item) => item.userId) : [];
    };
    const fieldPlayerIds = configured ? leaders(roleScores("outfield")) : [];
    const goalkeeperIds = configured ? leaders(roleScores("goalkeeper"), new Set(fieldPlayerIds)) : [];
    return { stageNumber, fieldPlayerIds, goalkeeperIds };
  });
  return { configured, progress: [...map.values()].sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity) || b.goals - a.goals), stageLeaders };
}

export const CARD_ASSETS: Record<FootballCardType, string> = {
  standard: "/player-cards/bilka-template.png",
  "evolution-1": "/player-cards/evolution-1.png",
  "evolution-2": "/player-cards/evolution-2.png",
  "evolution-3": "/player-cards/evolution-3.png",
  "evolution-4": "/player-cards/evolution-4.png",
  "evolution-5": "/player-cards/evolution-5.png",
  "stage-player": "/player-cards/stage-award.png",
  "stage-goalkeeper": "/player-cards/stage-award.png",
  legend: "/player-cards/legend.png",
  toty: "/player-cards/toty.png",
};
