"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { ROLE_LABELS } from "@/lib/roles";
import { LogoMark } from "@/components/Logo";

function useIsEmbeddedInIframe() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  useEffect(() => {
    try {
      setIsEmbedded(window.self !== window.top);
    } catch {
      // Cross-origin access to window.top throws, which itself means we're embedded.
      setIsEmbedded(true);
    }
  }, []);
  return isEmbedded;
}

export default function AuthButton() {
  const { user, profile, loading, authError, isSuperAdmin, signInWithGoogle, signOutUser } =
    useAuth();
  const isEmbedded = useIsEmbeddedInIframe();

  if (!user && isEmbedded) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted"
        >
          <GoogleIcon />
          Deschide într-un tab nou pentru login
        </button>
        <p className="max-w-xs text-right text-xs text-muted-foreground">
          Login-ul Google nu funcționează în acest preview încorporat. Deschide linkul într-un tab de browser separat.
        </p>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <button
        type="button"
        onClick={signInWithGoogle}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={signInWithGoogle}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
        {authError && <p className="max-w-xs text-right text-xs text-destructive">{authError}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isSuperAdmin && (
        <Link
          href="/admin"
          className="inline-flex rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
        >
          Admin
        </Link>
      )}
      {user.photoURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt=""
          className="h-9 w-9 rounded-full border border-border"
        />
      )}
      <span className="hidden text-sm font-medium text-foreground sm:inline">
        {user.displayName}
        {profile && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({ROLE_LABELS[profile.role]})
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={signOutUser}
        className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-foreground"
        >
          <LogoMark className="h-9 w-9" />
          Ne Adunam
        </Link>
        <AuthButton />
      </div>
    </header>
  );
}
