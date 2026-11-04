import { createHash, createSign } from "node:crypto";
import type { PushPlatform } from "@/lib/push-types";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function getServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Lipseste configurarea FIREBASE_SERVICE_ACCOUNT.");
  let account: ServiceAccount;
  try {
    account = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT nu contine un JSON valid.");
  }
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT nu contine campurile necesare.");
  }
  return account;
}

async function getAccessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = encodeBase64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString("base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Firebase nu a autorizat trimiterea notificarilor.");
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Firebase nu a returnat un token de acces.");
  return data.access_token;
}

function readString(fields: Record<string, { stringValue?: string }> | undefined, key: string) {
  return fields?.[key]?.stringValue ?? "";
}


type PushTokenDocument = {
  name: string;
  fields?: Record<string, { stringValue?: string }>;
};

async function queryPushTokens(
  projectId: string,
  accessToken: string,
  fieldPath: "uid" | "token",
  value: string,
) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "pushTokens" }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: "EQUAL",
              value: { stringValue: value },
            },
          },
        },
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Nu am putut verifica dispozitivele inregistrate.");
  const rows = await response.json() as Array<{ document?: PushTokenDocument }>;
  return rows.flatMap((row) => row.document ? [row.document] : []);
}

async function deletePushTokenDocument(name: string, accessToken: string) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("Nu am putut elimina o inregistrare veche a dispozitivului.");
  }
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerPushToken(uid: string, token: string, platform: PushPlatform) {
  if (!uid || !token || token.length > 4096) {
    throw new Error("Datele dispozitivului pentru notificari nu sunt valide.");
  }
  const account = getServiceAccount();
  const accessToken = await getAccessToken(account);
  const documentId = tokenDigest(token);
  const documentPath = `projects/${account.project_id}/databases/(default)/documents/pushTokens/${documentId}`;
  const existingCopies = await queryPushTokens(account.project_id, accessToken, "token", token);
  await Promise.all(existingCopies
    .filter((document) => document.name !== documentPath)
    .map((document) => deletePushTokenDocument(document.name, accessToken)));

  const response = await fetch(
    `https://firestore.googleapis.com/v1/${documentPath}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: uid },
          token: { stringValue: token },
          platform: { stringValue: platform },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    console.error("Firebase push token registration failed:", response.status, detail);
    throw new Error("Nu am putut inregistra acest dispozitiv pentru notificari.");
  }
  return { registered: true };
}

export async function unregisterPushToken(uid: string, token: string) {
  if (!uid || !token || token.length > 4096) {
    throw new Error("Datele dispozitivului pentru notificari nu sunt valide.");
  }
  const account = getServiceAccount();
  const accessToken = await getAccessToken(account);
  const documents = await queryPushTokens(account.project_id, accessToken, "token", token);
  const ownedDocuments = documents.filter((document) =>
    readString(document.fields, "uid") === uid,
  );
  await Promise.all(ownedDocuments.map((document) =>
    deletePushTokenDocument(document.name, accessToken),
  ));
  return { unregistered: true };
}

export async function sendPushToUser(
  uid: string,
  title: string,
  body: string,
  platform?: PushPlatform,
) {
  const account = getServiceAccount();
  const projectId = account.project_id;
  const accessToken = await getAccessToken(account);
  const documents = await queryPushTokens(projectId, accessToken, "uid", uid);
  const uniqueTokens = new Map<string, { name: string; token: string }>();
  for (const document of documents) {
    if (platform && readString(document.fields, "platform") !== platform) continue;
    const token = readString(document.fields, "token");
    if (token && !uniqueTokens.has(token)) {
      uniqueTokens.set(token, { name: document.name, token });
    }
  }
  const tokens = [...uniqueTokens.values()];

  if (!tokens.length) return { sent: 0, total: 0 };

  const results = await Promise.all(tokens.map(async ({ name, token }) => {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            webpush: { notification: { title, body } },
          },
        }),
        cache: "no-store",
      },
    );
    if (response.ok) return true;
    const errorText = await response.text();
    if (errorText.includes("UNREGISTERED") || errorText.includes("registration-token-not-registered")) {
      await fetch(`https://firestore.googleapis.com/v1/${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
    }
    return false;
  }));

  return { sent: results.filter(Boolean).length, total: tokens.length };
}


type FirestoreValue = { stringValue?: string; integerValue?: string; booleanValue?: boolean; timestampValue?: string; mapValue?: { fields?: Record<string, FirestoreValue> }; arrayValue?: { values?: FirestoreValue[] } };
type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue> };

export async function firestoreAccess() {
  const account = getServiceAccount();
  return { account, accessToken: await getAccessToken(account) };
}

export async function getFirestoreDocument(path: string) {
  const { account, accessToken } = await firestoreAccess();
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Nu am putut citi datele evenimentului.");
  return await response.json() as FirestoreDocument;
}

export async function queryFirestore(collectionId: string, fieldPath?: string, value?: string) {
  const { account, accessToken } = await firestoreAccess();
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId }] };
  if (fieldPath) structuredQuery.where = { fieldFilter: {
    field: { fieldPath }, op: "EQUAL", value: { stringValue: value ?? "" },
  } };
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }), cache: "no-store",
  });
  if (!response.ok) throw new Error("Nu am putut citi lista de participanti.");
  const rows = await response.json() as Array<{ document?: FirestoreDocument }>;
  return rows.flatMap((row) => row.document ? [row.document] : []);
}

export function firestoreField(doc: FirestoreDocument, key: string): FirestoreValue | undefined {
  return doc.fields?.[key];
}

export function firestoreString(doc: FirestoreDocument, key: string): string {
  return doc.fields?.[key]?.stringValue ?? "";
}

export function firestoreNumber(doc: FirestoreDocument, key: string): number {
  const value = doc.fields?.[key];
  return Number(value?.integerValue ?? value?.stringValue ?? 0);
}

export async function reserveNotification(key: string): Promise<boolean> {
  const { account, accessToken } = await firestoreAccess();
  const url = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/notificationLogs/${encodeURIComponent(key)}?currentDocument.exists=false`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { createdAt: { timestampValue: new Date().toISOString() } } }),
    cache: "no-store",
  });
  if (response.status === 409 || response.status === 412) return false;
  if (!response.ok) throw new Error("Nu am putut inregistra notificarea.");
  return true;
}
