import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/server/firebase-owner-auth";
import { sendPushToUser } from "@/lib/server/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const uid = await requireFirebaseUser(request);
    const result = await sendPushToUser(
      uid,
      "Prezenta",
      "Notificarea de test functioneaza. Acest dispozitiv este conectat.",
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trimiterea notificarii a esuat.";
    const status = message.includes("Autentificare") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
