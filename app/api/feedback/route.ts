import { NextResponse } from "next/server";
import { feedbackEventSchema } from "@/lib/improve/types";
import { appendFeedback } from "@/lib/improve/store";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/validation/errors";

export const runtime = "nodejs";

/**
 * Opt-in anonymous feedback. The client only sends events when the user
 * has enabled "help the editor learn"; the payload contains the
 * generated result and settings — never the user's raw thought, never
 * any identifier.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimit(`feedback:${clientKey(request)}`, Date.now(), 30);
  if (!limit.allowed) {
    return errorResponse("rate_limited", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", 400);
  }

  const parsed = feedbackEventSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
    ts: Date.now(), // server-side timestamp; client clock is not trusted
  });
  if (!parsed.success) {
    return errorResponse("bad_request", 400);
  }

  try {
    appendFeedback(parsed.data);
  } catch {
    // Storage failure must not surface an error for a fire-and-forget
    // signal; report accepted=false instead.
    return NextResponse.json({ accepted: false });
  }
  return NextResponse.json({ accepted: true });
}
