import { NextResponse } from "next/server";
import { z } from "zod";
import { pickDuel, publishPiece, topPieces, verifyText } from "@/lib/improve/wall";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/validation/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGS = ["en", "ru", "uk"];

const publishSchema = z.object({
  text: z.string().min(1).max(3000),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
  language: z.string().max(10),
});

const view = (p: { id: string; text: string; language: string }) => ({
  id: p.id,
  text: p.text,
  language: p.language,
});

/** A fresh duel plus the leaderboard. Ratings are hidden from duels to avoid bias. */
export async function GET(request: Request): Promise<NextResponse> {
  const lang = new URL(request.url).searchParams.get("lang") ?? undefined;
  const language = lang && LANGS.includes(lang) ? lang : undefined;
  const duel = pickDuel(language);
  return NextResponse.json({
    duel: duel ? duel.map(view) : null,
    top: topPieces(20, language).map((p) => ({
      ...view(p),
      wins: p.wins,
      duels: p.wins + p.losses,
    })),
  });
}

/** Publish a piece. Only text this server generated (valid signature) is accepted. */
export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimit(`wall-publish:${clientKey(request)}`, Date.now(), 10);
  if (!limit.allowed) return errorResponse("rate_limited", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", 400);
  }
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success || !verifyText(parsed.data.text, parsed.data.signature)) {
    return errorResponse("bad_request", 400);
  }
  const language = LANGS.includes(parsed.data.language) ? parsed.data.language : "en";
  const piece = publishPiece(parsed.data.text, language);
  return NextResponse.json({ id: piece.id });
}
