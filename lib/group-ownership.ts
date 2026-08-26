import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function getGroupOwnerId(groupId: string): Promise<string | null> {
  const seriesSnap = await getDoc(doc(db, "series", groupId));
  if (seriesSnap.exists()) return (seriesSnap.data().ownerId as string) ?? null;

  const eventSnap = await getDoc(doc(db, "events", groupId));
  return eventSnap.exists() ? ((eventSnap.data().ownerId as string) ?? null) : null;
}

export async function assertGroupOwner(groupId: string, userId: string): Promise<void> {
  const ownerId = await getGroupOwnerId(groupId);
  if (!ownerId || ownerId !== userId) {
    throw new Error("Doar administratorul evenimentului poate face această modificare.");
  }
}
