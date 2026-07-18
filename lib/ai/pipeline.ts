import { randomUUID } from "crypto";
import type { AIProvider } from "./provider";
import { completeStructured } from "./structured";
import {
  Brief,
  briefJsonSchema,
  briefSchema,
  Candidates,
  candidatesJsonSchema,
  candidatesSchema,
  editorResultJsonSchema,
  editorResultSchema,
  GenerationResponse,
  RefineRequest,
  RefineResponse,
  refineResultJsonSchema,
  refineResultSchema,
  Settings,
} from "./schemas";
import { observerSystemPrompt, observerUserPrompt } from "./prompts/observer";
import { writerSystemPrompt, writerUserPrompt } from "./prompts/writer";
import { editorSystemPrompt, editorUserPrompt } from "./prompts/editor";
import { refineSystemPrompt, refineUserPrompt } from "./prompts/refine";
import { fastSystemPrompt, fastUserPrompt } from "./prompts/fast";
import { PROMPT_VERSION } from "./prompts/versions";
import { safetyResponse } from "./safety";

export type QualityMode = "quality" | "fast";

/**
 * Quality Mode (default): Observer -> Writer -> Editor.
 * Fast Mode (AI_QUALITY_MODE=fast): one call for primary + alternatives.
 * Internal briefs and candidates never leave the server.
 */
export async function generate(
  provider: AIProvider,
  input: string,
  settings: Settings,
  mode: QualityMode,
  signal?: AbortSignal
): Promise<GenerationResponse> {
  if (mode === "fast") {
    const result = await completeStructured(
      provider,
      {
        system: fastSystemPrompt(settings),
        user: fastUserPrompt(input),
        schemaName: "fast_result",
        jsonSchema: editorResultJsonSchema,
        signal,
      },
      editorResultSchema
    );
    return {
      id: randomUUID(),
      language: settings.language === "auto" ? "auto" : settings.language,
      result: result.primary.trim(),
      alternatives: result.alternatives.map((a) => ({
        mode: a.mode,
        text: a.text.trim(),
      })),
      promptVersion: PROMPT_VERSION,
      provider: provider.name,
      safety: false,
    };
  }

  // Stage 1: Observer
  const brief: Brief = await completeStructured(
    provider,
    {
      system: observerSystemPrompt(settings),
      user: observerUserPrompt(input),
      schemaName: "writing_brief",
      jsonSchema: briefJsonSchema,
      signal,
    },
    briefSchema
  );

  if (brief.crisis) {
    const lang =
      settings.language !== "auto" ? settings.language : brief.language;
    return {
      id: randomUUID(),
      language: lang,
      result: safetyResponse(lang),
      alternatives: [],
      promptVersion: PROMPT_VERSION,
      provider: provider.name,
      safety: true,
    };
  }

  // Stage 2: Writer
  const candidates: Candidates = await completeStructured(
    provider,
    {
      system: writerSystemPrompt(settings, brief),
      user: writerUserPrompt(input),
      schemaName: "candidates",
      jsonSchema: candidatesJsonSchema,
      maxOutputTokens: 6000,
      signal,
    },
    candidatesSchema
  );

  // Stage 3: Editor
  const edited = await completeStructured(
    provider,
    {
      system: editorSystemPrompt(settings, brief),
      user: editorUserPrompt(input, candidates),
      schemaName: "editor_result",
      jsonSchema: editorResultJsonSchema,
      signal,
    },
    editorResultSchema
  );

  const language =
    settings.language !== "auto" ? settings.language : brief.language;

  return {
    id: randomUUID(),
    language,
    result: edited.primary.trim(),
    alternatives: edited.alternatives.map((a) => ({
      mode: a.mode,
      text: a.text.trim(),
    })),
    promptVersion: PROMPT_VERSION,
    provider: provider.name,
    safety: false,
  };
}

export async function refine(
  provider: AIProvider,
  request: RefineRequest,
  signal?: AbortSignal
): Promise<RefineResponse> {
  const result = await completeStructured(
    provider,
    {
      system: refineSystemPrompt(request.mode, request.settings),
      user: refineUserPrompt(request.input, request.previousResult),
      schemaName: "refine_result",
      jsonSchema: refineResultJsonSchema,
      signal,
    },
    refineResultSchema
  );
  return {
    id: randomUUID(),
    result: result.text.trim(),
    promptVersion: PROMPT_VERSION,
    provider: provider.name,
  };
}
