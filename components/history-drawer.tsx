"use client";

import type { HistoryEntry } from "@/lib/storage/local";

interface Props {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export default function HistoryDrawer({ history, onRestore, onClear }: Props) {
  if (!history.length) return null;
  return (
    <details className="group mt-10 border-t border-line/70 pt-4">
      <summary className="list-none cursor-pointer select-none text-sm text-ink-faint hover:text-ink-soft [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Recent thoughts ({history.length})
      </summary>
      <ul className="mt-3 space-y-2">
        {history.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onRestore(entry)}
              className="w-full rounded-sm border border-transparent px-2 py-1.5 text-left text-sm text-ink-soft transition-colors hover:border-line hover:bg-paper-deep/50"
            >
              <span className="block truncate">{entry.input}</span>
              <span className="mt-0.5 block truncate font-serif text-xs text-ink-faint">
                {entry.result.split("\n")[0]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-sm border border-line px-2.5 py-1 text-xs text-ink-faint transition-colors hover:border-accent hover:text-accent"
      >
        Clear history
      </button>
    </details>
  );
}
