"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

type TestType = "reminder" | "capacity" | "vacancy" | "promotion" | "cancellation";

const tests: Array<{ type: TestType; title: string; description: string; icon: string }> = [
  { type: "reminder", title: "Reminder (ziua meciului)", description: "Notificarea pentru participantii confirmati si organizator.", icon: "▣" },
  { type: "capacity", title: "Locuri ocupate", description: "Notificarea trimisa cand toate locurile sunt ocupate.", icon: "♧" },
  { type: "vacancy", title: "Loc eliberat", description: "Notificarea ca a devenit disponibil un loc.", icon: "▱" },
  { type: "promotion", title: "Promovare din lista de asteptare", description: "Notificarea participantului promovat automat.", icon: "↑" },
  { type: "cancellation", title: "Anulare eveniment", description: "Notificarea ca evenimentul a fost anulat.", icon: "⊗" },
];

export default function PreviewNotificationTester({ eventId }: { eventId: string }) {
  const [isPreviewHost, setIsPreviewHost] = useState(false);
  const [busy, setBusy] = useState<TestType | null>(null);
  const [message, setMessage] = useState<{ type: TestType; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const hostname = window.location.hostname;
    setIsPreviewHost(
      hostname.endsWith(".vercel.app") &&
      hostname !== "prezenta.vercel.app" &&
      hostname !== "www.prezenta.com.ro"
    );
  }, []);

  async function sendTest(type: TestType) {
    setBusy(type);
    setMessage(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Trebuie sa fii autentificat.");
      const response = await fetch("/api/events/notification-test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, type }),
      });
      const result = await response.json() as { error?: string; sent?: number; total?: number };
      if (!response.ok) throw new Error(result.error || "Notificarea de test nu a putut fi trimisa.");
      setMessage({
        type,
        ok: (result.sent ?? 0) > 0,
        text: (result.sent ?? 0) > 0
          ? "Notificarea de test a fost trimisa pe dispozitivul tau."
          : "Nu exista niciun dispozitiv inregistrat pentru notificari pe acest cont.",
      });
    } catch (error) {
      setMessage({ type, ok: false, text: error instanceof Error ? error.message : "A aparut o eroare." });
    } finally {
      setBusy(null);
    }
  }

  if (!isPreviewHost) return null;

  return (
    <section className="rounded-2xl border border-violet-300 bg-violet-50/80 p-4 shadow-sm dark:border-violet-900 dark:bg-violet-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xl text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" aria-hidden="true">⚗</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Test notificari (Preview)</h2>
            <span className="rounded-full bg-violet-200 px-2.5 py-1 text-[11px] font-bold text-violet-900 dark:bg-violet-900 dark:text-violet-200">Doar pentru testare</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Trimite manual fiecare tip de notificare existent. Testele ajung doar la contul tau si nu modifica evenimentul sau participantii.</p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-violet-200 overflow-hidden rounded-xl border border-violet-200 bg-white/70 dark:divide-violet-900 dark:border-violet-900 dark:bg-card/70">
        {tests.map((test) => (
          <div key={test.type} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-8 shrink-0 text-center text-2xl font-semibold text-violet-600 dark:text-violet-300" aria-hidden="true">{test.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{test.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{test.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => sendTest(test.type)}
              disabled={busy !== null}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/50 bg-card px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === test.type ? "Se trimite..." : "➤ Trimite test"}
            </button>
          </div>
        ))}
      </div>
      {message && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${message.ok ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"}`}>
          {tests.find((test) => test.type === message.type)?.title}: {message.text}
        </p>
      )}
    </section>
  );
}
