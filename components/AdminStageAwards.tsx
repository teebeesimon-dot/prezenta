"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { subscribeToGroupMembers, type Member } from "@/lib/members";
import CardImageUploader from "@/components/CardImageUploader";
import {
  STAGE_AWARD_OPTIONS,
  applyStageAwardsToPlayer,
  getStageConfig,
  getStageVotes,
  reportPlayerCardsError,
  saveStageConfig,
  upsertStageCard,
  type StageAward,
} from "@/lib/player-cards";

interface AdminStageAwardsProps {
  groupId: string;
  currentStageNumber?: number;
}

export default function AdminStageAwards({
  groupId,
  currentStageNumber = 1,
  hideCardCreation = false,
}: AdminStageAwardsProps & { hideCardCreation?: boolean }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [stageNumber, setStageNumber] = useState(currentStageNumber);
  const [selectedAwards, setSelectedAwards] = useState<string[]>([
    "mvp",
    "top_scorer",
  ]);
  const [votingOpen, setVotingOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Record<string, StageAward[]>>({});
  const [specialCardUserId, setSpecialCardUserId] = useState("");
  const [specialCardImages, setSpecialCardImages] = useState<Record<string, string>>({});

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);

  const stageId = `${groupId}_stage_${stageNumber}`;
  const awardOptions = useMemo(() => STAGE_AWARD_OPTIONS, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getStageConfig(groupId, stageNumber);
        if (cancelled) return;
        setSelectedAwards(
          config?.awardIds?.length ? config.awardIds : ["mvp", "top_scorer"],
        );
        setVotingOpen(config?.votingOpen ?? false);
        setPublished(config?.published ?? false);
        setResults({});
      } catch (error) {
        if (!cancelled) {
          setMessage(
            reportPlayerCardsError(
              error,
              "Citirea configurației etapei",
              "stageConfigs",
            ),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, stageNumber]);

  function toggleAward(id: string) {
    if (votingOpen || published) return;
    setSelectedAwards((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function openVoting() {
    if (selectedAwards.length === 0) return;
    setSaving(true);
    setMessage("");
    try {
      await saveStageConfig({
        groupId,
        stageNumber,
        awardIds: selectedAwards,
        votingOpen: true,
        published: false,
        updatedBy: user!.uid,
      });
      setVotingOpen(true);
      setPublished(false);
      setMessage(
        "Votarea este deschisa. Participantii o vor vedea pe pagina meciului.",
      );
    } catch (error) {
      setMessage(
        reportPlayerCardsError(error, "Deschiderea votării", "stageConfigs"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function closeVoting() {
    setSaving(true);
    setMessage("");
    try {
      await saveStageConfig({
        groupId,
        stageNumber,
        awardIds: selectedAwards,
        votingOpen: false,
        published: false,
        updatedBy: user!.uid,
      });
      setVotingOpen(false);
      setMessage("Votarea a fost inchisa.");
    } catch (error) {
      setMessage(
        reportPlayerCardsError(error, "Închiderea votării", "stageConfigs"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadResults() {
    setMessage("");
    try {
      const stageVotes = await getStageVotes(groupId, stageId);
      const grouped: Record<string, StageAward[]> = {};
      for (const awardId of selectedAwards) {
        const award = awardOptions.find((item) => item.id === awardId);
        if (!award) continue;
        const byCandidate = new Map<string, number>();
        stageVotes
          .filter((vote) => vote.awardId === awardId)
          .forEach((vote) => {
            byCandidate.set(
              vote.candidateUserId,
              (byCandidate.get(vote.candidateUserId) ?? 0) + 1,
            );
          });
        grouped[awardId] = Array.from(byCandidate.entries())
          .map(([candidateUserId, count]) => {
            const member = members.find(
              (item) => item.userId === candidateUserId,
            );
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
    } catch (error) {
      setMessage(
        reportPlayerCardsError(error, "Citirea rezultatelor", "stageVotes"),
      );
    }
  }

  async function publishStageCards() {
    if (!user || votingOpen || selectedAwards.length === 0) return;
    setSaving(true);
    setMessage("");
    try {
      const stageVotes = await getStageVotes(groupId, stageId);
      const winnersByUser = new Map<string, StageAward[]>();

      for (const awardId of selectedAwards) {
        const award = awardOptions.find((item) => item.id === awardId);
        if (!award) continue;
        const counts = new Map<string, number>();
        stageVotes
          .filter((vote) => vote.awardId === awardId)
          .forEach((vote) => {
            counts.set(
              vote.candidateUserId,
              (counts.get(vote.candidateUserId) ?? 0) + 1,
            );
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
        winnersByUser.set(winner[0], [
          ...(winnersByUser.get(winner[0]) ?? []),
          awardResult,
        ]);
      }

      for (const [winnerUserId, awards] of winnersByUser) {
        const progressedCard = await applyStageAwardsToPlayer({
          groupId,
          stageId,
          stageNumber,
          userId: winnerUserId,
          awardIds: awards.map((award) => award.awardId),
          updatedBy: user.uid,
        });
        await upsertStageCard({
          groupId,
          stageId,
          stageNumber,
          userId: winnerUserId,
          playerName: awards[0].winnerName,
          playerPhoto: awards[0].winnerPhoto,
          cardImageUrl: specialCardImages[winnerUserId] ?? progressedCard.cardImageUrl ?? null,
          overall: progressedCard.overall,
          position: progressedCard.position,
          pace: progressedCard.pace,
          shooting: progressedCard.shooting,
          passing: progressedCard.passing,
          dribbling: progressedCard.dribbling,
          defending: progressedCard.defending,
          physical: progressedCard.physical,
          diving: progressedCard.diving,
          handling: progressedCard.handling,
          kicking: progressedCard.kicking,
          reflexes: progressedCard.reflexes,
          speed: progressedCard.speed,
          positioning: progressedCard.positioning,
          jerseyNumber: progressedCard.jerseyNumber ?? null,
          awardIds: awards.map((award) => award.awardId),
          awards,
        }, user.uid);
      }

      await saveStageConfig({
        groupId,
        stageNumber,
        awardIds: selectedAwards,
        votingOpen: false,
        published: true,
        updatedBy: user.uid,
      });
      setPublished(true);
      setVotingOpen(false);
      await loadResults();
      setMessage(
        "Rezultatele au fost publicate si cardurile etapei au fost create.",
      );
    } catch (error) {
      setMessage(
        reportPlayerCardsError(
          error,
          "Publicarea premiilor",
          "stageCards / stageConfigs",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold text-foreground">Premiile etapei</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Selecteaza ce se voteaza. Votarea se face de participanti pe pagina
        meciului, nu din panoul de administrare.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">
          Numar etapa
          <input
            type="number"
            min={1}
            value={stageNumber}
            disabled={votingOpen || published}
            onChange={(event) =>
              setStageNumber(Number(event.target.value) || 1)
            }
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 disabled:opacity-60"
          />
        </label>
        <div>
          <span className="text-sm font-medium text-foreground">Premii</span>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {awardOptions.map((award) => (
              <label
                key={award.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedAwards.includes(award.id)}
                  disabled={votingOpen || published}
                  onChange={() => toggleAward(award.id)}
                />
                {award.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {!published && (
        <div className="mt-5 rounded-xl border border-border bg-background p-4">
          <h4 className="font-bold text-foreground">Imagine card special</h4>
          <p className="mt-1 text-sm text-muted-foreground">Încarcă opțional imaginea specială pentru un posibil câștigător. Va fi asociată cardului etapei doar dacă jucătorul câștigă.</p>
          <label className="mt-3 block text-sm font-medium text-foreground">
            Jucător
            <select value={specialCardUserId} onChange={(event) => setSpecialCardUserId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5">
              <option value="">Alege jucătorul</option>
              {members.map((member) => <option key={member.userId} value={member.userId}>{member.userName}</option>)}
            </select>
          </label>
          {specialCardUserId && (
            <div className="mt-3">
              <CardImageUploader groupId={groupId} userId={specialCardUserId} variant="special" onUploaded={(pathname) => setSpecialCardImages((current) => ({ ...current, [specialCardUserId]: pathname }))} />
              {specialCardImages[specialCardUserId] && <p className="mt-2 text-xs font-semibold text-primary">Imagine pregătită pentru acest jucător și etapa {stageNumber}.</p>}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!votingOpen && !published && (
          <button
            type="button"
            onClick={openVoting}
            disabled={saving || selectedAwards.length === 0}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            Deschide votarea
          </button>
        )}
        {votingOpen && (
          <button
            type="button"
            onClick={closeVoting}
            disabled={saving}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Inchide votarea
          </button>
        )}
        {!votingOpen && (
          <button
            type="button"
            onClick={loadResults}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            Vezi rezultate
          </button>
        )}
        {!hideCardCreation && !votingOpen && !published && (
          <button
            type="button"
            onClick={publishStageCards}
            disabled={saving}
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
          >
            Publică premiile și cardurile
          </button>
        )}
      </div>

      {published && (
        <p className="mt-4 text-sm font-semibold text-primary">
          Etapa este publicata. Cardurile raman in history dupa trecerea la
          etapa urmatoare.
        </p>
      )}
      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}

      {Object.keys(results).length > 0 && (
        <div className="mt-5 space-y-4">
          {Object.entries(results).map(([awardId, entries]) => (
            <div key={awardId} className="rounded-xl border border-border p-4">
              <div className="font-bold text-foreground">
                {awardOptions.find((item) => item.id === awardId)?.label}
              </div>
              <div className="mt-2 space-y-1 text-sm">
                {entries.map((entry) => (
                  <div
                    key={entry.winnerUserId}
                    className="flex items-center justify-between"
                  >
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
