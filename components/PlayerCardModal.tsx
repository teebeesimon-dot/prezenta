"use client";

import { useEffect } from "react";
import PlayerCard from "@/components/PlayerCard";
import type { PlayerCardData } from "@/lib/player-cards";

const POSITION_LABELS: Record<string, string> = {
  GK: "Portar",
  DEF: "Fundaș",
  MID: "Mijlocaș",
  ATT: "Atacant",
};

function statColor(value: number): string {
  if (value >= 80) return "bg-primary";
  if (value >= 65) return "bg-accent";
  return "bg-muted-foreground/50";
}

interface PlayerCardModalProps {
  card: PlayerCardData;
  playerName: string;
  badges?: React.ReactNode;
  onClose: () => void;
}

/** Floating FIFA-style card detail with the player's real attribute stats. */
export default function PlayerCardModal({ card, playerName, badges, onClose }: PlayerCardModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats: Array<[string, string, number]> =
    card.position === "GK"
      ? [
          ["Plonjon", "DIV", card.diving],
          ["Prindere", "HAN", card.handling],
          ["Degajare", "KIC", card.kicking],
          ["Reflexe", "REF", card.reflexes],
          ["Viteză", "SPD", card.speed],
          ["Plasament", "POS", card.positioning],
        ]
      : [
          ["Viteză", "PAC", card.pace],
          ["Șut", "SHO", card.shooting],
          ["Pasă", "PAS", card.passing],
          ["Dribling", "DRI", card.dribbling],
          ["Apărare", "DEF", card.defending],
          ["Fizic", "PHY", card.physical],
        ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Card ${playerName}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-foreground">{playerName}</h2>
            <p className="text-sm text-muted-foreground">
              {POSITION_LABELS[card.position] ?? card.position} · OVR {card.overall}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition hover:text-foreground"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {badges && <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>}

        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <PlayerCard card={card} widthClass="w-40 shrink-0" compact playerName={playerName} />
          <dl className="min-w-0 flex-1 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Statistici</p>
            {stats.map(([label, abbr, value]) => (
              <div key={abbr}>
                <div className="flex items-baseline justify-between text-sm">
                  <dt className="text-muted-foreground">
                    {label} <span className="text-xs">({abbr})</span>
                  </dt>
                  <dd className="font-bold text-foreground">{value}</dd>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${statColor(value)}`} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
