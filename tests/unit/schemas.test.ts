import { describe, expect, it } from "vitest";
import {
  generateRequestSchema,
  refineRequestSchema,
} from "@/lib/ai/schemas";

describe("request validation", () => {
  it("accepts a minimal generate request and applies defaults", () => {
    const parsed = generateRequestSchema.parse({ input: "hello" });
    expect(parsed.settings.tone).toBe("sharp");
    expect(parsed.settings.length).toBe("short");
    expect(parsed.settings.language).toBe("auto");
    expect(parsed.settings.preserveFacts).toBe(true);
  });

  it("rejects empty input", () => {
    expect(generateRequestSchema.safeParse({ input: "" }).success).toBe(false);
  });

  it("rejects input over 8000 characters", () => {
    const result = generateRequestSchema.safeParse({
      input: "x".repeat(8001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown tone values", () => {
    const result = generateRequestSchema.safeParse({
      input: "hi",
      settings: { tone: "sarcastic" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid refine request", () => {
    const parsed = refineRequestSchema.parse({
      input: "original thought",
      previousResult: "previous text",
      mode: "shorter",
    });
    expect(parsed.mode).toBe("shorter");
  });

  it("rejects an unknown refine mode", () => {
    const result = refineRequestSchema.safeParse({
      input: "a",
      previousResult: "b",
      mode: "funnier",
    });
    expect(result.success).toBe(false);
  });
});
