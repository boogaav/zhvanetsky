/**
 * Small in-memory sliding-window rate limiter. Good enough for a
 * single-instance v1; swap for a shared store when deploying multiple
 * instances.
 */
const WINDOW_MS = 60_000;
/** Default 12 req/min per client; RATE_LIMIT_MAX overrides (e.g. in e2e). */
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX ?? 12);

const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  max: number = MAX_REQUESTS
): { allowed: boolean; retryAfterSeconds: number } {
  const windowStart = now - WINDOW_MS;
  const list = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (list.length >= max) {
    const retryAfterSeconds = Math.ceil((list[0] + WINDOW_MS - now) / 1000);
    hits.set(key, list);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }
  list.push(now);
  hits.set(key, list);
  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}

/** Test hook. */
export function resetRateLimit(): void {
  hits.clear();
}
