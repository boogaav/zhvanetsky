import type { z } from "zod";
import { AIProvider, AIProviderError, JsonCompletionParams } from "./provider";

/**
 * Runs a structured completion and validates it with zod.
 * On validation failure, retries ONCE with a repair instruction.
 * If it still fails, throws a public-safe invalid_response error.
 */
export async function completeStructured<T>(
  provider: AIProvider,
  params: JsonCompletionParams,
  schema: z.ZodType<T>
): Promise<T> {
  const first = await provider.completeJson(params);
  const parsed = schema.safeParse(first);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");

  const repaired = await provider.completeJson({
    ...params,
    user: `${params.user}\n\nREPAIR: Your previous response did not match the required schema (${issues}). Return corrected JSON that satisfies the schema exactly.`,
  });
  const second = schema.safeParse(repaired);
  if (second.success) return second.data;

  throw new AIProviderError(
    "invalid_response",
    "The model returned an unusable response twice."
  );
}
