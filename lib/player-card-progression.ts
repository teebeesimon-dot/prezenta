import type {
  GoalkeeperAttributes,
  OutfieldAttributes,
  PlayerCardData,
  PlayerPosition,
} from "@/lib/player-cards";

export type PlayerForm = "in_form" | "stable" | "out_of_form";

export interface AttributeDelta {
  key: keyof OutfieldAttributes | keyof GoalkeeperAttributes | "overall";
  amount: number;
}

const ATTRIBUTE_WEIGHTS: Record<
  PlayerPosition,
  Partial<Record<keyof OutfieldAttributes | keyof GoalkeeperAttributes, number>>
> = {
  GK: { diving: 1, handling: 1, kicking: 1, reflexes: 1, speed: 1, positioning: 1 },
  DEF: { pace: 0.7, shooting: 0.25, passing: 0.7, dribbling: 0.45, defending: 1.4, physical: 1.2 },
  MID: { pace: 0.65, shooting: 0.65, passing: 1.35, dribbling: 1.2, defending: 0.65, physical: 0.75 },
  ATT: { pace: 1.15, shooting: 1.45, passing: 0.65, dribbling: 1.2, defending: 0.2, physical: 0.7 },
};

export function suggestedOverall(card: PlayerCardData): number {
  const weights = ATTRIBUTE_WEIGHTS[card.position];
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += Number(card[key as keyof PlayerCardData] ?? 65) * Number(weight);
    weightTotal += Number(weight);
  }
  return Math.min(99, Math.max(1, Math.round(total / weightTotal)));
}

export function classifyForm(recentOverallDeltas: readonly number[]): PlayerForm {
  const recent = recentOverallDeltas.slice(-3);
  const score = recent.reduce((sum, value) => sum + value, 0);
  if (score >= 3) return "in_form";
  if (score <= -2) return "out_of_form";
  return "stable";
}

export function awardDeltas(
  awardIds: readonly string[],
  position: PlayerPosition,
): AttributeDelta[] {
  const deltas: AttributeDelta[] = [];
  const add = (key: AttributeDelta["key"], amount: number) => deltas.push({ key, amount });
  for (const awardId of awardIds) {
    add("overall", awardId === "mvp" ? 2 : 1);
    if (position === "GK") {
      if (awardId === "best_goalkeeper") { add("reflexes", 2); add("positioning", 2); }
      else if (awardId === "fair_play") add("handling", 1);
      else add("reflexes", 1);
      continue;
    }
    if (["top_scorer", "best_attacker", "best_goal"].includes(awardId)) { add("shooting", 2); add("pace", 1); }
    else if (["best_midfielder", "best_assist"].includes(awardId)) { add("passing", 2); add("dribbling", 1); }
    else if (awardId === "best_defender") { add("defending", 2); add("physical", 1); }
    else if (["fighter", "fair_play"].includes(awardId)) add("physical", 1);
    else add("dribbling", 1);
  }
  return deltas;
}

export function applyDeltas(card: PlayerCardData, deltas: readonly AttributeDelta[]): PlayerCardData {
  const next = { ...card };
  for (const delta of deltas) {
    const current = Number(next[delta.key as keyof PlayerCardData] ?? 65);
    (next as unknown as Record<string, unknown>)[delta.key] = Math.min(99, Math.max(1, current + delta.amount));
  }
  return next;
}
