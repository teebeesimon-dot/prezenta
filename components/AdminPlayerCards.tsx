"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { savePlayerCard, subscribePlayerCards, type PlayerCardData, type PlayerPosition } from "@/lib/player-cards";
import { subscribeToGroupMembers, type Member } from "@/lib/members";

const POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: "GK", label: "Portar" },
  { value: "DEF", label: "Fundas" },
  { value: "MID", label: "Mijlocas" },
  { value: "ATT", label: "Atacant" },
];

const STAT_FIELDS = [
  ["pace", "Viteza"],
  ["shooting", "Sut"],
  ["passing", "Pase"],
  ["dribbling", "Dribling"],
  ["defending", "Aparare"],
  ["physical", "Fizic"],
] as const;

export default function AdminPlayerCards({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [cards, setCards] = useState<PlayerCardData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [form, setForm] = useState<PlayerCardData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);
  useEffect(() => subscribePlayerCards(groupId, setCards), [groupId]);

  const selectedMember = useMemo(
    () => members.find((member) => member.userId === selectedUserId) ?? null,
    [members, selectedUserId]
  );

  useEffect(() => {
    if (!selectedMember) {
      setForm(null);
      return;
    }
    const existing = cards.find((card) => card.userId === selectedMember.userId);
    setForm(
      existing ?? {
        userId: selectedMember.userId,
        groupId,
        overall: 65,
        position: "MID",
        pace: 65,
        shooting: 65,
        passing: 65,
        dribbling: 65,
        defending: 65,
        physical: 65,
        jerseyNumber: null,
      }
    );
  }, [selectedMember, cards, groupId]);

  async function handleSave() {
    if (!form || !user) return;
    setSaving(true);
    setMessage("");
    try {
      await savePlayerCard(form, user.uid);
      setMessage("Card salvat.");
    } catch {
      setMessage("Nu am putut salva cardul.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold text-foreground">Carduri jucatori</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Seteaza OVR-ul si atributele fiecarui jucator. Categoria Bronze / Silver / Gold se stabileste automat.
      </p>

      <select
        value={selectedUserId}
        onChange={(event) => setSelectedUserId(event.target.value)}
        className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
      >
        <option value="">Selecteaza jucatorul</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.userName}
          </option>
        ))}
      </select>

      {form && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-foreground">
            OVR
            <input
              type="number"
              min={1}
              max={99}
              value={form.overall}
              onChange={(event) => setForm({ ...form, overall: Number(event.target.value) })}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
            />
          </label>
          <label className="text-sm font-medium text-foreground">
            Pozitie
            <select
              value={form.position}
              onChange={(event) => setForm({ ...form, position: event.target.value as PlayerPosition })}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
            >
              {POSITIONS.map((position) => (
                <option key={position.value} value={position.value}>
                  {position.label}
                </option>
              ))}
            </select>
          </label>

          {STAT_FIELDS.map(([field, label]) => (
            <label key={field} className="text-sm font-medium text-foreground">
              {label}
              <input
                type="number"
                min={1}
                max={99}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: Number(event.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
              />
            </label>
          ))}

          <label className="text-sm font-medium text-foreground">
            Numar
            <input
              type="number"
              min={0}
              max={99}
              value={form.jerseyNumber ?? ""}
              onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value ? Number(event.target.value) : null })}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
            />
          </label>

          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            {message ? <span className="text-sm text-muted-foreground">{message}</span> : <span />}
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? "Se salveaza..." : "Salveaza cardul"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
