import { NextResponse } from "next/server";
import { z } from "zod";
import { recordDuel } from "@/lib/improve/wall";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/validation/errors";

export const runtime = "nodejs";

const voteSchema = z.object({
  winner: z.string().regex(/^[0-9a-f]{16}$/),
  loser: z.string().regex(/^[0-9a-f]{16}$/),
});

// shortcut: votes are only IP-rate-limited, not tied to a served duel; add a
// signed duel token if the Wall ever sees vote stuffing.
export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimit(`wall-vote:${clientKey(request)}`, Date.now(), 40);
  if (!limit.allowed) return errorResponse("rate_limited", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", 400);
  }
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success || !recordDuel(parsed.data.winner, parsed.data.loser)) {
    return errorResponse("bad_request", 400);
  }
  return NextResponse.json({ accepted: true });
}
