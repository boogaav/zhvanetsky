import { NextResponse } from "next/server";
import { learningEvents } from "@/lib/improve/wall";
import { isAuthorized } from "../route-helpers";

export const runtime = "nodejs";

/** Export collected feedback events (for the Coach, run from a dev machine). */
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ events: learningEvents() });
}
