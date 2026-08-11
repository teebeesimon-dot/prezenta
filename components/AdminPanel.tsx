"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserProfile, UserRole } from "@/lib/types";
import { updateUserRole } from "@/lib/user-service";
import { mapUserProfile } from "@/lib/users";

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(
          snapshot.docs
            .map((docSnap) => mapUserProfile(docSnap.id, docSnap.data()))
            .sort((a, b) => a.displayName.localeCompare(b.displayName, "ro"))
        );
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function handleRoleChange(targetUid: string, role: UserRole) {
    setError("");
    setUpdatingUid(targetUid);

    try {
      await updateUserRole(targetUid, role);
    } catch {
      setError("Nu am putut actualiza rolul. Încearcă din nou.");
    } finally {
      setUpdatingUid(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Se încarcă utilizatorii...</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Nume</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Email</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Rol</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((profile) => {
                const isCurrentUser = profile.uid === user?.uid;
                const isSuperAdminUser = profile.role === "super_admin";

                return (
                  <tr key={profile.uid} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      {profile.displayName || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{profile.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {ROLE_LABELS[profile.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isSuperAdminUser || isCurrentUser ? (
                        <span className="text-xs text-muted-foreground">Fără acțiuni</span>
                      ) : profile.role === "user" ? (
                        <button
                          type="button"
                          disabled={updatingUid === profile.uid}
                          onClick={() =>
                            handleRoleChange(profile.uid, "organizer")
                          }
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
                        >
                          Promovează la Organizator
                        </button>
                      ) : profile.role === "organizer" ? (
                        <button
                          type="button"
                          disabled={updatingUid === profile.uid}
                          onClick={() => handleRoleChange(profile.uid, "user")}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
                        >
                          Retrogradează la Utilizator
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
