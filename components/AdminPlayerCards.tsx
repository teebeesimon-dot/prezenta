"use client";

import { useEffect, useState } from "react";
import CardImageUploader from "@/components/CardImageUploader";
import { useAuth } from "@/contexts/AuthProvider";
import {
  defaultPlayerCard,
  PLAYER_POSITIONS,
  reportPlayerCardsError,
  savePlayerCard,
  subscribePlayerCards,
  type PlayerCardData,
  type PlayerPosition,
} from "@/lib/player-cards";
import { subscribeToGroupMembers, type Member } from "@/lib/members";

function isRating(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 99;
}

export default function AdminPlayerCards({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [cards, setCards] = useState<PlayerCardData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [form, setForm] = useState<PlayerCardData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);
  useEffect(() => subscribePlayerCards(groupId, setCards, setMessage), [groupId]);

  function selectPlayer(userId: string) {
    setSelectedUserId(userId);
    setMessage("");
    const member = members.find((item) => item.userId === userId);
    if (!member) return setForm(null);
    const existing = cards.find((card) => card.userId === userId);
    setForm(existing ?? { ...defaultPlayerCard(userId, groupId), playerName: member.userName, playerPhoto: member.userPhoto });
  }

  async function handleSave() {
    if (!form || !user || !isRating(form.overall)) return setMessage("OVR-ul trebuie să fie între 1 și 99.");
    setSaving(true);
    setMessage("");
    try {
      await savePlayerCard(form, user.uid);
      setMessage("Jucător salvat.");
    } catch (error) {
      setMessage(reportPlayerCardsError(error, "Salvarea jucătorului", "playerCards"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold text-foreground">Jucători</h3>
      <p className="mt-1 text-sm text-muted-foreground">Configurează doar OVR-ul inițial, poziția principală, fotografia și disponibilitatea.</p>
      <select value={selectedUserId} onChange={(event) => selectPlayer(event.target.value)} className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
        <option value="">Selectează jucătorul</option>
        {members.map((member) => <option key={member.userId} value={member.userId}>{member.userName}</option>)}
      </select>

      {form && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-foreground">OVR inițial<input type="number" min={1} max={99} value={form.overall} onChange={(event) => setForm({ ...form, overall: Number(event.target.value), initialOverall: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-foreground">Poziție principală<select value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value as PlayerPosition })} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5">{PLAYER_POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}</select></label>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 sm:col-span-2"><input type="checkbox" checked={form.isInjured ?? false} onChange={(event) => setForm({ ...form, isInjured: event.target.checked })} className="h-5 w-5 accent-primary" /><span><strong className="block text-sm text-foreground">Jucător accidentat</strong><span className="text-xs text-muted-foreground">Este marcat vizual și nu poate fi selectat în meciuri noi.</span></span></label>
          <div className="sm:col-span-2"><div className="mb-2 text-sm font-medium text-foreground">Fotografia jucătorului</div><CardImageUploader groupId={groupId} userId={form.userId} variant="permanent" onUploaded={(pathname) => setForm({ ...form, cardImageUrl: pathname })} /></div>
          <div className="flex items-center justify-between gap-3 sm:col-span-2">{message ? <span role="status" className="text-sm text-muted-foreground">{message}</span> : <span />}<button type="button" disabled={saving || !isRating(form.overall)} onClick={handleSave} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{saving ? "Se salvează..." : "Salvează jucătorul"}</button></div>
        </div>
      )}
    </section>
  );
}
