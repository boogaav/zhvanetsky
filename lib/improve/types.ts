import { z } from "zod";

/**
 * Self-improvement module types.
 *
 * The loop: readers react (thumbs/copies, opt-in) -> the Coach distills
 * style rules from winners vs losers -> a candidate style version is
 * judged pairwise against the current champion on the eval fixtures ->
 * promotion only on a clear win. Every version is kept in history and
 * can be rolled back.
 */

export const FEEDBACK_KINDS = [
  "thumbs_up",
  "thumbs_down",
  "copied",
  // won a "which is funnier?" duel against the user's other versions
  "preferred",
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const feedbackEventSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  /** The generated result only — the user's raw thought is never sent. */
  result: z.string().min(1).max(5000),
  language: z.string().max(10),
  tone: z.string().max(20),
  length: z.string().max(20),
  promptVersion: z.string().max(40),
  ts: z.number().int().positive(),
});
export type FeedbackEvent = z.infer<typeof feedbackEventSchema>;

export const styleRulesSchema = z.object({
  rules: z.array(z.string().min(1)).min(1).max(8),
});

export const styleRulesJsonSchema = {
  type: "object",
  properties: {
    rules: { type: "array", items: { type: "string" } },
  },
  required: ["rules"],
  additionalProperties: false,
} as const;

export const pairwiseVerdictSchema = z.object({
  winner: z.enum(["A", "B"]),
  reason: z.string(),
});

export const pairwiseVerdictJsonSchema = {
  type: "object",
  properties: {
    winner: { type: "string", enum: ["A", "B"] },
    reason: { type: "string" },
  },
  required: ["winner", "reason"],
  additionalProperties: false,
} as const;

export interface StyleVersion {
  version: number;
  rules: string[];
  createdAt: number;
  /** Stats from the promotion run that made this version champion. */
  promotion?: {
    wins: number;
    losses: number;
    ties: number;
    fixtures: number;
    eventsAnalyzed: number;
  };
}

export interface StyleState {
  active: StyleVersion | null;
  history: StyleVersion[];
}
