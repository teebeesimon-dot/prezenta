"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

type Key = "reminder" | "capacity" | "vacancy" | "promotion" | "cancellation";
type Template = { title: string; body: string };
type Templates = Record<Key, Template>;

const rules: Array<{ key: Key; label: string; description: string }> = [
  { key: "reminder", label: "Reminder in ziua evenimentului", description: "Se trimite la ora 10:00 participantilor confirmati si organizatorului." },
  { key: "capacity", label: "Toate locurile ocupate", description: "Se trimite cand numarul confirmarilor ajunge la capacitatea evenimentului." },
  { key: "vacancy", label: "S-a eliberat un loc", description: "Se trimite celor care nu au raspuns, cand nu exista lista de asteptare." },
  { key: "promotion", label: "Promovare din lista de asteptare", description: "Se trimite participantului promovat automat si organizatorului." },
  { key: "cancellation", label: "Anulare eveniment", description: "Se trimite participantilor si organizatorului la anulare." },
];

const empty: Templates = {
  reminder: { title: "", body: "" }, capacity: { title: "", body: "" },
  vacancy: { title: "", body: "" }, promotion: { title: "", body: "" },
  cancellation: { title: "", body: "" },
};

export default function NotificationSettingsPanel({ eventId }: { eventId: string }) {
  const [templates, setTemplates] = useState<Templates>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Sesiunea a expirat. Autentifica-te din nou.");
        const response = await fetch(`/api/events/notification-settings?eventId=${encodeURIComponent(eventId)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        });
        const data = await response.json() as { ok?: boolean; templates?: Templates; error?: string };
        if (!response.ok || !data.ok || !data.templates) throw new Error(data.error || "Nu am putut incarca mesajele.");
        if (active) setTemplates(data.templates);
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "A aparut o eroare.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [eventId]);

  function update(key: Key, field: keyof Template, value: string) {
    setTemplates((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  }

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesiunea a expirat. Autentifica-te din nou.");
      const response = await fetch("/api/events/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, templates }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Nu am putut salva mesajele.");
      setNotice("Mesajele au fost salvate pentru acest eveniment.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "A aparut o eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group relative shrink-0">
      <summary className="cursor-pointer list-none whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground sm:text-sm [&::-webkit-details-marker]:hidden">Notificari</summary>
      <section className="absolute right-0 top-full z-50 mt-2 max-h-[75vh] w-[min(92vw,680px)] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Mesaje notificari</h2>
        <p className="mt-1 text-sm text-muted-foreground">Editezi textele trimise automat pentru acest eveniment. Modificarile nu afecteaza celelalte evenimente.</p>
        <p className="mt-2 text-xs text-muted-foreground">Variabile disponibile: {`{eventTitle}`}, {`{eventTime}`}, {`{location}`}, {`{capacity}`}, {`{participantName}`} si {`{withdrawnName}`}. La promovare, participantName este jucatorul care intra, iar withdrawnName este jucatorul care s-a retras.</p>
      </div>
      {loading ? <p className="mt-4 text-sm text-muted-foreground">Se incarca mesajele...</p> : (
        <div className="mt-4 space-y-4">
          {rules.map((rule) => (
            <div key={rule.key} className="rounded-xl border border-border p-3 sm:p-4">
              <h3 className="font-semibold text-foreground">{rule.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{rule.description}</p>
              <label className="mt-3 block text-xs font-semibold text-muted-foreground">Titlu notificare</label>
              <input value={templates[rule.key].title} onChange={(event) => update(rule.key, "title", event.target.value)} maxLength={120} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
              <label className="mt-3 block text-xs font-semibold text-muted-foreground">Mesaj</label>
              <textarea value={templates[rule.key].body} onChange={(event) => update(rule.key, "body", event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            </div>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={save} disabled={saving} className="min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving ? "Se salveaza..." : "Salveaza mesajele"}</button>
            {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
          </div>
        </div>
      )}
      </section>
    </details>
  );
}
