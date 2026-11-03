import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/server/firebase-owner-auth";
import { cancelEventAndNotify } from "@/lib/server/event-notifications";
import { firestoreAccess, firestoreString, getFirestoreDocument } from "@/lib/server/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const uid = await requireFirebaseUser(request);
    const payload = await request.json() as { eventId?: unknown };
    if (typeof payload.eventId !== "string" || !payload.eventId) {
      return NextResponse.json({ ok: false, error: "Eveniment invalid." }, { status: 400 });
    }
    const path = `events/${encodeURIComponent(payload.eventId)}`;
    const event = await getFirestoreDocument(path);
    if (!event) return NextResponse.json({ ok: false, error: "Evenimentul nu exista." }, { status: 404 });
    const profile = await getFirestoreDocument(`users/${encodeURIComponent(uid)}`);
    const isSuperAdmin = profile ? firestoreString(profile, "role") === "super_admin" : false;
    if (firestoreString(event, "ownerId") !== uid && !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: "Doar organizatorul poate anula evenimentul." }, { status: 403 });
    }
    if (firestoreString(event, "status") === "cancelled") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }
    const { account, accessToken } = await firestoreAccess();
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/${path}?updateMask.fieldPaths=status&updateMask.fieldPaths=cancelledAt`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          status: { stringValue: "cancelled" },
          cancelledAt: { timestampValue: new Date().toISOString() },
        } }),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("Nu am putut anula evenimentul.");
    await cancelEventAndNotify(payload.eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anularea evenimentului a esuat.";
    const status = message.includes("Autentificare") || message.includes("Sesiune") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
