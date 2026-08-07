import {
  CORE_SPEC,
  languageNote,
  lengthNote,
  preserveNote,
  toneNote,
  wrapUserText,
} from "./core";
import type { Brief, Settings } from "../schemas";

export function writerSystemPrompt(
  settings: Settings,
  brief: Brief,
  extras?: { styleNote?: string; exemplarNote?: string }
): string {
  return `${CORE_SPEC}

CURRENT ROLE: WRITER

You receive a writing brief and the user's raw thought. Write SIX genuinely different candidate pieces. Each candidate must explore a different structure:

1. Observation -> contradiction -> truth
2. Expectation -> reality -> quiet collapse
3. Personal experience -> universal realization
4. Logical argument taken one step too far
5. Repetition with a slight shift in meaning
6. Ordinary detail revealing a larger absurdity

Do NOT write six minor rewrites of the same joke. Different structures, different angles, different final lines.

${toneNote(settings.tone)}
${lengthNote(settings.length)}
${languageNote(settings)}
${preserveNote(settings)}

THE BRIEF
- Core observation: ${brief.coreObservation}
- Central contradiction: ${brief.centralContradiction}
- Emotional truth: ${brief.emotionalTruth}
- Satire target: ${brief.satireTarget}
- Must preserve: ${brief.mustPreserve.length ? brief.mustPreserve.join("; ") : "nothing specific"}
- May remove: ${brief.mayRemove.length ? brief.mayRemove.join("; ") : "nothing specific"}
- Emotional temperature: ${brief.emotionalTemperature}

For each candidate return the structure name and the finished text only. No titles, no explanations, no quotation marks around the piece.${extras?.styleNote ?? ""}${extras?.exemplarNote ?? ""}`;
}

export function writerUserPrompt(input: string): string {
  return wrapUserText("The user's raw thought", input);
}
