import { NextRequest, NextResponse } from "next/server";
import { sendDueEventReminders } from "@/lib/server/event-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Neautorizat." }, { status: 401 });
  }
  try {
    const result = await sendDueEventReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Event reminder cron failed:", error);
    return NextResponse.json({ ok: false, error: "Reminder-ele nu au putut fi procesate." }, { status: 500 });
  }
}
