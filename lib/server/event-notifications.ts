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

type TemplateKey = "reminder" | "capacity" | "vacancy" | "promotion" | "cancellation";
function eventTemplate(event: Doc, key: TemplateKey, defaults: { title: string; body: string }, values: Record<string, string> = {}) {
  const saved = firestoreField(event, "notificationTemplates")?.mapValue?.fields?.[key]?.mapValue?.fields;
  const title = saved?.title?.stringValue || defaults.title;
  const body = saved?.body?.stringValue || defaults.body;
  const replace = (value: string) => value.replace(/\{(eventTitle|eventTime|location|capacity|participantName|withdrawnName)\}/g, (match, name: string) => values[name] ?? match);
  return { title: replace(title), body: replace(body) };
}
async function notifyEvent(key: string, event: Doc, templateKey: TemplateKey, uids: string[], defaults: { title: string; body: string }, values: Record<string, string> = {}) {
  const message = eventTemplate(event, templateKey, defaults, values);
  await notifyOnce(key, uids, message.title, message.body);
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
    await notifyEvent(`full_${input.eventId}_${cycle}`, event, "capacity", [...confirmed, ownerId],
      { title: `Locuri ocupate: ${title}`, body: `Toate cele ${max} locuri pentru eveniment sunt ocupate.` },
      { eventTitle: title, capacity: String(max) });
  }

  if (input.previousStatus === "vin" && input.currentStatus !== "vin") {
    const promoted = waitlist[0];
    if (promoted) {
      const promotedUid = firestoreString(promoted, "userId");
      const promotedName = firestoreString(promoted, "userName") || "Participant";
      const withdrawnName = actorResponse ? firestoreString(actorResponse, "userName") || "Participant" : "Participant";
      const replacementValues = { eventTitle: title, participantName: promotedName, withdrawnName };
      const replacementDefaults = {
        title: `Inlocuire confirmata: ${title}`,
        body: `${promotedName} l-a inlocuit pe ${withdrawnName}, care s-a retras.`,
      };
      await notifyEvent(`promotion_owner_${input.eventId}_${input.actorUid}_${cycle}`, event, "promotion", [ownerId],
        replacementDefaults, replacementValues);
      await notifyEvent(`promotion_user_${input.eventId}_${input.actorUid}_${promotedUid}_${cycle}`, event, "promotion", [promotedUid],
        { title: `Ai fost promovat: ${title}`, body: `${promotedName} l-a inlocuit pe ${withdrawnName}, care s-a retras.` },
        replacementValues);
    } else {
      const responded = new Set(responses.map((doc) => firestoreString(doc, "userId")));
      const users = await queryFirestore("users");
      const eligible = users
        .map((doc) => firestoreString(doc, "uid") || doc.name.split("/").pop() || "")
        .filter((uid) => uid && uid !== ownerId && !responded.has(uid));
      await notifyEvent(`open_users_${input.eventId}_${input.actorUid}_${cycle}`, event, "vacancy", eligible,
        { title: `S-a eliberat un loc: ${title}`, body: "Un loc este disponibil. Deschide evenimentul si confirma daca participi." }, { eventTitle: title });
      await notifyEvent(`open_owner_${input.eventId}_${input.actorUid}_${cycle}`, event, "vacancy", [ownerId],
        { title: `Loc disponibil: ${title}`, body: "Un participant s-a retras si nu exista persoane pe lista de asteptare. Poti organiza inlocuirea." }, { eventTitle: title });
    }
  }
}

export async function cancelEventAndNotify(eventId: string) {
  const event = await getFirestoreDocument(`events/${encodeURIComponent(eventId)}`);
  if (!event) throw new Error("Evenimentul nu exista.");
  const ownerId = firestoreString(event, "ownerId");
  const responses = await queryFirestore("responses", "eventId", eventId);
  const participants = responses.map((doc) => firestoreString(doc, "userId"));
  const title = firestoreString(event, "title") || "Eveniment";
  await notifyEvent(`cancel_${eventId}`, event, "cancellation", [...participants, ownerId],
    { title: `Eveniment anulat: ${title}`, body: "Organizatorul a anulat acest eveniment." }, { eventTitle: title });
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
    await notifyEvent(`reminder_${eventId}_${today}`, event, "reminder", [...confirmed, ownerId],
      { title: `Astazi: ${title}`, body: `${time ? `Ora ${time}. ` : ""}${location ? `Locatie: ${location}. ` : ""}Te asteptam la eveniment!` },
      { eventTitle: title, eventTime: time, location });
    processed++;
  }
  return { processed };
}
