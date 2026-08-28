"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthProvider";
import { subscribeToGroupMembers, type Member } from "@/lib/members";
import { db } from "@/lib/firebase";
import PlayerCard from "@/components/PlayerCard";
import CardImageUploader from "@/components/CardImageUploader";
import {
  createStageVote,
  getMyStageVotes,
  getStageConfig,
  hydratePlayerCard,
  reportPlayerCardsError,
  STAGE_AWARD_OPTIONS,
  updatePlayerCardPhoto,
  type PlayerCardData,
  type StageCard,
} from "@/lib/player-cards";

async function resolveCurrentStage(groupId: string): Promise<number> {
  const seriesSnap = await getDoc(doc(db, "series", groupId));
  if (seriesSnap.exists()) {
    const currentEventId = seriesSnap.data().currentEventId as
      string | undefined;
    if (!currentEventId) return 1;
    const eventSnap = await getDoc(doc(db, "events", currentEventId));
    return eventSnap.exists() ? Number(eventSnap.data().seriesIndex ?? 1) : 1;
  }
  const eventSnap = await getDoc(doc(db, "events", groupId));
  return eventSnap.exists() ? Number(eventSnap.data().seriesIndex ?? 1) : 1;
}

export default function PlayerCardSection({
  groupId,
  view = "all",
}: {
  groupId: string;
  view?: "all" | "cards" | "voting";
}) {
  const { user } = useAuth();
  const [currentStageNumber, setCurrentStageNumber] = useState(1);
  const [allBaseCards, setAllBaseCards] = useState<PlayerCardData[]>([]);
  const [allStageCards, setAllStageCards] = useState<StageCard[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [awardIds, setAwardIds] = useState<string[]>([]);
  const [votingOpen, setVotingOpen] = useState(false);
  const [voted, setVoted] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [savingVote, setSavingVote] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");

  useEffect(() => subscribeToGroupMembers(groupId, setMembers), [groupId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stage = await resolveCurrentStage(groupId);
        if (active) setCurrentStageNumber(stage);
      } catch (error) {
        if (active)
          setDataMessage(
            reportPlayerCardsError(
              error,
              "Identificarea etapei curente",
              "series / events",
            ),
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (!user || !groupId) return;
    let active = true;
    (async () => {
      try {
        const [baseSnap, stageSnap] = await Promise.all([
          getDocs(query(collection(db, "playerCards"), where("groupId", "==", groupId))),
          getDocs(query(collection(db, "stageCards"), where("groupId", "==", groupId))),
        ]);
        if (!active) return;
        const baseCards = baseSnap.docs.map((cardDoc) => hydratePlayerCard(cardDoc.data() as PlayerCardData));
        setAllBaseCards(baseCards);
        const cards = stageSnap.docs
          .map((docSnap) => {
            const data = docSnap.data() as Partial<StageCard>;
            return {
              ...data,
              id: docSnap.id,
              groupId,
              stageId:
                data.stageId ?? `${groupId}_stage_${data.stageNumber ?? 1}`,
              stageNumber: data.stageNumber ?? 1,
              userId: data.userId ?? user.uid,
              playerName: data.playerName?.trim() || "Jucator",
              playerPhoto: data.playerPhoto ?? null,
              cardImageUrl: data.cardImageUrl ?? null,
              overall: data.overall ?? 65,
              position: data.position ?? "MID",
              pace: data.pace ?? 65,
              shooting: data.shooting ?? 65,
              passing: data.passing ?? 65,
              dribbling: data.dribbling ?? 65,
              defending: data.defending ?? 65,
              physical: data.physical ?? 65,
              diving: data.diving ?? data.pace ?? 65,
              handling: data.handling ?? data.defending ?? 65,
              kicking: data.kicking ?? data.passing ?? 65,
              reflexes: data.reflexes ?? data.dribbling ?? 65,
              speed: data.speed ?? data.physical ?? 65,
              positioning: data.positioning ?? data.shooting ?? 65,
              jerseyNumber: data.jerseyNumber ?? null,
              awardIds: data.awardIds ?? [],
              awards: data.awards ?? [],
            } satisfies StageCard;
          })
          .sort((a, b) => b.stageNumber - a.stageNumber);
        setAllStageCards(cards);
        setDataMessage("");
      } catch (error) {
        if (active)
          setDataMessage(
            reportPlayerCardsError(
              error,
              "Citirea cardurilor",
              "playerCards / stageCards",
            ),
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [user, groupId, currentStageNumber]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getStageConfig(groupId, currentStageNumber);
        if (cancelled) return;
        setAwardIds(config?.awardIds ?? []);
        setVotingOpen(config?.votingOpen ?? false);
        setVoted({});
        if (config?.votingOpen && user) {
          const ownVotes = await getMyStageVotes(
            groupId,
            `${groupId}_stage_${currentStageNumber}`,
            user.uid,
          );
          const mapped: Record<string, string> = {};
          ownVotes.forEach((vote) => {
            mapped[vote.awardId] = vote.candidateUserId;
          });
          if (!cancelled) setVoted(mapped);
        }
      } catch (error) {
        if (!cancelled)
          setDataMessage(
            reportPlayerCardsError(
              error,
              "Citirea votării",
              "stageConfigs / stageVotes",
            ),
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, currentStageNumber, user]);

  async function saveOwnPhoto(pathname: string) {
    if (!user) return;
    try {
      await updatePlayerCardPhoto(groupId, user.uid, pathname);
      setAllBaseCards((current) => current.map((card) => card.userId === user.uid ? { ...card, cardImageUrl: pathname } : card));
      setDataMessage("");
    } catch (error) {
      setDataMessage(reportPlayerCardsError(error, "Salvarea fotografiei", "playerCards"));
    }
  }

  async function vote(awardId: string) {
    if (!user || !selection[awardId] || voted[awardId]) return;
    setSavingVote(awardId);
    setVoteMessage("");
    try {
      await createStageVote({
        groupId,
        stageId: `${groupId}_stage_${currentStageNumber}`,
        awardId,
        voterUserId: user.uid,
        candidateUserId: selection[awardId],
      });
      setVoted((current) => ({ ...current, [awardId]: selection[awardId] }));
      setVoteMessage("Votul a fost inregistrat.");
    } catch (error) {
      setVoteMessage(
        reportPlayerCardsError(error, "Înregistrarea votului", "stageVotes"),
      );
    } finally {
      setSavingVote(null);
    }
  }

  return (
    <>
      {dataMessage && (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {dataMessage}
        </p>
      )}

      {view !== "voting" && allBaseCards.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-foreground">Player Cards</h2>
            <p className="text-sm text-muted-foreground">Galeria tuturor jucătorilor din grup. Apasă un card pentru detalii și istoric.</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {allBaseCards.map((card) => {
              const member = members.find((item) => item.userId === card.userId);
              const active = allStageCards.find((item) => item.userId === card.userId && item.stageNumber === currentStageNumber);
              return (
                <button key={card.userId} type="button" onClick={() => setSelectedUserId(card.userId)} className="flex flex-col items-center rounded-2xl border border-border bg-background p-2 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <PlayerCard card={active ?? card} compact playerName={member?.userName} playerPhoto={member?.userPhoto} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selectedUserId && (() => {
        const permanent = allBaseCards.find((card) => card.userId === selectedUserId);
        if (!permanent) return null;
        const member = members.find((item) => item.userId === selectedUserId);
        const specialCards = allStageCards.filter((card) => card.userId === selectedUserId);
        const active = specialCards.find((card) => card.stageNumber === currentStageNumber);
        return (
          <div role="dialog" aria-modal="true" aria-label={`Card ${member?.userName ?? permanent.playerName ?? "jucător"}`} className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 p-4 sm:items-center" onClick={() => setSelectedUserId(null)}>
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="text-xl font-bold text-foreground">{member?.userName ?? permanent.playerName ?? "Jucător"}</h2><p className="text-sm text-muted-foreground">Card activ și istoric</p></div>
                <button type="button" onClick={() => setSelectedUserId(null)} className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground">Închide</button>
              </div>
              <div className="mt-5 flex flex-col gap-6 md:flex-row">
                <PlayerCard card={active ?? permanent} playerName={member?.userName} playerPhoto={member?.userPhoto} />
                <div className="min-w-0 flex-1">
                  {selectedUserId === user?.uid && (
                    <div className="mb-6 rounded-xl border border-border bg-card p-4">
                      <h3 className="font-bold text-foreground">Fotografia mea</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Încarcă un portret decupat cât mai clar. Dacă nu alegi o fotografie, cardul folosește avatarul generic.</p>
                      <div className="mt-3">
                        <CardImageUploader groupId={groupId} userId={user.uid} variant="permanent" onUploaded={saveOwnPhoto} />
                      </div>
                    </div>
                  )}
                  <h3 className="font-bold text-foreground">Istoric carduri speciale</h3>
                  {specialCards.length ? <div className="mt-3 grid grid-cols-2 gap-3">{specialCards.map((card) => <div key={card.id}><p className="mb-1 text-xs font-bold text-muted-foreground">Etapa {card.stageNumber}</p><PlayerCard card={card} compact /></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Nu există carduri speciale.</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {view !== "cards" && votingOpen && awardIds.length > 0 && user && (
        <section className="mt-8 rounded-2xl border border-primary/20 bg-card p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">
            Etapa {currentStageNumber}
          </div>
          <h2 className="mt-1 text-xl font-bold text-foreground">
            Voteaza premiile etapei
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ai un singur vot pentru fiecare premiu.
          </p>
          <div className="mt-5 grid gap-4">
            {awardIds.map((awardId) => {
              const award = STAGE_AWARD_OPTIONS.find(
                (item) => item.id === awardId,
              );
              if (!award) return null;
              const hasVoted = Boolean(voted[awardId]);
              return (
                <div
                  key={awardId}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="font-bold text-foreground">{award.label}</div>
                  {hasVoted ? (
                    <p className="mt-2 text-sm font-semibold text-primary">
                      Ai votat deja pentru aceasta categorie.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={selection[awardId] ?? ""}
                        onChange={(event) =>
                          setSelection((current) => ({
                            ...current,
                            [awardId]: event.target.value,
                          }))
                        }
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">Selecteaza jucatorul</option>
                        {members.filter((member) => member.userId !== user.uid).map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.userName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selection[awardId] || savingVote === awardId}
                        onClick={() => vote(awardId)}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                      >
                        {savingVote === awardId ? "Se salveaza..." : "Voteaza"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {voteMessage && (
            <p className="mt-4 text-sm text-muted-foreground">{voteMessage}</p>
          )}
        </section>
      )}
    </>
  );
}
