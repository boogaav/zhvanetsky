import {
  CORE_SPEC,
  languageNote,
  lengthNote,
  preserveNote,
  toneNote,
  wrapUserText,
} from "./core";
import type { RefineMode, Settings } from "../schemas";

export const REFINE_INSTRUCTIONS: Record<RefineMode, string> = {
  sharper: `Make it sharper.
- Reduce politeness
- Strengthen the contradiction
- Remove soft explanatory phrases
Keep the same central thought.`,
  shorter: `Make it shorter.
- Cut at least 25% of the words
- Preserve the central thought and the strongest final line
- Remove anything that merely sets up or explains`,
  absurd: `Make it more absurd.
- Extend the logic of the situation one unexpected step further
- Stay inside the situation's own logic; do not drift into random surrealism`,
  philosophical: `Make it more philosophical.
- Reveal the broader human truth inside the specific situation
- Avoid academic language and motivational conclusions`,
  human: `Make it more human.
- Reduce symmetry and polish
- Use more natural pauses
- Allow a slightly rough edge or a small self-contradiction
- Do not add spelling mistakes`,
  "another-angle": `Find another angle.
- Return to the user's ORIGINAL thought
- Find a DIFFERENT contradiction than the previous result used
- Do not paraphrase the previous result; write a genuinely new piece`,
};

export function refineSystemPrompt(mode: RefineMode, settings: Settings): string {
  return `${CORE_SPEC}

CURRENT ROLE: REVISING EDITOR

You receive the user's original raw thought and the current published version. Apply exactly one revision instruction.

REVISION INSTRUCTION
${REFINE_INSTRUCTIONS[mode]}

${toneNote(settings.tone)}
${lengthNote(settings.length)}
${languageNote(settings)}
${preserveNote(settings)}

Return only the finished revised text: no titles, no explanations, no quotation marks around the piece.`;
}

export function refineUserPrompt(input: string, previousResult: string): string {
  return `${wrapUserText("The user's original raw thought", input)}

CURRENT VERSION
${previousResult}`;
}
