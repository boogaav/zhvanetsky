import { describe, expect, it } from "vitest";
import { z } from "zod";
import { completeStructured } from "@/lib/ai/structured";
import { AIProviderError, type AIProvider } from "@/lib/ai/provider";

const schema = z.object({ text: z.string().min(1) });
const params = {
  system: "s",
  user: "u",
  schemaName: "test",
  jsonSchema: {},
};

function providerReturning(values: unknown[]): AIProvider & { calls: string[] } {
  const calls: string[] = [];
  let i = 0;
  return {
    name: "mock",
    calls,
    async completeJson(p) {
      calls.push(p.user);
      return values[Math.min(i++, values.length - 1)];
    },
  };
}

describe("structured output repair", () => {
  it("returns valid output on the first try without retrying", async () => {
    const provider = providerReturning([{ text: "ok" }]);
    const result = await completeStructured(provider, params, schema);
    expect(result.text).toBe("ok");
    expect(provider.calls).toHaveLength(1);
  });

  it("retries once with a repair instruction on invalid output", async () => {
    const provider = providerReturning([{ wrong: true }, { text: "fixed" }]);
    const result = await completeStructured(provider, params, schema);
    expect(result.text).toBe("fixed");
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]).toContain("REPAIR");
  });

  it("fails with invalid_response after two invalid outputs", async () => {
    const provider = providerReturning([{ wrong: 1 }, { stillWrong: 2 }]);
    await expect(
      completeStructured(provider, params, schema)
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(provider.calls).toHaveLength(2);
  });

  it("does not leak provider internals in the public error", async () => {
    const provider = providerReturning([{ wrong: 1 }, { wrong: 2 }]);
    try {
      await completeStructured(provider, params, schema);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as Error).message).not.toContain("mock");
    }
  });
});
