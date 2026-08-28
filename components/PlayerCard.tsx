"use client";

import PrivateCardImage from "@/components/PrivateCardImage";
import type { PlayerCardData, StageCard } from "@/lib/player-cards";

interface PlayerCardProps {
  card: PlayerCardData | StageCard;
  compact?: boolean;
  playerName?: string;
  playerPhoto?: string | null;
}

export default function PlayerCard({
  card,
  compact = false,
  playerName: playerNameProp,
}: PlayerCardProps) {
  const isStage = "awardIds" in card;
  const playerName = playerNameProp?.trim() || card.playerName?.trim() || "Jucător";
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

  return (
    <article
      className={`relative aspect-[644/900] shrink-0 overflow-hidden font-sans text-card-foreground drop-shadow-xl ${compact ? "w-40 sm:w-44" : "w-full max-w-xs"}`}
      aria-label={`Card Bilka pentru ${playerName}`}
    >
      <img
        src="/player-cards/bilka-template.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      <div className="absolute left-1/2 top-[12.2%] z-10 flex h-[6.5%] w-[29%] -translate-x-1/2 items-center justify-center gap-1 bg-[#a90016] px-1">
        <img src="/player-cards/bilka-logo.jpg" alt="" className="h-full w-auto mix-blend-screen" />
        <span className="text-[clamp(7px,2.5vw,12px)] font-black tracking-wide text-white">BILKA</span>
      </div>

      <div className="absolute left-[14%] top-[23%] z-10 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
        <div className={`font-black leading-none ${compact ? "text-2xl" : "text-4xl"}`}>{card.overall}</div>
        <div className={`mt-1 font-extrabold ${compact ? "text-[10px]" : "text-sm"}`}>{card.position}</div>
        {card.jerseyNumber !== null && card.jerseyNumber !== undefined && (
          <div className={`mt-1 border-t border-white/45 pt-1 font-bold ${compact ? "text-[8px]" : "text-xs"}`}>#{card.jerseyNumber}</div>
        )}
      </div>

      <div className="absolute left-[27%] right-[9%] top-[24%] h-[39%] overflow-hidden">
        {card.cardImageUrl ? (
          <PrivateCardImage
            pathname={card.cardImageUrl}
            alt={`Fotografie ${playerName}`}
            className="h-full w-full object-contain object-bottom drop-shadow-[0_8px_8px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <img
            src="/player-cards/generic-player.png"
            alt="Portret generic de jucător"
            className="h-full w-full object-contain object-bottom opacity-90"
          />
        )}
      </div>

      <div className="absolute inset-x-[13%] top-[64%] z-10 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]">
        <div className={`truncate border-b border-white/40 pb-1 font-black uppercase tracking-tight ${compact ? "text-xs" : "text-xl"}`}>{playerName}</div>
        {isStage && (
          <div className={`mt-1 font-bold uppercase tracking-wider text-white/80 ${compact ? "text-[7px]" : "text-[10px]"}`}>Card special · Etapa {card.stageNumber}</div>
        )}
      </div>

      <div className="absolute inset-x-[18%] top-[72%] z-10 grid grid-cols-2 gap-x-[17%] gap-y-0.5 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
        {stats.map(([label, value]) => (
          <div key={label} className={`flex items-baseline gap-1 font-black ${compact ? "text-[9px]" : "text-sm"}`}>
            <span>{value}</span>
            <span className={`font-bold text-white/80 ${compact ? "text-[6px]" : "text-[9px]"}`}>{label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
