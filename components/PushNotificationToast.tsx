"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthProvider";

export function PushNotificationToast() {
  const { pushMessage, clearPushMessage } = useAuth();

  useEffect(() => {
    if (!pushMessage) return;
    const timeout = window.setTimeout(clearPushMessage, 7000);
    return () => window.clearTimeout(timeout);
  }, [pushMessage, clearPushMessage]);

  if (!pushMessage) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md rounded-2xl border border-border bg-background p-4 shadow-xl" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{pushMessage.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{pushMessage.body}</p>
        </div>
        <button type="button" onClick={clearPushMessage} className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted" aria-label="Inchide notificarea">×</button>
      </div>
    </div>
  );
}
