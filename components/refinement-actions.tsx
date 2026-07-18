"use client";

import type { RefineMode } from "@/lib/ai/schemas";

export const REFINE_LABELS: Record<RefineMode, string> = {
  sharper: "Sharper",
  shorter: "Shorter",
  absurd: "Stranger",
  philosophical: "More philosophical",
  human: "More human",
  "another-angle": "Another angle",
};

interface Props {
  onRefine: (mode: RefineMode) => void;
  busyMode: RefineMode | null;
  disabled: boolean;
  favorite: RefineMode | null;
}

export default function RefinementActions({
  onRefine,
  busyMode,
  disabled,
  favorite,
}: Props) {
  const modes = Object.keys(REFINE_LABELS) as RefineMode[];
  // Surface the user's most-used refinement first.
  const ordered = favorite
    ? [favorite, ...modes.filter((m) => m !== favorite)]
    : modes;

  return (
    <div
      className="mt-3 flex flex-wrap gap-1.5"
      role="group"
      aria-label="Refine the result"
    >
      {ordered.map((mode) => {
        const busy = busyMode === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => onRefine(mode)}
            className={`rounded-sm border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              busy
                ? "border-accent text-accent"
                : "border-line text-ink-soft hover:border-ink-faint hover:text-ink"
            }`}
          >
            {busy ? "Rewriting…" : REFINE_LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}
