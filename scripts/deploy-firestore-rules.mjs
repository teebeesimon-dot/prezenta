// Deploys firestore.rules to the Firebase project using a service account.
// Usage: node --env-file=/vercel/share/.env.project scripts/deploy-firestore-rules.mjs
//
// Uses the Firebase Rules REST API directly (no extra dependencies):
//   1. Mint a signed JWT with the service account private key
//   2. Exchange it for an OAuth2 access token
//   3. Create a ruleset from firestore.rules
//   4. Release it to cloud.firestore

import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

// Prefer an explicit file (SERVICE_ACCOUNT_FILE) over the env var, so we can
// run with a freshly provided key even if the env var lags behind.
const rawKey = process.env.SERVICE_ACCOUNT_FILE
  ? readFileSync(process.env.SERVICE_ACCOUNT_FILE, "utf8")
  : (process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ?? process.env.FIREBASE_SERVICE_ACCOUNT
    ?? "");

let sa;
try {
  sa = JSON.parse(rawKey || "{}");
} catch {
  console.error("Service account JSON is invalid. Provide the complete JSON document, not a quoted or truncated value.");
  process.exit(1);
}

if (!sa.private_key || !sa.client_email || !sa.project_id || !sa.token_uri) {
  console.error("Service account is missing private_key, client_email, project_id, or token_uri.");
  process.exit(1);
}

const publicProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (publicProject && publicProject !== sa.project_id) {
  console.error(`Service account project mismatch: expected ${publicProject}, received ${sa.project_id}.`);
  process.exit(1);
}

const PROJECT = sa.project_id;
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer
    .sign(sa.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    const detail = json.error_description ?? json.error ?? res.statusText;
    throw new Error(
      `OAuth token exchange failed (${res.status}): ${detail}. `
      + "Regenerate or re-enable the service-account key and verify the system clock."
    );
  }
  return json.access_token;
}

async function main() {
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const rulesPath = path.join(process.cwd(), "firestore.rules");
  const source = await readFile(rulesPath, "utf8");

  // 1. Create a ruleset
  const rulesetRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { files: [{ name: "firestore.rules", content: source }] },
      }),
    }
  );
  const ruleset = await rulesetRes.json();
  if (!rulesetRes.ok) throw new Error(`ruleset: ${JSON.stringify(ruleset)}`);
  console.log("Created ruleset:", ruleset.name);

  // 2. Update (or create) the cloud.firestore release to point at it
  const releaseName = `projects/${PROJECT}/releases/cloud.firestore`;
  const updateRes = await fetch(
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        release: { name: releaseName, rulesetName: ruleset.name },
      }),
    }
  );
  const release = await updateRes.json();
  if (!updateRes.ok) {
    // If the release does not exist yet, create it.
    const createRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: releaseName, rulesetName: ruleset.name }),
      }
    );
    const created = await createRes.json();
    if (!createRes.ok) throw new Error(`release: ${JSON.stringify(release)} / ${JSON.stringify(created)}`);
    console.log("Created release:", created.name);
  } else {
    console.log("Updated release:", release.name);
  }

  console.log("Firestore rules deployed successfully.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
