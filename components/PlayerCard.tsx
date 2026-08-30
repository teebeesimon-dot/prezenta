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

      {"isInjured" in card && card.isInjured && (
        <div className="absolute right-[9%] top-[22%] z-20 rounded-full bg-destructive px-[2.5cqw] py-[1.2cqw] font-black uppercase leading-none text-destructive-foreground text-[2.8cqw] shadow-lg">Accidentat</div>
      )}

      <div className="absolute inset-x-[15%] top-[67%] z-10 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]">
        <div className="truncate border-b border-white/40 pb-[1cqw] font-black uppercase leading-tight tracking-tight text-[5.5cqw]">{playerName}</div>
        {isStage && (
          <div className="mt-[1cqw] font-bold uppercase leading-none tracking-wider text-white/80 text-[2.6cqw]">Card special · Etapa {card.stageNumber}</div>
        )}
      </div>

    </article>
  );
}
