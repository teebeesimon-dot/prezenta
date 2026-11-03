import {
  firestoreField,
  firestoreNumber,
  firestoreString,
  getFirestoreDocument,
  queryFirestore,
  reserveNotification,
  sendPushToUser,
} from "@/lib/server/push";

type Doc = Awaited<ReturnType<typeof queryFirestore>>[number];

function timestampMillis(value: ReturnType<typeof firestoreField>): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (value.timestampValue) return new Date(value.timestampValue).getTime();
  if (value.integerValue) return Number(value.integerValue);
  return Number.MAX_SAFE_INTEGER;
}

function eventDate(doc: Doc) {
  const value = firestoreField(doc, "date");
  if (value?.stringValue) return value.stringValue;
  if (value?.timestampValue) return value.timestampValue.slice(0, 10);
  return "";
}

function eventIsCancelled(doc: Doc) {
  return firestoreString(doc, "status") === "cancelled";
}

async function notifyOnce(key: string, uids: string[], title: string, body: string) {
  if (!(await reserveNotification(key))) return;
  await Promise.all([...new Set(uids.filter(Boolean))].map((uid) =>
    sendPushToUser(uid, title, body).catch((error) => {
      console.error("Event push failed for user", uid, error);
      return { sent: 0, total: 0 };
    }),
  ));
}

export async function notifyAttendanceChange(input: {
  eventId: string;
  actorUid: string;
  previousStatus: string | null;
  currentStatus: string;
}) {
  const event = await getFirestoreDocument(`events/${encodeURIComponent(input.eventId)}`);
  if (!event || eventIsCancelled(event)) return;
  const ownerId = firestoreString(event, "ownerId");
  const title = firestoreString(event, "title") || "Eveniment";
  const max = firestoreNumber(event, "maxParticipants");
  const responses = await queryFirestore("responses", "eventId", input.eventId);
  const going = responses
    .filter((doc) => firestoreString(doc, "status") === "vin")
    .sort((a, b) => timestampMillis(firestoreField(a, "goingRegisteredAt") ?? firestoreField(a, "createdAt")) -
      timestampMillis(firestoreField(b, "goingRegisteredAt") ?? firestoreField(b, "createdAt")));
  const confirmed = going.slice(0, max).map((doc) => firestoreString(doc, "userId"));
  const waitlist = going.slice(max);
  const actorResponse = responses.find((doc) => firestoreString(doc, "userId") === input.actorUid);
  const cycle = actorResponse ? String(timestampMillis(firestoreField(actorResponse, "updatedAt") ?? firestoreField(actorResponse, "createdAt"))) : String(Date.now());

  if (input.currentStatus === "vin" && input.previousStatus !== "vin" && max > 0 && going.length === max) {
    await notifyOnce(`full_${input.eventId}_${cycle}`, [...confirmed, ownerId],
      `Locuri ocupate: ${title}`, `Toate cele ${max} locuri pentru eveniment sunt ocupate.`);
  }

  if (input.previousStatus === "vin" && input.currentStatus !== "vin") {
    const promoted = waitlist[0];
    if (promoted) {
      const promotedUid = firestoreString(promoted, "userId");
      const promotedName = firestoreString(promoted, "userName") || "Participant";
      await notifyOnce(`promotion_${input.eventId}_${input.actorUid}_${promotedUid}_${cycle}`, [ownerId, promotedUid],
        `Ai fost promovat: ${title}`,
        promotedUid === ownerId
          ? "Un participant s-a retras. Locul a fost ocupat automat."
          : `Un participant s-a retras. ${promotedName}, ai acum un loc confirmat.`);
    } else {
      const responded = new Set(responses.map((doc) => firestoreString(doc, "userId")));
      const users = await queryFirestore("users");
      const eligible = users
        .map((doc) => firestoreString(doc, "uid") || doc.name.split("/").pop() || "")
        .filter((uid) => uid && uid !== ownerId && !responded.has(uid));
      await notifyOnce(`open_${input.eventId}_${input.actorUid}_${cycle}`, [...eligible, ownerId],
        `S-a eliberat un loc: ${title}`,
        "Un loc este disponibil. Deschide evenimentul si confirma daca participi.");
    }
  }
}

export async function cancelEventAndNotify(eventId: string) {
  const event = await getFirestoreDocument(`events/${encodeURIComponent(eventId)}`);
  if (!event) throw new Error("Evenimentul nu exista.");
  const ownerId = firestoreString(event, "ownerId");
  const responses = await queryFirestore("responses", "eventId", eventId);
  const participants = responses.map((doc) => firestoreString(doc, "userId"));
  await notifyOnce(`cancel_${eventId}`, [...participants, ownerId],
    `Eveniment anulat: ${firestoreString(event, "title") || "Eveniment"}`,
    "Organizatorul a anulat acest eveniment.");
}

export async function sendDueEventReminders(now = new Date()) {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => local.find((item) => item.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  if (part("hour") !== "10") return { processed: 0 };

  const events = await queryFirestore("events");
  let processed = 0;
  for (const event of events) {
    if (eventDate(event) !== today || eventIsCancelled(event)) continue;
    const eventId = event.name.split("/").pop() ?? "";
    const responses = await queryFirestore("responses", "eventId", eventId);
    const confirmed = responses
      .filter((doc) => firestoreString(doc, "status") === "vin")
      .map((doc) => firestoreString(doc, "userId"));
    const ownerId = firestoreString(event, "ownerId");
    const title = firestoreString(event, "title") || "Eveniment";
    const time = firestoreString(event, "time");
    const location = firestoreString(event, "locationName") || firestoreString(event, "location");
    await notifyOnce(`reminder_${eventId}_${today}`, [...confirmed, ownerId],
      `Astazi: ${title}`,
      `${time ? `Ora ${time}. ` : ""}${location ? `Locatie: ${location}. ` : ""}Te asteptam la eveniment!`);
    processed++;
  }
  return { processed };
}
