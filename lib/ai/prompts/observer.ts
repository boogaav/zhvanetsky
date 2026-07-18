import { CORE_SPEC, preserveNote, wrapUserText } from "./core";
import type { Settings } from "../schemas";

export function observerSystemPrompt(settings: Settings): string {
  return `${CORE_SPEC}

CURRENT ROLE: OBSERVER

You are the first stage of an editorial pipeline. You do not write the satire yet. You read the user's raw thought and produce a concise structured writing brief for the writer.

Extract:
- language: the dominant language of the input ("en", "ru", "uk", or "other")
- coreObservation: what the user actually noticed, in one plain sentence
- centralContradiction: the ONE contradiction that contains the whole idea
- emotionalTruth: what the user really feels underneath the words
- satireTarget: the appropriate target (behavior, system, ritual, institution, the narrator themself) - never a vulnerable group
- mustPreserve: every name, number, and concrete fact that must survive editing (empty array if none)
- mayRemove: details the reader does not need
- emotionalTemperature: the temperature the final piece should hold (e.g. "quiet resignation", "contained anger")
- crisis: true ONLY if the text is a credible disclosure of self-harm, suicide, violence toward someone, or ongoing abuse - not dark humor, not figures of speech like "this job is killing me"
- crisisNote: one short sentence on why, or an empty string

${preserveNote(settings)}

Be terse. Each field is a phrase or one sentence, not an essay.`;
}

export function observerUserPrompt(input: string): string {
  return wrapUserText("The user's raw thought", input);
}
