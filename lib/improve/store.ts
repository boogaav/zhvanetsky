import fs from "fs";
import path from "path";
import {
  FeedbackEvent,
  feedbackEventSchema,
  StyleState,
  StyleVersion,
} from "./types";

/**
 * File-backed store for feedback events and the learned style state.
 * Local dev: ./.improve-data (gitignored). Production: a Fly volume via
 * IMPROVE_DATA_DIR=/data. Deliberately no database in v1.
 */

const FEEDBACK_FILE = "feedback.jsonl";
const STYLE_FILE = "style.json";
const MAX_FEEDBACK_BYTES = 5 * 1024 * 1024;

export function dataDir(): string {
  return process.env.IMPROVE_DATA_DIR ?? path.join(process.cwd(), ".improve-data");
}

function ensureDir(): string {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/* ---------------- feedback events ---------------- */

export function appendFeedback(event: FeedbackEvent): void {
  const dir = ensureDir();
  const file = path.join(dir, FEEDBACK_FILE);
  // Rotate once the log gets big; one previous generation is enough.
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_FEEDBACK_BYTES) {
      fs.renameSync(file, path.join(dir, `${FEEDBACK_FILE}.1`));
    }
  } catch {
    // Rotation is best-effort.
  }
  fs.appendFileSync(file, JSON.stringify(event) + "\n");
}

export function readFeedback(): FeedbackEvent[] {
  const file = path.join(dataDir(), FEEDBACK_FILE);
  if (!fs.existsSync(file)) return [];
  const events: FeedbackEvent[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = feedbackEventSchema.safeParse(JSON.parse(line));
      if (parsed.success) events.push(parsed.data);
    } catch {
      // Skip corrupted lines rather than failing the whole read.
    }
  }
  return events;
}

/* ---------------- style state ---------------- */

export function readStyleState(): StyleState {
  const file = path.join(dataDir(), STYLE_FILE);
  if (!fs.existsSync(file)) return { active: null, history: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as StyleState;
    if (parsed && typeof parsed === "object" && "active" in parsed) {
      return { active: parsed.active ?? null, history: parsed.history ?? [] };
    }
  } catch {
    // Corrupt style file -> behave as if unstyled; history is lost but
    // the base prompt is always a safe fallback.
  }
  return { active: null, history: [] };
}

export function writeStyleState(state: StyleState): void {
  const dir = ensureDir();
  fs.writeFileSync(
    path.join(dir, STYLE_FILE),
    JSON.stringify(state, null, 2)
  );
}

export function promoteStyle(version: StyleVersion): StyleState {
  const state = readStyleState();
  const next: StyleState = {
    active: version,
    history: [...state.history, version],
  };
  writeStyleState(next);
  return next;
}

export function rollbackStyle(): StyleState {
  const state = readStyleState();
  const history = [...state.history];
  history.pop(); // drop current champion
  const next: StyleState = {
    active: history.length ? history[history.length - 1] : null,
    history,
  };
  writeStyleState(next);
  return next;
}

/** Test hook: point the store somewhere else. */
export function withDataDir<T>(dir: string, fn: () => T): T {
  const prev = process.env.IMPROVE_DATA_DIR;
  process.env.IMPROVE_DATA_DIR = dir;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.IMPROVE_DATA_DIR;
    else process.env.IMPROVE_DATA_DIR = prev;
  }
}
