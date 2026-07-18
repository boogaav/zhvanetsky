"use client";

interface Alternative {
  mode: string;
  text: string;
}

interface Props {
  alternatives: Alternative[];
  onPromote: (text: string) => void;
}

const MODE_LABELS: Record<string, string> = {
  sharper: "The sharper one",
  stranger: "The stranger one",
};

export default function AlternativeResults({ alternatives, onPromote }: Props) {
  if (!alternatives.length) return null;
  return (
    <details className="group mt-4 rounded-sm border border-line/70">
      <summary className="list-none cursor-pointer select-none px-4 py-2.5 text-sm text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Two other versions
      </summary>
      <div className="space-y-5 border-t border-line/70 px-4 py-4">
        {alternatives.map((alt) => (
          <div key={alt.mode} data-testid={`alternative-${alt.mode}`}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
              {MODE_LABELS[alt.mode] ?? alt.mode}
            </p>
            <p className="whitespace-pre-wrap font-serif leading-7 text-ink">
              {alt.text}
            </p>
            <button
              type="button"
              onClick={() => onPromote(alt.text)}
              className="mt-2 rounded-sm border border-line px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
            >
              Use this one
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
