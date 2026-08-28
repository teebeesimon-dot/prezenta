"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import AdminPlayerCards from "@/components/AdminPlayerCards";
import AdminStageAwards from "@/components/AdminStageAwards";
import AttendanceSection from "@/components/AttendanceSection";
import EventDashboardShell from "@/components/EventDashboardShell";
import MembersGroup from "@/components/MembersGroup";
import PlayerCardSection from "@/components/PlayerCardSection";
import TeamGenerator from "@/components/TeamGenerator";
import { useAuth } from "@/contexts/AuthProvider";
import { mapFirestoreEvent } from "@/lib/events";
import { db } from "@/lib/firebase";
import { resolveGroup } from "@/lib/members";
import type { Event } from "@/lib/types";

export type EventSection = "group" | "confirmed" | "teams" | "cards";

const titles: Record<EventSection, string> = {
  group: "Grup",
  confirmed: "Confirmați",
  teams: "Echipe",
  cards: "Player Cards",
};

export default function EventSectionPage({
  id,
  section,
}: {
  id: string;
  section: EventSection;
}) {
  const { user, loading } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      if (!loading) setLoaded(true);
      return;
    }
    return onSnapshot(
      doc(db, "events", id),
      (snapshot) => {
        setEvent(
          snapshot.exists()
            ? mapFirestoreEvent(snapshot.id, snapshot.data())
            : null,
        );
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [id, loading, user]);

  if (!loaded)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Se încarcă...
      </div>
    );
  if (!user)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-muted-foreground">
        Conectează-te pentru a vedea această secțiune.
      </div>
    );
  if (!event)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-muted-foreground">
        Eveniment negăsit.
      </div>
    );

  const canManage = user.uid === event.ownerId;
  const group = resolveGroup(event);

  return (
    <EventDashboardShell event={event} active={section}>
      <header className="event-panel p-5 sm:p-6">
        <p className="text-sm font-semibold text-primary">{event.title}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{titles[section]}</h1>
      </header>
      {section === "group" && (
        <MembersGroup
          eventId={event.id}
          {...group}
          ownerId={event.ownerId}
          eventDate={event.date}
          pricePerHour={event.pricePerHour}
          durationMinutes={event.durationMinutes}
          paymentModel={event.paymentModel}
          canManage={canManage}
        />
      )}
      {section === "confirmed" && (
        <AttendanceSection
          eventId={event.id}
          maxParticipants={event.maxParticipants}
          pricePerHour={event.pricePerHour}
          durationMinutes={event.durationMinutes}
          ownerId={event.ownerId}
          eventDate={event.date}
          eventTime={event.time}
          canManage={canManage}
          paymentModel={event.paymentModel}
          view="lists"
        />
      )}
      {section === "teams" && (
        <>
          <TeamGenerator
            eventId={event.id}
            maxParticipants={event.maxParticipants}
            footballFormat={event.footballFormat}
            teams={event.teams}
            isOwner={canManage}
            groupId={group.groupId}
          />
          {canManage && (
            <AdminStageAwards
              groupId={group.groupId}
              currentStageNumber={event.seriesIndex ?? 1}
              hideCardCreation
            />
          )}
          <PlayerCardSection groupId={group.groupId} view="voting" />
        </>
      )}
      {section === "cards" && (
        <>
          <PlayerCardSection groupId={group.groupId} view="cards" />
          {canManage && <AdminPlayerCards groupId={group.groupId} />}
        </>
      )}
    </EventDashboardShell>
  );
}
