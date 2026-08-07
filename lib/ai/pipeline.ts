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
import { activeStyle, styleAddendum, taggedPromptVersion } from "../improve/style";
import { exemplarBlock, selectExemplars } from "../improve/exemplars";
import type { StyleVersion } from "../improve/types";

export type QualityMode = "quality" | "fast";

export interface PipelineOptions {
  /** Style override: undefined = active champion, null = no style. */
  style?: StyleVersion | null;
  /** Feed reader-approved exemplars to the Writer (default true). */
  useExemplars?: boolean;
}

function resolveStyle(options?: PipelineOptions): StyleVersion | null {
  return options && "style" in options ? (options.style ?? null) : activeStyle();
}

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
  signal?: AbortSignal,
  options?: PipelineOptions
): Promise<GenerationResponse> {
  const style = resolveStyle(options);
  const styleNote = styleAddendum(style);
  const promptVersion = taggedPromptVersion(PROMPT_VERSION, style);

  if (mode === "fast") {
    const result = await completeStructured(
      provider,
      {
        system: fastSystemPrompt(settings, { styleNote }),
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
      promptVersion,
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
      promptVersion,
      provider: provider.name,
      safety: true,
    };
  }

  const outputLanguage =
    settings.language !== "auto" ? settings.language : brief.language;
  const exemplars =
    options?.useExemplars === false ? [] : selectExemplars(outputLanguage);

  // Stage 2: Writer
  const candidates: Candidates = await completeStructured(
    provider,
    {
      system: writerSystemPrompt(settings, brief, {
        styleNote,
        exemplarNote: exemplarBlock(exemplars),
      }),
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
      system: editorSystemPrompt(settings, brief, { styleNote }),
      user: editorUserPrompt(input, candidates),
      schemaName: "editor_result",
      jsonSchema: editorResultJsonSchema,
      signal,
    },
    editorResultSchema
  );

  return {
    id: randomUUID(),
    language: outputLanguage,
    result: edited.primary.trim(),
    alternatives: edited.alternatives.map((a) => ({
      mode: a.mode,
      text: a.text.trim(),
    })),
    promptVersion,
    provider: provider.name,
    safety: false,
  };
}

export async function refine(
  provider: AIProvider,
  request: RefineRequest,
  signal?: AbortSignal,
  options?: PipelineOptions
): Promise<RefineResponse> {
  const style = resolveStyle(options);
  const result = await completeStructured(
    provider,
    {
      system: refineSystemPrompt(request.mode, request.settings, {
        styleNote: styleAddendum(style),
      }),
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
    promptVersion: taggedPromptVersion(PROMPT_VERSION, style),
    provider: provider.name,
  };
}
