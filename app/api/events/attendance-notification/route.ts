import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/server/firebase-owner-auth";
import { notifyAttendanceChange } from "@/lib/server/event-notifications";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const uid = await requireFirebaseUser(request);
    const payload = await request.json() as {
      eventId?: unknown;
      previousStatus?: unknown;
      currentStatus?: unknown;
    };
    if (typeof payload.eventId !== "string" || !payload.eventId ||
        !["vin", "poate", "nu_vin"].includes(String(payload.currentStatus))) {
      return NextResponse.json({ ok: false, error: "Date invalide." }, { status: 400 });
    }
    await notifyAttendanceChange({
      eventId: payload.eventId,
      actorUid: uid,
      previousStatus: typeof payload.previousStatus === "string" ? payload.previousStatus : null,
      currentStatus: String(payload.currentStatus),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notificarile nu au putut fi procesate.";
    const status = message.includes("Autentificare") || message.includes("Sesiune") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
