import { readFile, writeFile } from "node:fs/promises";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "ne-adunam";
const CONFIRMATION = "DELETE_23_EVENTS_119_RESPONSES_1_MEMBER_KEEP_2_EVENTS";
const PROTECTED_EVENT_IDS = new Set([
  "FyHjMfq8sp2W90uI38ut",
  "eCWio3E5cl50SU95fXYT",
]);
const EXPECTED_EVENT_IDS = new Set([
  "21y1CNDcLYwgNQRtbZak",
  "32fZXh02norAqfK9EnZF",
  "5LDmlBELY9cQcLeU8fvU",
  "7r1ca2BJRbpdH8EFlmJ3",
  "B1D46JLL7f6mw0deCL6T",
  "K7hG2cuCL5x5RaBBqCuY",
  "KQxY9DkWL7IhfCIKJbRe",
  "OZwGBGy8KdYJLSCxVtZb",
  "UPoiGDp8CNKnhpI2uAJK",
  "Vd16TALuU0x7jN4niwy7",
  "XVMpkOIcdPp4VYjg6Kvl",
  "XtO9IXkVcxxIQIgKn2BA",
  "Z3cZFdMTTMspwFimIMR3",
  "ZIVZVbcthW4E9yuis9pL",
  "ahmpwV5IcFSZYaGJTOyU",
  "bbWdLovjnD8Q7skZ8fo3",
  "cpETICeSfwzivfvgPZvi",
  "f2ickThdZMZG66LG8Zl2",
  "gOqHeH3nLczGDy9ebV7X",
  "v0-seed-series-1782299721146_current",
  "v0-seed-series-1782299721146_future",
  "v0-seed-series-1782299721146_past",
  "vIla7wHvjnGpXfzpO2hR",
]);

function sameSet(actual, expected) {
  return (
    actual.size === expected.size &&
    [...actual].every((value) => expected.has(value))
  );
}

function accessToken() {
  const token = process.env.FIRESTORE_ACCESS_TOKEN;
  if (!token) throw new Error("FIRESTORE_ACCESS_TOKEN is required.");
  return token;
}

async function deleteDocument(path, token) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${encodedPath}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new Error(
      `Failed deleting ${path}: ${response.status} ${await response.text()}`,
    );
}

const reportPath = process.argv[2] ?? "firestore-event-audit-before.json";
const report = JSON.parse(await readFile(reportPath, "utf8"));

if (process.env.CLEANUP_CONFIRMATION !== CONFIRMATION) {
  throw new Error(
    "Cleanup confirmation token does not match the approved manifest.",
  );
}
if (
  !report.safeToRequestDeletionConfirmation ||
  report.ambiguousReferences.length !== 0
) {
  throw new Error("Audit is not safe or contains ambiguous references.");
}
if (
  !sameSet(
    new Set(report.protectedEvents.map(({ id }) => id)),
    PROTECTED_EVENT_IDS,
  )
) {
  throw new Error("Protected event set changed. Refusing cleanup.");
}
if (
  !sameSet(
    new Set(report.candidateEvents.map(({ id }) => id)),
    EXPECTED_EVENT_IDS,
  )
) {
  throw new Error("Candidate event set changed. Refusing cleanup.");
}
if (
  report.affectedDocuments.events.length !== 23 ||
  report.affectedDocuments.directEventScoped.length !== 119 ||
  report.affectedDocuments.members.length !== 1 ||
  report.affectedDocuments.subscriptions.length !== 0 ||
  report.removableSeries.length !== 0
) {
  throw new Error(
    "Document counts changed from the approved manifest. Refusing cleanup.",
  );
}
if (
  report.preservedPlayerCards.count !== 1 ||
  report.inventory.byCollection.users !== 42 ||
  report.inventory.byCollection.subscriptions !== 8 ||
  report.inventory.byCollection.series !== 2
) {
  throw new Error(
    "Preserved production data changed from the approved manifest. Refusing cleanup.",
  );
}

const pathOf = (entry) => (typeof entry === "string" ? entry : entry?.path);
const paths = [
  ...report.affectedDocuments.directEventScoped.map(pathOf),
  ...report.affectedDocuments.members.map(pathOf),
  ...report.affectedDocuments.events.map(pathOf),
];
if (paths.some((path) => typeof path !== "string" || !path.includes("/"))) {
  throw new Error("Audit contains an invalid document path. Refusing cleanup.");
}
if (
  paths.some((path) => [...PROTECTED_EVENT_IDS].some((id) => path.includes(id)))
) {
  throw new Error(
    "Protected event appeared in deletion paths. Refusing cleanup.",
  );
}

const token = accessToken();
const deleted = [];
for (const path of paths) {
  await deleteDocument(path, token);
  deleted.push(path);
}

const result = {
  projectId: PROJECT_ID,
  completedAt: new Date().toISOString(),
  deletedCount: deleted.length,
  deletedByCollection: deleted.reduce((counts, path) => {
    const collection = path.split("/").at(-2);
    counts[collection] = (counts[collection] ?? 0) + 1;
    return counts;
  }, {}),
  protectedEventIds: [...PROTECTED_EVENT_IDS],
  deleted,
};
await writeFile(
  "firestore-event-cleanup-result.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify({ ...result, deleted: undefined }, null, 2));
