import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { env } from "@/lib/env";

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// On iOS Safari, IndexedDB-based persistence can stall or be unavailable
// (Intelligent Tracking Prevention, in-app browsers, private mode). Provide a
// fallback chain so auth state still resolves and the session can persist.
// `initializeAuth` must only run in the browser; on the server (prerender)
// we fall back to plain `getAuth` to avoid Firebase internal assertions.
function createAuth() {
  if (typeof window === "undefined") {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      // IndexedDB can stall indefinitely in embedded previews, private mode,
      // and some Safari contexts. Local storage is more reliable for this app
      // and still keeps the session across normal page reloads.
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // initializeAuth throws if auth was already initialized (e.g. HMR).
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
