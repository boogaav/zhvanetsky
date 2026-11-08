import { NextResponse } from "next/server";
import { generateRequestSchema } from "@/lib/ai/schemas";
import { generate } from "@/lib/ai/pipeline";
import { getProvider, getQualityMode } from "@/lib/ai";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import {
  errorResponse,
  mapErrorToResponse,
} from "@/lib/validation/errors";
import { GENERATE_TIMEOUT_MS, MAX_INPUT_LENGTH } from "@/lib/config";
import { signText } from "@/lib/improve/wall";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimit(`generate:${clientKey(request)}`);
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

  // Pre-checks with specific copy before the generic schema pass.
  if (typeof body === "object" && body !== null && "input" in body) {
    const input = (body as { input: unknown }).input;
    if (typeof input === "string" && input.trim().length === 0) {
      return errorResponse("empty_input", 400);
    }
    if (typeof input === "string" && input.length > MAX_INPUT_LENGTH) {
      return errorResponse("too_long", 400);
    }
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("bad_request", 400);
  }

  // Combined timeout + client-disconnect cancellation.
  const signal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(GENERATE_TIMEOUT_MS),
  ]);

  try {
    const response = await generate(
      getProvider(),
      parsed.data.input,
      parsed.data.settings,
      getQualityMode(),
      signal
    );
    if (response.safety) return NextResponse.json(response);
    return NextResponse.json({
      ...response,
      signature: signText(response.result),
      alternatives: response.alternatives.map((a) => ({
        ...a,
        signature: signText(a.text),
      })),
    });
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
