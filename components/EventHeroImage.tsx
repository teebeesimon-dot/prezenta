"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { getEventHeroImage } from "@/lib/events";
import type { Event } from "@/lib/types";

interface EventHeroImageProps {
  event: Event;
  canManage?: boolean;
  className?: string;
}

/**
 * Event hero/venue photo. Falls back to a generic per-sport image. When the
 * viewer manages the event, an overlay button lets them upload a custom photo
 * (saved on the event and, for series occurrences, on the parent series so it
 * persists across future materialized occurrences).
 */
export default function EventHeroImage({ event, canManage = false, className = "" }: EventHeroImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [heroUrl, setHeroUrl] = useState(() => getEventHeroImage(event));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const groupId = event.seriesId ?? event.id;
  const currentImageHash = (event as Event & { heroImageHash?: string }).heroImageHash;

  async function handleFile(file: File | null) {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Folosește JPG, PNG sau WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Imaginea poate avea maximum 8 MB.");
      return;
    }
    setBusy(true);
    try {
      const optimizedFile = await optimizeImage(file);
      const imageHash = await getFileHash(optimizedFile);
      if (imageHash === currentImageHash) return;
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesiunea a expirat.");
      const body = new FormData();
      body.set("file", optimizedFile, "event-image.webp");
      body.set("groupId", groupId);
      const response = await fetch("/api/event-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Încărcarea a eșuat.");
      await updateDoc(doc(db, "events", event.id), { heroImageUrl: result.url, heroImageHash: imageHash });
      if (event.seriesId) {
        await updateDoc(doc(db, "series", event.seriesId), { heroImageUrl: result.url, heroImageHash: imageHash }).catch(() => {});
      }
      setHeroUrl(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Încărcarea a eșuat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`group relative overflow-hidden rounded-xl border border-border bg-muted ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={heroUrl}
        alt={`Locația evenimentului ${event.title}`}
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      {canManage && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-60"
          >
            <CameraIcon />
            {busy ? "Se încarcă..." : "Schimbă imaginea"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </>
      )}
      {error && (
        <p className="absolute inset-x-2 bottom-2 rounded-lg bg-destructive/90 px-2 py-1 text-xs font-medium text-white">
          {error}
        </p>
      )}
    </div>
  );
}

async function optimizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.type !== "image/webp") return file;
    return new File([blob], "event-image.webp", { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

async function getFileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function CameraIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
