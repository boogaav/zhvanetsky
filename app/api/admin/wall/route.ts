import { NextResponse } from "next/server";
import { readWall, removePiece } from "@/lib/improve/wall";
import { isAuthorized } from "../route-helpers";

export const runtime = "nodejs";

/** Full wall with ratings (moderation view). */
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ pieces: readWall() });
}

/** Remove a piece: DELETE /api/admin/wall?id=<id> */
export async function DELETE(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const id = new URL(request.url).searchParams.get("id") ?? "";
  return NextResponse.json({ removed: removePiece(id) });
}
