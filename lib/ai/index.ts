import type { AIProvider } from "./provider";
import { OpenAIProvider } from "./openai-provider";
import { DemoProvider } from "./demo-provider";
import type { QualityMode } from "./pipeline";

let cached: AIProvider | null = null;

/**
 * Provider selection:
 * - AI_PROVIDER=demo forces the deterministic demo provider.
 * - AI_PROVIDER=openai (default) uses OpenAI when both OPENAI_API_KEY and
 *   OPENAI_MODEL are set (the model name is never hardcoded); otherwise it
 *   falls back to demo, and every response is labeled with the provider.
 */
export function getProvider(): AIProvider {
  if (cached) return cached;
  const requested = process.env.AI_PROVIDER ?? "openai";
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (requested === "openai" && apiKey && model) {
    cached = new OpenAIProvider(apiKey, model);
  } else {
    cached = new DemoProvider();
  }
  return cached;
}

export function getQualityMode(): QualityMode {
  return process.env.AI_QUALITY_MODE === "fast" ? "fast" : "quality";
}

/** Test hook. */
export function resetProviderCache(): void {
  cached = null;
}
