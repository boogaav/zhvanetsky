"use client";

interface Props {
  a: string;
  b: string;
  onPick: (side: "a" | "b") => void;
  disabled?: boolean;
  caption?: string;
}

/** Two pieces side by side; one tap picks the funnier one. */
export default function FunnierDuel({ a, b, onPick, disabled, caption }: Props) {
  return (
    <div data-testid="funnier-duel">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-faint">
        Which is funnier?{caption ? ` · ${caption}` : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["a", "b"] as const).map((side, i) => (
          <button
            key={side}
            type="button"
            disabled={disabled}
            onClick={() => onPick(side)}
            aria-label={`Version ${i + 1} is funnier`}
            className="rounded-sm border border-line bg-paper-deep/40 px-5 py-4 text-left transition-colors hover:border-accent focus-visible:border-accent disabled:opacity-50"
          >
            <span className="whitespace-pre-wrap font-serif leading-7 text-ink">
              {side === "a" ? a : b}
            </span>
            <span className="mt-3 block text-xs text-ink-faint">
              Tap if this one is funnier
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
