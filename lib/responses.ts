import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
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
  const previousStatus = existing.exists() ? (existing.data().status as AttendanceStatus) : null;

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
  }

  else await setDoc(docRef, {
    eventId,
    userId,
    userName,
    userPhoto,
    status,
    paid: false,
    createdAt: now,
    ...(status === "vin" ? { goingRegisteredAt: now } : {}),
  });

  try {
    const currentUser = getAuth().currentUser;
    const token = await currentUser?.getIdToken();
    if (token) {
      await fetch("/api/events/attendance-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, previousStatus, currentStatus: status }),
      });
    }
  } catch (error) {
    console.error("Nu am putut procesa notificarile de prezenta:", error);
  }
}
