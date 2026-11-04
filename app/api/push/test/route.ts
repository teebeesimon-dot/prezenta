import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/server/firebase-owner-auth";
import { sendPushToUser } from "@/lib/server/push";
import type { PushPlatform } from "@/lib/push-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const uid = await requireFirebaseUser(request);
    const payload = await request.json().catch(() => ({})) as { platform?: unknown };
    if (payload.platform !== undefined && !isPushPlatform(payload.platform)) {
      return NextResponse.json({ ok: false, error: "Platforma dispozitivului nu este acceptata." }, { status: 400 });
    }
    const result = await sendPushToUser(
      uid,
      "Prezenta",
      "Notificarea de test functioneaza. Acest dispozitiv este conectat.",
      payload.platform as PushPlatform | undefined,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trimiterea notificarii a esuat.";
    const status = (message.includes("Autentificare") || message.includes("Sesiune")) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

function isPushPlatform(value: unknown): value is PushPlatform {
  return value === "web" || value === "ios-web" || value === "android";
}
