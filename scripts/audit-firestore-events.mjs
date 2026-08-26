import { writeFile } from "node:fs/promises";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "ne-adunam";
const TOKEN = process.env.FIRESTORE_ACCESS_TOKEN;
const OUTPUT = process.env.AUDIT_OUTPUT || "firestore-event-audit.json";
const PROTECTED_EVENT_IDS = ["FyHjMfq8sp2W90uI38ut", "eCWio3E5cl50SU95fXYT"];
const HISTORICAL_EVENT_IDS = [
  "gOqHeH3nLczGDy9ebV7X",
  "OZwGBGy8KdYJLSCxVtZb",
  "Z3cZFdMTTMspwFimIMR3",
  "f2ickThdZMZG66LG8Zl2",
  "21y1CNDcLYwgNQRtbZak",
  "KQxY9DkWL7IhfCIKJbRe",
  "bbWdLovjnD8Q7skZ8fo3",
  "B1D46JLL7f6mw0deCL6T",
  "vIla7wHvjnGpXfzpO2hR",
  "7r1ca2BJRbpdH8EFlmJ3",
  "XVMpkOIcdPp4VYjg6Kvl",
  "5LDmlBELY9cQcLeU8fvU",
  "K7hG2cuCL5x5RaBBqCuY",
  "cpETICeSfwzivfvgPZvi",
  "32fZXh02norAqfK9EnZF",
  "ZIVZVbcthW4E9yuis9pL",
];
const HISTORICAL_SERIES_IDS = ["tYbWTlGBa68TlOdllcR7", "8nIem9j18d31gA9XW0PX"];
const API_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

if (!TOKEN) throw new Error("FIRESTORE_ACCESS_TOKEN is required.");

async function request(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok)
    throw new Error(
      `${response.status} ${response.statusText}: ${await response.text()}`,
    );
  return response.json();
}

function decode(value) {
  if (!value || typeof value !== "object") return value;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("bytesValue" in value) return "[bytes]";
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value)
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nested]) => [
        key,
        decode(nested),
      ]),
    );
  return value;
}

function documentPath(name) {
  return name.split("/documents/")[1];
}

async function listCollectionIds(parentPath = "") {
  const url = parentPath
    ? `${API_ROOT}/${parentPath}:listCollectionIds`
    : `${API_ROOT}:listCollectionIds`;
  const result = await request(url, {
    method: "POST",
    body: JSON.stringify({ pageSize: 1000 }),
  });
  return result.collectionIds || [];
}

async function listDocuments(collectionPath) {
  const documents = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      pageSize: "1000",
      showMissing: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const result = await request(`${API_ROOT}/${collectionPath}?${params}`);
    documents.push(...(result.documents || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function walk(parentPath = "", result = []) {
  for (const collectionId of await listCollectionIds(parentPath)) {
    const collectionPath = parentPath
      ? `${parentPath}/${collectionId}`
      : collectionId;
    for (const raw of await listDocuments(collectionPath)) {
      const path = documentPath(raw.name);
      const data = Object.fromEntries(
        Object.entries(raw.fields || {}).map(([key, value]) => [
          key,
          decode(value),
        ]),
      );
      result.push({
        path,
        collection: collectionId,
        id: path.split("/").at(-1),
        data,
      });
      await walk(path, result);
    }
  }
  return result;
}

function containsValue(value, targets, trail = []) {
  const matches = [];
  if (typeof value === "string" && targets.has(value))
    matches.push(trail.join("."));
  else if (Array.isArray(value))
    value.forEach((item, index) =>
      matches.push(...containsValue(item, targets, [...trail, String(index)])),
    );
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([key, nested]) =>
      matches.push(...containsValue(nested, targets, [...trail, key])),
    );
  return matches;
}

function eventSummary(document) {
  const data = document.data;
  return {
    id: document.id,
    path: document.path,
    title: data.title || data.name || null,
    date: data.date || data.startDate || null,
    seriesId: data.seriesId || null,
    ownerId: data.ownerId || null,
  };
}

const allDocuments = await walk();
const eventDocuments = allDocuments.filter(
  (document) =>
    document.path.split("/").length === 2 && document.collection === "events",
);
const protectedEvents = PROTECTED_EVENT_IDS.map((id) =>
  eventDocuments.find((event) => event.id === id),
).filter(Boolean);
const missingProtectedEventIds = PROTECTED_EVENT_IDS.filter(
  (id) => !protectedEvents.some((event) => event.id === id),
);
const candidateEvents = eventDocuments.filter(
  (event) => !PROTECTED_EVENT_IDS.includes(event.id),
);
const candidateIds = new Set(candidateEvents.map((event) => event.id));
const protectedIds = new Set(PROTECTED_EVENT_IDS);
const protectedSeriesIds = new Set(
  protectedEvents.map((event) => event.data.seriesId).filter(Boolean),
);
const candidateSeriesIds = new Set(
  candidateEvents.map((event) => event.data.seriesId).filter(Boolean),
);
const removableSeriesIds = new Set(
  [...candidateSeriesIds].filter((id) => !protectedSeriesIds.has(id)),
);
const seriesDocuments = allDocuments.filter(
  (document) =>
    document.path.split("/").length === 2 && document.collection === "series",
);

const referencesToCandidates = [];
const referencesToProtected = [];
for (const document of allDocuments) {
  const candidateFields = containsValue(document.data, candidateIds);
  const protectedFields = containsValue(document.data, protectedIds);
  if (candidateFields.length)
    referencesToCandidates.push({
      path: document.path,
      collection: document.collection,
      fields: candidateFields,
    });
  if (protectedFields.length)
    referencesToProtected.push({
      path: document.path,
      collection: document.collection,
      fields: protectedFields,
    });
}

const eventScopedCollections = new Set([
  "responses",
  "stageConfigs",
  "stageVotes",
  "stageAwards",
  "specialCards",
]);
const directlyScopedCandidates = allDocuments.filter(
  (document) =>
    eventScopedCollections.has(document.collection) &&
    candidateIds.has(document.data.eventId),
);
const removableSeriesDocuments = seriesDocuments.filter((document) =>
  removableSeriesIds.has(document.id),
);
const removableGroupIds = new Set([...candidateIds, ...removableSeriesIds]);
const removableMemberDocuments = allDocuments.filter(
  (document) =>
    document.collection === "members" &&
    removableGroupIds.has(document.data.groupId),
);
const removableSubscriptionDocuments = allDocuments.filter(
  (document) =>
    document.collection === "subscriptions" &&
    removableSeriesIds.has(document.data.seriesId),
);
const protectedPlayerCards = allDocuments.filter(
  (document) =>
    document.collection === "playerCards" &&
    !removableGroupIds.has(document.data.groupId),
);
const ambiguousReferences = referencesToCandidates.filter(({ path }) => {
  const document = allDocuments.find((item) => item.path === path);
  if (!document) return false;
  if (document.collection === "events" && candidateIds.has(document.id))
    return false;
  if (
    eventScopedCollections.has(document.collection) &&
    candidateIds.has(document.data.eventId)
  )
    return false;
  if (
    document.collection === "members" &&
    removableGroupIds.has(document.data.groupId)
  )
    return false;
  if (document.collection === "series" && removableSeriesIds.has(document.id))
    return false;
  return true;
});

const historicalTargets = new Set([
  ...HISTORICAL_EVENT_IDS,
  ...HISTORICAL_SERIES_IDS,
]);
const historicalMatches = allDocuments.flatMap((document) => {
  const fields = containsValue(document.data, historicalTargets);
  const idMatch = historicalTargets.has(document.id);
  if (!fields.length && !idMatch) return [];
  return [
    {
      path: document.path,
      collection: document.collection,
      id: document.id,
      fields,
      idMatch,
      data: document.data,
    },
  ];
});
const historicalMatchesByCollection = Object.fromEntries(
  [...new Set(historicalMatches.map((document) => document.collection))]
    .sort()
    .map((collection) => [
      collection,
      historicalMatches.filter(
        (document) => document.collection === collection,
      ),
    ]),
);
const historicalEventExistence = Object.fromEntries(
  HISTORICAL_EVENT_IDS.map((id) => [
    id,
    eventDocuments.some((document) => document.id === id),
  ]),
);
const linkageCollections = new Set([
  "events",
  "members",
  "responses",
  "playerCards",
  "users",
  "series",
  "subscriptions",
]);
const collectionLinkageInventory = Object.fromEntries(
  [...linkageCollections].map((collection) => {
    const documents = allDocuments.filter(
      (document) => document.collection === collection,
    );
    return [
      collection,
      {
        count: documents.length,
        fieldNames: [
          ...new Set(
            documents.flatMap((document) => Object.keys(document.data)),
          ),
        ].sort(),
        links: documents.map((document) => ({
          path: document.path,
          eventId: document.data.eventId ?? null,
          seriesId: document.data.seriesId ?? null,
          groupId: document.data.groupId ?? null,
          userId: document.data.userId ?? null,
          hasPayments: document.data.payments !== undefined,
          hasTeams: document.data.teams !== undefined,
        })),
      },
    ];
  }),
);

const byCollection = Object.fromEntries(
  [...new Set(allDocuments.map((document) => document.collection))]
    .sort()
    .map((collection) => [
      collection,
      allDocuments.filter((document) => document.collection === collection)
        .length,
    ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  projectId: PROJECT_ID,
  mode: "audit",
  safeToRequestDeletionConfirmation:
    missingProtectedEventIds.length === 0 && ambiguousReferences.length === 0,
  protectedEventIds: PROTECTED_EVENT_IDS,
  protectedEvents: protectedEvents.map(eventSummary),
  missingProtectedEventIds,
  candidateEvents: candidateEvents.map(eventSummary),
  protectedSeriesIds: [...protectedSeriesIds],
  removableSeries: removableSeriesDocuments.map((document) => ({
    id: document.id,
    path: document.path,
    title: document.data.title || document.data.name || null,
    currentEventId: document.data.currentEventId || null,
  })),
  affectedDocuments: {
    events: candidateEvents.map((document) => document.path),
    directEventScoped: directlyScopedCandidates.map(
      (document) => document.path,
    ),
    members: removableMemberDocuments.map((document) => document.path),
    subscriptions: removableSubscriptionDocuments.map(
      (document) => document.path,
    ),
  },
  referencesToCandidateEvents: referencesToCandidates,
  referencesToProtectedEvents: referencesToProtected,
  ambiguousReferences,
  preservedPlayerCards: {
    count: protectedPlayerCards.length,
    paths: protectedPlayerCards.map((document) => document.path),
  },
  historicalRecoveryAudit: {
    eventIds: HISTORICAL_EVENT_IDS,
    seriesIds: HISTORICAL_SERIES_IDS,
    eventDocumentExists: historicalEventExistence,
    matchedDocumentCount: historicalMatches.length,
    matchedDocumentsByCollection: historicalMatchesByCollection,
    collectionLinkageInventory,
  },
  inventory: { totalDocuments: allDocuments.length, byCollection },
};

await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (missingProtectedEventIds.length) process.exitCode = 2;
