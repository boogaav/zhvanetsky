import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  expectedScore,
  learningEvents,
  pickDuel,
  publishPiece,
  readWall,
  recordDuel,
  removePiece,
  signText,
  topPieces,
  verifyText,
  wallSignals,
  type WallPiece,
} from "@/lib/improve/wall";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "wall-test-"));
  process.env.IMPROVE_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.IMPROVE_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("publish signatures", () => {
  it("verifies text this server signed and rejects anything else", () => {
    const sig = signText("a real generated piece");
    expect(verifyText("a real generated piece", sig)).toBe(true);
    expect(verifyText("a forged piece", sig)).toBe(false);
    expect(verifyText("a real generated piece", "00".repeat(32))).toBe(false);
    expect(verifyText("a real generated piece", "not-hex")).toBe(false);
  });
});

describe("wall store", () => {
  it("publishes idempotently per text", () => {
    const a = publishPiece("Same piece.\nTwo lines.", "en");
    const b = publishPiece("Same piece.\nTwo lines.  ", "en");
    expect(a.id).toBe(b.id);
    expect(readWall()).toHaveLength(1);
  });

  it("applies Elo symmetrically and counts duels", () => {
    const a = publishPiece("A", "en");
    const b = publishPiece("B", "en");
    expect(recordDuel(a.id, b.id)).toBe(true);
    const [wa, wb] = readWall();
    expect(wa.elo).toBe(1012);
    expect(wb.elo).toBe(988);
    expect(wa.wins).toBe(1);
    expect(wb.losses).toBe(1);
    expect(expectedScore(1000, 1000)).toBe(0.5);
  });

  it("rejects self-duels and unknown ids", () => {
    const a = publishPiece("A", "en");
    expect(recordDuel(a.id, a.id)).toBe(false);
    expect(recordDuel(a.id, "0000000000000000")).toBe(false);
  });

  it("removes pieces (moderation)", () => {
    const a = publishPiece("A", "en");
    expect(removePiece(a.id)).toBe(true);
    expect(removePiece(a.id)).toBe(false);
    expect(readWall()).toHaveLength(0);
  });

  it("survives a corrupt wall file", () => {
    fs.writeFileSync(path.join(dir, "wall.json"), "{not json");
    expect(readWall()).toEqual([]);
    publishPiece("fresh", "en");
    expect(readWall()).toHaveLength(1);
  });
});

describe("duels and leaderboard", () => {
  it("needs two pieces and prefers the least-judged piece in the same language", () => {
    publishPiece("only one", "en");
    expect(pickDuel()).toBeNull();

    const judged = publishPiece("judged en", "en");
    const other = publishPiece("other en", "en");
    publishPiece("ru piece", "ru");
    recordDuel(judged.id, other.id);
    recordDuel(other.id, judged.id);

    for (let i = 0; i < 20; i++) {
      const duel = pickDuel();
      expect(duel).not.toBeNull();
      const [a, b] = duel!;
      expect(a.id).not.toBe(b.id);
      // the two unjudged pieces ("only one", "ru piece") are always in the duel
      expect([a.text, b.text].some((t) => t === "only one" || t === "ru piece")).toBe(true);
    }
    expect(pickDuel("ru")).toBeNull();
  });

  it("ranks only judged pieces by Elo", () => {
    const a = publishPiece("winner", "en");
    const b = publishPiece("loser", "en");
    publishPiece("unjudged", "en");
    recordDuel(a.id, b.id);
    expect(topPieces().map((p) => p.text)).toEqual(["winner", "loser"]);
  });
});

describe("learning signals", () => {
  const piece = (over: Partial<WallPiece>): WallPiece => ({
    id: "x",
    text: "t",
    language: "en",
    elo: 1000,
    wins: 0,
    losses: 0,
    createdAt: 1,
    ...over,
  });

  it("turns well-judged extremes into up/down events, ignores the rest", () => {
    const events = wallSignals([
      piece({ text: "great", elo: 1100, wins: 6, losses: 1 }),
      piece({ text: "weak", elo: 900, wins: 1, losses: 6 }),
      piece({ text: "middling", elo: 1010, wins: 4, losses: 4 }),
      piece({ text: "too few duels", elo: 1200, wins: 3, losses: 0 }),
    ]);
    expect(events.map((e) => [e.result, e.kind])).toEqual([
      ["great", "thumbs_up"],
      ["weak", "thumbs_down"],
    ]);
  });

  it("merges wall signals with direct feedback", () => {
    const a = publishPiece("star", "en");
    const b = publishPiece("dud", "en");
    for (let i = 0; i < 5; i++) recordDuel(a.id, b.id);
    const kinds = learningEvents().map((e) => `${e.result}:${e.kind}`);
    expect(kinds).toContain("star:thumbs_up");
    expect(kinds).toContain("dud:thumbs_down");
  });
});
