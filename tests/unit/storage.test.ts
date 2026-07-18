// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addFeedback,
  addHistoryEntry,
  bumpRefineCount,
  clearHistory,
  DEFAULT_SETTINGS,
  exportFeedbackJson,
  favoriteRefineMode,
  loadHistory,
  loadPrefs,
  savePrefs,
  type Prefs,
} from "@/lib/storage/local";

/** Minimal localStorage backed by a Map, installed on a fake window. */
function installFakeWindow() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  (globalThis as Record<string, unknown>).window = { localStorage };
  return store;
}

describe("local preference serialization", () => {
  beforeEach(() => installFakeWindow());
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it("round-trips preferences", () => {
    const prefs: Prefs = {
      settings: { ...DEFAULT_SETTINGS, tone: "brutal", language: "uk" },
      refineCounts: { shorter: 3 },
    };
    savePrefs(prefs);
    const loaded = loadPrefs();
    expect(loaded.settings.tone).toBe("brutal");
    expect(loaded.settings.language).toBe("uk");
    expect(loaded.refineCounts.shorter).toBe(3);
  });

  it("falls back to defaults on corrupted storage", () => {
    (globalThis as { window: { localStorage: Storage } }).window.localStorage.setItem(
      "zh.prefs.v1",
      "{not json"
    );
    const loaded = loadPrefs();
    expect(loaded.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("tracks the most frequently used refinement mode", () => {
    let prefs = loadPrefs();
    prefs = bumpRefineCount(prefs, "sharper");
    prefs = bumpRefineCount(prefs, "sharper");
    prefs = bumpRefineCount(prefs, "human");
    expect(favoriteRefineMode(prefs)).toBe("sharper");
  });

  it("does not surface a favorite after a single use", () => {
    const prefs = bumpRefineCount(loadPrefs(), "absurd");
    expect(favoriteRefineMode(prefs)).toBeNull();
  });

  it("caps history at 20 entries and clears it", () => {
    for (let i = 0; i < 25; i++) {
      addHistoryEntry({
        id: `id-${i}`,
        input: `input ${i}`,
        result: "res",
        alternatives: [],
        settings: DEFAULT_SETTINGS,
        provider: "demo",
        createdAt: i,
      });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].id).toBe("id-24");
    clearHistory();
    expect(loadHistory()).toHaveLength(0);
  });

  it("exports feedback as JSON with prompt version and settings", () => {
    addFeedback({
      promptVersion: "satire-v1",
      settings: DEFAULT_SETTINGS,
      result: "text",
      value: "up",
      createdAt: 1,
    });
    const exported = JSON.parse(exportFeedbackJson());
    expect(exported).toHaveLength(1);
    expect(exported[0].promptVersion).toBe("satire-v1");
    expect(exported[0].value).toBe("up");
  });
});
