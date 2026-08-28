import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireGroupOwner } from "@/lib/server/firebase-owner-auth";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Uploads a public hero/venue photo for an event or series. Only the group
 * owner (event/series ownerId) may upload. The venue photo is not sensitive,
 * so it is stored with public access for a simple <img src> reference.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const groupId = String(formData.get("groupId") ?? "");
    if (!(file instanceof File) || !groupId) {
      return NextResponse.json({ error: "Date de încărcare incomplete." }, { status: 400 });
    }
    await requireGroupOwner(request, groupId);
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Folosește JPG, PNG sau WebP." }, { status: 415 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Imaginea poate avea maximum 8 MB." }, { status: 413 });
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const pathname = `event-heroes/${groupId}/${crypto.randomUUID()}.${extension}`;
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: false });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Încărcarea a eșuat.";
    return NextResponse.json({ error: message }, { status: message.includes("administratorul") ? 403 : 401 });
  }
}
