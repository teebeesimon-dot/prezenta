import assert from "node:assert/strict";
import {
  getHistoricalSeriesEvents,
  mergeSeriesOccurrences,
} from "../lib/historical-series-events.ts";

const footballLive = {
  id: "eCWio3E5cl50SU95fXYT",
  date: "2026-08-31",
  title: "Fotbal Soho (Goal Arena)",
};
const tennisLive = {
  id: "FyHjMfq8sp2W90uI38ut",
  date: "2026-09-01",
  title: "Tenis Arena",
};

const football = mergeSeriesOccurrences(
  getHistoricalSeriesEvents("production-series-id", footballLive.title),
  [footballLive],
);
const tennis = mergeSeriesOccurrences(
  getHistoricalSeriesEvents("another-production-series-id", tennisLive.title),
  [tennisLive],
);

assert.equal(football.filter(({ kind }) => kind === "archived").length, 9);
assert.equal(football.length, 10);
assert.equal(football.at(-1)?.kind, "live");
assert.equal(football.at(-1)?.event.id, footballLive.id);
assert.equal(tennis.filter(({ kind }) => kind === "archived").length, 7);
assert.equal(tennis.length, 8);
assert.equal(tennis.at(-1)?.kind, "live");
assert.equal(tennis.at(-1)?.event.id, tennisLive.id);

console.log("Historical series merge verified: Fotbal 9+1, Tenis 7+1.");
