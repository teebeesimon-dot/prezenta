"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import AdminStageAwards from "@/components/AdminStageAwards";
import { subscribeGroupCardHistory, subscribeGroupStageCards, subscribePlayerCards, type PlayerCardData, type PlayerCardHistoryEntry, type StageCard } from "@/lib/player-cards";
import type { GeneratedTeams, ParticipantEntry } from "@/lib/types";
import { createFootballMatch, deleteFootballMatch, saveEvolutionSettings, saveScoringSettings, saveStageTeamColors, subscribeEvolutionSettings, subscribeFootballMatches, subscribeFootballProgress, subscribeScoringSettings, subscribeStageTeamColors, updateFootballMatch, DEFAULT_EVOLUTION, DEFAULT_TEAM_COLORS, emptyScoringSettings, type TeamColor } from "@/lib/football-repository";
import { calculateMatchScores, type EvolutionLevel, type FootballMatch, type MatchPlayer, type MatchPosition, type PlayerProgress, type ScoringKey, type ScoringSettings } from "@/lib/football-system";

const POSITIONS: MatchPosition[] = ["GK", "DEF", "MID", "ATT"];
const RULES: Array<[ScoringKey, string]> = [["win","Victorie"],["loss","Înfrângere"],["goal","Gol"],["penaltyWin","Victorie penalty"],["penaltyLoss","Înfrângere la penalty"],["cleanSheet","Clean sheet"],["goalConceded","Gol primit"],["winStreak","Serie 3+ victorii"]];
const TEAM_LETTERS = ["A", "B", "C"];
const TEAM_COLORS: TeamColor[] = ["Verde", "Portocaliu", "Negru"];
function teamNames(colors: TeamColor[]) { return colors.map((color, index) => `Echipa ${TEAM_LETTERS[index]} (${color})`); }

function teamArrays(teams?: GeneratedTeams | null): ParticipantEntry[][] {
  if (!teams) return [];
  if (teams.teams?.length) return teams.teams;
  return [teams.teamA ?? [], teams.teamB ?? []].filter((team) => team.length > 0);
}
function draftPlayers(teams: ParticipantEntry[][], selected: number[], cards: PlayerCardData[]): MatchPlayer[] {
  const cardsByUser = new Map(cards.map((card) => [card.userId, card]));
  return selected.flatMap((sourceIndex, teamIndex) => (teams[sourceIndex] ?? []).flatMap((player) => {
    const card = cardsByUser.get(player.userId);
    return card?.isInjured ? [] : [{ userId: player.userId, name: player.name, teamIndex, position: card?.position ?? "MID", goals: 0 }];
  }));
}
function inputNumber(value: number): number | "" { return value === 0 ? "" : value; }
function scorers(match: FootballMatch, teamIndex: number): string {
  const entries = match.players.filter((player) => player.teamIndex === teamIndex && player.goals > 0).map((player) => `${player.name}${player.goals > 1 ? ` (${player.goals})` : ""}`);
  const ownGoals = match.ownGoals?.[teamIndex] ?? 0;
  if (ownGoals > 0) entries.push(`Autogol${ownGoals > 1 ? ` (${ownGoals})` : ""}`);
  return entries.join(", ");
}

export default function FootballMatchesPanel({ groupId, eventId, stageNumber, teams, canManage }: { groupId: string; eventId: string; stageNumber: number; teams?: GeneratedTeams | null; canManage: boolean }) {
  const { user } = useAuth();
  const availableTeams = useMemo(() => teamArrays(teams), [teams]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [cards, setCards] = useState<PlayerCardData[]>([]);
  const [progress, setProgress] = useState<PlayerProgress[]>([]);
  const [scoring, setScoring] = useState<ScoringSettings | null>(null);
  const [evolution, setEvolution] = useState<EvolutionLevel[]>(DEFAULT_EVOLUTION);
  const [editing, setEditing] = useState<FootballMatch | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"current" | "awards" | "history">("current");
  const [colors, setColors] = useState<TeamColor[]>(DEFAULT_TEAM_COLORS);
  const [colorDraft, setColorDraft] = useState<TeamColor[]>(DEFAULT_TEAM_COLORS);
  const [stageCards, setStageCards] = useState<StageCard[]>([]);
  const [cardHistory, setCardHistory] = useState<PlayerCardHistoryEntry[]>([]);

  useEffect(() => subscribeFootballMatches(groupId, setMatches), [groupId]);
  useEffect(() => subscribePlayerCards(groupId, setCards), [groupId]);
  useEffect(() => subscribeFootballProgress(groupId, setProgress), [groupId]);
  useEffect(() => subscribeScoringSettings(groupId, setScoring), [groupId]);
  useEffect(() => subscribeEvolutionSettings(groupId, setEvolution), [groupId]);
  useEffect(() => subscribeStageTeamColors(groupId, stageNumber, (next) => { setColors(next); setColorDraft(next); }), [groupId, stageNumber]);
  useEffect(() => subscribeGroupStageCards(groupId, setStageCards), [groupId]);
  useEffect(() => subscribeGroupCardHistory(groupId, setCardHistory), [groupId]);

  const currentTeamNames = useMemo(() => teamNames(colors), [colors]);
  const nextOrder = useMemo(() => {
    const used = new Set(matches.filter((match) => match.stageNumber === stageNumber).map((match) => match.matchOrder));
    let order = 1; while (used.has(order)) order += 1; return order;
  }, [matches, stageNumber]);

  async function persist(match: FootballMatch) {
    if (!user) return;
    setSaving(true); setMessage("");
    try {
      if (editing) await updateFootballMatch(match, user.uid);
      else { const { id: _id, ...newMatch } = match; await createFootballMatch(newMatch, user.uid); }
      setShowForm(false); setEditing(null); setMessage("Meciul a fost salvat și statisticile au fost recalculate.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Meciul nu a putut fi salvat."); }
    finally { setSaving(false); }
  }

  const stageMatches = matches.filter((match) => match.stageNumber === stageNumber);
  return <div className="flex flex-col gap-4">
    <section className="event-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Sistem fotbal</p><h2 className="text-2xl font-extrabold text-foreground">Meciuri · Etapa {stageNumber}</h2></div>{activeTab === "current" && canManage && <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Adaugă meci</button>}</div>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Secțiuni meciuri">{([["current","Etapa curentă"],["awards","Premii & Evoluții"],["history","Istoric"]] as const).map(([id,label]) => <button key={id} type="button" role="tab" aria-selected={activeTab===id} onClick={() => setActiveTab(id)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab===id ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"}`}>{label}</button>)}</div>
      {message && <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}
    </section>
    {activeTab === "current" && <>
      {canManage && user && <section className="event-panel p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="event-panel-title">Culorile echipelor</h3><p className="mt-1 text-sm text-muted-foreground">Atribuie o singură dată Verde, Portocaliu și Negru echipelor A/B/C pentru etapa curentă.</p></div><button type="button" onClick={async()=>{try{await saveStageTeamColors(groupId,stageNumber,colorDraft,user.uid);setMessage("Culorile echipelor au fost salvate.");}catch(error){setMessage(error instanceof Error?error.message:"Culorile nu au putut fi salvate.");}}} disabled={new Set(colorDraft).size!==3} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Salvează culorile</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{colorDraft.map((color,index)=><label key={index} className="text-sm font-semibold">Echipa {TEAM_LETTERS[index]}<select value={color} onChange={(event)=>setColorDraft((current)=>current.map((item,i)=>i===index?event.target.value as TeamColor:item))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5">{TEAM_COLORS.map((option)=><option key={option} disabled={colorDraft.some((item,i)=>i!==index&&item===option)}>{option}</option>)}</select></label>)}</div></section>}
      {availableTeams.length < 2 && <p className="event-panel p-4 text-sm text-muted-foreground">Generează mai întâi echipele pentru eveniment.</p>}
      {(showForm || editing) && <MatchEditor groupId={groupId} eventId={eventId} stageNumber={stageNumber} teams={availableTeams} teamLabels={currentTeamNames} cards={cards} initial={editing} nextOrder={nextOrder} saving={saving} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={persist} />}
      <MatchList matches={stageMatches} canManage={canManage} onEdit={(match) => { setEditing(match); setShowForm(false); }} />
      <Leaderboard progress={progress} />
    </>}
    {activeTab === "awards" && <><AdminStageAwards groupId={groupId} currentStageNumber={stageNumber} allowedAwardIds={["mvp","best_goalkeeper"]} />{canManage && user && <><ScoringEditor groupId={groupId} userId={user.uid} value={scoring} /><EvolutionEditor groupId={groupId} userId={user.uid} value={evolution} /></>}</>}
    {activeTab === "history" && <StageHistory matches={matches} progress={progress} stageCards={stageCards} cardHistory={cardHistory} />}
  </div>;
}

function MatchList({ matches, canManage, onEdit }: { matches: FootballMatch[]; canManage: boolean; onEdit: (match: FootballMatch) => void }) {
  return <section className="event-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="event-panel-title">Meciurile etapei</h2></div>{matches.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nu există meciuri înregistrate.</p> : <ul className="divide-y divide-border">{matches.map((match) => {
    const scores = match.scores.slice(0, 2); const winner = scores[0] === scores[1] ? match.penaltyWinnerIndex : scores[0] > scores[1] ? 0 : 1;
    return <li key={match.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase text-muted-foreground">Etapa {match.stageNumber} · Meciul {match.matchOrder}</p><div className="mt-2 flex flex-wrap items-center gap-3 text-lg font-extrabold"><span className={winner === 0 ? "text-primary" : "text-foreground"}>{match.teamNames[0]}</span><span className="rounded-lg bg-muted px-3 py-1 font-mono text-foreground">{scores[0] ?? 0} – {scores[1] ?? 0}</span><span className={winner === 1 ? "text-primary" : "text-foreground"}>{match.teamNames[1]}</span></div>{[0,1].map((index) => scorers(match,index) && <p key={index} className="mt-1 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{match.teamNames[index]}:</span> {scorers(match,index)}</p>)}{scores[0] === scores[1] && winner !== null && <p className="mt-1 text-xs font-semibold text-primary">Câștigătoare la penalty: {match.teamNames[winner]}</p>}</div>{canManage && <div className="flex gap-2"><button type="button" onClick={() => onEdit(match)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Editează</button><button type="button" onClick={async () => { if (confirm("Ștergi meciul și recalculezi toate statisticile?")) await deleteFootballMatch(match); }} className="rounded-lg border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive">Șterge</button></div>}</li>;
  })}</ul>}</section>;
}

function MatchEditor({ groupId,eventId,stageNumber,teams,teamLabels,cards,initial,nextOrder,saving,onCancel,onSave }: { groupId:string;eventId:string;stageNumber:number;teams:ParticipantEntry[][];teamLabels:string[];cards:PlayerCardData[];initial:FootballMatch|null;nextOrder:number;saving:boolean;onCancel:()=>void;onSave:(match:FootballMatch)=>void }) {
  const initialIndexes = initial?.teamIndexes?.length === 2 ? initial.teamIndexes : [0, Math.min(1, teams.length - 1)];
  const [selected, setSelected] = useState<number[]>(initialIndexes);
  const [players, setPlayers] = useState<MatchPlayer[]>(initial?.teamNames.length === 2 ? initial.players : draftPlayers(teams, initialIndexes, cards));
  const [ownGoals, setOwnGoals] = useState<number[]>(initial?.ownGoals?.slice(0,2) ?? [0,0]);
  const [penalty, setPenalty] = useState<number|null>(initial?.teamNames.length === 2 ? initial.penaltyWinnerIndex : null);
  const [order, setOrder] = useState(initial?.matchOrder ?? nextOrder);
  const scores = calculateMatchScores(players, ownGoals, 2); const tied = scores[0] === scores[1];

  function choose(slot: number, sourceIndex: number) {
    const updated = selected.map((value,index) => index === slot ? sourceIndex : value);
    setSelected(updated); setPlayers(draftPlayers(teams, updated, cards)); setOwnGoals([0,0]); setPenalty(null);
  }
  const names = selected.map((index) => teamLabels[index] ?? `Echipa ${TEAM_LETTERS[index] ?? index + 1}`);
  return <section className="event-panel p-5 sm:p-6"><h2 className="event-panel-title">{initial ? "Editează meciul" : "Meci nou"}</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_100px]">{[0,1].map((slot) => <label key={slot} className="text-sm font-semibold text-foreground">Echipa {slot + 1}<select value={selected[slot]} onChange={(event) => choose(slot, Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5">{teams.map((_,index) => <option key={index} value={index} disabled={selected[1-slot] === index}>{teamLabels[index] ?? `Echipa ${TEAM_LETTERS[index] ?? index + 1}`}</option>)}</select></label>)}<label className="text-sm font-semibold text-foreground">Meciul<input type="number" min={1} placeholder="1" value={inputNumber(order)} onChange={(event) => setOrder(event.target.value === "" ? 0 : Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5" /></label></div>
    <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-muted p-4"><span className="font-bold text-foreground">{names[0]}</span><span className="rounded-lg bg-background px-4 py-2 font-mono text-xl font-extrabold">{scores[0]} – {scores[1]}</span><span className="font-bold text-foreground">{names[1]}</span></div>
    {tied && <fieldset className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4"><legend className="px-1 text-sm font-bold">Cine a câștigat la penalty?</legend><div className="mt-2 flex flex-wrap gap-2">{[0,1].map((index) => <button key={index} type="button" aria-pressed={penalty===index} onClick={() => setPenalty(index)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${penalty===index ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>{names[index]}</button>)}</div>{penalty===null && <p className="mt-2 text-sm font-medium text-destructive">Alegerea câștigătoarei este obligatorie la egal.</p>}</fieldset>}
    <div className="mt-5 grid gap-4 md:grid-cols-2">{[0,1].map((teamIndex) => <div key={teamIndex} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{names[teamIndex]}</h3><label className="text-xs font-semibold">Autogoluri în favoare<input aria-label={`Autogoluri în favoarea ${names[teamIndex]}`} type="number" min={0} placeholder="0" value={inputNumber(ownGoals[teamIndex] ?? 0)} onChange={(event) => { const value=event.target.value===""?0:Number(event.target.value); setOwnGoals((current)=>current.map((item,index)=>index===teamIndex?value:item)); setPenalty(null); }} className="ml-2 w-16 rounded-lg border border-border bg-background px-2 py-1.5" /></label></div><div className="mt-3 flex flex-col gap-2">{players.filter((player) => player.teamIndex === teamIndex).map((player) => <div key={player.userId} className="grid grid-cols-[1fr_76px_72px] items-center gap-2"><span className="truncate text-sm font-medium">{player.name}</span><select aria-label={`Poziția lui ${player.name}`} value={player.position} onChange={(event) => setPlayers((current)=>current.map((item)=>item.userId===player.userId?{...item,position:event.target.value as MatchPosition}:item))} className="rounded-lg border border-border bg-background px-2 py-2 text-xs">{POSITIONS.map((position)=><option key={position}>{position}</option>)}</select><input aria-label={`Goluri ${player.name}`} type="number" min={0} placeholder="0" value={inputNumber(player.goals)} onChange={(event)=>{const goals=event.target.value===""?0:Number(event.target.value);setPlayers((current)=>current.map((item)=>item.userId===player.userId?{...item,goals}:item));setPenalty(null);}} className="rounded-lg border border-border bg-background px-2 py-2" /></div>)}</div></div>)}</div>
    <div className="mt-5 flex gap-2"><button type="button" disabled={saving || selected[0]===selected[1] || (tied && penalty===null) || order<1} onClick={() => onSave({ id:initial?.id??"new", groupId,eventId,stageNumber,matchOrder:order,playedAt:initial?.playedAt??Date.now(),teamNames:names,teamIndexes:selected,ownGoals,scores,penaltyWinnerIndex:tied?penalty:null,players })} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">{saving?"Se salvează...":"Salvează și recalculează"}</button><button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2.5 font-semibold">Renunță</button></div>
  </section>;
}

function StageHistory({matches,progress,stageCards,cardHistory}:{matches:FootballMatch[];progress:PlayerProgress[];stageCards:StageCard[];cardHistory:PlayerCardHistoryEntry[]}) {
  const stages=[...new Set(matches.map((match)=>match.stageNumber))].sort((a,b)=>b-a);
  if(stages.length===0) return <section className="event-panel p-5"><h2 className="event-panel-title">Istoricul etapelor</h2><p className="mt-2 text-sm text-muted-foreground">Istoricul apare după salvarea primului meci.</p></section>;
  return <div className="flex flex-col gap-4">{stages.map((stage)=>{
    const stageMatches=matches.filter((match)=>match.stageNumber===stage);
    const stagePlayers=progress.map((player)=>{const rows=player.breakdown.filter((row)=>row.stageNumber===stage);return {name:player.name,matches:rows.length,wins:rows.filter((row)=>row.won).length,goals:rows.reduce((sum,row)=>sum+row.goals,0),points:rows.some((row)=>row.points!==null)?rows.reduce((sum,row)=>sum+(row.points??0),0):null};}).filter((player)=>player.matches>0).sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity)||b.goals-a.goals);
    const awards=stageCards.filter((card)=>card.stageNumber===stage).flatMap((card)=>card.awards);
    const changes=cardHistory.filter((entry)=>entry.stageNumber===stage&&entry.reason==="award");
    const teamLabels=[...new Set(stageMatches.flatMap((match)=>match.teamNames))];
    return <details key={stage} className="event-panel overflow-hidden" open={stage===stages[0]}><summary className="cursor-pointer list-none p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Etapa {stage}</p><h2 className="event-panel-title">{stageMatches.length} {stageMatches.length===1?"meci":"meciuri"} · {stagePlayers.length} jucători</h2></div><span className="text-sm font-semibold text-muted-foreground">Vezi toate datele</span></div></summary><div className="flex flex-col gap-5 border-t border-border p-5">
      <div><h3 className="font-bold text-foreground">Echipe și culori</h3><div className="mt-2 flex flex-wrap gap-2">{teamLabels.map((name)=><span key={name} className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold">{name}</span>)}</div></div>
      <div><h3 className="font-bold text-foreground">Rezultate și marcatori</h3><div className="mt-2"><MatchList matches={stageMatches} canManage={false} onEdit={()=>{}} /></div></div>
      <div><h3 className="font-bold text-foreground">Clasamentul etapei</h3><div className="mt-2 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-2">Jucător</th><th>M</th><th>V</th><th>Goluri</th><th>Puncte</th></tr></thead><tbody>{stagePlayers.map((player)=><tr key={player.name} className="border-t border-border"><td className="p-2 font-semibold">{player.name}</td><td>{player.matches}</td><td>{player.wins}</td><td>{player.goals}</td><td>{player.points??"—"}</td></tr>)}</tbody></table></div></div>
      <div className="grid gap-4 md:grid-cols-2"><div><h3 className="font-bold text-foreground">Premii</h3>{awards.length?<ul className="mt-2 flex flex-col gap-2">{awards.map((award,index)=><li key={`${award.awardId}-${index}`} className="rounded-xl bg-muted p-3 text-sm"><span className="font-bold">{award.label}:</span> {award.winnerName} ({award.votes} voturi)</li>)}</ul>:<p className="mt-2 text-sm text-muted-foreground">Premiile nu au fost încă publicate.</p>}</div><div><h3 className="font-bold text-foreground">Evoluții acordate</h3>{changes.length?<ul className="mt-2 flex flex-col gap-2">{changes.map((entry)=><li key={entry.id} className="rounded-xl bg-muted p-3 text-sm"><span className="font-bold">{entry.after.playerName??entry.userId}</span>: OVR {entry.before.overall} → {entry.after.overall}{entry.deltas?.length?` · ${entry.deltas.map((delta)=>`${delta.key} +${delta.amount}`).join(", ")}`:""}</li>)}</ul>:<p className="mt-2 text-sm text-muted-foreground">Nu există evoluții acordate în această etapă.</p>}</div></div>
    </div></details>;
  })}</div>;
}

function Leaderboard({progress}:{progress:PlayerProgress[]}) { return <section className="event-panel overflow-hidden"><div className="p-5"><h2 className="event-panel-title">Clasament sezon</h2></div>{progress.length===0?<p className="px-5 pb-5 text-sm text-muted-foreground">Statisticile apar după primul meci.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-3">Jucător</th><th>M</th><th>V</th><th>VP</th><th>Î</th><th>ÎP</th><th>Goluri</th><th>CS</th><th>Puncte</th><th>OVR</th></tr></thead><tbody>{progress.map(p=><tr key={p.userId} className="border-t border-border"><td className="p-3 font-semibold">{p.name}</td><td>{p.matches}</td><td>{p.wins}</td><td>{p.penaltyWins}</td><td>{p.losses}</td><td>{p.penaltyLosses}</td><td>{p.goals}</td><td>{p.cleanSheets}</td><td>{p.points ?? "—"}</td><td>{p.currentOverall}</td></tr>)}</tbody></table></div>}</section>; }
function ScoringEditor({groupId,userId,value}:{groupId:string;userId:string;value:ScoringSettings|null}) { const [draft,setDraft]=useState<ScoringSettings>(value??emptyScoringSettings()); useEffect(()=>setDraft(value??emptyScoringSettings()),[value]); return <section className="event-panel p-5"><h2 className="event-panel-title">Configurare punctaj</h2><p className="mt-2 text-sm text-muted-foreground">Toate valorile sunt obligatorii înainte de acordarea punctelor.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Criteriu</th>{POSITIONS.map(p=><th key={p}>{p}</th>)}</tr></thead><tbody>{RULES.map(([key,label])=><tr key={key} className="border-t border-border"><td className="p-2">{label}</td>{POSITIONS.map(pos=><td key={pos} className="p-1"><input aria-label={`${label} ${pos}`} type="number" value={draft[pos][key]??""} onChange={(e)=>setDraft({...draft,[pos]:{...draft[pos],[key]:e.target.value===""?null:Number(e.target.value)}})} className="w-20 rounded-md border border-border bg-background px-2 py-1.5" /></td>)}</tr>)}</tbody></table></div><button type="button" onClick={()=>saveScoringSettings(groupId,draft,userId)} className="mt-4 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Salvează punctajul</button></section>; }
function EvolutionEditor({groupId,userId,value}:{groupId:string;userId:string;value:EvolutionLevel[]}) { const [draft,setDraft]=useState(value); useEffect(()=>setDraft(value),[value]); return <section className="event-panel p-5"><h2 className="event-panel-title">Praguri Evolution</h2><div className="mt-4 grid gap-2 sm:grid-cols-5">{draft.map((level,i)=><div key={level.level} className="rounded-xl border border-border p-3"><p className="text-sm font-bold">Nivel {level.level}</p><input aria-label={`Puncte nivel ${level.level}`} placeholder="Puncte" type="number" value={level.points??""} onChange={(e)=>setDraft(v=>v.map((x,j)=>j===i?{...x,points:e.target.value===""?null:Number(e.target.value)}:x))} className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5"/><input aria-label={`Bonus nivel ${level.level}`} placeholder="Bonus OVR" type="number" value={level.overallBonus??""} onChange={(e)=>setDraft(v=>v.map((x,j)=>j===i?{...x,overallBonus:e.target.value===""?null:Number(e.target.value)}:x))} className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5"/></div>)}</div><button type="button" onClick={()=>saveEvolutionSettings(groupId,draft,userId)} className="mt-4 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Salvează pragurile</button></section>; }
