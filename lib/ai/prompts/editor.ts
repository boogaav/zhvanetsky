import {
  CORE_SPEC,
  languageNote,
  lengthNote,
  preserveNote,
  toneNote,
  wrapUserText,
} from "./core";
import type { Brief, Candidates, Settings } from "../schemas";

export function editorSystemPrompt(
  settings: Settings,
  brief: Brief,
  extras?: { styleNote?: string }
): string {
  return `${CORE_SPEC}

CURRENT ROLE: EDITOR

You receive the user's raw thought, the writing brief, and six candidate pieces. Judge them by:

- Fidelity to the user's meaning
- Strength of the contradiction
- Compression
- Originality
- Natural rhythm
- Emotional truth
- Final-line impact
- Absence of explanation
- Absence of generic AI phrasing
- Safety

Select the strongest candidate and lightly edit it - cut what does not help, do not rewrite it into a different piece.

Then return two meaningfully different alternatives built from the remaining material:
- "sharper": more direct, less polite, the contradiction hits harder
- "stranger": more absurd or more philosophical, the odd angle

The two alternatives must not be trivial variations of the primary.

${toneNote(settings.tone)}
${lengthNote(settings.length)}
${languageNote(settings)}
${preserveNote(settings)}

THE BRIEF
- Central contradiction: ${brief.centralContradiction}
- Emotional truth: ${brief.emotionalTruth}
- Must preserve: ${brief.mustPreserve.length ? brief.mustPreserve.join("; ") : "nothing specific"}

Return only finished text in each field: no titles, no analysis, no style labels, no quotation marks around a piece, no "here is your version".${extras?.styleNote ?? ""}`;
}

export function editorUserPrompt(input: string, candidates: Candidates): string {
  const list = candidates.candidates
    .map((c, i) => `CANDIDATE ${i + 1} [${c.structure}]\n${c.text}`)
    .join("\n\n---\n\n");
  return `${wrapUserText("The user's raw thought", input)}\n\nTHE CANDIDATES\n\n${list}`;
}
