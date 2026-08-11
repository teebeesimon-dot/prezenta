"use client";

import { useEffect, useMemo, useState } from "react";
import { addMember, type GroupType } from "@/lib/members";
import { getAllUsers } from "@/lib/user-service";
import type { UserProfile } from "@/lib/types";

interface MemberPickerProps {
  groupId: string;
  groupType: GroupType;
  ownerId: string;
  /** userIds already in the group — excluded from the list. */
  existingUserIds: Set<string>;
  onClose: () => void;
  onAdded?: () => void;
}

export default function MemberPicker({
  groupId,
  groupType,
  ownerId,
  existingUserIds,
  onClose,
  onAdded,
}: MemberPickerProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAllUsers()
      .then((all) => {
        if (active) setUsers(all);
      })
      .catch(() => {
        if (active) setError("Nu am putut încărca utilizatorii.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => !existingUserIds.has(u.uid))
      .filter(
        (u) =>
          !q ||
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
  }, [users, existingUserIds, search]);

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const chosen = users.filter((u) => selected.has(u.uid));
      await Promise.all(
        chosen.map((u) =>
          addMember({
            groupId,
            groupType,
            ownerId,
            userId: u.uid,
            userName: u.displayName || u.email || "Membru",
            userPhoto: null,
          })
        )
      );
      onAdded?.();
      onClose();
    } catch {
      setError("Nu am putut adăuga membrii. Încearcă din nou.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Adaugă membri în grup"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-bold text-foreground">Adaugă membri</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="rounded-full p-1 text-muted-foreground transition hover:text-foreground"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută după nume sau email..."
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Se încarcă utilizatorii...
            </p>
          ) : available.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Niciun utilizator disponibil.
            </p>
          ) : (
            <ul>
              {available.map((u) => {
                const checked = selected.has(u.uid);
                return (
                  <li key={u.uid}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(u.uid)}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {u.displayName || "Fără nume"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <p className="px-5 pt-3 text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <span className="text-sm text-muted-foreground">
            {selected.size} selectați
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || selected.size === 0}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? "Se adaugă..." : "Adaugă selectați"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
