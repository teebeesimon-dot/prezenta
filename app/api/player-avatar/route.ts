import { NextRequest } from "next/server";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(items: T[], value: number): T {
  return items[value % items.length];
}

export async function GET(request: NextRequest) {
  const seed = request.nextUrl.searchParams.get("seed") || "player";
  const name = request.nextUrl.searchParams.get("name") || "Jucator";
  const hash = hashSeed(seed);

  const skin = pick(["#f1c7a5", "#d99b72", "#b96f4d", "#8f543d", "#704331"], hash);
  const hair = pick(["#17120f", "#2b211d", "#5a3925", "#8b5a36", "#c5a16b"], hash >>> 4);
  const shirt = pick(["#111827", "#0f766e", "#1d4ed8", "#b91c1c", "#7c3aed", "#374151"], hash >>> 8);
  const background = pick(["#d9e5f0", "#dbe7dc", "#e9dfd2", "#dcd9e9", "#e7e1d7"], hash >>> 12);
  const faceWidth = 92 + (hash % 12);
  const hairStyle = hash % 3;
  const beard = (hash >>> 16) % 3 === 0;
  const eyeOffset = 18 + (hash % 5);
  const initial = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z]/g, "")
    .charAt(0)
    .toUpperCase() || "J";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${background}"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shirt}"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="320" height="400" fill="url(#bg)"/>
  <circle cx="160" cy="170" r="135" fill="#ffffff" opacity="0.22"/>
  <path d="M55 400 C62 315 105 286 160 286 C215 286 258 315 265 400Z" fill="url(#shirt)"/>
  <path d="M128 292 L160 330 L192 292 L182 270 L138 270Z" fill="${skin}"/>
  <ellipse cx="160" cy="170" rx="${faceWidth / 2}" ry="112" fill="${skin}"/>
  <path d="M${160 - faceWidth / 2} 151 C${145 - faceWidth / 2} 56 ${175 - faceWidth / 2} 43 160 42 C245 43 ${175 + faceWidth / 2} 56 ${160 + faceWidth / 2} 151 C235 108 85 108 ${160 - faceWidth / 2} 151Z" fill="${hair}"/>
  ${hairStyle === 0 ? `<path d="M${160 - faceWidth / 2} 100 C95 65 112 36 160 36 C208 36 225 65 ${160 + faceWidth / 2} 100 C212 79 108 79 ${160 - faceWidth / 2} 100Z" fill="${hair}"/>` : ""}
  ${hairStyle === 1 ? `<path d="M92 105 C83 52 121 24 160 28 C199 24 237 52 228 105 L207 91 C204 61 183 49 160 51 C137 49 116 61 113 91Z" fill="${hair}"/>` : ""}
  ${hairStyle === 2 ? `<path d="M88 112 C81 66 103 32 137 24 L183 24 C217 32 239 66 232 112 L213 86 L205 54 L185 72 L160 45 L135 72 L115 54 L107 86Z" fill="${hair}"/>` : ""}
  <ellipse cx="${160 - eyeOffset}" cy="165" rx="8" ry="5" fill="#ffffff"/>
  <ellipse cx="${160 - eyeOffset}" cy="165" rx="3" ry="4" fill="#111827"/>
  <ellipse cx="${160 + eyeOffset}" cy="165" rx="8" ry="5" fill="#ffffff"/>
  <ellipse cx="${160 + eyeOffset}" cy="165" rx="3" ry="4" fill="#111827"/>
  <path d="M${160 - eyeOffset - 9} 149 Q${160 - eyeOffset} 143 ${160 - eyeOffset + 9} 149" fill="none" stroke="${hair}" stroke-width="5" stroke-linecap="round"/>
  <path d="M${160 + eyeOffset - 9} 149 Q${160 + eyeOffset} 143 ${160 + eyeOffset + 9} 149" fill="none" stroke="${hair}" stroke-width="5" stroke-linecap="round"/>
  <path d="M160 166 C154 184 154 190 163 192" fill="none" stroke="#7c4a37" stroke-width="4" stroke-linecap="round"/>
  <path d="M140 214 Q160 226 180 214" fill="none" stroke="#7c3f35" stroke-width="5" stroke-linecap="round"/>
  ${beard ? `<path d="M117 205 Q160 259 203 205 Q194 267 160 271 Q126 267 117 205Z" fill="${hair}" opacity="0.72"/>` : ""}
  <path d="M126 304 L160 338 L194 304" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.7"/>
  <text x="160" y="382" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#ffffff" opacity="0.85">${initial}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
