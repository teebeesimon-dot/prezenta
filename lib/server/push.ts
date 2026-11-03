import { createSign } from "node:crypto";

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

export async function sendPushToUser(uid: string, title: string, body: string) {
  const account = getServiceAccount();
  const projectId = account.project_id;
  const accessToken = await getAccessToken(account);
  const queryResponse = await fetch(
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
              field: { fieldPath: "uid" },
              op: "EQUAL",
              value: { stringValue: uid },
            },
          },
        },
      }),
      cache: "no-store",
    },
  );
  if (!queryResponse.ok) throw new Error("Nu am putut citi dispozitivele inregistrate.");
  const rows = await queryResponse.json() as Array<{
    document?: { name: string; fields?: Record<string, { stringValue?: string }> };
  }>;
  const tokens = rows
    .map((row) => row.document ? {
      name: row.document.name,
      token: readString(row.document.fields, "token"),
    } : null)
    .filter((item): item is { name: string; token: string } => Boolean(item?.token));

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
