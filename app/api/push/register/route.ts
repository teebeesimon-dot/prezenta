import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/server/firebase-owner-auth";
import {
  registerPushToken,
  unregisterPushToken,
} from "@/lib/server/push";
import type { PushPlatform } from "@/lib/push-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const uid = await requireFirebaseUser(request);
    const payload = await request.json() as { token?: unknown; platform?: unknown };
    if (typeof payload.token !== "string" || !payload.token || payload.token.length > 4096) {
      return NextResponse.json({ ok: false, error: "Tokenul dispozitivului nu este valid." }, { status: 400 });
    }
    if (!isPushPlatform(payload.platform)) {
      return NextResponse.json({ ok: false, error: "Platforma dispozitivului nu este acceptata." }, { status: 400 });
    }
    const result = await registerPushToken(uid, payload.token, payload.platform);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inregistrarea notificarilor a esuat.";
    const status = (message.includes("Autentificare") || message.includes("Sesiune")) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = await requireFirebaseUser(request);
    const payload = await request.json() as { token?: unknown; platform?: unknown };
    if (typeof payload.token !== "string" || !payload.token || payload.token.length > 4096) {
      return NextResponse.json({ ok: false, error: "Tokenul dispozitivului nu este valid." }, { status: 400 });
    }
    if (!isPushPlatform(payload.platform)) {
      return NextResponse.json({ ok: false, error: "Platforma dispozitivului nu este acceptata." }, { status: 400 });
    }
    const result = await unregisterPushToken(uid, payload.token);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dezactivarea notificarilor a esuat.";
    const status = (message.includes("Autentificare") || message.includes("Sesiune")) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

function isPushPlatform(value: unknown): value is PushPlatform {
  return value === "web" || value === "ios-web" || value === "android";
}
