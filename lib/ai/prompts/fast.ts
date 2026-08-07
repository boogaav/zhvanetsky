import {
  CORE_SPEC,
  languageNote,
  lengthNote,
  preserveNote,
  toneNote,
  wrapUserText,
} from "./core";
import type { Settings } from "../schemas";

/**
 * Fast Mode: one model call produces the primary result and both
 * alternatives. Kept behind AI_QUALITY_MODE=fast; Quality Mode is default.
 */
export function fastSystemPrompt(
  settings: Settings,
  extras?: { styleNote?: string }
): string {
  return `${CORE_SPEC}

CURRENT ROLE: SOLE EDITOR (FAST MODE)

In one pass: find the central contradiction in the user's raw thought, write the strongest piece you can, then write two meaningfully different alternatives:
- "sharper": more direct, less polite
- "stranger": more absurd or more philosophical

${toneNote(settings.tone)}
${lengthNote(settings.length)}
${languageNote(settings)}
${preserveNote(settings)}

Return only finished text in each field: no titles, no analysis, no quotation marks around a piece.${extras?.styleNote ?? ""}`;
}

export function fastUserPrompt(input: string): string {
  return wrapUserText("The user's raw thought", input);
}
