"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WritingInput from "@/components/writing-input";
import VoiceControls from "@/components/voice-controls";
import ResultCard from "@/components/result-card";
import RefinementActions from "@/components/refinement-actions";
import AlternativeResults from "@/components/alternative-results";
import HistoryDrawer from "@/components/history-drawer";
import FunnierDuel from "@/components/funnier-duel";
import Link from "next/link";
import { APP_NAME, APP_SUBTAGLINE, APP_TAGLINE } from "@/lib/config";
import type {
  GenerationResponse,
  RefineMode,
  RefineResponse,
  Settings,
} from "@/lib/ai/schemas";
import {
  addFeedback,
  addHistoryEntry,
  bumpRefineCount,
  clearHistory,
  DEFAULT_SETTINGS,
  exportFeedbackJson,
  favoriteRefineMode,
  HistoryEntry,
  loadHistory,
  loadPrefs,
  Prefs,
  savePrefs,
} from "@/lib/storage/local";
import { PROMPT_VERSION } from "@/lib/ai/prompts/versions";

const STAGES = [
  "Listening",
  "Finding the contradiction",
  "Cutting what doesn’t help",
  "Choosing the line that hurts",
];

interface ApiError {
  error?: string;
  message?: string;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [generatedFor, setGeneratedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [refining, setRefining] = useState<RefineMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [duel, setDuel] = useState<{
    versions: { text: string; signature?: string }[];
    pairs: [number, number][];
    step: number;
    wins: number[];
  } | null>(null);
  const [publishedText, setPublishedText] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef(0);

  // Load local preferences and history once, client-side only. Reading
  // localStorage in a mount effect (not in useState initializers) keeps
  // the server-rendered HTML and the first client render identical.
  useEffect(() => {
    const p = loadPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setPrefs(p);
    setSettings(p.settings);
    setHistory(loadHistory());
    // Developer-only feedback export; never uploaded automatically.
    (window as unknown as Record<string, unknown>).zhExportFeedback = () =>
      exportFeedbackJson();
  }, []);

  const updateSettings = useCallback(
    (next: Settings) => {
      setSettings(next);
      if (prefs) {
        const nextPrefs = { ...prefs, settings: next };
        setPrefs(nextPrefs);
        savePrefs(nextPrefs);
      }
    },
    [prefs]
  );

  function startStages() {
    stageRef.current = 0;
    setStage(0);
    setAnnouncement(`Working: ${STAGES[0]}`);
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = setInterval(() => {
      const next = Math.min(stageRef.current + 1, STAGES.length - 1);
      if (next !== stageRef.current) {
        stageRef.current = next;
        setStage(next);
        setAnnouncement(`Working: ${STAGES[next]}`);
      }
    }, 2600);
  }

  function stopStages() {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  }

  useEffect(() => () => stopStages(), []);

  async function generate() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Write the thought first. Even a messy one.");
      return;
    }
    setError(null);
    setFeedback(null);
    setDuel(null);
    setLoading(true);
    startStages();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed, settings }),
        signal: controller.signal,
      });
      const data = (await res.json()) as GenerationResponse & ApiError;
      if (!res.ok) {
        setError(data.message ?? "Something broke on our side. Try once more.");
        setAnnouncement(data.message ?? "Generation failed.");
        return;
      }
      setResult(data);
      setGeneratedFor(trimmed);
      setAnnouncement("The result is ready.");
      if (!data.safety) {
        setHistory(
          addHistoryEntry({
            id: data.id,
            input: trimmed,
            result: data.result,
            alternatives: data.alternatives,
            settings,
            provider: data.provider,
            signature: data.signature,
            createdAt: Date.now(),
          })
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setAnnouncement("Stopped.");
      } else {
        setError(
          "The network dropped the thought. Check the connection and retry."
        );
        setAnnouncement("Network error.");
      }
    } finally {
      setLoading(false);
      stopStages();
      abortRef.current = null;
    }
  }

  function cancelGenerate() {
    abortRef.current?.abort();
  }

  async function refine(mode: RefineMode) {
    if (!result || refining) return;
    setRefining(mode);
    setError(null);
    setAnnouncement("Rewriting.");
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: generatedFor,
          previousResult: result.result,
          mode,
          settings,
        }),
      });
      const data = (await res.json()) as RefineResponse & ApiError;
      if (!res.ok) {
        setError(data.message ?? "Something broke on our side. Try once more.");
        setAnnouncement(data.message ?? "Refinement failed.");
        return;
      }
      setResult({ ...result, result: data.result, signature: data.signature });
      setFeedback(null);
      setAnnouncement("The result is ready.");
      if (prefs) setPrefs(bumpRefineCount(prefs, mode));
    } catch {
      setError(
        "The network dropped the thought. Check the connection and retry."
      );
      setAnnouncement("Network error.");
    } finally {
      setRefining(null);
    }
  }

  function startOver() {
    setInput("");
    setResult(null);
    setError(null);
    setFeedback(null);
    setDuel(null);
    setGeneratedFor("");
    setAnnouncement("Cleared. Write the next thought.");
  }

  /** Fire-and-forget anonymous learning signal; only with opt-in. */
  function sendLearningSignal(
    kind: "thumbs_up" | "thumbs_down" | "copied" | "preferred",
    current: GenerationResponse
  ) {
    if (!prefs?.shareFeedback || current.safety) return;
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        result: current.result,
        language: current.language,
        tone: settings.tone,
        length: settings.length,
        promptVersion: current.promptVersion,
      }),
    }).catch(() => {
      // A lost signal is fine; never bother the user about it.
    });
  }

  function toggleShareFeedback(value: boolean) {
    if (!prefs) return;
    const next = { ...prefs, shareFeedback: value };
    setPrefs(next);
    savePrefs(next);
    setAnnouncement(
      value
        ? "Anonymous ratings will be shared to improve the editor."
        : "Sharing disabled. Ratings stay on this device."
    );
  }

  function giveFeedback(value: "up" | "down") {
    if (!result) return;
    setFeedback(value);
    addFeedback({
      promptVersion: result.promptVersion ?? PROMPT_VERSION,
      settings,
      result: result.result,
      value,
      createdAt: Date.now(),
    });
    sendLearningSignal(value === "up" ? "thumbs_up" : "thumbs_down", result);
    setAnnouncement(value === "up" ? "Noted: it landed." : "Noted: it missed.");
  }

  function restoreEntry(entry: HistoryEntry) {
    setInput(entry.input);
    setGeneratedFor(entry.input);
    setSettings(entry.settings);
    setResult({
      id: entry.id,
      language: entry.settings.language,
      result: entry.result,
      alternatives: entry.alternatives as GenerationResponse["alternatives"],
      promptVersion: PROMPT_VERSION,
      provider: entry.provider,
      safety: false,
      signature: entry.signature,
    });
    setFeedback(null);
    setError(null);
  }

  /** Every version on screen with its publish signature. */
  function versions(current: GenerationResponse) {
    const all = [
      { text: current.result, signature: current.signature },
      ...current.alternatives.map((a) => ({ text: a.text, signature: a.signature })),
    ];
    return all.filter((v, i) => all.findIndex((x) => x.text === v.text) === i);
  }

  function promote(current: GenerationResponse, text: string) {
    const signature = versions(current).find((v) => v.text === text)?.signature;
    setResult({ ...current, result: text, signature });
    setFeedback(null);
  }

  function startDuel() {
    if (!result) return;
    const vs = versions(result);
    const pairs: [number, number][] = [];
    for (let i = 0; i < vs.length; i++)
      for (let j = i + 1; j < vs.length; j++) pairs.push([i, j]);
    setDuel({ versions: vs, pairs, step: 0, wins: vs.map(() => 0) });
    setAnnouncement("Pick the funnier of two versions.");
  }

  function pickInDuel(side: "a" | "b") {
    if (!duel || !result) return;
    const [i, j] = duel.pairs[duel.step];
    const winner = side === "a" ? i : j;
    const wins = duel.wins.map((w, k) => (k === winner ? w + 1 : w));
    sendLearningSignal("preferred", { ...result, result: duel.versions[winner].text });
    if (duel.step + 1 < duel.pairs.length) {
      setDuel({ ...duel, step: duel.step + 1, wins });
      return;
    }
    const best = wins.indexOf(Math.max(...wins));
    promote(result, duel.versions[best].text);
    setDuel(null);
    setAnnouncement("Your favourite is now the main result.");
  }

  async function publish() {
    if (!result?.signature) return;
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: result.result,
          signature: result.signature,
          language: result.language,
        }),
      });
      if (!res.ok) throw new Error();
      setPublishedText(result.result);
      setAnnouncement("Published to the Wall.");
    } catch {
      setError("The Wall didn't take it. Try once more.");
    }
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    setAnnouncement("History cleared.");
  }

  const busy = loading || refining !== null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      {/* screen-reader status channel */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <header className="mb-10">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-accent">
          {APP_NAME}
        </p>
        <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">
          {APP_TAGLINE}
        </h1>
        <p className="mt-3 text-lg text-ink-soft">{APP_SUBTAGLINE}</p>
        <Link
          href="/wall"
          className="mt-4 inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          The Wall — vote on what other people wrote →
        </Link>
      </header>

      <section aria-label="Your thought">
        <WritingInput
          value={input}
          onChange={(v) => {
            setInput(v);
            if (error) setError(null);
          }}
          onSubmit={generate}
          disabled={busy}
          autoFocus
        />
        <VoiceControls
          settings={settings}
          onChange={updateSettings}
          disabled={busy}
        />
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={busy || !input.trim()}
            className="rounded-sm bg-accent px-5 py-2.5 text-base text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            Find the contradiction
          </button>
          {loading && (
            <button
              type="button"
              onClick={cancelGenerate}
              className="rounded-sm border border-line px-3 py-2 text-sm text-ink-soft hover:border-ink-faint"
            >
              Stop
            </button>
          )}
          {result && !loading && (
            <button
              type="button"
              onClick={startOver}
              className="ml-auto rounded-sm border border-line px-3 py-2 text-sm text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
            >
              Start over
            </button>
          )}
        </div>
      </section>

      {loading && (
        <div className="mt-10" data-testid="loading-stages">
          <ol className="space-y-2">
            {STAGES.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2.5 text-sm transition-colors ${
                  i === stage
                    ? "text-ink"
                    : i < stage
                      ? "text-ink-faint line-through decoration-line"
                      : "text-ink-faint/60"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    i === stage ? "stage-dot bg-accent" : "bg-line"
                  }`}
                />
                {label}
                {i === stage ? "…" : ""}
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && !loading && (
        <div
          role="alert"
          data-testid="error-state"
          className="mt-10 rounded-sm border border-accent/40 bg-paper-deep/50 px-5 py-4"
        >
          <p className="text-ink">{error}</p>
          <button
            type="button"
            onClick={generate}
            className="mt-3 rounded-sm border border-accent px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent hover:text-paper"
          >
            Try again
          </button>
        </div>
      )}

      {result && !loading && (
        <section className="mt-10" aria-label="The result">
          <ResultCard
            text={result.result}
            safety={result.safety}
            provider={result.provider}
            onCopied={() => {
              setAnnouncement("Copied to clipboard.");
              sendLearningSignal("copied", result);
            }}
            feedback={feedback}
            onFeedback={giveFeedback}
            shareFeedback={prefs?.shareFeedback ?? false}
            onToggleShare={toggleShareFeedback}
          />
          {!result.safety && (
            <>
              <RefinementActions
                onRefine={refine}
                busyMode={refining}
                disabled={busy}
                favorite={prefs ? favoriteRefineMode(prefs) : null}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {result.alternatives.length > 0 && !duel && (
                  <button
                    type="button"
                    onClick={startDuel}
                    disabled={busy}
                    className="rounded-sm border border-accent px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent hover:text-paper disabled:opacity-50"
                  >
                    Which is funnier?
                  </button>
                )}
                {result.signature &&
                  (publishedText === result.result ? (
                    <Link href="/wall" className="text-sm text-accent hover:underline">
                      On the Wall ✓ — see it
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={publish}
                      disabled={busy}
                      className="rounded-sm border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-50"
                    >
                      Publish to the Wall
                    </button>
                  ))}
              </div>
              {result.signature && publishedText !== result.result && (
                <p className="mt-1.5 text-xs text-ink-faint">
                  Publishing posts only this text, anonymously. Your original
                  thought is never published.
                </p>
              )}
              {duel && (
                <div className="mt-6">
                  <FunnierDuel
                    a={duel.versions[duel.pairs[duel.step][0]].text}
                    b={duel.versions[duel.pairs[duel.step][1]].text}
                    onPick={pickInDuel}
                    caption={`${duel.step + 1} of ${duel.pairs.length}`}
                  />
                </div>
              )}
              <AlternativeResults
                alternatives={result.alternatives}
                onPromote={(text) => {
                  promote(result, text);
                  setAnnouncement("Alternative promoted to the main result.");
                }}
              />
            </>
          )}
        </section>
      )}

      <HistoryDrawer
        history={history}
        onRestore={restoreEntry}
        onClear={handleClearHistory}
      />
    </main>
  );
}
