import { createHash, timingSafeEqual } from "crypto";

/**
 * Admin endpoints are enabled only when IMPROVE_ADMIN_TOKEN is set,
 * and require `Authorization: Bearer <token>`. Comparison is
 * constant-time over digests.
 */
export function isAuthorized(request: Request): boolean {
  const token = process.env.IMPROVE_ADMIN_TOKEN;
  if (!token) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}
