import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser, requireGroupOwner } from "@/lib/server/firebase-owner-auth";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const groupId = String(formData.get("groupId") ?? "");
    const userId = String(formData.get("userId") ?? "");
    const variant = formData.get("variant") === "special" ? "special" : "permanent";
    if (!(file instanceof File) || !groupId || !userId) {
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
    const pathname = `player-cards/${groupId}/${userId}/${variant}-${crypto.randomUUID()}.${extension}`;
    const blob = await put(pathname, file, { access: "private", addRandomSuffix: false });
    return NextResponse.json({ pathname: blob.pathname });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Încărcarea a eșuat.";
    return NextResponse.json({ error: message }, { status: message.includes("administratorul") ? 403 : 401 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireFirebaseUser(request);
    const pathname = request.nextUrl.searchParams.get("pathname");
    if (!pathname?.startsWith("player-cards/")) {
      return NextResponse.json({ error: "Imagine invalidă." }, { status: 400 });
    }
    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    });
    if (!result) return new NextResponse("Not found", { status: 404 });
    if (result.statusCode === 304) {
      return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" } });
    }
    return new NextResponse(result.stream, {
      headers: { "Content-Type": result.blob.contentType, ETag: result.blob.etag, "Cache-Control": "private, no-cache" },
    });
  } catch {
    return NextResponse.json({ error: "Autentificare necesară." }, { status: 401 });
  }
}
