import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { dataDir, readFeedback } from "./store";
import type { FeedbackEvent } from "./types";

/**
 * The Wall: a public, opt-in feed of published pieces that visitors judge
 * in "which is funnier?" duels. Every duel is a clean pairwise preference;
 * pieces carry an Elo rating, and well-judged pieces flow back into the
 * learning loop as up/down signals.
 *
 * Only text this server generated can be published: generate/refine
 * responses carry an HMAC signature per text, verified on publish.
 */

const WALL_FILE = "wall.json";
const MAX_PIECES = 2000;
const START_ELO = 1000;
const K = 24;
/** Duels a piece needs before its rating counts as a learning signal. */
const SIGNAL_MIN_DUELS = 5;
const SIGNAL_MARGIN = 40;

export interface WallPiece {
  id: string;
  text: string;
  language: string;
  elo: number;
  wins: number;
  losses: number;
  createdAt: number;
}

/* ---------------- signatures ---------------- */

// Random fallback only matters locally: signatures then die with the process.
const SECRET =
  process.env.WALL_SECRET ??
  process.env.IMPROVE_ADMIN_TOKEN ??
  randomBytes(32).toString("hex");

export function signText(text: string): string {
  return createHmac("sha256", SECRET).update(text).digest("hex");
}

export function verifyText(text: string, signature: string): boolean {
  const expected = Buffer.from(signText(text), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/* ---------------- storage ---------------- */

const wallFile = () => path.join(dataDir(), WALL_FILE);

export function readWall(): WallPiece[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(wallFile(), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWall(pieces: WallPiece[]): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  // tmp + rename so a crash mid-write never leaves a truncated wall.
  const tmp = `${wallFile()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(pieces));
  fs.renameSync(tmp, wallFile());
}

export function pieceId(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

/** Adds a piece (idempotent per text). Returns the stored piece. */
export function publishPiece(text: string, language: string): WallPiece {
  const pieces = readWall();
  const id = pieceId(text);
  const existing = pieces.find((p) => p.id === id);
  if (existing) return existing;
  const piece: WallPiece = {
    id,
    text: text.trim(),
    language,
    elo: START_ELO,
    wins: 0,
    losses: 0,
    createdAt: Date.now(),
  };
  // Over capacity, drop the least-judged oldest pieces first.
  const next = [...pieces, piece];
  if (next.length > MAX_PIECES) {
    next.sort((a, b) => b.wins + b.losses - (a.wins + a.losses) || b.createdAt - a.createdAt);
    next.length = MAX_PIECES;
  }
  writeWall(next);
  return piece;
}

export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** Records a duel result. Returns false if either id is unknown. */
export function recordDuel(winnerId: string, loserId: string): boolean {
  if (winnerId === loserId) return false;
  const pieces = readWall();
  const w = pieces.find((p) => p.id === winnerId);
  const l = pieces.find((p) => p.id === loserId);
  if (!w || !l) return false;
  const delta = K * (1 - expectedScore(w.elo, l.elo));
  w.elo = Math.round(w.elo + delta);
  l.elo = Math.round(l.elo - delta);
  w.wins++;
  l.losses++;
  writeWall(pieces);
  return true;
}

export function removePiece(id: string): boolean {
  const pieces = readWall();
  const next = pieces.filter((p) => p.id !== id);
  if (next.length === pieces.length) return false;
  writeWall(next);
  return true;
}

/**
 * Picks two pieces to duel: the least-judged piece (ties broken randomly)
 * against a random opponent, preferring the same language.
 */
export function pickDuel(
  language?: string,
  rand: () => number = Math.random
): [WallPiece, WallPiece] | null {
  const pool = readWall().filter((p) => !language || p.language === language);
  if (pool.length < 2) return null;
  const minDuels = Math.min(...pool.map((p) => p.wins + p.losses));
  const fresh = pool.filter((p) => p.wins + p.losses === minDuels);
  const a = fresh[Math.floor(rand() * fresh.length)];
  const rest = pool.filter((p) => p.id !== a.id);
  const sameLang = rest.filter((p) => p.language === a.language);
  const opponents = sameLang.length ? sameLang : rest;
  const b = opponents[Math.floor(rand() * opponents.length)];
  return rand() < 0.5 ? [a, b] : [b, a];
}

export function topPieces(n = 20, language?: string): WallPiece[] {
  return readWall()
    .filter((p) => (!language || p.language === language) && p.wins + p.losses > 0)
    .sort((a, b) => b.elo - a.elo)
    .slice(0, n);
}

/* ---------------- learning signals ---------------- */

/** Well-judged wall pieces as up/down events for exemplars + the Coach. */
export function wallSignals(pieces: WallPiece[] = readWall()): FeedbackEvent[] {
  const events: FeedbackEvent[] = [];
  for (const p of pieces) {
    if (p.wins + p.losses < SIGNAL_MIN_DUELS) continue;
    const kind =
      p.elo >= START_ELO + SIGNAL_MARGIN
        ? "thumbs_up"
        : p.elo <= START_ELO - SIGNAL_MARGIN
          ? "thumbs_down"
          : null;
    if (!kind) continue;
    events.push({
      kind,
      result: p.text,
      language: p.language,
      tone: "wall",
      length: "wall",
      promptVersion: "wall",
      ts: p.createdAt,
    });
  }
  return events;
}

/** Everything the learning loop learns from: direct feedback + the Wall. */
export function learningEvents(): FeedbackEvent[] {
  return [...readFeedback(), ...wallSignals()];
}
