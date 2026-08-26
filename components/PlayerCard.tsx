"use client";

import Image from "next/image";
import { getCardTier, type PlayerCardData, type StageCard } from "@/lib/player-cards";

function tierClasses(tier: ReturnType<typeof getCardTier>) {
  if (tier === "gold") return "from-amber-200 via-yellow-100 to-amber-400 text-amber-950";
  if (tier === "silver") return "from-slate-200 via-white to-slate-400 text-slate-950";
  return "from-orange-200 via-amber-100 to-orange-400 text-orange-950";
}

interface PlayerCardProps {
  card: PlayerCardData | StageCard;
  compact?: boolean;
  playerName?: string;
  playerPhoto?: string | null;
}

export default function PlayerCard({ card, compact = false, playerName: playerNameProp, playerPhoto: playerPhotoProp }: PlayerCardProps) {
  const tier = getCardTier(card.overall);
  const isStage = "awardIds" in card;
  const playerName = playerNameProp?.trim() || card.playerName?.trim() || "Jucator";
  const playerPhoto = playerPhotoProp ?? card.playerPhoto ?? null;
  const awards = isStage ? card.awards : [];
  const form = !isStage ? card.form : undefined;
  const formLabel = form === "in_form" ? "Formă bună" : form === "out_of_form" ? "Formă scăzută" : "Formă stabilă";
  const stats = card.position === "GK"
    ? [
        ["DIV", card.diving],
        ["HAN", card.handling],
        ["KIC", card.kicking],
        ["REF", card.reflexes],
        ["SPD", card.speed],
        ["POS", card.positioning],
      ]
    : [
        ["PAC", card.pace],
        ["SHO", card.shooting],
        ["PAS", card.passing],
        ["DRI", card.dribbling],
        ["DEF", card.defending],
        ["PHY", card.physical],
      ];

  const fallbackAvatarUrl = `/api/player-avatar?seed=${encodeURIComponent(card.userId)}&name=${encodeURIComponent(playerName)}`;

  return (
    <article className={`relative overflow-hidden rounded-[26px] border border-white/60 bg-gradient-to-br ${tierClasses(tier)} shadow-xl ${compact ? "w-44" : "w-full max-w-xs"}`}>
      <div className="absolute inset-x-0 top-0 h-20 bg-white/20 blur-xl" />
      <div className="relative p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-3xl font-black leading-none">{card.overall}</div>
            <div className="mt-1 text-[10px] font-extrabold uppercase tracking-widest opacity-80">{isStage ? `Etapa ${card.stageNumber}` : tier}</div>
          </div>
          <div className="text-right text-xs font-black uppercase">{card.position}</div>
        </div>

        <div className="relative mt-2 aspect-[4/5] overflow-hidden rounded-2xl bg-black/10">
          <Image
            src={playerPhoto || fallbackAvatarUrl}
            alt={playerName}
            fill
            sizes={compact ? "176px" : "320px"}
            className="object-cover object-top"
            unoptimized
          />
        </div>

        <div className="mt-3 text-center">
          <div className="truncate text-xl font-black uppercase tracking-tight">{playerName}</div>
          {!isStage && form && (
            <div className="mt-2 text-[10px] font-extrabold uppercase tracking-wider opacity-75">{formLabel}</div>
          )}
          {isStage && awards.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {awards.map((award) => <span key={award.awardId} className="rounded-full bg-black/10 px-2 py-1 text-[10px] font-bold">{award.label}</span>)}
            </div>
          )}
        </div>

        {stats.length > 0 && !compact && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/10 pt-3">
            {stats.map(([label, value]) => <div key={label} className="text-center"><div className="text-sm font-black">{value}</div><div className="text-[9px] font-bold opacity-70">{label}</div></div>)}
          </div>
        )}
      </div>
    </article>
  );
}
