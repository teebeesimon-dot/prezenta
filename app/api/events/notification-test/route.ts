import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/server/firebase-owner-auth";
import { sendPushToUser, firestoreString, getFirestoreDocument } from "@/lib/server/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messages = {
  reminder: {
    title: "Reminder: evenimentul este astazi",
    body: "Acesta este un test al notificarii de reminder pentru ziua evenimentului.",
  },
  capacity: {
    title: "Locuri ocupate",
    body: "Acesta este un test al notificarii trimise cand toate locurile sunt ocupate.",
  },
  vacancy: {
    title: "S-a eliberat un loc",
    body: "Acesta este un test al notificarii pentru un loc devenit disponibil.",
  },
  promotion: {
    title: "Ai fost promovat din lista de asteptare",
    body: "Acesta este un test al notificarii de promovare. Nu s-a schimbat lista reala.",
  },
  cancellation: {
    title: "Eveniment anulat",
    body: "Acesta este un test al notificarii de anulare. Evenimentul real nu a fost anulat.",
  },
} as const;

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, error: "Testele sunt disponibile doar in Preview." }, { status: 404 });
  }

  try {
    const uid = await requireFirebaseUser(request);
    const payload = await request.json() as { eventId?: unknown; type?: unknown };
    if (typeof payload.eventId !== "string" || !payload.eventId ||
        typeof payload.type !== "string" || !(payload.type in messages)) {
      return NextResponse.json({ ok: false, error: "Date de test invalide." }, { status: 400 });
    }

    const event = await getFirestoreDocument(`events/${encodeURIComponent(payload.eventId)}`);
    if (!event) return NextResponse.json({ ok: false, error: "Evenimentul nu exista." }, { status: 404 });
    const profile = await getFirestoreDocument(`users/${encodeURIComponent(uid)}`);
    const isSuperAdmin = profile ? firestoreString(profile, "role") === "super_admin" : false;
    if (firestoreString(event, "ownerId") !== uid && !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: "Doar organizatorul poate testa notificarile acestui eveniment." }, { status: 403 });
    }

    const message = messages[payload.type as keyof typeof messages];
    const saved = event.fields?.notificationTemplates?.mapValue?.fields?.[payload.type]?.mapValue?.fields;
    const eventTitle = firestoreString(event, "title") || "Eveniment";
    const values: Record<string, string> = {
      eventTitle,
      eventTime: firestoreString(event, "time"),
      location: firestoreString(event, "locationName") || firestoreString(event, "location"),
      capacity: String(Number(event.fields?.maxParticipants?.integerValue ?? 0)),
      participantName: "Participant",
    };
    const replace = (value: string) => value.replace(/\{(eventTitle|eventTime|location|capacity|participantName)\}/g, (match, name: string) => values[name] ?? match);
    const title = replace(saved?.title?.stringValue || message.title);
    const body = replace(saved?.body?.stringValue || message.body);
    const result = await sendPushToUser(uid, title, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notificarea de test nu a putut fi trimisa.";
    const status = message.includes("Autentificare") || message.includes("Sesiune") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
