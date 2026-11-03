"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthProvider";

export function PushNotificationsButton() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState(false);

  async function enableNotifications() {
    setBusy(true);
    setMessage("");
    try {
      const currentUser = auth.currentUser;
      if (!user || !currentUser) throw new Error("Trebuie sa fii autentificat.");

      if (Capacitor.isNativePlatform()) {
        throw new Error("Notificarile native Android/iOS necesita instalarea pluginului si sincronizarea proiectului mobil. Lucrez separat la aceasta integrare.");
      }

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("Browserul nu suporta notificari web.");
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) throw new Error("Lipseste cheia publica VAPID din configurarea aplicatiei.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permisiunea pentru notificari nu a fost acordata.");

      const supported = await isSupported();
      if (!supported) throw new Error("Firebase Messaging nu este suportat in acest browser.");

      await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      // register() may resolve while the worker is still installing. PushManager
      // requires an active worker, so wait for the browser's ready registration.
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) {
        throw new Error("Service Worker-ul pentru notificari nu a devenit activ. Reincarca pagina si incearca din nou.");
      }

      const messaging = getMessaging();
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error("Nu am putut obtine tokenul pentru notificari.");

      const idToken = await currentUser.getIdToken();
      const registrationResponse = await fetch("/api/push/register", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios-web" : "web",
        }),
      });
      const registrationResult = await registrationResponse.json() as { ok?: boolean; error?: string };
      if (!registrationResponse.ok || !registrationResult.ok) {
        throw new Error(registrationResult.error || "Nu am putut inregistra dispozitivul pentru notificari.");
      }

      onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? "Prezenta";
        const body = payload.notification?.body ?? "Ai o notificare noua.";
        setMessage(`${title}: ${body}`);
      });

      setRegistered(true);
      setMessage("Notificarile au fost activate pe acest dispozitiv.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activarea notificarilor a esuat.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTestNotification() {
    setBusy(true);
    setMessage("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sesiunea a expirat. Autentifica-te din nou.");
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const result = await response.json() as { ok?: boolean; sent?: number; total?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Nu am putut trimite notificarea.");
      setMessage(result.sent
        ? `Notificare trimisa catre ${result.sent} din ${result.total} dispozitive.`
        : "Nu exista inca tokenuri inregistrate pentru acest cont.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Testul notificarii a esuat.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="border-t border-border px-3 py-3">
      <button
        type="button"
        onClick={enableNotifications}
        disabled={busy}
        className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
      >
        {busy ? "Se activeaza..." : "Activeaza notificarile"}
      </button>
      {registered && <button type="button" onClick={sendTestNotification} disabled={busy} className="mt-2 w-full rounded-xl bg-primary px-3 py-2 text-left text-sm font-semibold text-primary-foreground disabled:opacity-60">Trimite notificare de test</button>}
      {message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
