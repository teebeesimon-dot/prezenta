"use client";

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
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
  useState,
} from "react";
import { auth, db } from "@/lib/firebase";
import { canCreateEvents, isSuperAdmin } from "@/lib/roles";
import type { UserProfile, UserRole } from "@/lib/types";
import { saveUserProfile } from "@/lib/user-service";
import { mapUserProfile } from "@/lib/users";

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
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/unauthorized-domain") return "Acest domeniu nu este autorizat în Firebase pentru autentificare.";
  if (code === "auth/operation-not-supported-in-this-environment") return "Autentificarea Google nu este disponibilă în acest browser.";
  if (code === "auth/network-request-failed") return "Conexiunea către Firebase a eșuat. Verifică internetul și încearcă din nou.";
  return code
    ? `Autentificarea Google a eșuat (${code}). Verifică domeniul autorizat în Firebase.`
    : "Autentificarea Google a eșuat. Încearcă din nou.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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
      // Use a full-page redirect instead of a popup. Popups are immediately
      // closed by embedded previews, Safari, and browsers with strict blockers.
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("[v0] signInWithGoogle redirect error:", error);
      setAuthError(getAuthErrorMessage(error));
      setLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
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
      signInWithGoogle,
      signOutUser,
    }),
    [user, profile, role, loading, authError, signInWithGoogle, signOutUser]
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
