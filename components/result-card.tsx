"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  safety: boolean;
  provider: string;
  onCopied: () => void;
  feedback: "up" | "down" | null;
  onFeedback: (value: "up" | "down") => void;
}

export default function ResultCard({
  text,
  safety,
  provider,
  onCopied,
  feedback,
  onFeedback,
}: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable; fall back to selection.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    onCopied();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      data-testid="result-card"
      className={`rounded-sm border px-6 py-6 sm:px-8 ${
        safety
          ? "border-ink-soft/40 bg-paper-deep/70"
          : "border-line bg-paper-deep/40"
      }`}
    >
      {/* Model output rendered strictly as text, never as HTML. */}
      <p
        data-testid="result-text"
        className="whitespace-pre-wrap font-serif text-lg leading-8 text-ink"
      >
        {text}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/60 pt-4">
        <button
          type="button"
          onClick={copy}
          className="rounded-sm bg-ink px-3.5 py-1.5 text-sm text-paper transition-colors hover:bg-ink-soft"
        >
          {copied ? "Copied." : "Copy"}
        </button>

        {!safety && (
          <div
            className="ml-auto flex items-center gap-1"
            role="group"
            aria-label="Was this any good?"
          >
            <button
              type="button"
              aria-label="Good result"
              aria-pressed={feedback === "up"}
              onClick={() => onFeedback("up")}
              className={`rounded-sm border px-2.5 py-1.5 text-sm transition-colors ${
                feedback === "up"
                  ? "border-accent text-accent"
                  : "border-line text-ink-faint hover:text-ink-soft"
              }`}
            >
              It landed{feedback === "up" ? " ✓" : ""}
            </button>
            <button
              type="button"
              aria-label="Bad result"
              aria-pressed={feedback === "down"}
              onClick={() => onFeedback("down")}
              className={`rounded-sm border px-2.5 py-1.5 text-sm transition-colors ${
                feedback === "down"
                  ? "border-accent text-accent"
                  : "border-line text-ink-faint hover:text-ink-soft"
              }`}
            >
              It missed{feedback === "down" ? " ✓" : ""}
            </button>
          </div>
        )}
      </div>

      {provider === "demo" && (
        <p className="mt-3 text-xs text-ink-faint">
          Demo mode — deterministic sample output, no live model. Set an API
          key to write for real.
        </p>
      )}
    </div>
  );
}
