/**
 * Environment variable validation for Ne Adunam.
 * Required vars must be set in production (Vercel project settings).
 */

const isProduction = process.env.NODE_ENV === "production";

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export const env = {
  appUrl: optional(process.env.NEXT_PUBLIC_APP_URL),

  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "",
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? "",
  },

  firebaseVapidKey: optional(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),

  googleMapsApiKey: optional(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
} as const;

const REQUIRED_FIREBASE_VARS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: env.firebase.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: env.firebase.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: env.firebase.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: env.firebase.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: env.firebase.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: env.firebase.appId,
} as const;

/** Call at build time to fail fast on Vercel when env is misconfigured. */
export function validateEnv(): void {
  if (!isProduction) {
    return;
  }

  for (const [name, value] of Object.entries(REQUIRED_FIREBASE_VARS)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }

  if (!env.googleMapsApiKey) {
    console.warn(
      "[Ne Adunam] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Location autocomplete will be disabled."
    );
  }
}
