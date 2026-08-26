import { NextRequest } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function verifyFirebaseToken(token: string): Promise<string> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Sesiune invalidă.");
  const data = (await response.json()) as { users?: Array<{ localId: string }> };
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error("Sesiune invalidă.");
  return uid;
}

async function readOwner(collection: "series" | "events", groupId: string, token: string) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(groupId)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { fields?: { ownerId?: { stringValue?: string } } };
  return data.fields?.ownerId?.stringValue ?? null;
}

export async function requireGroupOwner(request: NextRequest, groupId: string) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) throw new Error("Autentificare necesară.");
  const uid = await verifyFirebaseToken(token);
  const ownerId =
    (await readOwner("series", groupId, token)) ??
    (await readOwner("events", groupId, token));
  if (ownerId !== uid) throw new Error("Doar administratorul evenimentului poate încărca imagini.");
  return uid;
}

export async function requireFirebaseUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) throw new Error("Autentificare necesară.");
  return verifyFirebaseToken(token);
}
