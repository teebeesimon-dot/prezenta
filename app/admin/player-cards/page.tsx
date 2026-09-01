"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RequireSuperAdmin from "@/components/RequireSuperAdmin";
import AdminPlayerCards from "@/components/AdminPlayerCards";
import { useAuth } from "@/contexts/AuthProvider";
import { getAllGroupsForAdmin, type AdminGroup } from "@/lib/members";

export default function AdminPlayerCardsPage() {
  const { isSuperAdmin } = useAuth();
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;

    let active = true;

    getAllGroupsForAdmin()
      .then((items) => {
        if (active) setGroups(items);
      })
      .catch(() => {
        if (active) setError("Nu am putut incarca grupele. Verifica accesul de administrator.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  return (
    <div className="min-h-full bg-background">
      <RequireSuperAdmin>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <Link href="/admin" className="text-sm font-medium text-primary hover:text-primary-hover">
            ← Înapoi la Admin
          </Link>
          <header className="mt-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Player Cards</h1>
            <p className="mt-2 text-muted-foreground">
              Gestioneaza cardurile jucatorilor si premiile fiecarei etape.
            </p>
          </header>

          <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Alege grupa</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pentru prima versiune, configureaza cardurile pentru o grupa odata.
            </p>

            {loading && <p className="mt-5 text-sm text-muted-foreground">Se incarca grupele...</p>}
            {error && <p className="mt-5 text-sm font-medium text-destructive">{error}</p>}

            {!loading && !error && (
              <div className="mt-3 grid gap-2">
                {groups.map((group) => (
                  <div key={group.groupId} className="rounded-xl border border-border p-3">
                    <div className="font-semibold text-foreground">{group.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {group.sport}{group.dateLabel ? ` · ${group.dateLabel}` : ""}
                    </div>
                    <div className="mt-3">
                      <AdminPlayerCards groupId={group.groupId} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && groups.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Nu exista inca grupe disponibile.</p>
            )}
          </div>
        </div>
      </RequireSuperAdmin>
    </div>
  );
}
