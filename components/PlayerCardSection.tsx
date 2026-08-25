"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import PlayerCard from "@/components/PlayerCard";
import type { PlayerCardData, StageCard } from "@/lib/player-cards";

export default function PlayerCardSection({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [baseCard, setBaseCard] = useState<PlayerCardData | null>(null);
  const [activeStageCard, setActiveStageCard] = useState<StageCard | null>(null);
  const [history, setHistory] = useState<StageCard[]>([]);

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
      const cards = stageSnap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<StageCard, "id">) }));
      cards.sort((a, b) => b.stageNumber - a.stageNumber);
      setActiveStageCard(cards[0] ?? null);
      setHistory(cards.slice(1));
    })();
    return () => {
      active = false;
    };
  }, [user, groupId]);

  if (!baseCard && !activeStageCard) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-foreground">Cardul meu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cardul de baza si premiile castigate in etapele grupei.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-5">
        {activeStageCard ? (
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Card activ</div>
            <PlayerCard card={activeStageCard} />
          </div>
        ) : baseCard ? (
          <PlayerCard card={baseCard} />
        ) : null}
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-foreground">Istoric</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((card) => (
              <div key={card.id}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Etapa {card.stageNumber}
                </div>
                <PlayerCard card={card} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
