import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db } from "@/lib/firebase";

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

export interface PlayerCardData {
  userId: string;
  groupId: string;
  playerName?: string;
  playerPhoto?: string | null;
  overall: number;
  position: PlayerPosition;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  jerseyNumber?: number | null;
  updatedAt?: unknown;
  updatedBy?: string;
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
  overall: number;
  position: PlayerPosition;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
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
export const defaultPlayerCard = (userId: string, groupId: string): PlayerCardData => ({ userId, groupId, overall: 65, position: "MID", pace: 65, shooting: 65, passing: 65, dribbling: 65, defending: 65, physical: 65, jerseyNumber: null });

export async function savePlayerCard(card: PlayerCardData, updatedBy: string): Promise<void> {
  await setDoc(doc(db, "playerCards", `${card.groupId}_${card.userId}`), { ...card, overall: clampRating(card.overall), pace: clampRating(card.pace), shooting: clampRating(card.shooting), passing: clampRating(card.passing), dribbling: clampRating(card.dribbling), defending: clampRating(card.defending), physical: clampRating(card.physical), updatedBy, updatedAt: serverTimestamp() }, { merge: true });
}
export async function getPlayerCards(groupId: string): Promise<PlayerCardData[]> { const snap = await getDocs(query(collection(db, "playerCards"), where("groupId", "==", groupId))); return snap.docs.map((d) => d.data() as PlayerCardData); }
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
    (snap) => onChange(snap.docs.map((d) => d.data() as PlayerCardData)),
    (error) => onError?.(reportPlayerCardsError(error, "Citirea cardurilor", "playerCards"))
  );
}

function stageConfigId(groupId: string, stageNumber: number): string { return `${groupId}_stage_${stageNumber}`; }
export async function saveStageConfig(params: { groupId: string; stageNumber: number; awardIds: string[]; votingOpen: boolean; published?: boolean }): Promise<void> {
  const ref = doc(db, "stageConfigs", stageConfigId(params.groupId, params.stageNumber));
  await setDoc(ref, { id: ref.id, groupId: params.groupId, stageNumber: params.stageNumber, awardIds: params.awardIds, votingOpen: params.votingOpen, published: params.published ?? false, updatedAt: serverTimestamp() }, { merge: true });
}
export async function getStageConfig(groupId: string, stageNumber: number): Promise<StageConfig | null> { const snap = await getDoc(doc(db, "stageConfigs", stageConfigId(groupId, stageNumber))); return snap.exists() ? (snap.data() as StageConfig) : null; }
export async function upsertStageCard(stageCard: Omit<StageCard, "id" | "createdAt">): Promise<void> { await setDoc(doc(db, "stageCards", `${stageCard.groupId}_${stageCard.stageId}_${stageCard.userId}`), { ...stageCard, createdAt: serverTimestamp() }, { merge: true }); }
export async function createStageVote(params: { groupId: string; stageId: string; awardId: string; voterUserId: string; candidateUserId: string }): Promise<void> { await setDoc(doc(db, "stageVotes", `${params.groupId}_${params.stageId}_${params.awardId}_${params.voterUserId}`), { ...params, createdAt: serverTimestamp() }, { merge: false }); }

export async function getStageVotes(groupId: string, stageId: string) {
  const snap = await getDocs(query(collection(db, "stageVotes"), where("groupId", "==", groupId), where("stageId", "==", stageId)));
  return snap.docs.map((d) => d.data() as { groupId: string; stageId: string; awardId: string; voterUserId: string; candidateUserId: string; });
}

export async function getMyStageVotes(groupId: string, stageId: string, userId: string) {
  const snap = await getDocs(query(collection(db, "stageVotes"), where("groupId", "==", groupId), where("stageId", "==", stageId), where("voterUserId", "==", userId)));
  return snap.docs.map((d) => d.data() as { groupId: string; stageId: string; awardId: string; voterUserId: string; candidateUserId: string; });
}
