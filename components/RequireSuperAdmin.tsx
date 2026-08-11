"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthProvider";

interface RequireSuperAdminProps {
  children: React.ReactNode;
}

export default function RequireSuperAdmin({ children }: RequireSuperAdminProps) {
  const { user, loading, isSuperAdmin, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Se încarcă...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted-foreground">Conectează-te cu Google pentru a accesa zona de admin.</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
        >
          Conectează-te cu Google
        </button>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acces interzis</h1>
        <p className="mt-2 text-muted-foreground">
          Doar super adminii pot accesa această pagină.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
        >
          Înapoi acasă
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
