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

  const roleStandings = useMemo(() => {
    const build = (goalkeeper: boolean) => progress.flatMap((player) => {
      const rows = player.breakdown.filter((row) => row.stageNumber === currentStageNumber && (goalkeeper ? row.position === "GK" : row.position !== "GK"));
      return rows.length && rows.some((row) => row.points !== null) ? [{ userId: player.userId, name: player.name, matches: rows.length, points: rows.reduce((sum, row) => sum + (row.points ?? 0), 0), rows }] : [];
    }).sort((a, b) => b.points - a.points);
    const outfield = build(false);
    const fieldMax = outfield[0]?.points ?? null;
    const fieldWinners = fieldMax === null ? [] : outfield.filter((player) => player.points === fieldMax);
    const excluded = new Set(fieldWinners.map((player) => player.userId));
    const goalkeepers = build(true).filter((player) => !excluded.has(player.userId));
    const goalkeeperMax = goalkeepers[0]?.points ?? null;
    return { outfield, goalkeepers, fieldMax, goalkeeperMax, fieldWinners, goalkeeperWinners: goalkeeperMax === null ? [] : goalkeepers.filter((player) => player.points === goalkeeperMax) };
  }, [currentStageNumber, progress]);
  const currentCards = stageCards.filter((card) => card.stageNumber === currentStageNumber && card.cardType === "totw");
  const stageId = `${groupId}_stage_${currentStageNumber}`;

  async function generateTotw() {
    const categories = [
      { awardId: "totw" as const, label: "TOTW jucător", winners: roleStandings.fieldWinners, position: null },
      { awardId: "totw_goalkeeper" as const, label: "TOTW portar", winners: roleStandings.goalkeeperWinners, position: "GK" as const },
    ];
    if (!user || categories.every((category) => category.winners.length === 0)) return;
    setSaving(true); setMessage("");
    try {
      for (const category of categories) for (const winner of category.winners) {
        const permanent = await applyTotwBonusToPlayer({ groupId, stageId, stageNumber: currentStageNumber, userId: winner.userId, awardId: category.awardId, updatedBy: user.uid });
        const member = members.find((item) => item.userId === winner.userId);
        const outfieldPosition = winner.rows.find((row) => row.position !== "GK")?.position;
        await upsertStageCard({
          groupId, stageId, stageNumber: currentStageNumber, cardType: "totw", stagePoints: winner.points,
          userId: winner.userId, playerName: winner.name, playerPhoto: member?.userPhoto ?? permanent.playerPhoto ?? null,
          cardImageUrl: permanent.cardImageUrl ?? null, overall: permanent.overall, position: category.position ?? outfieldPosition ?? "MID",
          pace: permanent.pace, shooting: permanent.shooting, passing: permanent.passing, dribbling: permanent.dribbling,
          defending: permanent.defending, physical: permanent.physical, diving: permanent.diving, handling: permanent.handling,
          kicking: permanent.kicking, reflexes: permanent.reflexes, speed: permanent.speed, positioning: permanent.positioning,
          jerseyNumber: permanent.jerseyNumber ?? null, awardIds: [category.awardId],
          awards: [{ awardId: category.awardId, label: category.label, winnerUserId: winner.userId, winnerName: winner.name, winnerPhoto: member?.userPhoto ?? null, votes: 0 }],
        }, user.uid);
      }
      const count = categories.reduce((sum, category) => sum + category.winners.length, 0);
      setMessage(`${count} ${count === 1 ? "card TOTW a fost generat" : "carduri TOTW au fost generate"}. Bonusul +1 OVR a fost aplicat fiecărui câștigător.`);
    } catch (error) { setMessage(reportPlayerCardsError(error, "Generarea cardurilor TOTW", "stageCards / playerCards")); }
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
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Punctele din teren și cele obținute ca portar sunt calculate separat. La egalitate, toți liderii eligibili primesc +1 OVR; același jucător nu poate primi ambele carduri.</p>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {([
        { title: "TOTW jucător", description: "Puncte obținute în teren", standings: roleStandings.outfield, winners: roleStandings.fieldWinners, max: roleStandings.fieldMax },
        { title: "TOTW portar", description: "Puncte obținute pe poziția GK", standings: roleStandings.goalkeepers, winners: roleStandings.goalkeeperWinners, max: roleStandings.goalkeeperMax },
      ]).map((category) => <div key={category.title} className="rounded-xl border border-border bg-background p-4"><p className="text-sm font-bold text-primary">{category.title}</p><p className="mt-1 text-xs text-muted-foreground">{category.description}</p>{category.winners.length ? <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4"><p className="font-bold text-foreground">{category.winners.map((winner) => winner.name).join(", ")}</p><p className="mt-1 text-sm text-muted-foreground">{category.max} puncte · {category.winners.length === 1 ? "lider" : "lideri la egalitate"}</p></div> : <p className="mt-4 text-sm text-muted-foreground">Nu există încă un jucător eligibil pentru această categorie.</p>}<div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="pb-2">Jucător</th><th className="pb-2">Meciuri</th><th className="pb-2 text-right">Puncte</th></tr></thead><tbody>{category.standings.map((player) => <tr key={player.userId} className="border-t border-border"><td className="py-2 font-semibold">{player.name}</td><td className="py-2">{player.matches}</td><td className="py-2 text-right font-bold">{player.points}</td></tr>)}</tbody></table></div></div>)}
    </div>

    {(roleStandings.fieldWinners.length > 0 || roleStandings.goalkeeperWinners.length > 0) && <div className="mt-5 flex justify-end"><button type="button" onClick={generateTotw} disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{currentCards.length ? "Regenerează cardurile TOTW" : "Generează cardurile TOTW"}</button></div>}
    {message && <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}

    {currentCards.length > 0 && <div className="mt-6"><h4 className="text-lg font-bold text-foreground">Carduri TOTW generate</h4><div className="mt-4 grid gap-5 lg:grid-cols-2">{currentCards.map((card) => <div key={card.id} className="rounded-2xl border border-border bg-background p-4"><div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start"><PlayerCard card={card} compact /><div className="flex-1"><p className="font-bold text-foreground">{card.playerName}</p><p className="text-sm font-semibold text-primary">{card.awardIds.includes("totw_goalkeeper") ? "TOTW portar" : "TOTW jucător"}</p><p className="text-sm text-muted-foreground">{card.stagePoints ?? "—"} puncte · OVR {card.overall}</p><button type="button" onClick={() => setEditing({ ...card })} className="mt-3 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground">Editează manual cardul</button></div></div></div>)}</div></div>}

    {editing && <div className="mt-6 rounded-2xl border border-border bg-background p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Editare manuală</p><h4 className="text-lg font-bold text-foreground">{editing.playerName}</h4></div><button type="button" onClick={() => setEditing(null)} className="text-sm font-semibold text-muted-foreground">Închide</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">OVR<input type="number" min={1} max={99} value={editing.overall} onChange={(event) => setEditing({ ...editing, overall: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5" /></label><label className="text-sm font-semibold">Poziție<select value={editing.position} onChange={(event) => setEditing({ ...editing, position: event.target.value as PlayerPosition })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5">{PLAYER_POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}</select></label></div><fieldset className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3"><legend className="px-2 text-sm font-bold">Atribute</legend>{(editing.position === "GK" ? GOALKEEPER : OUTFIELD).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input type="number" min={1} max={99} value={editing[key]} onChange={(event) => setEditing({ ...editing, [key]: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5" /></label>)}</fieldset><div className="mt-4 flex justify-end"><button type="button" onClick={saveEdit} disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Salvează cardul TOTW</button></div></div>}
  </section>;
}
