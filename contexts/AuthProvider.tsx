"use client";

import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
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

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  canCreateEvents: boolean;
  isSuperAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Complete any sign-in that used the redirect fallback.
    getRedirectResult(auth).catch((error) => {
      console.error("[v0] getRedirectResult error:", error);
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
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    // Use a full-page redirect instead of a popup. Popups are immediately
    // closed by embedded previews, Safari, and browsers with strict blockers.
    await signInWithRedirect(auth, provider);
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
      canCreateEvents: canCreateEvents(role),
      isSuperAdmin: isSuperAdmin(role),
      signInWithGoogle,
      signOutUser,
    }),
    [user, profile, role, loading, signInWithGoogle, signOutUser]
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
