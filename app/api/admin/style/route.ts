import { NextResponse } from "next/server";
import { z } from "zod";
import {
  promoteStyle,
  readStyleState,
  rollbackStyle,
} from "@/lib/improve/store";
import { validateStyleRules } from "@/lib/improve/style";
import { isAuthorized } from "../route-helpers";

export const runtime = "nodejs";

const promoteSchema = z.object({
  action: z.literal("promote"),
  version: z.object({
    version: z.number().int().positive(),
    rules: z.array(z.string()).min(1).max(8),
    createdAt: z.number().int().positive(),
    promotion: z
      .object({
        wins: z.number(),
        losses: z.number(),
        ties: z.number(),
        fixtures: z.number(),
        eventsAnalyzed: z.number(),
      })
      .optional(),
  }),
});

const rollbackSchema = z.object({ action: z.literal("rollback") });

/** Read the current learned-style state. */
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(readStyleState());
}

/** Promote a new style version, or roll back to the previous one. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const rollback = rollbackSchema.safeParse(body);
  if (rollback.success) {
    return NextResponse.json(rollbackStyle());
  }

  const promote = promoteSchema.safeParse(body);
  if (!promote.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const check = validateStyleRules(promote.data.version.rules);
  if (!check.ok) {
    return NextResponse.json(
      { error: "invalid_rules", reason: check.reason },
      { status: 400 }
    );
  }
  return NextResponse.json(promoteStyle(promote.data.version));
}
