"use client";

import { useRef, useState } from "react";
import { auth } from "@/lib/firebase";

interface CardImageUploaderProps {
  groupId: string;
  userId: string;
  variant: "permanent" | "special";
  onUploaded: (pathname: string) => void;
}

export default function CardImageUploader({ groupId, userId, variant, onUploaded }: CardImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function choose(next: File | null) {
    setError("");
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) return setError("Folosește JPG, PNG sau WebP.");
    if (next.size > 8 * 1024 * 1024) return setError("Imaginea poate avea maximum 8 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesiunea a expirat.");
      const body = new FormData();
      body.set("file", file);
      body.set("groupId", groupId);
      body.set("userId", userId);
      body.set("variant", variant);
      const response = await fetch("/api/player-card-image", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
      const result = (await response.json()) as { pathname?: string; error?: string };
      if (!response.ok || !result.pathname) throw new Error(result.error ?? "Încărcarea a eșuat.");
      onUploaded(result.pathname);
      setFile(null);
      setPreview(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Încărcarea a eșuat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0] ?? null); }}
        className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-sm font-semibold text-foreground transition hover:bg-muted"
      >
        {preview ? <img src={preview} alt={variant === "permanent" ? "Previzualizare fotografie" : "Previzualizare card special"} className="max-h-48 rounded-lg object-contain" /> : <><span>{variant === "permanent" ? "Trage fotografia jucătorului aici" : "Trage imaginea cardului special aici"}</span><span className="text-xs font-normal text-muted-foreground">sau apasă pentru JPG, PNG, WebP · max. 8 MB</span></>}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => choose(event.target.files?.[0] ?? null)} />
      {file && <button type="button" disabled={busy} onClick={upload} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "Se încarcă..." : "Încarcă imaginea"}</button>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
