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
  scores: number[];
  penaltyWinnerIndex: number | null;
  players: MatchPlayer[];
}

export type ScoringKey = "win" | "draw" | "loss" | "goal" | "penaltyWin" | "penaltyLoss" | "cleanSheet" | "goalConceded" | "winStreak";
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
  goals: number;
  goalsConceded: number;
  cleanSheets: number;
  currentWinStreak: number;
  longestWinStreak: number;
  points: number | null;
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

export function emptyPositionScoring(): PositionScoring {
  return { win: null, draw: null, loss: null, goal: null, penaltyWin: null, penaltyLoss: null, cleanSheet: null, goalConceded: null, winStreak: null };
}
export function emptyScoringSettings(): ScoringSettings {
  return { GK: emptyPositionScoring(), DEF: emptyPositionScoring(), MID: emptyPositionScoring(), ATT: emptyPositionScoring() };
}

function isScoringConfigured(settings: ScoringSettings | null): settings is ScoringSettings {
  if (!settings) return false;
  return (Object.keys(settings) as MatchPosition[]).every((position) =>
    (Object.keys(settings[position]) as ScoringKey[]).every((key) => settings[position][key] !== null),
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
    const winnerIndex = winnerIndexes.length === 1 ? winnerIndexes[0] : match.penaltyWinnerIndex;
    for (const player of match.players) {
      if (excludedUserIds.has(player.userId)) continue;
      const decidedByPenalties = winnerIndexes.length > 1 && match.penaltyWinnerIndex !== null;
      const draw = winnerIndexes.length > 1 && !decidedByPenalties;
      const won = !draw && player.teamIndex === winnerIndex;
      const lost = !draw && winnerIndex !== null && !won;
      const goalsConceded = match.scores.reduce((sum, score, index) => index === player.teamIndex ? sum : sum + score, 0);
      const cleanSheet = player.position === "GK" && goalsConceded === 0;
      const current = map.get(player.userId) ?? {
        userId: player.userId, name: player.name, matches: 0, wins: 0, losses: 0, penaltyWins: 0,
        goals: 0, goalsConceded: 0, cleanSheets: 0, currentWinStreak: 0, longestWinStreak: 0,
        points: configured ? 0 : null, evolutionLevel: 0, evolutionBonus: 0,
        awardBonus: awardBonusByUser[player.userId] ?? 0,
        initialOverall: initialOverallByUser[player.userId] ?? 50,
        currentOverall: initialOverallByUser[player.userId] ?? 50,
        positionAppearances: { GK: 0, DEF: 0, MID: 0, ATT: 0 }, breakdown: [],
      };
      current.matches += 1;
      current.wins += won ? 1 : 0;
      current.losses += lost ? 1 : 0;
      current.penaltyWins += won && winnerIndexes.length > 1 ? 1 : 0;
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
        criteria[draw ? "draw" : won ? "win" : "loss"] = draw ? rules.draw! : won ? rules.win! : rules.loss!;
        criteria.goal = player.goals * rules.goal!;
        if (decidedByPenalties && won) criteria.penaltyWin = rules.penaltyWin!;
        if (decidedByPenalties && lost) criteria.penaltyLoss = rules.penaltyLoss!;
        if (cleanSheet) criteria.cleanSheet = rules.cleanSheet!;
        if (player.position === "GK" && goalsConceded > 0) criteria.goalConceded = goalsConceded * rules.goalConceded!;
        if (won && current.currentWinStreak >= 3) criteria.winStreak = rules.winStreak!;
        matchPoints = Object.values(criteria).reduce((sum, value) => sum + (value ?? 0), 0);
        current.points = (current.points ?? 0) + matchPoints;
      }
      current.breakdown.push({ matchId: match.id, stageNumber: match.stageNumber, position: player.position, won, lost, penaltyWin: won && winnerIndexes.length > 1, goals: player.goals, goalsConceded, cleanSheet, winStreak: current.currentWinStreak, points: matchPoints, criteria });
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
    const stageScores = [...map.values()].map((player) => ({
      userId: player.userId,
      gk: player.breakdown.some((b) => b.stageNumber === stageNumber && b.position === "GK"),
      points: player.breakdown.filter((b) => b.stageNumber === stageNumber).reduce((sum, b) => sum + (b.points ?? 0), 0),
    }));
    const leaders = (gk: boolean) => {
      const candidates = stageScores.filter((item) => item.gk === gk);
      const top = Math.max(...candidates.map((item) => item.points), -Infinity);
      return Number.isFinite(top) ? candidates.filter((item) => item.points === top).map((item) => item.userId) : [];
    };
    return { stageNumber, fieldPlayerIds: configured ? leaders(false) : [], goalkeeperIds: configured ? leaders(true) : [] };
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
