"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteEvent } from "@/lib/events";

interface DeleteEventButtonProps {
  eventId: string;
  className?: string;
}

export default function DeleteEventButton({
  eventId,
  className = "",
}: DeleteEventButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setError(false);
    try {
      await deleteEvent(eventId);
      router.push("/");
    } catch {
      setError(true);
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}>
        <span className="text-sm font-medium text-foreground">
          Sigur ștergi acest eveniment?
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Se șterge..." : "Da, șterge"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-card-foreground transition hover:bg-muted active:scale-[0.98] disabled:opacity-60"
          >
            Anulează
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex w-full items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/20 active:scale-[0.98] sm:w-auto"
      >
        Șterge eveniment
      </button>
      {error && (
        <p className="mt-2 text-sm font-medium text-destructive">
          Nu am putut șterge evenimentul. Încearcă din nou.
        </p>
      )}
    </div>
  );
}
