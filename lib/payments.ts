import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type PaymentMap = Record<string, boolean | "paid" | "unpaid">;

export function isPaid(payments: PaymentMap, userId: string): boolean {
  return payments[userId] === true || payments[userId] === "paid";
}

export async function setPaymentStatus(
  eventId: string,
  userId: string,
  paid: boolean,
): Promise<void>;
export async function setPaymentStatus(
  eventId: string,
  currentPayments: Record<string, "paid" | "unpaid">,
  userId: string,
  paid: boolean,
): Promise<void>;
export async function setPaymentStatus(
  eventId: string,
  userIdOrPayments: string | Record<string, "paid" | "unpaid">,
  paidOrUserId: boolean | string,
  legacyPaid?: boolean,
): Promise<void> {
  if (typeof userIdOrPayments === "string") {
    await updateDoc(doc(db, "responses", `${eventId}_${userIdOrPayments}`), {
      paid: paidOrUserId as boolean,
    });
    return;
  }

  const next = { ...userIdOrPayments };
  const userId = paidOrUserId as string;
  if (legacyPaid) next[userId] = "paid";
  else delete next[userId];
  await updateDoc(doc(db, "events", eventId), { payments: next });
}

export async function setAllPaymentStatuses(
  eventId: string,
  userIds: string[],
  paid: boolean,
): Promise<void> {
  const batch = writeBatch(db);
  userIds.forEach((userId) => {
    batch.update(doc(db, "responses", `${eventId}_${userId}`), { paid });
  });
  await batch.commit();
}
