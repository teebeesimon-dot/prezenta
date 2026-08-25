"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthProvider";
import { subscribeToGroupMembers, type Member } from "@/lib/members";
import { db } from "@/lib/firebase";
import {
  STAGE_AWARD_OPTIONS,
  createStageVote,
  getStageVotes,
  upsertStageCard,
  type StageAward,
  type StageAwardDefinition,
  type StageCard,
} from "@/lib/player-cards";

interface AdminStageAwardsProps {
  groupId: string;
  currentStageNumber?: number;
}

export default function AdminStageAwards({ groupId, currentStageNumber = 1 }: AdminStageAwardsProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [stageNumber, setStageNumber] = useState(currentStageNumber);
  const [selectedAwards, setSelectedAwards] = useState<string[]>(["mvp", "top_scorer"]);
  const [votingOpen, setVotingOpen] = useState(false);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Record<string, StageAward[]>>({});

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);

  const stageId = `${groupId}_stage_${stageNumber}`;

  const awardOptions = useMemo(() => STAGE_AWARD_OPTIONS, []);

  function toggleAward(id: string) {
    setSelectedAwards((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function loadResults() {
    if (!groupId || !stageNumber) return;
    const stageVotes = await getStageVotes(groupId, stageId);
    const grouped: Record<string, StageAward[]> = {};
    for (const awardId of selectedAwards) {
      const award = awardOptions.find((item) => item.id === awardId);
      if (!award) continue;
      const byCandidate = new Map<string, number>();
      stageVotes
        .filter((vote) => vote.awardId === awardId)
        .forEach((vote) => byCandidate.set(vote.candidateUserId, (byCandidate.get(vote.candidateUserId) ?? 0) + 1));
      grouped[awardId] = Array.from(byCandidate.entries())
        .map(([candidateUserId, count]) => {
          const member = members.find((item) => item.userId === candidateUserId);
          return {
            awardId,
            label: award.label,
            winnerUserId: candidateUserId,
            winnerName: member?.userName ?? "Jucator",
            winnerPhoto: member?.userPhoto ?? null,
            votes: count,
          };
        })
        .sort((a, b) => b.votes - a.votes);
    }
    setResults(grouped);
  }

  async function publishStageCards() {
    if (!user || selectedAwards.length === 0) return;
    setSaving(true);
    setMessage("");
    try {
      const stageVotes = await getStageVotes(groupId, stageId);
      const winnersByUser = new Map<string, StageAward[]>();
      for (const awardId of selectedAwards) {
        const award = awardOptions.find((item) => item.id === awardId);
        if (!award) continue;
        const counts = new Map<string, number>();
        stageVotes.filter((vote) => vote.awardId === awardId).forEach((vote) => {
          counts.set(vote.candidateUserId, (counts.get(vote.candidateUserId) ?? 0) + 1);
        });
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const winner = sorted[0];
        if (!winner) continue;
        const member = members.find((item) => item.userId === winner[0]);
        const awardResult: StageAward = {
          awardId,
          label: award.label,
          winnerUserId: winner[0],
          winnerName: member?.userName ?? "Jucator",
          winnerPhoto: member?.userPhoto ?? null,
          votes: winner[1],
        };
        const existing = winnersByUser.get(winner[0]) ?? [];
        existing.push(awardResult);
        winnersByUser.set(winner[0], existing);
      }

      for (const [winnerUserId, awards] of winnersByUser) {
        const card = await getExistingCard(groupId, winnerUserId);
        await upsertStageCard({
          groupId,
          stageId,
          stageNumber,
          userId: winnerUserId,
          playerName: awards[0].winnerName,
          playerPhoto: awards[0].winnerPhoto,
          overall: card?.overall ?? 65,
          position: card?.position ?? "MID",
          awardIds: awards.map((award) => award.awardId),
          awards,
        });
      }
      setVotingOpen(false);
      setMessage("Rezultatele au fost publicate si cardurile etapei au fost create.");
    } catch {
      setMessage("Nu am putut publica premiile etapei.");
    } finally {
      setSaving(false);
    }
  }

  async function vote(awardId: string) {
    if (!user || !votes[awardId]) return;
    setSaving(true);
    setMessage("");
    try {
      await createStageVote({
        groupId,
        stageId,
        awardId,
        voterUserId: user.uid,
        candidateUserId: votes[awardId],
      });
      setMessage("Vot inregistrat.");
    } catch {
      setMessage("Votul nu a putut fi inregistrat. Daca ai votat deja, acesta nu poate fi repetat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold text-foreground">Premiile etapei</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Alege exact ce se voteaza la etapa curenta. Participantii pot avea un singur vot pentru fiecare premiu.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">
          Numar etapa
          <input
            type="number"
            min={1}
            value={stageNumber}
            onChange={(event) => setStageNumber(Number(event.target.value) || 1)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          />
        </label>
        <div>
          <span className="text-sm font-medium text-foreground">Premii</span>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {awardOptions.map((award) => (
              <label key={award.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={selectedAwards.includes(award.id)} onChange={() => toggleAward(award.id)} />
                {award.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setVotingOpen(true)}
          disabled={selectedAwards.length === 0}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          Deschide votarea
        </button>
        <button
          type="button"
          onClick={loadResults}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
        >
          Vezi rezultate
        </button>
        <button
          type="button"
          onClick={publishStageCards}
          disabled={saving || selectedAwards.length === 0}
          className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
        >
          Publica premiile si cardurile
        </button>
      </div>

      {votingOpen && (
        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
          <h4 className="font-bold text-foreground">Votare etapa {stageNumber}</h4>
          <div className="mt-4 grid gap-4">
            {selectedAwards.map((awardId) => {
              const award = awardOptions.find((item) => item.id === awardId)!;
              return (
                <div key={awardId} className="rounded-xl border border-border p-3">
                  <div className="text-sm font-bold text-foreground">{award.label}</div>
                  <select
                    value={votes[awardId] ?? ""}
                    onChange={(event) => setVotes((current) => ({ ...current, [awardId]: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">Selecteaza jucatorul</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.userName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!votes[awardId] || saving}
                    onClick={() => vote(awardId)}
                    className="mt-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Voteaza
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}

      {Object.keys(results).length > 0 && (
        <div className="mt-5 space-y-4">
          {Object.entries(results).map(([awardId, entries]) => (
            <div key={awardId} className="rounded-xl border border-border p-4">
              <div className="font-bold text-foreground">{awardOptions.find((item) => item.id === awardId)?.label}</div>
              <div className="mt-2 space-y-1 text-sm">
                {entries.map((entry) => (
                  <div key={entry.winnerUserId} className="flex items-center justify-between">
                    <span>{entry.winnerName}</span>
                    <span className="font-bold">{entry.votes}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function getExistingCard(groupId: string, userId: string) {
  const snap = await getDocs(
    query(
      collection(db, "playerCards"),
      where("groupId", "==", groupId),
      where("userId", "==", userId)
    )
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as {
    overall: number;
    position: "GK" | "DEF" | "MID" | "ATT";
  };
}
