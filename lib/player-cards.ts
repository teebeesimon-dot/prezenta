import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db } from "@/lib/firebase";
import { assertGroupOwner } from "@/lib/group-ownership";
import {
  applyDeltas,
  awardDeltas,
  classifyForm,
  suggestedOverall,
} from "@/lib/player-card-progression";

const FIRESTORE_ERROR_MESSAGES: Record<string, string> = {
  "permission-denied": "Nu ai permisiunea necesară. Verifică rolul de administrator și regulile Firestore publicate.",
  unauthenticated: "Sesiunea a expirat. Autentifică-te din nou și reîncearcă.",
  unavailable: "Serviciul Firestore este indisponibil momentan. Reîncearcă în câteva secunde.",
  "failed-precondition": "Operația necesită o configurare Firestore suplimentară, de exemplu un index.",
  "already-exists": "Această înregistrare există deja.",
  "not-found": "Înregistrarea solicitată nu mai există.",
};

export function playerCardsErrorMessage(error: unknown, operation: string, collectionName: string): string {
  const code = error instanceof FirebaseError ? error.code.replace("firestore/", "") : "unknown";
  const detail = FIRESTORE_ERROR_MESSAGES[code] ?? "A apărut o eroare neașteptată. Reîncearcă.";
  return `${operation} (${collectionName}): ${detail}`;
}

export function reportPlayerCardsError(error: unknown, operation: string, collectionName: string): string {
  console.error(`[Player Cards] ${operation} failed for ${collectionName}`, error);
  return playerCardsErrorMessage(error, operation, collectionName);
}

export type PlayerPosition = "GK" | "DEF" | "MID" | "ATT";
export type CardTier = "bronze" | "silver" | "gold";

export const PLAYER_POSITIONS: ReadonlyArray<{ value: PlayerPosition; label: string }> = [
  { value: "GK", label: "Portar" },
  { value: "DEF", label: "Fundaș" },
  { value: "MID", label: "Mijlocaș" },
  { value: "ATT", label: "Atacant" },
];

export interface OutfieldAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface GoalkeeperAttributes {
  diving: number;
  handling: number;
  kicking: number;
  reflexes: number;
  speed: number;
  positioning: number;
}

export interface PlayerCardData extends OutfieldAttributes, GoalkeeperAttributes {
  userId: string;
  groupId: string;
  playerName?: string;
  playerPhoto?: string | null;
  cardImageUrl?: string | null;
  overall: number;
  position: PlayerPosition;
  jerseyNumber?: number | null;
  suggestedOverall?: number;
  form?: "in_form" | "stable" | "out_of_form";
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface PlayerCardHistoryEntry {
  id: string;
  groupId: string;
  userId: string;
  stageId?: string | null;
  stageNumber?: number | null;
  reason: "manual" | "award";
  before: PlayerCardData;
  after: PlayerCardData;
  deltas?: Array<{ key: string; amount: number }>;
  awardIds?: string[];
  createdAt?: unknown;
  createdBy: string;
}

export interface StageAwardDefinition { id: string; label: string; description?: string; }
export interface StageAward { awardId: string; label: string; winnerUserId: string; winnerName: string; winnerPhoto: string | null; votes: number; }
export interface StageConfig { id: string; groupId: string; stageNumber: number; awardIds: string[]; votingOpen: boolean; published: boolean; createdAt?: unknown; updatedAt?: unknown; }
export interface StageCard {
  id: string;
  groupId: string;
  stageId: string;
  stageNumber: number;
  userId: string;
  playerName: string;
  playerPhoto: string | null;
  cardImageUrl?: string | null;
  overall: number;
  position: PlayerPosition;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  diving: number;
  handling: number;
  kicking: number;
  reflexes: number;
  speed: number;
  positioning: number;
  jerseyNumber?: number | null;
  awardIds: string[];
  awards: StageAward[];
  activeFrom?: unknown;
  activeUntil?: unknown;
  createdAt?: unknown;
}

export const STAGE_AWARD_OPTIONS: StageAwardDefinition[] = [
  { id: "mvp", label: "Omul etapei" },
  { id: "top_scorer", label: "Golgeterul etapei" },
  { id: "best_goalkeeper", label: "Portarul etapei" },
  { id: "best_defender", label: "Fundasul etapei" },
  { id: "best_midfielder", label: "Mijlocasul etapei" },
  { id: "best_attacker", label: "Atacantul etapei" },
  { id: "best_goal", label: "Golul etapei" },
  { id: "best_assist", label: "Assistul etapei" },
  { id: "breakthrough", label: "Revelatia etapei" },
  { id: "fair_play", label: "Fair Play" },
  { id: "fighter", label: "Luptatorul etapei" },
];

export function getCardTier(overall: number): CardTier { if (overall >= 75) return "gold"; if (overall >= 65) return "silver"; return "bronze"; }
export function clampRating(value: number): number { return Math.min(99, Math.max(1, Math.round(value))); }

const DEFAULT_RATING = 65;
const OUTFIELD_KEYS: Array<keyof OutfieldAttributes> = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];
const GOALKEEPER_KEYS: Array<keyof GoalkeeperAttributes> = ["diving", "handling", "kicking", "reflexes", "speed", "positioning"];

export function goalkeeperAttributeAverage(card: GoalkeeperAttributes): number {
  return Math.round(GOALKEEPER_KEYS.reduce((total, key) => total + clampRating(card[key]), 0) / GOALKEEPER_KEYS.length);
}

export function isValidManualGoalkeeperOverall(card: Pick<PlayerCardData, "overall" | "position"> & Partial<GoalkeeperAttributes>): boolean {
  return card.position === "GK" && Number.isFinite(card.overall) && card.overall >= 1 && card.overall <= 99 && GOALKEEPER_KEYS.every((key) => Number.isFinite(card[key]) && Number(card[key]) >= 1 && Number(card[key]) <= 99);
}

export const defaultPlayerCard = (userId: string, groupId: string): PlayerCardData => ({
  userId,
  groupId,
  overall: DEFAULT_RATING,
  position: "MID",
  pace: DEFAULT_RATING,
  shooting: DEFAULT_RATING,
  passing: DEFAULT_RATING,
  dribbling: DEFAULT_RATING,
  defending: DEFAULT_RATING,
  physical: DEFAULT_RATING,
  diving: DEFAULT_RATING,
  handling: DEFAULT_RATING,
  kicking: DEFAULT_RATING,
  reflexes: DEFAULT_RATING,
  speed: DEFAULT_RATING,
  positioning: DEFAULT_RATING,
  jerseyNumber: null,
});

export function hydratePlayerCard(card: PlayerCardData): PlayerCardData {
  return {
    ...defaultPlayerCard(card.userId, card.groupId),
    ...card,
    diving: card.diving ?? card.pace ?? DEFAULT_RATING,
    handling: card.handling ?? card.defending ?? DEFAULT_RATING,
    kicking: card.kicking ?? card.passing ?? DEFAULT_RATING,
    reflexes: card.reflexes ?? card.dribbling ?? DEFAULT_RATING,
    speed: card.speed ?? card.physical ?? DEFAULT_RATING,
    positioning: card.positioning ?? card.shooting ?? DEFAULT_RATING,
  };
}

export async function savePlayerCard(card: PlayerCardData, updatedBy: string): Promise<void> {
  await assertGroupOwner(card.groupId, updatedBy);
  const ref = doc(db, "playerCards", `${card.groupId}_${card.userId}`);
  const existing = await getDoc(ref);
  const before = hydratePlayerCard(
    existing.exists() ? (existing.data() as PlayerCardData) : defaultPlayerCard(card.userId, card.groupId),
  );
  const hydrated = hydratePlayerCard(card);
  const shared = {
    userId: hydrated.userId,
    groupId: hydrated.groupId,
    playerName: hydrated.playerName ?? null,
    playerPhoto: hydrated.playerPhoto ?? null,
    cardImageUrl: hydrated.cardImageUrl ?? null,
    overall: clampRating(hydrated.overall),
    position: hydrated.position,
    jerseyNumber: hydrated.jerseyNumber ?? null,
    updatedBy,
    updatedAt: serverTimestamp(),
  };
  const attributes = hydrated.position === "GK"
    ? {
        diving: clampRating(hydrated.diving), handling: clampRating(hydrated.handling), kicking: clampRating(hydrated.kicking),
        reflexes: clampRating(hydrated.reflexes), speed: clampRating(hydrated.speed), positioning: clampRating(hydrated.positioning),
        ...Object.fromEntries(OUTFIELD_KEYS.map((key) => [key, deleteField()])),
      }
    : {
        pace: clampRating(hydrated.pace), shooting: clampRating(hydrated.shooting), passing: clampRating(hydrated.passing),
        dribbling: clampRating(hydrated.dribbling), defending: clampRating(hydrated.defending), physical: clampRating(hydrated.physical),
        ...Object.fromEntries(GOALKEEPER_KEYS.map((key) => [key, deleteField()])),
      };
  const after = hydratePlayerCard({
    ...hydrated,
    overall: shared.overall,
    suggestedOverall: suggestedOverall(hydrated),
    form: hydrated.form ?? "stable",
  });
  await setDoc(ref, { ...shared, ...attributes, suggestedOverall: after.suggestedOverall, form: after.form }, { merge: true });
  const historyRef = doc(collection(db, "playerCardHistory"));
  await setDoc(historyRef, {
    id: historyRef.id,
    groupId: card.groupId,
    userId: card.userId,
    stageId: null,
    stageNumber: null,
    reason: "manual",
    before,
    after,
    createdAt: serverTimestamp(),
    createdBy: updatedBy,
  });
}
export async function updatePlayerCardPhoto(groupId: string, userId: string, cardImageUrl: string): Promise<void> {
  await updateDoc(doc(db, "playerCards", `${groupId}_${userId}`), {
    cardImageUrl,
    updatedAt: serverTimestamp(),
  });
}

export async function getPlayerCards(groupId: string): Promise<PlayerCardData[]> { const snap = await getDocs(query(collection(db, "playerCards"), where("groupId", "==", groupId))); return snap.docs.map((d) => hydratePlayerCard(d.data() as PlayerCardData)); }
export function subscribePlayerCards(
  groupId: string,
  onChange: (cards: PlayerCardData[]) => void,
  onError?: (message: string) => void
): () => void {
  if (!groupId) {
    onChange([]);
    return () => {};
  }

  return onSnapshot(
    query(collection(db, "playerCards"), where("groupId", "==", groupId)),
    (snap) => onChange(snap.docs.map((d) => hydratePlayerCard(d.data() as PlayerCardData))),
    (error) => onError?.(reportPlayerCardsError(error, "Citirea cardurilor", "playerCards"))
  );
}

function stageConfigId(groupId: string, stageNumber: number): string { return `${groupId}_stage_${stageNumber}`; }
export async function saveStageConfig(params: { groupId: string; stageNumber: number; awardIds: string[]; votingOpen: boolean; published?: boolean; updatedBy: string }): Promise<void> {
  await assertGroupOwner(params.groupId, params.updatedBy);
  const ref = doc(db, "stageConfigs", stageConfigId(params.groupId, params.stageNumber));
  await setDoc(ref, { id: ref.id, groupId: params.groupId, stageNumber: params.stageNumber, awardIds: params.awardIds, votingOpen: params.votingOpen, published: params.published ?? false, updatedAt: serverTimestamp() }, { merge: true });
}
export async function getStageConfig(groupId: string, stageNumber: number): Promise<StageConfig | null> { const snap = await getDoc(doc(db, "stageConfigs", stageConfigId(groupId, stageNumber))); return snap.exists() ? (snap.data() as StageConfig) : null; }
export async function upsertStageCard(stageCard: Omit<StageCard, "id" | "createdAt">, updatedBy: string): Promise<void> {
  await assertGroupOwner(stageCard.groupId, updatedBy);
  await setDoc(doc(db, "stageCards", `${stageCard.groupId}_${stageCard.stageId}_${stageCard.userId}`), { ...stageCard, activeFrom: serverTimestamp(), activeUntil: null, createdAt: serverTimestamp() }, { merge: true });
}
export async function createStageVote(params: { groupId: string; stageId: string; awardId: string; voterUserId: string; candidateUserId: string }): Promise<void> {
  if (params.voterUserId === params.candidateUserId) throw new Error("Nu te poți vota pe tine.");
  await setDoc(doc(db, "stageVotes", `${params.groupId}_${params.stageId}_${params.awardId}_${params.voterUserId}`), { ...params, createdAt: serverTimestamp() }, { merge: false });
}

export async function getStageVotes(groupId: string, stageId: string) {
  const snap = await getDocs(query(collection(db, "stageVotes"), where("groupId", "==", groupId), where("stageId", "==", stageId)));
  return snap.docs.map((d) => d.data() as { groupId: string; stageId: string; awardId: string; voterUserId: string; candidateUserId: string; });
}

export async function applyStageAwardsToPlayer(params: {
  groupId: string;
  stageId: string;
  stageNumber: number;
  userId: string;
  awardIds: string[];
  updatedBy: string;
}): Promise<PlayerCardData> {
  await assertGroupOwner(params.groupId, params.updatedBy);
  const historyId = `${params.groupId}_${params.stageId}_${params.userId}_award`;
  const historyRef = doc(db, "playerCardHistory", historyId);
  const existingHistory = await getDoc(historyRef);
  const cardRef = doc(db, "playerCards", `${params.groupId}_${params.userId}`);
  const cardSnap = await getDoc(cardRef);
  const before = hydratePlayerCard(cardSnap.exists()
    ? (cardSnap.data() as PlayerCardData)
    : defaultPlayerCard(params.userId, params.groupId));
  if (existingHistory.exists()) {
    return hydratePlayerCard((existingHistory.data() as PlayerCardHistoryEntry).after);
  }
  const deltas = awardDeltas(params.awardIds, before.position);
  const afterWithBonus = applyDeltas(before, deltas);
  const previousHistory = await getDocs(query(
    collection(db, "playerCardHistory"),
    where("groupId", "==", params.groupId),
    where("userId", "==", params.userId),
  ));
  const recentDeltas = previousHistory.docs
    .map((entry) => entry.data() as PlayerCardHistoryEntry)
    .filter((entry) => entry.reason === "award")
    .sort((a, b) => Number(a.stageNumber ?? 0) - Number(b.stageNumber ?? 0))
    .slice(-2)
    .map((entry) => entry.after.overall - entry.before.overall);
  const after = hydratePlayerCard({
    ...afterWithBonus,
    suggestedOverall: suggestedOverall(afterWithBonus),
    form: classifyForm([...recentDeltas, afterWithBonus.overall - before.overall]),
    updatedBy: params.updatedBy,
  });
  await setDoc(cardRef, { ...after, updatedAt: serverTimestamp() }, { merge: true });
  await setDoc(historyRef, {
    id: historyId,
    groupId: params.groupId,
    userId: params.userId,
    stageId: params.stageId,
    stageNumber: params.stageNumber,
    reason: "award",
    before,
    after,
    deltas,
    awardIds: params.awardIds,
    createdAt: serverTimestamp(),
    createdBy: params.updatedBy,
  });
  return after;
}

export async function getPlayerCardHistory(groupId: string, userId: string): Promise<PlayerCardHistoryEntry[]> {
  const snap = await getDocs(query(
    collection(db, "playerCardHistory"),
    where("groupId", "==", groupId),
    where("userId", "==", userId),
  ));
  return snap.docs
    .map((entry) => entry.data() as PlayerCardHistoryEntry)
    .sort((a, b) => Number(b.stageNumber ?? 0) - Number(a.stageNumber ?? 0));
}

export async function getMyStageVotes(groupId: string, stageId: string, userId: string) {
  const snap = await getDocs(query(collection(db, "stageVotes"), where("groupId", "==", groupId), where("stageId", "==", stageId), where("voterUserId", "==", userId)));
  return snap.docs.map((d) => d.data() as { groupId: string; stageId: string; awardId: string; voterUserId: string; candidateUserId: string; });
}
