"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import EditEventForm from "@/components/EditEventForm";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import { mapFirestoreEvent } from "@/lib/events";
import type { Event } from "@/lib/types";

interface EditEventPageClientProps {
  id: string;
}

export default function EditEventPageClient({ id }: EditEventPageClientProps) {
  const { user, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "events", id),
      (snapshot) => {
        if (snapshot.exists()) {
          setEvent(mapFirestoreEvent(snapshot.id, snapshot.data()));
        } else {
          setEvent(null);
        }
        setLoaded(true);
      },
      () => {
        setLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [id]);

  if (!loaded || authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Se încarcă...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Eveniment negăsit</h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
        >
          Înapoi acasă
        </Link>
      </div>
    );
  }

  if (!user || user.uid !== event.ownerId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acces interzis</h1>
        <p className="mt-2 text-muted-foreground">
          Doar organizatorul poate edita acest eveniment.
        </p>
        <Link
          href={`/event/${event.id}`}
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
        >
          Înapoi la eveniment
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <Link
        href={`/event/${event.id}`}
        className="mb-6 inline-flex items-center text-sm font-medium text-primary transition hover:text-primary-hover"
      >
        ← Înapoi
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-card-foreground sm:text-3xl">
          Editează evenimentul
        </h1>
        <EditEventForm event={event} />
      </div>
    </div>
  );
}
