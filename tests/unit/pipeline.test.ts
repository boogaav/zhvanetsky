import { describe, expect, it } from "vitest";
import { DemoProvider, detectLanguage } from "@/lib/ai/demo-provider";
import { generate, refine } from "@/lib/ai/pipeline";
import {
  briefSchema,
  candidatesSchema,
  editorResultSchema,
  settingsSchema,
} from "@/lib/ai/schemas";
import { observerSystemPrompt, observerUserPrompt } from "@/lib/ai/prompts/observer";

const provider = new DemoProvider();
const settings = settingsSchema.parse({});

describe("language selection", () => {
  it("detects English, Russian and Ukrainian", () => {
    expect(detectLanguage("I bought a kettle")).toBe("en");
    expect(detectLanguage("Я купил чайник")).toBe("ru");
    expect(detectLanguage("Я купив чайник, і він мій")).toBe("uk");
  });

  it("uses the detected language when language=auto", async () => {
    const res = await generate(
      provider,
      "Мы расстались, потому что молчали.",
      settings,
      "quality"
    );
    expect(res.language).toBe("ru");
    expect(res.result).toMatch(/[а-яА-Я]/);
  });

  it("honors an explicit output language", async () => {
    const res = await generate(
      provider,
      "We broke up because we never talked.",
      { ...settings, language: "uk" },
      "quality"
    );
    expect(res.language).toBe("uk");
    expect(res.result).toMatch(/[іїєґа-я]/);
  });
});

describe("provider response parsing", () => {
  it("demo brief validates against the brief schema", async () => {
    const raw = await provider.completeJson({
      system: observerSystemPrompt(settings),
      user: observerUserPrompt("I love my job but I cry on Sundays."),
      schemaName: "writing_brief",
      jsonSchema: {},
    });
    expect(briefSchema.safeParse(raw).success).toBe(true);
  });

  it("demo candidates validate and are genuinely different", async () => {
    const raw = await provider.completeJson({
      system: "Length: a short post",
      user: "<user_text>\nI love my job but I cry on Sundays. It is fine.\n</user_text>",
      schemaName: "candidates",
      jsonSchema: {},
    });
    const parsed = candidatesSchema.parse(raw);
    expect(parsed.candidates.length).toBe(6);
    const unique = new Set(parsed.candidates.map((c) => c.text));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("demo editor result validates with two alternatives", async () => {
    const raw = await provider.completeJson({
      system: "Length: a short post",
      user: "<user_text>\nI love my job but I cry on Sundays.\n</user_text>",
      schemaName: "editor_result",
      jsonSchema: {},
    });
    const parsed = editorResultSchema.parse(raw);
    expect(parsed.alternatives.map((a) => a.mode).sort()).toEqual([
      "sharper",
      "stranger",
    ]);
  });
});

describe("full pipeline", () => {
  it("is deterministic for the same input", async () => {
    const a = await generate(provider, "Same input, same day.", settings, "quality");
    const b = await generate(provider, "Same input, same day.", settings, "quality");
    expect(a.result).toBe(b.result);
  });

  it("returns schema-shaped public output without internal briefs", async () => {
    const res = await generate(provider, "My kettle is smart now.", settings, "quality");
    expect(res).not.toHaveProperty("brief");
    expect(res).not.toHaveProperty("candidates");
    expect(res.promptVersion).toBe("satire-v1");
    expect(res.provider).toBe("demo");
    expect(res.safety).toBe(false);
  });

  it("interrupts the comedy pipeline for credible crisis input", async () => {
    const res = await generate(
      provider,
      "I want to kill myself and I mean it.",
      settings,
      "quality"
    );
    expect(res.safety).toBe(true);
    expect(res.alternatives).toHaveLength(0);
    expect(res.result).not.toMatch(/franchis/i);
    expect(res.result.toLowerCase()).toContain("not going to turn this");
  });

  it("does not treat figures of speech as crisis", async () => {
    const res = await generate(
      provider,
      "This job is killing me, slowly, with meetings.",
      settings,
      "quality"
    );
    expect(res.safety).toBe(false);
  });
});

describe("refinement behavior", () => {
  const input = "I bought a smart kettle to save time. The old kettle just boiled.";

  async function makeResult() {
    return generate(provider, input, settings, "quality");
  }

  it("shorter cuts at least 25% and keeps the final line", async () => {
    const first = await makeResult();
    const refined = await refine(provider, {
      input,
      previousResult: first.result,
      mode: "shorter",
      settings,
    });
    expect(refined.result.length).toBeLessThanOrEqual(
      Math.ceil(first.result.length * 0.75)
    );
    const lastLine = first.result.split("\n").filter(Boolean).pop();
    expect(refined.result).toContain(lastLine);
  });

  it("another-angle returns a genuinely different text", async () => {
    const first = await makeResult();
    const refined = await refine(provider, {
      input,
      previousResult: first.result,
      mode: "another-angle",
      settings,
    });
    expect(refined.result).not.toBe(first.result);
  });

  it("every refine mode produces non-empty output", async () => {
    const first = await makeResult();
    for (const mode of [
      "sharper",
      "shorter",
      "absurd",
      "philosophical",
      "human",
      "another-angle",
    ] as const) {
      const refined = await refine(provider, {
        input,
        previousResult: first.result,
        mode,
        settings,
      });
      expect(refined.result.trim().length).toBeGreaterThan(0);
    }
  });
});
