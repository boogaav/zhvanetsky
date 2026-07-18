/**
 * Central product configuration.
 * The product name lives here (and in env) so it can be renamed
 * before public launch without touching the rest of the codebase.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Zhvanetsky";

export const APP_TAGLINE = "Say it normally first.";
export const APP_SUBTAGLINE = "The agent will find the contradiction.";

export const DISCLAIMER =
  "Independent AI writing experiment. Not affiliated with the Zhvanetsky estate.";

export const MAX_INPUT_LENGTH = 8000;

/** Hard timeout for a full quality-mode generation (three model calls). */
export const GENERATE_TIMEOUT_MS = 90_000;
/** Hard timeout for a single refinement call. */
export const REFINE_TIMEOUT_MS = 45_000;
