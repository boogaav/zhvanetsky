import { NextResponse } from "next/server";
import { AIProviderError } from "../ai/provider";

export type PublicErrorCode =
  | "empty_input"
  | "too_long"
  | "bad_request"
  | "rate_limited"
  | "timeout"
  | "cancelled"
  | "provider_unavailable"
  | "invalid_response"
  | "unknown";

/**
 * Human, concise error copy. One dry line where the user can take it;
 * plain help where they're likely already frustrated.
 */
export const ERROR_MESSAGES: Record<PublicErrorCode, string> = {
  empty_input: "Write the thought first. Even a messy one.",
  too_long:
    "That's over 8,000 characters. Cut it down — the editor would anyway.",
  bad_request: "The request didn't make sense to the server. Reload and retry.",
  rate_limited: "Too many thoughts too fast. Give it a minute.",
  timeout: "The model thought about it for too long. Try once more.",
  cancelled: "Stopped.",
  provider_unavailable: "The thought survived. The model didn't. Try once more.",
  invalid_response: "The model answered in the wrong shape twice. Try again.",
  unknown: "Something broke on our side. Try once more.",
};

export function errorResponse(
  code: PublicErrorCode,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { error: code, message: ERROR_MESSAGES[code], ...extra },
    { status }
  );
}

/** Maps any thrown value to a safe response. Never leaks internals. */
export function mapErrorToResponse(err: unknown): NextResponse {
  if (err instanceof AIProviderError) {
    switch (err.code) {
      case "cancelled":
        return errorResponse("cancelled", 499);
      case "timeout":
        return errorResponse("timeout", 504);
      case "invalid_response":
        return errorResponse("invalid_response", 502);
      default:
        return errorResponse("provider_unavailable", 502);
    }
  }
  if (err instanceof Error && err.name === "AbortError") {
    return errorResponse("timeout", 504);
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return errorResponse("timeout", 504);
  }
  return errorResponse("unknown", 500);
}
