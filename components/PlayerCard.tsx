"use client";

import PrivateCardImage from "@/components/PrivateCardImage";
import type { PlayerCardData, StageCard } from "@/lib/player-cards";

interface PlayerCardProps {
  card: PlayerCardData | StageCard;
  compact?: boolean;
  playerName?: string;
  playerPhoto?: string | null;
  /** Overrides the width class (e.g. "w-14") for tiny thumbnails. */
  widthClass?: string;
  /** Tiny thumbnail: only overall + position + photo, no name/stats. */
  mini?: boolean;
}

export default function PlayerCard({
  card,
  compact = false,
  playerName: playerNameProp,
  widthClass,
  mini = false,
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

  const cardArtwork: Record<NonNullable<PlayerCardData["cardType"]>, string> = {
    standard: "/player-cards/bilka-template.png",
    "evolution-1": "/player-cards/evolution-1.png",
    "evolution-2": "/player-cards/evolution-2.png",
    "evolution-3": "/player-cards/evolution-3.png",
    "evolution-4": "/player-cards/evolution-4.png",
    "evolution-5": "/player-cards/evolution-5.png",
    "stage-player": "/player-cards/stage-award.png",
    "stage-goalkeeper": "/player-cards/stage-award.png",
    legend: "/player-cards/legend.png",
    toty: "/player-cards/toty.png",
  };
  const cardType = "cardType" in card ? card.cardType ?? "standard" : "standard";
  const artwork = cardArtwork[cardType];
  const displayedOverall = "currentOverall" in card ? card.currentOverall ?? card.overall : card.overall;

  if (mini) {
    return (
      <article
        className={`relative aspect-[1381/1814] shrink-0 overflow-hidden font-sans drop-shadow ${widthClass ?? "w-12"}`}
        aria-label={`Card pentru ${playerName}, OVR ${displayedOverall} ${card.position}`}
      >
        <img
          src={artwork}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        <div className="absolute left-[27%] right-[10%] top-[24%] h-[41%] overflow-hidden">
          {card.cardImageUrl ? (
            <PrivateCardImage
              pathname={card.cardImageUrl}
              alt=""
              className="h-full w-full object-contain object-bottom"
            />
          ) : (
            <img
              src="/player-cards/generic-player.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain object-bottom opacity-90"
            />
          )}
        </div>
        <div className="absolute left-[13%] top-[24%] z-10 text-center leading-none text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.8)]">
          <div className="text-[11px] font-black">{displayedOverall}</div>
          <div className="text-[6px] font-extrabold">{card.position}</div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`relative aspect-[1381/1814] shrink-0 overflow-hidden font-sans text-card-foreground drop-shadow-xl ${widthClass ?? (compact ? "w-40 sm:w-44" : "w-full max-w-xs")}`}
      style={{ containerType: "inline-size" }}
      aria-label={`Card Bilka pentru ${playerName}`}
    >
      <img
        src={artwork}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      <div className="absolute left-[13%] top-[26%] z-10 w-[13%] text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
        <div className="font-black leading-none text-[9cqw]">{displayedOverall}</div>
        <div className="mt-[2cqw] font-extrabold leading-none text-[3.6cqw]">{card.position}</div>
        {card.jerseyNumber !== null && card.jerseyNumber !== undefined && (
          <div className="mt-[2cqw] border-t border-white/45 pt-[1.5cqw] font-bold leading-none text-[3cqw]">#{card.jerseyNumber}</div>
        )}
      </div>

      <div className="absolute left-[27%] right-[10%] top-[24%] h-[41%] overflow-hidden">
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

      <div className="absolute inset-x-[15%] top-[64%] z-10 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]">
        <div className="truncate border-b border-white/40 pb-[1cqw] font-black uppercase leading-tight tracking-tight text-[5.5cqw]">{playerName}</div>
        {isStage && (
          <div className="mt-[1cqw] font-bold uppercase leading-none tracking-wider text-white/80 text-[2.6cqw]">Card special · Etapa {card.stageNumber}</div>
        )}
      </div>

      <div className="absolute inset-x-[16%] top-[71%] z-10 flex items-stretch text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
        <div className="flex flex-1 flex-col gap-y-[2cqw] pr-[5cqw]">
          {stats.slice(0, 3).map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-[2cqw] leading-none">
              <span className="w-[8cqw] text-right font-black text-[4.4cqw]">{value}</span>
              <span className="font-semibold uppercase text-white/85 text-[3.2cqw]">{label}</span>
            </div>
          ))}
        </div>
        <div className="w-px self-stretch bg-white/45" aria-hidden="true" />
        <div className="flex flex-1 flex-col gap-y-[2cqw] pl-[5cqw]">
          {stats.slice(3, 6).map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-[2cqw] leading-none">
              <span className="w-[8cqw] text-right font-black text-[4.4cqw]">{value}</span>
              <span className="font-semibold uppercase text-white/85 text-[3.2cqw]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
