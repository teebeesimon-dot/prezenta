"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeFootballMatches, subscribeFootballProgress } from "@/lib/football-repository";
import type { FootballMatch, PlayerProgress } from "@/lib/football-system";

 type StandingMode = "stage" | "overall";
 type StandingTab = "players" | "teams";

 interface PlayerStanding {
  userId: string;
  name: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  goalsConceded: number;
  points: number | null;
  overall: number;
  position: string;
 }

 interface TeamStanding {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
 }

 function sortPlayers(rows: PlayerStanding[]) {
  return [...rows].sort((a, b) =>
    (b.points ?? -Infinity) - (a.points ?? -Infinity) ||
    b.wins - a.wins || b.goals - a.goals || b.overall - a.overall ||
    a.name.localeCompare(b.name),
  );
 }

 function sortTeams(rows: TeamStanding[]) {
  return [...rows].sort((a, b) =>
    b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor || b.wins - a.wins || a.name.localeCompare(b.name),
  );
 }

 function playerRows(progress: PlayerProgress[], mode: StandingMode, stageNumber: number): PlayerStanding[] {
  return sortPlayers(progress.map((player) => {
    const rows = mode === "overall"
      ? player.breakdown.filter((item) => item.stageNumber <= stageNumber)
      : player.breakdown.filter((item) => item.stageNumber === stageNumber);
    const goals = rows.reduce((sum, row) => sum + row.goals, 0);
    const points = rows.some((row) => row.points !== null) ? rows.reduce((sum, row) => sum + (row.points ?? 0), 0) : null;
    return {
      userId: player.userId,
      name: player.name,
      matches: rows.length,
      wins: rows.filter((row) => row.won).length,
      draws: rows.filter((row) => !row.won && !row.lost).length,
      losses: rows.filter((row) => row.lost).length,
      goals,
      goalsConceded: rows.reduce((sum, row) => sum + (row.position === "GK" ? row.goalsConceded : 0), 0),
      points,
      overall: player.currentOverall,
      position: rows[0]?.position ?? "—",
    };
  }).filter((row) => row.matches > 0));
 }

 function teamRows(matches: FootballMatch[], mode: StandingMode, stageNumber: number): TeamStanding[] {
  const filtered = mode === "overall"
    ? matches.filter((match) => match.stageNumber <= stageNumber)
    : matches.filter((match) => match.stageNumber === stageNumber);
  const table = new Map<string, TeamStanding>();
  for (const match of filtered) {
    const scores = match.scores.slice(0, 2);
    if (scores.length < 2) continue;
    const tied = scores[0] === scores[1];
    const winner = tied ? match.penaltyWinnerIndex : scores[0] > scores[1] ? 0 : 1;
    for (const index of [0, 1]) {
      const name = match.teamNames[index] ?? `Culoare ${index + 1}`;
      const current = table.get(name) ?? { name, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      current.played += 1;
      current.goalsFor += scores[index] ?? 0;
      current.goalsAgainst += scores[1 - index] ?? 0;
      if (winner === null) current.draws += 1, current.points += 1;
      else if (winner === index) current.wins += 1, current.points += 3;
      else current.losses += 1;
      table.set(name, current);
    }
  }
  return sortTeams([...table.values()]);
 }

 function rankClass(rank: number) {
  return rank === 1 ? "border-primary/50 bg-primary/10" : rank === 2 ? "border-border bg-muted/70" : rank === 3 ? "border-border bg-muted/40" : "border-border bg-card";
 }

 export default function FootballStandingsPanel({ groupId, currentStageNumber }: { groupId: string; currentStageNumber: number }) {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [progress, setProgress] = useState<PlayerProgress[]>([]);
  const [tab, setTab] = useState<StandingTab>("players");
  const [mode, setMode] = useState<StandingMode>("stage");

  useEffect(() => subscribeFootballMatches(groupId, setMatches), [groupId]);
  useEffect(() => subscribeFootballProgress(groupId, setProgress), [groupId]);

  const players = useMemo(() => playerRows(progress, mode, currentStageNumber), [currentStageNumber, mode, progress]);
  const teams = useMemo(() => teamRows(matches, mode, currentStageNumber), [currentStageNumber, matches, mode]);
  const label = mode === "overall" ? `General până la Etapa ${currentStageNumber}` : `Etapa ${currentStageNumber}`;
  const hasData = tab === "players" ? players.length > 0 : teams.length > 0;

  return <div className="flex flex-col gap-4">
    <section className="event-panel p-5 sm:p-6">
      <div>
        <p className="text-sm font-semibold text-primary">Sistem fotbal</p>
        <h2 className="mt-1 text-2xl font-extrabold text-foreground">Clasament</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Compară etapa selectată cu clasamentul general acumulat până la această etapă. La următoarea etapă, totalul continuă automat de aici.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Tip clasament">
        {([["players", "Jucători"], ["teams", "Echipe"]] as const).map(([id, text]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{text}</button>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Perioadă clasament">
        <button type="button" onClick={() => setMode("stage")} aria-pressed={mode === "stage"} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${mode === "stage" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"}`}>Etapa {currentStageNumber}</button>
        <button type="button" onClick={() => setMode("overall")} aria-pressed={mode === "overall"} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${mode === "overall" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"}`}>General până aici</button>
      </div>
    </section>
    {tab === "players" ? <PlayerStandings rows={players} label={label} hasData={hasData} /> : <TeamStandings rows={teams} label={label} hasData={hasData} />}
  </div>;
 }

 function PlayerStandings({ rows, label, hasData }: { rows: PlayerStanding[]; label: string; hasData: boolean }) {
  return <section className="event-panel overflow-hidden"><div className="border-b border-border p-5"><h3 className="text-lg font-extrabold text-foreground">Jucători · {label}</h3><p className="mt-1 text-sm text-muted-foreground">P = puncte acordate de sistemul de punctaj · OVR = rating actual</p></div>{!hasData ? <p className="p-5 text-sm text-muted-foreground">Nu există statistici pentru această selecție.</p> : <div className="grid gap-3 p-4 sm:p-5">{rows.map((row, index) => <article key={row.userId} className={`rounded-2xl border p-4 ${rankClass(index + 1)}`}><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-extrabold text-foreground">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="break-words text-base font-extrabold text-foreground sm:text-lg">{row.name}</h4><span className="rounded-lg bg-background px-2.5 py-1 text-sm font-extrabold text-primary">{row.points ?? "—"} P</span></div><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.position}</p><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5"><Stat label="Meciuri" value={row.matches} /><Stat label="Victorii" value={row.wins} /><Stat label="Egaluri" value={row.draws} /><Stat label="Înfrângeri" value={row.losses} /><Stat label="Goluri" value={row.goals} /><Stat label="Primite" value={row.goalsConceded} /><Stat label="OVR" value={row.overall} /></dl></div></div></article>)}</div>}</section>;
 }

 function TeamStandings({ rows, label, hasData }: { rows: TeamStanding[]; label: string; hasData: boolean }) {
  return <section className="event-panel overflow-hidden"><div className="border-b border-border p-5"><h3 className="text-lg font-extrabold text-foreground">Echipe · {label}</h3><p className="mt-1 text-sm text-muted-foreground">Punctaj standard: 3 puncte pentru victorie, 1 pentru egal, 0 pentru înfrângere. Departajare: golaveraj, goluri marcate, victorii.</p></div>{!hasData ? <p className="p-5 text-sm text-muted-foreground">Nu există meciuri pentru această selecție.</p> : <div className="grid gap-3 p-4 sm:p-5">{rows.map((row, index) => <article key={row.name} className={`rounded-2xl border p-4 ${rankClass(index + 1)}`}><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-extrabold text-foreground">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="break-words text-base font-extrabold text-foreground sm:text-lg">{row.name}</h4><span className="rounded-lg bg-background px-2.5 py-1 text-sm font-extrabold text-primary">{row.points} pct</span></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4"><Stat label="Meciuri" value={row.played} /><Stat label="Victorii" value={row.wins} /><Stat label="Egaluri" value={row.draws} /><Stat label="Înfrângeri" value={row.losses} /><Stat label="Goluri marcate" value={row.goalsFor} /><Stat label="Goluri primite" value={row.goalsAgainst} /><Stat label="Golaveraj" value={`${row.goalsFor - row.goalsAgainst >= 0 ? "+" : ""}${row.goalsFor - row.goalsAgainst}`} /></dl></div></div></article>)}</div>}</section>;
 }

 function Stat({ label, value }: { label: string; value: number | string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-bold text-foreground">{value}</dd></div>; }
