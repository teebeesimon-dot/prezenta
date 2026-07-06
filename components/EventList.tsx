"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import { mapFirestoreEvent } from "@/lib/events";
import { subscribeMemberEvents, type MemberEventItem } from "@/lib/members";
import { ensureCurrentOccurrence, subscribeOwnerSeries } from "@/lib/series";
import type { Event, Series } from "@/lib/types";

type DisplayItem = {
  kind: "event" | "series";
  key: string;
  date: string;
  event: Event;
  series?: Series;
  invited?: boolean;
};

export default function EventList() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [memberItems, setMemberItems] = useState<MemberEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  // Tracks series currently being advanced to avoid duplicate writes.
  const advancing = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEvents([]);
      setSeries([]);
      setMemberItems([]);
      setLoadingEvents(false);
      setLoadingSeries(false);
      return;
    }

    setLoadingEvents(true);
    setLoadingSeries(true);

    // No orderBy here — items are sorted client-side below, which avoids
    // requiring a composite Firestore index on (ownerId, date).
    const eventsQuery = query(
      collection(db, "events"),
      where("ownerId", "==", user.uid)
    );

    const unsubEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        setEvents(
          snapshot.docs.map((d) => mapFirestoreEvent(d.id, d.data()))
        );
        setLoadingEvents(false);
      },
      () => setLoadingEvents(false)
    );

    const unsubSeries = subscribeOwnerSeries(user.uid, (list) => {
      setSeries(list);
      setLoadingSeries(false);
    });

    // Events the user was invited to (member of a group they don't own).
    const unsubMember = subscribeMemberEvents(user.uid, setMemberItems);

    return () => {
      unsubEvents();
      unsubSeries();
      unsubMember();
    };
  }, [user, authLoading]);

  // Lazily advance open series whose current occurrence is in the past.
  useEffect(() => {
    if (!user) return;
    series.forEach((s) => {
      if (advancing.current.has(s.id)) return;
      advancing.current.add(s.id);
      ensureCurrentOccurrence(s, user.uid).finally(() => {
        advancing.current.delete(s.id);
      });
    });
  }, [series, user]);

  const loading = loadingEvents || loadingSeries;

  if (authLoading || loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Se încarcă evenimentele...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted p-8 text-center">
        <p className="text-muted-foreground">
          Conectează-te cu Google pentru a-ți vedea evenimentele.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
        >
          Conectează-te cu Google
        </button>
      </div>
    );
  }

  const eventById = new Map(events.map((e) => [e.id, e]));
  const items: DisplayItem[] = [];
  // Track which events/series are already shown as "mine" to avoid duplicates.
  const shownEventIds = new Set<string>();
  const shownSeriesIds = new Set<string>();

  // Standalone events owned by the user (not part of a series).
  for (const e of events) {
    if (!e.seriesId) {
      items.push({ kind: "event", key: e.id, date: e.date, event: e });
      shownEventIds.add(e.id);
    }
  }

  // One card per owned series → its current (upcoming) occurrence.
  for (const s of series) {
    const current = eventById.get(s.currentEventId);
    if (!current) continue;
    items.push({
      kind: "series",
      key: s.id,
      date: current.date,
      event: current,
      series: s,
    });
    shownSeriesIds.add(s.id);
    shownEventIds.add(current.id);
  }

  // Events the user was invited to (deduped against owned items above).
  for (const m of memberItems) {
    if (m.kind === "member-series" && m.series) {
      if (shownSeriesIds.has(m.series.id)) continue;
      items.push({
        kind: "series",
        key: `invited-${m.series.id}`,
        date: m.event.date,
        event: m.event,
        series: m.series,
        invited: true,
      });
    } else {
      if (shownEventIds.has(m.event.id)) continue;
      items.push({
        kind: "event",
        key: `invited-${m.event.id}`,
        date: m.event.date,
        event: m.event,
        invited: true,
      });
    }
  }

  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted p-8 text-center">
        <p className="font-medium text-foreground">Nu ai evenimente.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Creează un eveniment sau deschide linkul unui eveniment la care ai
          fost invitat.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <EventCard
          key={item.key}
          event={item.event}
          series={item.series}
          invited={item.invited}
        />
      ))}
    </div>
  );
}
