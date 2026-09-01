"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerCard from "@/components/PlayerCard";
import { useAuth } from "@/contexts/AuthProvider";
import { subscribeToGroupMembers, type Member } from "@/lib/members";
import type { PlayerProgress } from "@/lib/football-system";
import {
  applyTotwBonusToPlayer,
  PLAYER_POSITIONS,
  reportPlayerCardsError,
  subscribeGroupStageCards,
  updateStageCard,
  upsertStageCard,
  type PlayerPosition,
  type StageCard,
} from "@/lib/player-cards";

const OUTFIELD = [["pace", "PAC · Viteză"], ["shooting", "SHO · Șut"], ["passing", "PAS · Pase"], ["dribbling", "DRI · Dribling"], ["defending", "DEF · Apărare"], ["physical", "PHY · Fizic"]] as const;
const GOALKEEPER = [["diving", "DIV · Plonjon"], ["handling", "HAN · Prindere"], ["kicking", "KIC · Degajare"], ["reflexes", "REF · Reflexe"], ["speed", "SPD · Viteză"], ["positioning", "POS · Poziționare"]] as const;

interface Props {
  groupId: string;
  currentStageNumber?: number;
  progress: PlayerProgress[];
}

export default function AdminStageAwards({ groupId, currentStageNumber = 1, progress }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [stageCards, setStageCards] = useState<StageCard[]>([]);
  const [editing, setEditing] = useState<StageCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);
  useEffect(() => subscribeGroupStageCards(groupId, setStageCards), [groupId]);

  const standings = useMemo(() => progress.map((player) => {
    const rows = player.breakdown.filter((row) => row.stageNumber === currentStageNumber);
    return { userId: player.userId, name: player.name, matches: rows.length, points: rows.some((row) => row.points !== null) ? rows.reduce((sum, row) => sum + (row.points ?? 0), 0) : null };
  }).filter((player) => player.matches > 0 && player.points !== null).sort((a, b) => (b.points ?? 0) - (a.points ?? 0)), [currentStageNumber, progress]);
  const maxPoints = standings[0]?.points ?? null;
  const winners = maxPoints === null ? [] : standings.filter((player) => player.points === maxPoints);
  const currentCards = stageCards.filter((card) => card.stageNumber === currentStageNumber && (card.cardType === "totw" || card.awardIds.includes("totw")));
  const stageId = `${groupId}_stage_${currentStageNumber}`;

  async function generateTotw() {
    if (!user || winners.length === 0) return;
    setSaving(true); setMessage("");
    try {
      for (const winner of winners) {
        const permanent = await applyTotwBonusToPlayer({ groupId, stageId, stageNumber: currentStageNumber, userId: winner.userId, updatedBy: user.uid });
        const member = members.find((item) => item.userId === winner.userId);
        await upsertStageCard({
          groupId, stageId, stageNumber: currentStageNumber, cardType: "totw", stagePoints: winner.points ?? 0,
          userId: winner.userId, playerName: winner.name, playerPhoto: member?.userPhoto ?? permanent.playerPhoto ?? null,
          cardImageUrl: permanent.cardImageUrl ?? null, overall: permanent.overall, position: permanent.position,
          pace: permanent.pace, shooting: permanent.shooting, passing: permanent.passing, dribbling: permanent.dribbling,
          defending: permanent.defending, physical: permanent.physical, diving: permanent.diving, handling: permanent.handling,
          kicking: permanent.kicking, reflexes: permanent.reflexes, speed: permanent.speed, positioning: permanent.positioning,
          jerseyNumber: permanent.jerseyNumber ?? null, awardIds: ["totw"],
          awards: [{ awardId: "totw", label: "TOTW", winnerUserId: winner.userId, winnerName: winner.name, winnerPhoto: member?.userPhoto ?? null, votes: 0 }],
        }, user.uid);
      }
      setMessage(winners.length === 1 ? "Cardul TOTW a fost generat. Bonusul +1 OVR a fost aplicat." : `Au fost generate ${winners.length} carduri TOTW pentru liderii la egalitate.`);
    } catch (error) { setMessage(reportPlayerCardsError(error, "Generarea cardului TOTW", "stageCards / playerCards")); }
    finally { setSaving(false); }
  }

  async function saveEdit() {
    if (!editing || !user) return;
    setSaving(true); setMessage("");
    try { await updateStageCard(editing, user.uid); setEditing(null); setMessage("Cardul TOTW a fost actualizat."); }
    catch (error) { setMessage(reportPlayerCardsError(error, "Editarea cardului TOTW", "stageCards")); }
    finally { setSaving(false); }
  }

  return <section className="event-panel p-5 sm:p-6">
    <p className="text-sm font-semibold text-primary">Team of the Week</p>
    <h3 className="mt-1 text-xl font-extrabold text-foreground">TOTW · Etapa {currentStageNumber}</h3>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Cardul se acordă automat jucătorului cu cel mai mare punctaj din această etapă. La egalitate, toți liderii primesc TOTW și +1 OVR.</p>

    <div className="mt-5 overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead className="bg-muted text-left text-muted-foreground"><tr><th className="p-3">Jucător</th><th className="p-3">Meciuri</th><th className="p-3">Punctaj etapă</th></tr></thead><tbody>{standings.map((player) => <tr key={player.userId} className="border-t border-border"><td className="p-3 font-semibold">{player.name}{player.points === maxPoints && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Lider</span>}</td><td className="p-3">{player.matches}</td><td className="p-3 font-bold">{player.points}</td></tr>)}</tbody></table>{standings.length === 0 && <p className="p-4 text-sm text-muted-foreground">Configurează punctajele și salvează meciurile etapei pentru a determina liderul.</p>}</div>

    {winners.length > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4"><div><p className="font-bold text-foreground">{winners.map((winner) => winner.name).join(", ")}</p><p className="text-sm text-muted-foreground">{maxPoints} puncte · {winners.length === 1 ? "câștigător TOTW" : "câștigători la egalitate"}</p></div><button type="button" onClick={generateTotw} disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{currentCards.length ? "Regenerează cardurile TOTW" : "Generează cardurile TOTW"}</button></div>}
    {message && <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}

    {currentCards.length > 0 && <div className="mt-6"><h4 className="text-lg font-bold text-foreground">Carduri TOTW generate</h4><div className="mt-4 grid gap-5 lg:grid-cols-2">{currentCards.map((card) => <div key={card.id} className="rounded-2xl border border-border bg-background p-4"><div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start"><PlayerCard card={card} compact /><div className="flex-1"><p className="font-bold text-foreground">{card.playerName}</p><p className="text-sm text-muted-foreground">{card.stagePoints ?? "—"} puncte · OVR {card.overall}</p><button type="button" onClick={() => setEditing({ ...card })} className="mt-3 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground">Editează manual cardul</button></div></div></div>)}</div></div>}

    {editing && <div className="mt-6 rounded-2xl border border-border bg-background p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Editare manuală</p><h4 className="text-lg font-bold text-foreground">{editing.playerName}</h4></div><button type="button" onClick={() => setEditing(null)} className="text-sm font-semibold text-muted-foreground">Închide</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">OVR<input type="number" min={1} max={99} value={editing.overall} onChange={(event) => setEditing({ ...editing, overall: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5" /></label><label className="text-sm font-semibold">Poziție<select value={editing.position} onChange={(event) => setEditing({ ...editing, position: event.target.value as PlayerPosition })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5">{PLAYER_POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}</select></label></div><fieldset className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3"><legend className="px-2 text-sm font-bold">Atribute</legend>{(editing.position === "GK" ? GOALKEEPER : OUTFIELD).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input type="number" min={1} max={99} value={editing[key]} onChange={(event) => setEditing({ ...editing, [key]: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5" /></label>)}</fieldset><div className="mt-4 flex justify-end"><button type="button" onClick={saveEdit} disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Salvează cardul TOTW</button></div></div>}
  </section>;
}
