import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceStatus } from "@/lib/types";

function buildResponseId(eventId: string, userId: string): string {
  return `${eventId}_${userId}`;
}

export async function saveResponse(
  eventId: string,
  userId: string,
  userName: string,
  userPhoto: string | null,
  status: AttendanceStatus
): Promise<void> {
  const docRef = doc(db, "responses", buildResponseId(eventId, userId));
  const existing = await getDoc(docRef);
  const now = Timestamp.now();

  if (existing.exists()) {
    const data = existing.data();
    const updates: Record<string, unknown> = {
      status,
      userName,
      userPhoto,
      updatedAt: now,
    };

    if (status === "vin" && !data.goingRegisteredAt) {
      updates.goingRegisteredAt = now;
    }

    await updateDoc(docRef, updates);
    return;
  }

  await setDoc(docRef, {
    eventId,
    userId,
    userName,
    userPhoto,
    status,
    paid: false,
    createdAt: now,
    ...(status === "vin" ? { goingRegisteredAt: now } : {}),
  });
}
