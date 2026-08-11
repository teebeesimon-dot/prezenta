"use client";

import { useEffect, useMemo, useState } from "react";
import MemberPicker from "@/components/MemberPicker";
import {
  getAllGroupsForAdmin,
  removeMember,
  subscribeToGroupMembers,
  type AdminGroup,
  type Member,
} from "@/lib/members";

/** Build a distinctive option label, avoiding redundant "Tenis (Tenis)". */
function formatOptionLabel(g: AdminGroup): string {
  const sportSuffix =
    g.sport && g.sport.toLowerCase() !== g.label.toLowerCase()
      ? ` (${g.sport})`
      : "";
  const dateSuffix = g.dateLabel ? ` · ${g.dateLabel}` : "";
  return `${g.label}${sportSuffix}${dateSuffix}`;
}

export default function AdminGroupMembers() {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getAllGroupsForAdmin()
      .then((list) => {
        if (active) setGroups(list);
      })
      .catch(() => {
        if (active) setError("Nu am putut încărca grupurile.");
      })
      .finally(() => {
        if (active) setLoadingGroups(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.groupId === selectedId) ?? null,
    [groups, selectedId]
  );

  const seriesGroups = useMemo(
    () => groups.filter((g) => g.groupType === "series"),
    [groups]
  );
  const eventGroups = useMemo(
    () => groups.filter((g) => g.groupType === "event"),
    [groups]
  );

  // Live roster of the selected group.
  useEffect(() => {
    if (!selectedId) {
      setMembers([]);
      return;
    }
    const unsubscribe = subscribeToGroupMembers(selectedId, setMembers);
    return () => unsubscribe();
  }, [selectedId]);

  async function handleRemove(userId: string) {
    if (!selectedId) return;
    setBusyUserId(userId);
    try {
      await removeMember(selectedId, userId);
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Membri în grupuri
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Alege un grup și adaugă utilizatori înscriși pe site.
      </p>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <label className="block text-sm font-medium text-foreground">
          Grup
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loadingGroups}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-60"
          >
            <option value="">
              {loadingGroups ? "Se încarcă grupurile..." : "Selectează un grup"}
            </option>
            {seriesGroups.length > 0 && (
              <optgroup label="Serii recurente">
                {seriesGroups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {formatOptionLabel(g)}
                  </option>
                ))}
              </optgroup>
            )}
            {eventGroups.length > 0 && (
              <optgroup label="Evenimente individuale">
                {eventGroups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {formatOptionLabel(g)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {selectedGroup && (
          <div className="mt-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {selectedGroup.label}
              </span>
              {selectedGroup.groupType === "series" ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Serie recurentă
                </span>
              ) : (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  Eveniment{selectedGroup.dateLabel ? ` · ${selectedGroup.dateLabel}` : ""}
                </span>
              )}
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {selectedGroup.sport}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Membri ({members.length})
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover active:scale-[0.98]"
              >
                Adaugă membri
              </button>
            </div>

            {members.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Niciun membru în acest grup încă.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
                {members.map((member) => {
                  const busy = busyUserId === member.userId;
                  return (
                    <li
                      key={member.userId}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {member.userName}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemove(member.userId)}
                        className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
                      >
                        Elimină
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {pickerOpen && selectedGroup && (
        <MemberPicker
          groupId={selectedGroup.groupId}
          groupType={selectedGroup.groupType}
          ownerId={selectedGroup.ownerId}
          existingUserIds={new Set(members.map((m) => m.userId))}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}
