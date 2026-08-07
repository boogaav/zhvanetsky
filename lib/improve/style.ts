import { readStyleState } from "./store";
import type { StyleVersion } from "./types";

/**
 * Learned style rules are ADDITIVE ONLY: they are appended to the stage
 * prompts under the immutable core spec and can never weaken it. The
 * validator below rejects anything that smells like an instruction
 * override or reintroduces banned phrasing.
 */

const FORBIDDEN_SUBSTRINGS = [
  "ignore previous",
  "ignore the above",
  "disregard",
  "system prompt",
  "you are now",
  "new instructions",
  "reveal",
  // banned output clichés must not come back as "rules"
  "plot twist",
  "let that sink in",
  "here's the thing",
  "at the end of the day",
];

const MAX_RULE_LENGTH = 200;
const MAX_RULES = 8;

export function validateStyleRules(rules: string[]): {
  ok: boolean;
  reason?: string;
} {
  if (!Array.isArray(rules) || rules.length === 0)
    return { ok: false, reason: "empty rules" };
  if (rules.length > MAX_RULES)
    return { ok: false, reason: `more than ${MAX_RULES} rules` };
  for (const rule of rules) {
    if (typeof rule !== "string" || !rule.trim())
      return { ok: false, reason: "blank rule" };
    if (rule.length > MAX_RULE_LENGTH)
      return { ok: false, reason: "rule too long" };
    const lower = rule.toLowerCase();
    const hit = FORBIDDEN_SUBSTRINGS.find((s) => lower.includes(s));
    if (hit) return { ok: false, reason: `forbidden content: "${hit}"` };
  }
  return { ok: true };
}

/** Prompt fragment for a style version; empty string when none. */
export function styleAddendum(style: StyleVersion | null): string {
  if (!style || !style.rules.length) return "";
  return `

LEARNED STYLE NOTES (voice v${style.version}, distilled from reader reactions)
Apply these WITHIN all rules above — they refine the voice and never override the core spec or safety rules:
${style.rules.map((r) => `- ${r}`).join("\n")}`;
}

/** Active style for the running server (read per request; tiny file). */
export function activeStyle(): StyleVersion | null {
  try {
    return readStyleState().active;
  } catch {
    return null;
  }
}

/** Public prompt-version tag, e.g. "satire-v1+s3". */
export function taggedPromptVersion(base: string, style: StyleVersion | null): string {
  return style ? `${base}+s${style.version}` : base;
}
