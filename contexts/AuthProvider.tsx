"use client";

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth, db } from "@/lib/firebase";
import { canCreateEvents, isSuperAdmin } from "@/lib/roles";
import type { UserProfile, UserRole } from "@/lib/types";
import { saveUserProfile } from "@/lib/user-service";
import { mapUserProfile } from "@/lib/users";
import { registerPushToken, unregisterPushToken } from "@/lib/push-client";

type PushMessage = { title: string; body: string; id: number };
type NativeTokenWaiter = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const GOOGLE_WEB_CLIENT_ID =
  "1068418224143-2j73duinolrees1n8o8i5ve3vnpqufer.apps.googleusercontent.com";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  authError: string | null;
  canCreateEvents: boolean;
  isSuperAdmin: boolean;
  nativePushEnabled: boolean;
  nativePushStatus: string | null;
  pushMessage: PushMessage | null;
  enableNativePushNotifications: () => Promise<void>;
  clearPushMessage: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/unauthorized-domain") return "Acest domeniu nu este autorizat în Firebase pentru autentificare.";
  if (code === "auth/operation-not-supported-in-this-environment") return "Autentificarea Google nu este disponibilă în acest browser.";
  if (code === "auth/network-request-failed") return "Conexiunea către Firebase a eșuat. Verifică internetul și încearcă din nou.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  return code
    ? `Autentificarea Google a eșuat (${code}). Verifică domeniul autorizat în Firebase.`
    : "Autentificarea Google a eșuat. Încearcă din nou.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [nativePushEnabled, setNativePushEnabled] = useState(false);
  const [nativePushStatus, setNativePushStatus] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState<PushMessage | null>(null);
  const nativeTokenRef = useRef<string | null>(null);
  const nativeTokenSyncRef = useRef<{ token: string; promise: Promise<void> } | null>(null);
  const nativeListenerReadyRef = useRef<Promise<void> | null>(null);
  const nativeTokenWaiterRef = useRef<NativeTokenWaiter | null>(null);

  useEffect(() => {
    // Complete any sign-in that used the redirect fallback.
    getRedirectResult(auth).catch((error) => {
      console.error("[v0] getRedirectResult error:", error);
      setAuthError(getAuthErrorMessage(error));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    // Safety net: never let the UI hang on an unresolved auth state
    // (e.g. iOS Safari blocking storage). Show the signed-out UI after a delay.
    const timeout = setTimeout(() => setLoading(false), 2500);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      // Resolve the loading state immediately based on auth, so the UI is
      // never blocked by a slow/stalled Firestore profile write.
      clearTimeout(timeout);
      setUser(nextUser);
      setLoading(false);

      if (nextUser) {
        // Ensure the user document exists, but don't block the UI on it.
        // The profile itself is loaded reactively via the onSnapshot effect.
        saveUserProfile(nextUser).catch((error) => {
          console.error("[v0] saveUserProfile error:", error);
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(mapUserProfile(snapshot.id, snapshot.data()));
      } else {
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android" || !user) {
      setNativePushEnabled(false);
      return;
    }

    let active = true;
    const listeners: PluginListenerHandle[] = [];
    setNativePushEnabled(false);
    setNativePushStatus(null);

    const setup = async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      if (!active) return;

      const registrationListener = await PushNotifications.addListener(
        "registration",
        ({ value }) => {
          nativeTokenRef.current = value;
          const waiter = nativeTokenWaiterRef.current;
          if (waiter) {
            clearTimeout(waiter.timeout);
            nativeTokenWaiterRef.current = null;
            waiter.resolve(value);
            return;
          }

          if (!auth.currentUser) return;
          const sync = registerPushToken(value, "android");
          nativeTokenSyncRef.current = { token: value, promise: sync };
          void sync
            .then(() => {
              if (active) {
                setNativePushEnabled(true);
                setNativePushStatus("Tokenul FCM este inregistrat pentru contul autentificat.");
              }
            })
            .catch((error: unknown) => {
              console.error("Native push token refresh registration failed:", error);
              if (active) {
                setNativePushStatus(
                  error instanceof Error ? error.message : "Nu am putut salva tokenul FCM.",
                );
              }
            });
        },
      );
      if (!active) {
        await registrationListener.remove();
        return;
      }
      listeners.push(registrationListener);

      const errorListener = await PushNotifications.addListener(
        "registrationError",
        ({ error }) => {
          const waiter = nativeTokenWaiterRef.current;
          const registrationError = new Error(error || "FCM nu a putut inregistra dispozitivul.");
          if (waiter) {
            clearTimeout(waiter.timeout);
            nativeTokenWaiterRef.current = null;
            waiter.reject(registrationError);
          } else if (active) {
            setNativePushStatus(registrationError.message);
          }
        },
      );
      if (!active) {
        await errorListener.remove();
        return;
      }
      listeners.push(errorListener);

      const actionListener = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        ({ notification }) => {
          const url = notification.data?.url ?? notification.link;
          if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
            window.location.assign(url);
          }
        },
      );
      if (!active) {
        await actionListener.remove();
        return;
      }
      listeners.push(actionListener);

      const permission = await PushNotifications.checkPermissions();
      if (active && permission.receive === "granted") {
        await PushNotifications.register();
      }
    };

    const setupPromise = setup();
    nativeListenerReadyRef.current = setupPromise;
    void setupPromise.catch((error: unknown) => {
      console.error("Native push listener setup failed:", error);
      if (active) {
        setNativePushStatus(
          error instanceof Error ? error.message : "Nu am putut porni notificarile native.",
        );
      }
    });

    return () => {
      active = false;
      if (nativeListenerReadyRef.current === setupPromise) {
        nativeListenerReadyRef.current = null;
      }
      const waiter = nativeTokenWaiterRef.current;
      if (waiter) {
        clearTimeout(waiter.timeout);
        nativeTokenWaiterRef.current = null;
        waiter.reject(new Error("Inregistrarea notificarilor a fost intrerupta."));
      }
      void Promise.all(listeners.map((listener) => listener.remove())).catch((error) => {
        console.error("Native push listener cleanup failed:", error);
      });
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user || Capacitor.isNativePlatform()) return;
    let active = true;
    let removeMessageListener: (() => void) | null = null;

    void (async () => {
      const { getMessaging, isSupported, onMessage } = await import("firebase/messaging");
      if (!(await isSupported()) || !active) return;
      removeMessageListener = onMessage(getMessaging(), (payload) => {
        if (!active) return;
        setPushMessage({
          title: payload.notification?.title ?? "Prezenta",
          body: payload.notification?.body ?? "Ai o notificare noua.",
          id: Date.now(),
        });
      });
    })().catch((error: unknown) => {
      console.warn("Web push foreground listener could not be initialized:", error);
    });

    return () => {
      active = false;
      removeMessageListener?.();
    };
  }, [user?.uid]);

  const enableNativePushNotifications = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") {
      throw new Error("Notificarile native sunt configurate aici pentru Android.");
    }
    if (!auth.currentUser) throw new Error("Trebuie sa fii autentificat.");

    const { PushNotifications } = await import("@capacitor/push-notifications");
    await nativeListenerReadyRef.current;

    const currentToken = nativeTokenRef.current;
    if (currentToken && nativeTokenSyncRef.current?.token === currentToken) {
      await nativeTokenSyncRef.current.promise;
      setNativePushEnabled(true);
      setNativePushStatus("Tokenul FCM este inregistrat pentru contul autentificat.");
      return;
    }

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== "granted") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") {
      throw new Error("Permisiunea pentru notificari nu a fost acordata.");
    }

    const tokenPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        nativeTokenWaiterRef.current = null;
        reject(new Error("FCM nu a returnat tokenul dispozitivului. Verifica Google Play Services si incearca din nou."));
      }, 20000);
      nativeTokenWaiterRef.current = { resolve, reject, timeout };
    });

    try {
      await PushNotifications.register();
      const token = await tokenPromise;
      const sync = registerPushToken(token, "android");
      nativeTokenSyncRef.current = { token, promise: sync };
      await sync;
      setNativePushEnabled(true);
      setNativePushStatus("Tokenul FCM este inregistrat pentru contul autentificat.");
    } catch (error) {
      const waiter = nativeTokenWaiterRef.current;
      if (waiter) {
        clearTimeout(waiter.timeout);
        nativeTokenWaiterRef.current = null;
      }
      throw error;
    }
  }, []);

  const clearPushMessage = useCallback(() => {
    setPushMessage(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      if (Capacitor.getPlatform() === "android") {
        await SocialLogin.initialize({
          google: {
            webClientId: GOOGLE_WEB_CLIENT_ID,
            mode: "online",
          },
        });

        const result = await SocialLogin.login({
          provider: "google",
          options: {
            scopes: ["email", "profile"],
            filterByAuthorizedAccounts: false,
          },
        });

        const idToken =
          result.result && "idToken" in result.result
            ? result.result.idToken
            : null;

        if (!idToken) {
          throw new Error("Autentificarea Google a eșuat. Încearcă din nou.");
        }

        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        return;
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        // Prefer a popup: the sign-in completes entirely inside the popup
        // window (same-origin as Firebase's authDomain), so no cross-domain
        // storage read is needed afterwards. signInWithRedirect instead
        // relies on a cross-origin iframe to read the result back from the
        // authDomain once the browser returns to our page — on Chrome for
        // Android (and other browsers with third-party storage
        // partitioning enabled) that read silently fails, so the user
        // selects their Google account, gets bounced back, and stays
        // signed out with no visible error. A popup avoids that failure
        // mode entirely.
        await signInWithPopup(auth, provider);
        return;
      } catch (popupError) {
        const code = (popupError as { code?: string })?.code ?? "";
        // Only fall back to a full-page redirect when the popup itself
        // couldn't be shown at all. If the user deliberately closed it,
        // surface that as-is instead of forcing a redirect they didn't ask for.
        const shouldFallBackToRedirect =
          code === "auth/popup-blocked" ||
          code === "auth/operation-not-supported-in-this-environment";
        if (!shouldFallBackToRedirect) {
          throw popupError;
        }
      }

      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("[v0] signInWithGoogle redirect error:", error);
      setAuthError(getAuthErrorMessage(error));
      setLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (Capacitor.getPlatform() === "android") {
      const token = nativeTokenRef.current;
      if (token && auth.currentUser) {
        try {
          await unregisterPushToken(token, "android");
        } catch (error) {
          console.error("Native push token removal on sign-out failed:", error);
        }
      }
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.unregister();
      } catch (error) {
        console.error("Native push unregister failed:", error);
      }
      nativeTokenRef.current = null;
      nativeTokenSyncRef.current = null;
      setNativePushEnabled(false);
    }
    await signOut(auth);
  }, []);

  const role = profile?.role ?? null;

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      loading,
      authError,
      canCreateEvents: canCreateEvents(role),
      isSuperAdmin: isSuperAdmin(role),
      nativePushEnabled,
      nativePushStatus,
      pushMessage,
      enableNativePushNotifications,
      clearPushMessage,
      signInWithGoogle,
      signOutUser,
    }),
    [
      user,
      profile,
      role,
      loading,
      authError,
      nativePushEnabled,
      nativePushStatus,
      pushMessage,
      enableNativePushNotifications,
      clearPushMessage,
      signInWithGoogle,
      signOutUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
