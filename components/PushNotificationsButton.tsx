"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function tokenDocumentId(uid: string, token: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)).then((hash) => {
    const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${uid}_${hex}`;
  });
}

export function PushNotificationsButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function enableNotifications() {
    setBusy(true);
    setMessage("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Trebuie sa fii autentificat.");

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

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = getMessaging();
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error("Nu am putut obtine tokenul pentru notificari.");

      const id = await tokenDocumentId(user.uid, token);
      await setDoc(doc(db, "pushTokens", id), {
        uid: user.uid,
        token,
        platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios-web" : "web",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? "Prezenta";
        const body = payload.notification?.body ?? "Ai o notificare noua.";
        setMessage(`${title}: ${body}`);
      });

      setMessage("Notificarile au fost activate pe acest dispozitiv.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activarea notificarilor a esuat.");
    } finally {
      setBusy(false);
    }
  }

  if (!auth.currentUser) return null;

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
      {message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
