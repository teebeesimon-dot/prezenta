import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/server/firebase-owner-auth";
import { firestoreString, getFirestoreDocument, firestoreAccess } from "@/lib/server/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const keys = ["reminder", "capacity", "vacancy", "promotion", "cancellation"] as const;
type TemplateKey = typeof keys[number];
type Template = { title: string; body: string };
type Templates = Record<TemplateKey, Template>;

const defaults: Templates = {
  reminder: { title: "Astazi: {eventTitle}", body: "Ora {eventTime}. Locatie: {location}. Te asteptam la eveniment!" },
  capacity: { title: "Locuri ocupate: {eventTitle}", body: "Toate cele {capacity} locuri pentru eveniment sunt ocupate." },
  vacancy: { title: "S-a eliberat un loc: {eventTitle}", body: "Un loc este disponibil. Deschide evenimentul si confirma daca participi." },
  promotion: { title: "Ai fost promovat: {eventTitle}", body: "S-a eliberat un loc si ai acum o prezenta confirmata." },
  cancellation: { title: "Eveniment anulat: {eventTitle}", body: "Organizatorul a anulat acest eveniment." },
};

function readTemplates(event: NonNullable<Awaited<ReturnType<typeof getFirestoreDocument>>>): Templates {
  const saved = event.fields?.notificationTemplates?.mapValue?.fields ?? {};
  return Object.fromEntries(keys.map((key) => {
    const fields = saved[key]?.mapValue?.fields ?? {};
    return [key, {
      title: fields.title?.stringValue || defaults[key].title,
      body: fields.body?.stringValue || defaults[key].body,
    }];
  })) as Templates;
}

async function authorizedEvent(request: NextRequest, eventId: string) {
  const uid = await requireFirebaseUser(request);
  const event = await getFirestoreDocument(`events/${encodeURIComponent(eventId)}`);
  if (!event) return { uid, event: null, error: "Evenimentul nu exista.", status: 404 };
  const profile = await getFirestoreDocument(`users/${encodeURIComponent(uid)}`);
  const isSuperAdmin = profile ? firestoreString(profile, "role") === "super_admin" : false;
  if (firestoreString(event, "ownerId") !== uid && !isSuperAdmin) {
    return { uid, event: null, error: "Doar organizatorul poate modifica mesajele acestui eveniment.", status: 403 };
  }
  return { uid, event, error: "", status: 200 };
}

export async function GET(request: NextRequest) {
  try {
    const eventId = new URL(request.url).searchParams.get("eventId") || "";
    if (!eventId) return NextResponse.json({ ok: false, error: "Lipseste eventId." }, { status: 400 });
    const result = await authorizedEvent(request, eventId);
    if (!result.event) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, templates: readTemplates(result.event) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu am putut incarca mesajele.";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("Autentificare") || message.includes("Sesiune") ? 401 : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json() as { eventId?: unknown; templates?: unknown };
    if (typeof payload.eventId !== "string" || !payload.eventId || !payload.templates || typeof payload.templates !== "object") {
      return NextResponse.json({ ok: false, error: "Date invalide." }, { status: 400 });
    }
    const result = await authorizedEvent(request, payload.eventId);
    if (!result.event) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    const incoming = payload.templates as Record<string, unknown>;
    const templates = {} as Templates;
    for (const key of keys) {
      const item = incoming[key] as { title?: unknown; body?: unknown } | undefined;
      if (!item || typeof item.title !== "string" || typeof item.body !== "string" ||
          !item.title.trim() || !item.body.trim() || item.title.length > 120 || item.body.length > 500) {
        return NextResponse.json({ ok: false, error: "Fiecare regula trebuie sa aiba titlu (max. 120 caractere) si mesaj (max. 500 caractere)." }, { status: 400 });
      }
      templates[key] = { title: item.title.trim(), body: item.body.trim() };
    }
    const { account, accessToken } = await firestoreAccess();
    const url = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/events/${encodeURIComponent(payload.eventId)}?updateMask.fieldPaths=notificationTemplates`;
    const fields = Object.fromEntries(keys.map((key) => [key, { mapValue: { fields: {
      title: { stringValue: templates[key].title },
      body: { stringValue: templates[key].body },
    } } }]));
    const response = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { notificationTemplates: { mapValue: { fields } } } }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Saving event notification templates failed:", response.status, await response.text());
      throw new Error("Nu am putut salva mesajele pentru eveniment.");
    }
    return NextResponse.json({ ok: true, templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu am putut salva mesajele.";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("Autentificare") || message.includes("Sesiune") ? 401 : 500 });
  }
}
