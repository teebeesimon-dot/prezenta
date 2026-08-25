"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthProvider";
import { subscribeToGroupMembers, type Member } from "@/lib/members";
import { db } from "@/lib/firebase";
import PlayerCard from "@/components/PlayerCard";
import { createStageVote, getStageConfig, getStageVotes, STAGE_AWARD_OPTIONS, type PlayerCardData, type StageCard } from "@/lib/player-cards";

export default function PlayerCardSection({ groupId, currentStageNumber = 1 }: { groupId: string; currentStageNumber?: number }) {
  const { user } = useAuth();
  const [baseCard, setBaseCard] = useState<PlayerCardData | null>(null);
  const [activeStageCard, setActiveStageCard] = useState<StageCard | null>(null);
  const [history, setHistory] = useState<StageCard[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [awardIds, setAwardIds] = useState<string[]>([]);
  const [votingOpen, setVotingOpen] = useState(false);
  const [voted, setVoted] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [savingVote, setSavingVote] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState("");

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);

  useEffect(() => {
    if (!user || !groupId) return;
    let active = true;
    (async () => {
      const [baseSnap, stageSnap] = await Promise.all([
        getDocs(query(collection(db, "playerCards"), where("groupId", "==", groupId), where("userId", "==", user.uid))),
        getDocs(query(collection(db, "stageCards"), where("groupId", "==", groupId), where("userId", "==", user.uid))),
      ]);
      if (!active) return;
      setBaseCard(baseSnap.empty ? null : (baseSnap.docs[0].data() as PlayerCardData));
      const cards = stageSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<StageCard, "id">) }))
        .sort((a, b) => b.stageNumber - a.stageNumber);
      const current = cards.find((card) => card.stageNumber === currentStageNumber) ?? null;
      setActiveStageCard(current);
      setHistory(cards.filter((card) => card.stageNumber < currentStageNumber));
    })();
    return () => { active = false; };
  }, [user, groupId, currentStageNumber]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await getStageConfig(groupId, currentStageNumber);
      if (cancelled) return;
      setAwardIds(config?.awardIds ?? []);
      setVotingOpen(config?.votingOpen ?? false);
      if (config?.votingOpen && user) {
        const votes = await getStageVotes(groupId, `${groupId}_stage_${currentStageNumber}`);
        const ownVotes: Record<string, string> = {};
        votes.filter((vote) => vote.voterUserId === user.uid).forEach((vote) => {
          ownVotes[vote.awardId] = vote.candidateUserId;
        });
        if (!cancelled) setVoted(ownVotes);
      } else {
        setVoted({});
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, currentStageNumber, user]);

  async function vote(awardId: string) {
    if (!user || !selection[awardId] || voted[awardId]) return;
    setSavingVote(awardId);
    setVoteMessage("");
    try {
      await createStageVote({ groupId, stageId: `${groupId}_stage_${currentStageNumber}`, awardId, voterUserId: user.uid, candidateUserId: selection[awardId] });
      setVoted((current) => ({ ...current, [awardId]: selection[awardId] }));
      setVoteMessage("Votul a fost inregistrat.");
    } catch {
      setVoteMessage("Votul nu a putut fi inregistrat. Daca ai votat deja, nu mai poate fi repetat.");
    } finally {
      setSavingVote(null);
    }
  }

  return (
    <>
      {(baseCard || activeStageCard) && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-foreground">Cardul meu</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cardul de baza si premiile castigate in etapele grupei.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-5">
            {activeStageCard ? <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Card activ · Etapa {currentStageNumber}</div><PlayerCard card={activeStageCard} /></div> : baseCard ? <PlayerCard card={baseCard} /> : null}
          </div>
          {history.length > 0 && <div className="mt-8"><h3 className="text-lg font-bold text-foreground">Istoric</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{history.map((card) => <div key={card.id}><div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Etapa {card.stageNumber}</div><PlayerCard card={card} compact /></div>)}</div></div>}
        </section>
      )}

      {votingOpen && awardIds.length > 0 && user && (
        <section className="mt-8 rounded-2xl border border-primary/20 bg-card p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Etapa {currentStageNumber}</div>
          <h2 className="mt-1 text-xl font-bold text-foreground">Voteaza premiile etapei</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ai un singur vot pentru fiecare premiu.</p>
          <div className="mt-5 grid gap-4">
            {awardIds.map((awardId) => {
              const award = STAGE_AWARD_OPTIONS.find((item) => item.id === awardId);
              if (!award) return null;
              const hasVoted = Boolean(voted[awardId]);
              return <div key={awardId} className="rounded-xl border border-border p-4"><div className="font-bold text-foreground">{award.label}</div>{hasVoted ? <p className="mt-2 text-sm font-semibold text-primary">Ai votat deja pentru aceasta categorie.</p> : <div className="mt-2 flex flex-col gap-2 sm:flex-row"><select value={selection[awardId] ?? ""} onChange={(event) => setSelection((current) => ({ ...current, [awardId]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"><option value="">Selecteaza jucatorul</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.userName}</option>)}</select><button type="button" disabled={!selection[awardId] || savingVote === awardId} onClick={() => vote(awardId)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{savingVote === awardId ? "Se salveaza..." : "Voteaza"}</button></div>}</div>;
            })}
          </div>
          {voteMessage && <p className="mt-4 text-sm text-muted-foreground">{voteMessage}</p>}
        </section>
      )}
    </>
  );
}
