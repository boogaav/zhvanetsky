import { NextResponse } from "next/server";
import { refineRequestSchema } from "@/lib/ai/schemas";
import { refine } from "@/lib/ai/pipeline";
import { getProvider } from "@/lib/ai";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { errorResponse, mapErrorToResponse } from "@/lib/validation/errors";
import { MAX_INPUT_LENGTH, REFINE_TIMEOUT_MS } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimit(`refine:${clientKey(request)}`);
  if (!limit.allowed) {
    return errorResponse("rate_limited", 429, {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", 400);
  }

  if (typeof body === "object" && body !== null && "input" in body) {
    const input = (body as { input: unknown }).input;
    if (typeof input === "string" && input.length > MAX_INPUT_LENGTH) {
      return errorResponse("too_long", 400);
    }
  }

  const parsed = refineRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("bad_request", 400);
  }

  const signal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(REFINE_TIMEOUT_MS),
  ]);

  try {
    const response = await refine(getProvider(), parsed.data, signal);
    return NextResponse.json(response);
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
