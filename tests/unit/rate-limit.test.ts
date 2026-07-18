import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clientKey, resetRateLimit } from "@/lib/rate-limit";

describe("rate limiting", () => {
  beforeEach(() => resetRateLimit());

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("a", 1000 + i, 5).allowed).toBe(i < 5);
    }
  });

  it("blocks the request over the limit with a retry hint", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("b", 1000, 3);
    const blocked = checkRateLimit("b", 1000, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("frees capacity after the window slides", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("c", 1000, 3);
    expect(checkRateLimit("c", 1000, 3).allowed).toBe(false);
    expect(checkRateLimit("c", 1000 + 61_000, 3).allowed).toBe(true);
  });

  it("keys are independent", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("d", 1000, 3);
    expect(checkRateLimit("e", 1000, 3).allowed).toBe(true);
  });

  it("derives the client key from x-forwarded-for", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientKey(req)).toBe("1.2.3.4");
    expect(clientKey(new Request("http://x"))).toBe("local");
  });
});
