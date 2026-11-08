import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Request settings (client → server)                                  */
/* ------------------------------------------------------------------ */

export const TONES = ["gentle", "sharp", "brutal"] as const;
export const LENGTHS = ["one-liner", "short", "mini-monologue"] as const;
export const LANGUAGES = ["auto", "en", "ru", "uk"] as const;
export const REFINE_MODES = [
  "sharper",
  "shorter",
  "absurd",
  "philosophical",
  "human",
  "another-angle",
] as const;

export type Tone = (typeof TONES)[number];
export type Length = (typeof LENGTHS)[number];
export type Language = (typeof LANGUAGES)[number];
export type RefineMode = (typeof REFINE_MODES)[number];

export const settingsSchema = z.object({
  tone: z.enum(TONES).default("sharp"),
  length: z.enum(LENGTHS).default("short"),
  language: z.enum(LANGUAGES).default("auto"),
  preserveFacts: z.boolean().default(true),
});
export type Settings = z.infer<typeof settingsSchema>;

export const generateRequestSchema = z.object({
  input: z.string().min(1).max(8000),
  settings: settingsSchema.default({
    tone: "sharp",
    length: "short",
    language: "auto",
    preserveFacts: true,
  }),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const refineRequestSchema = z.object({
  input: z.string().min(1).max(8000),
  previousResult: z.string().min(1).max(8000),
  mode: z.enum(REFINE_MODES),
  settings: settingsSchema.default({
    tone: "sharp",
    length: "short",
    language: "auto",
    preserveFacts: true,
  }),
});
export type RefineRequest = z.infer<typeof refineRequestSchema>;

/* ------------------------------------------------------------------ */
/* Model output schemas (validated server-side, never sent to client)  */
/* ------------------------------------------------------------------ */

/**
 * NOTE ON JSON SCHEMAS: OpenAI strict structured outputs require every
 * property to be required and additionalProperties:false, and reject
 * some validation keywords. So each zod schema below has a hand-written
 * JSON-schema twin without count constraints; counts are enforced by zod
 * after parsing.
 */

export const briefSchema = z.object({
  language: z.enum(["en", "ru", "uk", "other"]),
  coreObservation: z.string(),
  centralContradiction: z.string(),
  emotionalTruth: z.string(),
  satireTarget: z.string(),
  mustPreserve: z.array(z.string()),
  mayRemove: z.array(z.string()),
  emotionalTemperature: z.string(),
  crisis: z.boolean(),
  crisisNote: z.string(),
});
export type Brief = z.infer<typeof briefSchema>;

export const briefJsonSchema = {
  type: "object",
  properties: {
    language: { type: "string", enum: ["en", "ru", "uk", "other"] },
    coreObservation: { type: "string" },
    centralContradiction: { type: "string" },
    emotionalTruth: { type: "string" },
    satireTarget: { type: "string" },
    mustPreserve: { type: "array", items: { type: "string" } },
    mayRemove: { type: "array", items: { type: "string" } },
    emotionalTemperature: { type: "string" },
    crisis: { type: "boolean" },
    crisisNote: { type: "string" },
  },
  required: [
    "language",
    "coreObservation",
    "centralContradiction",
    "emotionalTruth",
    "satireTarget",
    "mustPreserve",
    "mayRemove",
    "emotionalTemperature",
    "crisis",
    "crisisNote",
  ],
  additionalProperties: false,
} as const;

export const candidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        structure: z.string(),
        text: z.string().min(1),
      })
    )
    .min(3)
    .max(8),
});
export type Candidates = z.infer<typeof candidatesSchema>;

export const candidatesJsonSchema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          structure: { type: "string" },
          text: { type: "string" },
        },
        required: ["structure", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

export const editorResultSchema = z.object({
  primary: z.string().min(1),
  alternatives: z
    .array(
      z.object({
        mode: z.enum(["sharper", "stranger"]),
        text: z.string().min(1),
      })
    )
    .length(2),
});
export type EditorResult = z.infer<typeof editorResultSchema>;

export const editorResultJsonSchema = {
  type: "object",
  properties: {
    primary: { type: "string" },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["sharper", "stranger"] },
          text: { type: "string" },
        },
        required: ["mode", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["primary", "alternatives"],
  additionalProperties: false,
} as const;

export const refineResultSchema = z.object({
  text: z.string().min(1),
});
export type RefineResult = z.infer<typeof refineResultSchema>;

export const refineResultJsonSchema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
} as const;

/* ------------------------------------------------------------------ */
/* Public API response (server → client)                               */
/* ------------------------------------------------------------------ */

export const generationResponseSchema = z.object({
  id: z.string(),
  language: z.string(),
  result: z.string(),
  alternatives: z.array(
    z.object({
      mode: z.enum(["sharper", "stranger"]),
      text: z.string(),
      /** Wall publish token: HMAC of the text, set by the API route. */
      signature: z.string().optional(),
    })
  ),
  promptVersion: z.string(),
  provider: z.string(),
  /** True when the input was a credible crisis disclosure and the
   *  comedy pipeline was intentionally skipped. */
  safety: z.boolean(),
  signature: z.string().optional(),
});
export type GenerationResponse = z.infer<typeof generationResponseSchema>;

export const refineResponseSchema = z.object({
  id: z.string(),
  result: z.string(),
  promptVersion: z.string(),
  provider: z.string(),
  signature: z.string().optional(),
});
export type RefineResponse = z.infer<typeof refineResponseSchema>;
