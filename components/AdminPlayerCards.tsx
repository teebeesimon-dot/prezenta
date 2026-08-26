"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import {
  defaultPlayerCard,
  goalkeeperAttributeAverage,
  PLAYER_POSITIONS,
  reportPlayerCardsError,
  savePlayerCard,
  subscribePlayerCards,
  type GoalkeeperAttributes,
  type OutfieldAttributes,
  type PlayerCardData,
  type PlayerPosition,
} from "@/lib/player-cards";
import { subscribeToGroupMembers, type Member } from "@/lib/members";
import { suggestedOverall } from "@/lib/player-card-progression";
import CardImageUploader from "@/components/CardImageUploader";

const OUTFIELD_STAT_FIELDS: ReadonlyArray<[keyof OutfieldAttributes, string]> = [
  ["pace", "Viteză"],
  ["shooting", "Șut"],
  ["passing", "Pase"],
  ["dribbling", "Dribling"],
  ["defending", "Apărare"],
  ["physical", "Fizic"],
];

const GOALKEEPER_STAT_FIELDS: ReadonlyArray<[keyof GoalkeeperAttributes, string]> = [
  ["diving", "Plonjon (DIV)"],
  ["handling", "Prindere (HAN)"],
  ["kicking", "Degajare (KIC)"],
  ["reflexes", "Reflexe (REF)"],
  ["speed", "Viteză (SPD)"],
  ["positioning", "Poziționare (POS)"],
];

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
  useEffect(
    () => subscribePlayerCards(groupId, setCards, setMessage),
    [groupId]
  );

  function selectPlayer(userId: string) {
    setSelectedUserId(userId);
    setMessage("");

    const member = members.find((item) => item.userId === userId);
    if (!member) {
      setForm(null);
      return;
    }

    const existing = cards.find((card) => card.userId === userId);
    setForm(
      existing ?? {
        ...defaultPlayerCard(userId, groupId),
        playerName: member.userName,
        playerPhoto: member.userPhoto,
      }
    );
  }

  const activeStatFields = form?.position === "GK" ? GOALKEEPER_STAT_FIELDS : OUTFIELD_STAT_FIELDS;
  const goalkeeperAverage = form?.position === "GK" ? goalkeeperAttributeAverage(form) : null;
  const recommendedOverall = form ? suggestedOverall(form) : null;
  const overallDifference = recommendedOverall === null || !form ? 0 : Math.abs(form.overall - recommendedOverall);
  const formIsValid = Boolean(
    form && isRating(form.overall) && activeStatFields.every(([field]) => isRating(form[field]))
  );

  async function handleSave() {
    if (!form || !user || !formIsValid) {
      setMessage("OVR-ul și toate atributele trebuie să fie între 1 și 99.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await savePlayerCard(form, user.uid);
      setMessage("Card salvat.");
    } catch (error) {
      setMessage(reportPlayerCardsError(error, "Salvarea cardului", "playerCards"));
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
        onChange={(event) => selectPlayer(event.target.value)}
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
              {PLAYER_POSITIONS.map((position) => (
                <option key={position.value} value={position.value}>
                  {position.label}
                </option>
              ))}
            </select>
          </label>

          {recommendedOverall !== null && (
            <div className="sm:col-span-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              OVR recomandat din atribute: <strong className="text-foreground">{recommendedOverall}</strong>. OVR-ul rămâne manual.
              {form.position === "GK" && goalkeeperAverage !== null && (
                <span className="ml-1">Media simplă GK: {goalkeeperAverage}.</span>
              )}
              {overallDifference >= 8 && (
                <span className="mt-1 block font-medium text-foreground">
                  Verifică OVR-ul: diferența față de recomandare este de {overallDifference} puncte.
                </span>
              )}
            </div>
          )}

          {activeStatFields.map(([field, label]) => (
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

          <div className="sm:col-span-2">
            <div className="mb-2 text-sm font-medium text-foreground">Imagine card permanent</div>
            <CardImageUploader groupId={groupId} userId={form.userId} variant="permanent" onUploaded={(pathname) => setForm({ ...form, cardImageUrl: pathname })} />
            {form.cardImageUrl && <p className="mt-2 text-xs font-semibold text-primary">Imagine încărcată. Salvează cardul pentru a o publica.</p>}
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            {message ? <span className="text-sm text-muted-foreground">{message}</span> : <span />}
            <button
              type="button"
              disabled={saving || !formIsValid}
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
