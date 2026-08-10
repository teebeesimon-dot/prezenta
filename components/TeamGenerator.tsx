"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { computeGoingLists, parseTimestamp } from "@/lib/going-list";
import { getDefaultFootballFormat } from "@/lib/football-formats";
import { generateRandomTeams } from "@/lib/teams";
import type { GeneratedTeams, ParticipantEntry } from "@/lib/types";

interface TeamGeneratorProps {
  eventId: string;
  maxParticipants: number;
  footballFormat?: string;
  teams: GeneratedTeams | null | undefined;
  isOwner: boolean;
}

function ParticipantAvatar({
  name,
  photoURL,
}: {
  name: string;
  photoURL: string | null;
}) {
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function TeamCard({
  title,
  players,
  className,
}: {
  title: string;
  players: ParticipantEntry[];
  className: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({players.length})
      </h3>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No players assigned.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {players.map((player) => (
            <li
              key={player.userId}
              className="flex items-center gap-3 rounded-lg bg-card/70 px-3 py-2"
            >
              <ParticipantAvatar
                name={player.name}
                photoURL={player.photoURL}
              />
              <span className="text-sm font-medium text-foreground">
                {player.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getParticipantName(data: Record<string, unknown>): string {
  return (data.userName as string) || (data.name as string) || "Unknown";
}

function getParticipantPhoto(data: Record<string, unknown>): string | null {
  return (data.userPhoto as string | null) ?? null;
}

export default function TeamGenerator({
  eventId,
  maxParticipants,
  footballFormat,
  teams,
  isOwner,
}: TeamGeneratorProps) {
  const [confirmed, setConfirmed] = useState<ParticipantEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "responses"),
      where("eventId", "==", eventId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const goingInputs: {
        userId: string;
        name: string;
        photoURL: string | null;
        goingRegisteredAt: number;
      }[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== "vin") return;

        goingInputs.push({
          userId: (data.userId as string) || docSnap.id,
          name: getParticipantName(data),
          photoURL: getParticipantPhoto(data),
          goingRegisteredAt: parseTimestamp(
            data.goingRegisteredAt ?? data.createdAt
          ),
        });
      });

      const lists = computeGoingLists(goingInputs, maxParticipants);
      setConfirmed(
        lists.confirmed.map(({ userId, name, photoURL }) => ({
          userId,
          name,
          photoURL,
        }))
      );
    });

    return () => unsubscribe();
  }, [eventId, maxParticipants]);

  async function handleGenerateTeams() {
    if (!isOwner || confirmed.length < 2) return;

    setError("");
    setGenerating(true);

    try {
      const generated = generateRandomTeams(confirmed, (footballFormat ?? getDefaultFootballFormat(maxParticipants)) as "2x6" | "3x5" | "3x6");

      await updateDoc(doc(db, "events", eventId), {
        teams: {
          teamA: generated.teamA,
          teamB: generated.teamB,
          teams: generated.teams,
          generatedAt: Timestamp.now(),
        },
      });
    } catch {
      setError("Could not generate teams. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  const displayTeams = teams?.teams?.length ? teams.teams : [teams?.teamA ?? [], teams?.teamB ?? []];
  const hasTeams = displayTeams.some((team) => team.length > 0);

  if (!isOwner && !hasTeams) {
    return null;
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Teams</h2>
        {isOwner && (
          <button
            type="button"
            onClick={handleGenerateTeams}
            disabled={generating || confirmed.length < 2}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating
              ? "Generating..."
              : hasTeams
                ? "Regenerate Random Teams"
                : "Random Teams"}
          </button>
        )}
      </div>

      {isOwner && confirmed.length < 2 && (
        <p className="mb-4 text-sm text-muted-foreground">
          At least 2 confirmed players are needed to generate teams.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {hasTeams ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayTeams.map((players, index) => (
            <TeamCard
              key={index}
              title={`Echipa ${String.fromCharCode(65 + index)}`}
              players={players}
              className={index % 2 === 0 ? "border-primary/30 bg-primary/5" : "border-accent/40 bg-accent/10"}
            />
          ))}
        </div>
      ) : (
        isOwner && (
          <div className="rounded-2xl border border-dashed border-border bg-muted p-8 text-center">
            <p className="text-muted-foreground">
              Generate random teams from confirmed players.
            </p>
          </div>
        )
      )}
    </section>
  );
}
