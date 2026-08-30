"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import type { GeneratedTeams, ParticipantEntry } from "@/lib/types";
import { createFootballMatch, deleteFootballMatch, saveEvolutionSettings, saveScoringSettings, subscribeEvolutionSettings, subscribeFootballMatches, subscribeFootballProgress, subscribeScoringSettings, updateFootballMatch, DEFAULT_EVOLUTION, emptyScoringSettings } from "@/lib/football-repository";
import type { EvolutionLevel, FootballMatch, MatchPlayer, MatchPosition, PlayerProgress, ScoringKey, ScoringSettings } from "@/lib/football-system";

const POSITIONS: MatchPosition[] = ["GK", "DEF", "MID", "ATT"];
const RULES: Array<[ScoringKey, string]> = [["win","Victorie"],["loss","Înfrângere"],["goal","Gol"],["penaltyWin","Victorie penalty"],["cleanSheet","Clean sheet"],["goalConceded","Gol primit"],["winStreak","Serie 3+ victorii"]];

function teamArrays(teams?: GeneratedTeams | null): ParticipantEntry[][] {
  if (!teams) return [];
  if (teams.teams?.length) return teams.teams;
  return [teams.teamA ?? [], teams.teamB ?? []].filter((team) => team.length > 0);
}
function draftPlayers(teams: ParticipantEntry[][]): MatchPlayer[] {
  return teams.flatMap((team, teamIndex) => team.map((player) => ({ userId: player.userId, name: player.name, teamIndex, position: "MID" as MatchPosition, goals: 0 })));
}

export default function FootballMatchesPanel({ groupId, eventId, stageNumber, teams, canManage }: { groupId: string; eventId: string; stageNumber: number; teams?: GeneratedTeams | null; canManage: boolean }) {
  const { user } = useAuth();
  const availableTeams = useMemo(() => teamArrays(teams), [teams]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [progress, setProgress] = useState<PlayerProgress[]>([]);
  const [scoring, setScoring] = useState<ScoringSettings | null>(null);
  const [evolution, setEvolution] = useState<EvolutionLevel[]>(DEFAULT_EVOLUTION);
  const [editing, setEditing] = useState<FootballMatch | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeFootballMatches(groupId, setMatches), [groupId]);
  useEffect(() => subscribeFootballProgress(groupId, setProgress), [groupId]);
  useEffect(() => subscribeScoringSettings(groupId, setScoring), [groupId]);
  useEffect(() => subscribeEvolutionSettings(groupId, setEvolution), [groupId]);

  async function persist(match: FootballMatch) {
    if (!user) return;
    setSaving(true); setMessage("");
    try {
      if (editing) await updateFootballMatch(match, user.uid);
      else {
        const { id: _id, ...newMatch } = match;
        await createFootballMatch(newMatch, user.uid);
      }
      setShowForm(false); setEditing(null); setMessage("Meciul a fost salvat și statisticile au fost recalculate.");
    } catch { setMessage("Meciul nu a putut fi salvat."); }
    finally { setSaving(false); }
  }

  return <div className="flex flex-col gap-4">
    <section className="event-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Sistem fotbal</p><h2 className="text-2xl font-extrabold text-foreground">Meciuri · Etapa {stageNumber}</h2></div>{canManage && <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Adaugă meci</button>}</div>
      {availableTeams.length < 2 && <p className="mt-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">Generează mai întâi echipele pentru eveniment.</p>}
      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
    </section>
    {(showForm || editing) && <MatchEditor groupId={groupId} eventId={eventId} stageNumber={stageNumber} teams={availableTeams} initial={editing} nextOrder={matches.length + 1} saving={saving} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={persist} />}
    <section className="event-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="event-panel-title">Meciurile etapei</h2></div>{matches.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nu există meciuri înregistrate.</p> : <ul className="divide-y divide-border">{matches.map((match) => <li key={match.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Etapa {match.stageNumber} · Meciul {match.matchOrder}</p><p className="mt-1 text-lg font-bold text-foreground">{match.teamNames.map((name,index) => `${name} ${match.scores[index] ?? 0}`).join(" — ")}</p>{match.penaltyWinnerIndex !== null && <p className="text-xs text-primary">Câștigătoare la penalty: {match.teamNames[match.penaltyWinnerIndex]}</p>}</div>{canManage && <div className="flex gap-2"><button type="button" onClick={() => { setEditing(match); setShowForm(false); }} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Editează</button><button type="button" onClick={async () => { if (confirm("Ștergi meciul și recalculezi toate statisticile?")) await deleteFootballMatch(match); }} className="rounded-lg border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive">Șterge</button></div>}</li>)}</ul>}</section>
    <Leaderboard progress={progress} />
    {canManage && user && <><ScoringEditor groupId={groupId} userId={user.uid} value={scoring} /><EvolutionEditor groupId={groupId} userId={user.uid} value={evolution} /></>}
  </div>;
}

function MatchEditor({ groupId,eventId,stageNumber,teams,initial,nextOrder,saving,onCancel,onSave }: {groupId:string;eventId:string;stageNumber:number;teams:ParticipantEntry[][];initial:FootballMatch|null;nextOrder:number;saving:boolean;onCancel:()=>void;onSave:(match:FootballMatch)=>void}) {
  const names = teams.map((_, index) => `Echipa ${index + 1}`);
  const [scores,setScores]=useState<number[]>(initial?.scores ?? teams.map(()=>0));
  const [players,setPlayers]=useState<MatchPlayer[]>(initial?.players ?? draftPlayers(teams));
  const [penalty,setPenalty]=useState<number|null>(initial?.penaltyWinnerIndex ?? null);
  const [order,setOrder]=useState(initial?.matchOrder ?? nextOrder);
  const tied = scores.filter((score)=>score===Math.max(...scores)).length>1;
  return <section className="event-panel p-5 sm:p-6"><h2 className="event-panel-title">{initial ? "Editează meciul" : "Meci nou"}</h2><div className="mt-4 flex flex-wrap gap-3">{teams.map((_,i)=><label key={i} className="flex items-center gap-2"><span className="text-sm font-semibold">{names[i]}</span><input type="number" min={0} value={scores[i] ?? 0} onChange={(e)=>setScores(v=>v.map((x,j)=>j===i?Number(e.target.value):x))} className="w-20 rounded-lg border border-border bg-background px-3 py-2" /></label>)}<label className="flex items-center gap-2"><span className="text-sm">Ordine</span><input type="number" min={1} value={order} onChange={(e)=>setOrder(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-3 py-2" /></label></div>{tied && <label className="mt-4 block text-sm font-semibold">Câștigătoare la penalty<select value={penalty ?? ""} onChange={(e)=>setPenalty(e.target.value===""?null:Number(e.target.value))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"><option value="">Selectează obligatoriu</option>{names.map((n,i)=><option key={n} value={i}>{n}</option>)}</select></label>}<div className="mt-5 grid gap-4 md:grid-cols-2">{teams.map((team,teamIndex)=><div key={teamIndex} className="rounded-xl border border-border p-3"><h3 className="font-bold">{names[teamIndex]}</h3><div className="mt-3 flex flex-col gap-2">{team.map((participant)=>{const p=players.find(x=>x.userId===participant.userId)!;return <div key={participant.userId} className="grid grid-cols-[1fr_72px_64px] items-center gap-2"><span className="truncate text-sm font-medium">{participant.name}</span><select value={p?.position ?? "MID"} onChange={(e)=>setPlayers(v=>v.map(x=>x.userId===participant.userId?{...x,position:e.target.value as MatchPosition}:x))} className="rounded-lg border border-border bg-background px-2 py-2 text-xs">{POSITIONS.map(pos=><option key={pos}>{pos}</option>)}</select><input aria-label={`Goluri ${participant.name}`} type="number" min={0} value={p?.goals ?? 0} onChange={(e)=>setPlayers(v=>v.map(x=>x.userId===participant.userId?{...x,goals:Number(e.target.value)}:x))} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" /></div>})}</div></div>)}</div><div className="mt-5 flex gap-2"><button disabled={saving || teams.length<2 || (tied&&penalty===null)} type="button" onClick={()=>onSave({id:initial?.id??"",groupId,eventId,stageNumber,matchOrder:order,playedAt:Date.now(),teamNames:names,scores,penaltyWinnerIndex:tied?penalty:null,players})} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Salvează și recalculează</button><button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2.5 font-semibold">Renunță</button></div></section>;
}

function Leaderboard({progress}:{progress:PlayerProgress[]}) { return <section className="event-panel overflow-hidden"><div className="p-5"><h2 className="event-panel-title">Clasament sezon</h2></div>{progress.length===0?<p className="px-5 pb-5 text-sm text-muted-foreground">Statisticile apar după primul meci.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-3">Jucător</th><th>M</th><th>V</th><th>Goluri</th><th>CS</th><th>Puncte</th><th>OVR</th></tr></thead><tbody>{progress.map(p=><tr key={p.userId} className="border-t border-border"><td className="p-3 font-semibold">{p.name}</td><td>{p.matches}</td><td>{p.wins}</td><td>{p.goals}</td><td>{p.cleanSheets}</td><td>{p.points ?? "—"}</td><td>{p.currentOverall}</td></tr>)}</tbody></table></div>}</section> }

function ScoringEditor({groupId,userId,value}:{groupId:string;userId:string;value:ScoringSettings|null}) { const [draft,setDraft]=useState<ScoringSettings>(value??emptyScoringSettings()); useEffect(()=>setDraft(value??emptyScoringSettings()),[value]); return <section className="event-panel p-5"><h2 className="event-panel-title">Configurare punctaj</h2><p className="mt-2 text-sm text-muted-foreground">Toate valorile sunt obligatorii înainte de acordarea punctelor.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Criteriu</th>{POSITIONS.map(p=><th key={p}>{p}</th>)}</tr></thead><tbody>{RULES.map(([key,label])=><tr key={key} className="border-t border-border"><td className="p-2">{label}</td>{POSITIONS.map(pos=><td key={pos} className="p-1"><input aria-label={`${label} ${pos}`} type="number" value={draft[pos][key]??""} onChange={(e)=>setDraft({...draft,[pos]:{...draft[pos],[key]:e.target.value===""?null:Number(e.target.value)}})} className="w-20 rounded-md border border-border bg-background px-2 py-1.5" /></td>)}</tr>)}</tbody></table></div><button type="button" onClick={()=>saveScoringSettings(groupId,draft,userId)} className="mt-4 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Salvează punctajul</button></section> }
function EvolutionEditor({groupId,userId,value}:{groupId:string;userId:string;value:EvolutionLevel[]}) { const [draft,setDraft]=useState(value); useEffect(()=>setDraft(value),[value]); return <section className="event-panel p-5"><h2 className="event-panel-title">Praguri Evolution</h2><div className="mt-4 grid gap-2 sm:grid-cols-5">{draft.map((level,i)=><div key={level.level} className="rounded-xl border border-border p-3"><p className="text-sm font-bold">Nivel {level.level}</p><input aria-label={`Puncte nivel ${level.level}`} placeholder="Puncte" type="number" value={level.points??""} onChange={(e)=>setDraft(v=>v.map((x,j)=>j===i?{...x,points:e.target.value===""?null:Number(e.target.value)}:x))} className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5"/><input aria-label={`Bonus nivel ${level.level}`} placeholder="Bonus OVR" type="number" value={level.overallBonus??""} onChange={(e)=>setDraft(v=>v.map((x,j)=>j===i?{...x,overallBonus:e.target.value===""?null:Number(e.target.value)}:x))} className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5"/></div>)}</div><button type="button" onClick={()=>saveEvolutionSettings(groupId,draft,userId)} className="mt-4 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Salvează pragurile</button></section> }
