/**
 * Evaluation runner: `npm run evals`
 *
 * Runs every fixture through the full quality pipeline with the
 * configured provider (demo by default; OpenAI when OPENAI_API_KEY and
 * OPENAI_MODEL are set) and applies the deterministic rubric checks.
 *
 * Optional model-based judging: set EVALS_MODEL_JUDGE=1 with an OpenAI
 * key. Its scores are advisory and reported separately - never treated
 * as ground truth.
 */
import fixturesJson from "./fixtures.json";
import { generate } from "../lib/ai/pipeline";
import { getProvider } from "../lib/ai";
import { settingsSchema, type Settings } from "../lib/ai/schemas";
import { completeStructured } from "../lib/ai/structured";
import { z } from "zod";
import { runAllChecks } from "./rubric";

interface Fixture {
  id: string;
  topic: string;
  language: string;
  input: string;
  mustPreserve: string[];
  settings: Partial<Settings>;
}

const judgeSchema = z.object({
  meaningPreserved: z.boolean(),
  oneClearContradiction: z.boolean(),
  soundsNatural: z.boolean(),
  finalLineMeaningful: z.boolean(),
  comment: z.string(),
});

const judgeJsonSchema = {
  type: "object",
  properties: {
    meaningPreserved: { type: "boolean" },
    oneClearContradiction: { type: "boolean" },
    soundsNatural: { type: "boolean" },
    finalLineMeaningful: { type: "boolean" },
    comment: { type: "string" },
  },
  required: [
    "meaningPreserved",
    "oneClearContradiction",
    "soundsNatural",
    "finalLineMeaningful",
    "comment",
  ],
  additionalProperties: false,
} as const;

async function main() {
  const fixtures = fixturesJson as Fixture[];
  const provider = getProvider();
  const useJudge =
    process.env.EVALS_MODEL_JUDGE === "1" && provider.name === "openai";

  console.log(
    `\nRunning ${fixtures.length} fixtures through the quality pipeline (provider: ${provider.name})\n`
  );

  let passed = 0;
  const failedIds: string[] = [];

  for (const fixture of fixtures) {
    const settings = settingsSchema.parse({
      tone: "sharp",
      length: "short",
      language: "auto",
      preserveFacts: true,
      ...fixture.settings,
    });

    try {
      const result = await generate(
        provider,
        fixture.input,
        settings,
        "quality"
      );

      const checks = runAllChecks({
        primary: result.result,
        alternatives: result.alternatives,
        length: settings.length,
        mustPreserve: fixture.mustPreserve,
        preserveFacts: settings.preserveFacts,
      });

      const failures = checks.filter((c) => !c.ok);
      if (failures.length === 0) {
        passed++;
        process.stdout.write(`  PASS  ${fixture.id}\n`);
      } else {
        failedIds.push(fixture.id);
        process.stdout.write(
          `  FAIL  ${fixture.id}  ${failures
            .map((f) => `${f.name}${f.detail ? ` (${f.detail})` : ""}`)
            .join("; ")}\n`
        );
      }

      if (useJudge) {
        const verdict = await completeStructured(
          provider,
          {
            system:
              "You judge short satirical texts. Answer strictly about the given result. Be skeptical; this is advisory review, not praise.",
            user: `ORIGINAL THOUGHT:\n${fixture.input}\n\nRESULT:\n${result.result}\n\nJudge: did it preserve the central meaning, find one clear contradiction, sound natural, and end on a meaningful final line?`,
            schemaName: "judge_verdict",
            jsonSchema: judgeJsonSchema,
          },
          judgeSchema
        );
        const score = [
          verdict.meaningPreserved,
          verdict.oneClearContradiction,
          verdict.soundsNatural,
          verdict.finalLineMeaningful,
        ].filter(Boolean).length;
        process.stdout.write(
          `        judge(advisory): ${score}/4 - ${verdict.comment}\n`
        );
      }
    } catch (err) {
      failedIds.push(fixture.id);
      process.stdout.write(
        `  FAIL  ${fixture.id}  pipeline error: ${(err as Error).message}\n`
      );
    }
  }

  const rate = Math.round((passed / fixtures.length) * 100);
  console.log(`\nPass rate: ${passed}/${fixtures.length} (${rate}%)`);
  if (failedIds.length) {
    console.log(`Failed fixtures: ${failedIds.join(", ")}`);
  }
  process.exit(failedIds.length ? 1 : 0);
}

main().catch((err) => {
  console.error("Eval run crashed:", err);
  process.exit(1);
});
