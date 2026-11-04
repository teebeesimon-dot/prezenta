import { auth } from "@/lib/firebase";
import type { PushPlatform } from "@/lib/push-types";

async function updatePushRegistration(
  method: "POST" | "DELETE",
  token: string,
  platform: PushPlatform,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sesiunea a expirat. Autentifica-te din nou.");
  if (!token || token.length > 4096) {
    throw new Error("Tokenul dispozitivului nu este valid.");
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/push/register", {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, platform }),
  });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Nu am putut actualiza inregistrarea notificarilor.");
  }
}

export function registerPushToken(token: string, platform: PushPlatform) {
  return updatePushRegistration("POST", token, platform);
}

export function unregisterPushToken(token: string, platform: PushPlatform) {
  return updatePushRegistration("DELETE", token, platform);
}
