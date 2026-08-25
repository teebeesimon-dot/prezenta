"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { subscribeToGroupMembers, type Member } from "@/lib/members";
import { createStageVote, getStageConfig, getStageVotes, STAGE_AWARD_OPTIONS } from "@/lib/player-cards";

export default function StageVotingSection({ groupId, stageNumber }: { groupId: string; stageNumber: number }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [awardIds, setAwardIds] = useState<string[]>([]);
  const [voted, setVoted] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await getStageConfig(groupId, stageNumber);
      if (cancelled) return;
      setAwardIds(config?.awardIds ?? []);
      setOpen(config?.votingOpen ?? false);
      if (config?.votingOpen && user) {
        const votes = await getStageVotes(groupId, `${groupId}_stage_${stageNumber}`);
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
  }, [groupId, stageNumber, user]);

  async function vote(awardId: string) {
    if (!user || !selection[awardId] || voted[awardId]) return;
    setSaving(awardId);
    setMessage("");
    try {
      await createStageVote({
        groupId,
        stageId: `${groupId}_stage_${stageNumber}`,
        awardId,
        voterUserId: user.uid,
        candidateUserId: selection[awardId],
      });
      setVoted((current) => ({ ...current, [awardId]: selection[awardId] }));
      setMessage("Votul a fost inregistrat.");
    } catch {
      setMessage("Votul nu a putut fi inregistrat. Daca ai votat deja, nu mai poate fi repetat.");
    } finally {
      setSaving(null);
    }
  }

  if (!open || awardIds.length === 0 || !user) return null;

  return (
    <section className="mt-8 rounded-2xl border border-primary/20 bg-card p-5 shadow-sm">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary">Etapa {stageNumber}</div>
        <h2 className="mt-1 text-xl font-bold text-foreground">Voteaza premiile etapei</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ai un singur vot pentru fiecare premiu. Votul tau ramane anonim fata de ceilalti participanti.</p>
      </div>

      <div className="mt-5 grid gap-4">
        {awardIds.map((awardId) => {
          const award = STAGE_AWARD_OPTIONS.find((item) => item.id === awardId);
          if (!award) return null;
          const hasVoted = Boolean(voted[awardId]);
          return (
            <div key={awardId} className="rounded-xl border border-border p-4">
              <div className="font-bold text-foreground">{award.label}</div>
              {hasVoted ? (
                <p className="mt-2 text-sm font-semibold text-primary">Ai votat deja pentru aceasta categorie.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selection[awardId] ?? ""}
                    onChange={(event) => setSelection((current) => ({ ...current, [awardId]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
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
                    disabled={!selection[awardId] || saving === awardId}
                    onClick={() => vote(awardId)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {saving === awardId ? "Se salveaza..." : "Voteaza"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}
