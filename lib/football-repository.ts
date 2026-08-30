"use client";

import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribePlayerCards } from "@/lib/player-cards";
import { emptyScoringSettings, recalculateFootballSystem, type EvolutionLevel, type FootballMatch, type PlayerProgress, type ScoringSettings } from "@/lib/football-system";

const DEFAULT_EVOLUTION: EvolutionLevel[] = [1, 2, 3, 4, 5].map((level) => ({ level: level as 1|2|3|4|5, points: null, overallBonus: null }));

function mapMatch(id: string, data: Record<string, unknown>): FootballMatch {
  return {
    id, groupId: String(data.groupId ?? ""), eventId: String(data.eventId ?? ""),
    stageNumber: Number(data.stageNumber ?? 1), matchOrder: Number(data.matchOrder ?? 1),
    playedAt: typeof data.playedAt === "number" ? data.playedAt : Date.now(),
    teamNames: Array.isArray(data.teamNames) ? data.teamNames.map(String) : ["Echipa 1", "Echipa 2"],
    scores: Array.isArray(data.scores) ? data.scores.map(Number) : [0, 0],
    penaltyWinnerIndex: typeof data.penaltyWinnerIndex === "number" ? data.penaltyWinnerIndex : null,
    players: Array.isArray(data.players) ? data.players.map((p: Record<string, unknown>) => ({ userId: String(p.userId), name: String(p.name), teamIndex: Number(p.teamIndex), position: String(p.position ?? "MID") as FootballMatch["players"][number]["position"], goals: Number(p.goals ?? 0) })) : [],
  };
}

export function subscribeFootballMatches(groupId: string, callback: (matches: FootballMatch[]) => void) {
  return onSnapshot(query(collection(db, "footballMatches"), where("groupId", "==", groupId)), (snapshot) => callback(snapshot.docs.map((item) => mapMatch(item.id, item.data())).sort((a,b) => a.stageNumber-b.stageNumber || a.matchOrder-b.matchOrder)));
}
export function subscribeFootballProgress(groupId: string, callback: (progress: PlayerProgress[]) => void) {
  return onSnapshot(query(collection(db, "playerProgress"), where("groupId", "==", groupId)), (snapshot) => callback(snapshot.docs.map((item) => item.data() as PlayerProgress).sort((a,b) => (b.points ?? -Infinity)-(a.points ?? -Infinity))));
}
export function subscribeScoringSettings(groupId: string, callback: (value: ScoringSettings | null) => void) {
  return onSnapshot(doc(db, "scoringSettings", groupId), (snapshot) => callback(snapshot.exists() ? snapshot.data().positions as ScoringSettings : null));
}
export function subscribeEvolutionSettings(groupId: string, callback: (value: EvolutionLevel[]) => void) {
  return onSnapshot(doc(db, "evolutionSettings", groupId), (snapshot) => callback(snapshot.exists() && Array.isArray(snapshot.data().levels) ? snapshot.data().levels : DEFAULT_EVOLUTION));
}
export async function saveScoringSettings(groupId: string, positions: ScoringSettings, actorId: string) {
  await setDoc(doc(db, "scoringSettings", groupId), { groupId, positions, actorId, updatedAt: serverTimestamp() }, { merge: true });
  await recalculateGroup(groupId);
}
export async function saveEvolutionSettings(groupId: string, levels: EvolutionLevel[], actorId: string) {
  await setDoc(doc(db, "evolutionSettings", groupId), { groupId, levels, actorId, updatedAt: serverTimestamp() }, { merge: true });
  await recalculateGroup(groupId);
}
export async function createFootballMatch(input: Omit<FootballMatch, "id">, actorId: string) {
  const ref = await addDoc(collection(db, "footballMatches"), { ...input, actorId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await recalculateGroup(input.groupId);
  return ref.id;
}
export async function updateFootballMatch(match: FootballMatch, actorId: string) {
  const { id, ...data } = match;
  await updateDoc(doc(db, "footballMatches", id), { ...data, actorId, updatedAt: serverTimestamp() });
  await recalculateGroup(match.groupId);
}
export async function deleteFootballMatch(match: FootballMatch) {
  await deleteDoc(doc(db, "footballMatches", match.id));
  await recalculateGroup(match.groupId);
}

async function onceCards(groupId: string) {
  return await new Promise<Awaited<ReturnType<typeof collectCards>>>((resolve) => {
    const unsub = subscribePlayerCards(groupId, (cards) => { unsub(); resolve(cards); });
  });
}
async function collectCards() { return [] as Array<{userId:string; overall:number; initialOverall?:number; isLegend?:boolean}>; }

export async function recalculateGroup(groupId: string) {
  const [matchSnap, scoringSnap, evolutionSnap, awardSnap, cards] = await Promise.all([
    getDocs(query(collection(db, "footballMatches"), where("groupId", "==", groupId))),
    getDocs(query(collection(db, "scoringSettings"), where("groupId", "==", groupId))),
    getDocs(query(collection(db, "evolutionSettings"), where("groupId", "==", groupId))),
    getDocs(query(collection(db, "playerAwards"), where("groupId", "==", groupId))),
    onceCards(groupId),
  ]);
  const matches = matchSnap.docs.map((item) => mapMatch(item.id, item.data()));
  const scoring = scoringSnap.docs[0]?.data().positions as ScoringSettings | undefined;
  const levels = (evolutionSnap.docs[0]?.data().levels as EvolutionLevel[] | undefined) ?? DEFAULT_EVOLUTION;
  const awardBonus: Record<string, number> = {};
  awardSnap.docs.forEach((item) => { const d=item.data(); if (d.confirmed) awardBonus[String(d.userId)] = (awardBonus[String(d.userId)] ?? 0) + Number(d.overallBonus ?? 1); });
  const initial: Record<string, number> = {};
  const excluded = new Set<string>();
  cards.forEach((card) => { initial[card.userId] = Number(card.initialOverall ?? card.overall); if (card.isLegend) excluded.add(card.userId); });
  const result = recalculateFootballSystem(matches, initial, scoring ?? null, levels, awardBonus, excluded);
  const batch = writeBatch(db);
  result.progress.forEach((player) => {
    batch.set(doc(db, "playerProgress", `${groupId}_${player.userId}`), { ...player, groupId, rulesConfigured: result.configured, recalculatedAt: serverTimestamp() });
    batch.set(doc(db, "playerCards", `${groupId}_${player.userId}`), {
      initialOverall: player.initialOverall,
      currentOverall: player.currentOverall,
      evolutionLevel: player.evolutionLevel,
      evolutionBonus: player.evolutionBonus,
      awardBonus: player.awardBonus,
      cardType: player.evolutionLevel > 0 ? `evolution-${player.evolutionLevel}` : "standard",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  result.stageLeaders.forEach((leaders) => batch.set(doc(db, "stageAwardCandidates", `${groupId}_${leaders.stageNumber}`), { ...leaders, groupId, needsReview: leaders.fieldPlayerIds.length !== 1 || leaders.goalkeeperIds.length !== 1, recalculatedAt: serverTimestamp() }, { merge: true }));
  await batch.commit();
  return result;
}

export { DEFAULT_EVOLUTION, emptyScoringSettings };
