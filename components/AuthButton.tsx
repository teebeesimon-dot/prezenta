"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { ROLE_LABELS } from "@/lib/roles";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isEmbedded = useIsEmbeddedInIframe();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (loading && !user && !isEmbedded) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />;
  }

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

  if (!user) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={signInWithGoogle}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted sm:px-4"
        >
          <GoogleIcon />
          <span className="hidden sm:inline">Conectează-te cu Google</span>
          <span className="sm:hidden">Conectează-te</span>
        </button>
        {authError && <p className="max-w-xs text-right text-xs text-destructive">{authError}</p>}
      </div>
    );
  }

  const roleLabel = profile ? ROLE_LABELS[profile.role] : null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Meniu cont"
        className="flex items-center gap-2 rounded-full border border-border p-0.5 transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            className="h-9 w-9 rounded-full"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {(user.displayName ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <ChevronIcon className={`mr-1 h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt=""
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                {(user.displayName ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.displayName ?? "Cont"}
              </p>
              {roleLabel && (
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              )}
            </div>
          </div>

          <div className="p-1.5">
            {isSuperAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOutUser();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Deconectează-te
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground"
        >
          <LogoMark className="h-9 w-9" />
          prezenta
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
