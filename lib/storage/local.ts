import type { RefineMode, Settings } from "../ai/schemas";

/**
 * All persistence is local to the browser. Nothing here is uploaded.
 * Only non-sensitive preferences and the user's own history/feedback.
 */

const HISTORY_KEY = "zh.history.v1";
const PREFS_KEY = "zh.prefs.v1";
const FEEDBACK_KEY = "zh.feedback.v1";
const HISTORY_LIMIT = 20;
const FEEDBACK_LIMIT = 200;

export interface HistoryEntry {
  id: string;
  input: string;
  result: string;
  alternatives: { mode: string; text: string; signature?: string }[];
  settings: Settings;
  provider: string;
  /** Wall publish token for `result`; absent on entries saved before the Wall. */
  signature?: string;
  createdAt: number;
}

export interface Prefs {
  settings: Settings;
  /** Counts per refinement mode, to surface the most-used one. */
  refineCounts: Partial<Record<RefineMode, number>>;
  /** Opt-in: send anonymous ratings/copies so the editor can learn.
   *  Off by default; nothing leaves the browser until enabled. */
  shareFeedback: boolean;
}

export interface FeedbackEntry {
  promptVersion: string;
  settings: Settings;
  result: string;
  value: "up" | "down";
  createdAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  tone: "sharp",
  length: "short",
  language: "auto",
  preserveFacts: true,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function available(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/* ---------------- history ---------------- */

export function loadHistory(): HistoryEntry[] {
  if (!available()) return [];
  const list = safeParse<HistoryEntry[]>(
    window.localStorage.getItem(HISTORY_KEY),
    []
  );
  return Array.isArray(list) ? list : [];
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const list = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
  if (available()) {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }
  return list;
}

export function clearHistory(): void {
  if (available()) window.localStorage.removeItem(HISTORY_KEY);
}

/* ---------------- preferences ---------------- */

export function loadPrefs(): Prefs {
  const fallback: Prefs = {
    settings: DEFAULT_SETTINGS,
    refineCounts: {},
    shareFeedback: false,
  };
  if (!available()) return fallback;
  const prefs = safeParse<Prefs>(window.localStorage.getItem(PREFS_KEY), fallback);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(prefs.settings ?? {}) },
    refineCounts: prefs.refineCounts ?? {},
    shareFeedback: prefs.shareFeedback === true,
  };
}

export function savePrefs(prefs: Prefs): void {
  if (available()) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function bumpRefineCount(prefs: Prefs, mode: RefineMode): Prefs {
  const next: Prefs = {
    ...prefs,
    refineCounts: {
      ...prefs.refineCounts,
      [mode]: (prefs.refineCounts[mode] ?? 0) + 1,
    },
  };
  savePrefs(next);
  return next;
}

export function favoriteRefineMode(prefs: Prefs): RefineMode | null {
  const entries = Object.entries(prefs.refineCounts) as [RefineMode, number][];
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] > 1 ? entries[0][0] : null;
}

/* ---------------- feedback ---------------- */

export function loadFeedback(): FeedbackEntry[] {
  if (!available()) return [];
  return safeParse<FeedbackEntry[]>(
    window.localStorage.getItem(FEEDBACK_KEY),
    []
  );
}

export function addFeedback(entry: FeedbackEntry): void {
  const list = [entry, ...loadFeedback()].slice(0, FEEDBACK_LIMIT);
  if (available()) {
    window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list));
  }
}

/** Developer-only export, exposed as window.zhExportFeedback(). */
export function exportFeedbackJson(): string {
  return JSON.stringify(loadFeedback(), null, 2);
}
