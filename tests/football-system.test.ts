import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyScoringSettings,
  recalculateFootballSystem,
  validateFootballMatchWinner,
  type FootballMatch,
  type ScoringSettings,
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
} from "../lib/football-system.ts";

const scoring: ScoringSettings = emptyScoringSettings();
for (const position of ["GK", "DEF", "MID", "ATT"] as const) {
  scoring[position] = {
    win: 3,
    loss: -1,
    goal: 2,
    penaltyWin: 2,
    penaltyLoss: 0,
    cleanSheet: 1,
    goalConceded: -1,
    winStreak: 4,
  };
}

function match(id: string, scores: number[], penaltyWinnerIndex: number | null = null, order = 1): FootballMatch {
  return {
    id,
    groupId: "group",
    eventId: "event",
    stageNumber: 1,
    matchOrder: order,
    playedAt: order,
    teamNames: ["Echipa A", "Echipa B"],
    scores,
    penaltyWinnerIndex,
    players: [
      { userId: "a", name: "A", teamIndex: 0, position: "MID", goals: 0 },
      { userId: "b", name: "B", teamIndex: 1, position: "MID", goals: 0 },
    ],
  };
}

function calculate(matches: FootballMatch[]) {
  return recalculateFootballSystem(matches, { a: 70, b: 70 }, scoring, [], {}).progress;
}

test("2-1 produce victorie și înfrângere", () => {
  const [winner, loser] = calculate([match("m1", [2, 1])]);
  assert.equal(winner.userId, "a");
  assert.equal(winner.wins, 1);
  assert.equal(loser.losses, 1);
});

test("1-2 inversează câștigătoarea", () => {
  const progress = calculate([match("m1", [1, 2])]);
  assert.equal(progress.find((player) => player.userId === "a")?.losses, 1);
  assert.equal(progress.find((player) => player.userId === "b")?.wins, 1);
});

test("2-2 cere obligatoriu câștigătoare la penalty", () => {
  assert.throws(() => validateFootballMatchWinner(match("m1", [2, 2])), /obligatoriu/);
  assert.throws(() => calculate([match("m1", [2, 2])]), /câștigător valid/);
});

test("Echipa A primește exclusiv victorie penalty", () => {
  const progress = calculate([match("m1", [2, 2], 0)]);
  const winner = progress.find((player) => player.userId === "a")!;
  const loser = progress.find((player) => player.userId === "b")!;
  assert.equal(winner.penaltyWins, 1);
  assert.equal(loser.penaltyLosses, 1);
  assert.deepEqual(winner.breakdown[0].criteria, { penaltyWin: 2, goal: 0 });
  assert.deepEqual(loser.breakdown[0].criteria, { penaltyLoss: 0, goal: 0 });
});

test("Echipa B primește exclusiv victorie penalty", () => {
  const progress = calculate([match("m1", [2, 2], 1)]);
  assert.equal(progress.find((player) => player.userId === "a")?.penaltyLosses, 1);
  assert.equal(progress.find((player) => player.userId === "b")?.penaltyWins, 1);
});

test("scorul neegal elimină automat selecția penalty", () => {
  assert.equal(validateFootballMatchWinner(match("m1", [3, 2], 0)).penaltyWinnerIndex, null);
});

test("victoria la penalty continuă seria de victorii", () => {
  const progress = calculate([
    match("m1", [1, 0], null, 1),
    match("m2", [1, 1], 0, 2),
    match("m3", [2, 0], null, 3),
    match("m4", [2, 2], 0, 4),
  ]);
  const player = progress.find((item) => item.userId === "a")!;
  assert.equal(player.currentWinStreak, 4);
  assert.equal(player.longestWinStreak, 4);
  assert.equal(player.breakdown[3].criteria.winStreak, 4);
});
