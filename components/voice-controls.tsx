"use client";

import type { Settings } from "@/lib/ai/schemas";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  disabled: boolean;
}

function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onSelect,
  disabled,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onSelect: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={legend}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(opt.value)}
              className={`rounded-sm border px-2.5 py-1.5 text-sm transition-colors disabled:opacity-60 ${
                selected
                  ? "border-accent bg-accent text-paper"
                  : "border-line bg-transparent text-ink-soft hover:border-ink-faint"
              }`}
            >
              {opt.label}
              {selected && <span className="sr-only"> (selected)</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function VoiceControls({ settings, onChange, disabled }: Props) {
  return (
    <details className="group mt-4 rounded-sm border border-line/70">
      <summary className="list-none cursor-pointer select-none px-4 py-2.5 text-sm text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Tune the voice
      </summary>
      <div className="grid gap-5 border-t border-line/70 px-4 py-4 sm:grid-cols-2">
        <OptionGroup
          legend="Tone"
          value={settings.tone}
          disabled={disabled}
          onSelect={(tone) => onChange({ ...settings, tone })}
          options={[
            { value: "gentle", label: "Gentle" },
            { value: "sharp", label: "Sharp" },
            { value: "brutal", label: "Brutal" },
          ]}
        />
        <OptionGroup
          legend="Length"
          value={settings.length}
          disabled={disabled}
          onSelect={(length) => onChange({ ...settings, length })}
          options={[
            { value: "one-liner", label: "One-liner" },
            { value: "short", label: "Short post" },
            { value: "mini-monologue", label: "Mini-monologue" },
          ]}
        />
        <OptionGroup
          legend="Language"
          value={settings.language}
          disabled={disabled}
          onSelect={(language) => onChange({ ...settings, language })}
          options={[
            { value: "auto", label: "Same as input" },
            { value: "en", label: "English" },
            { value: "ru", label: "Русский" },
            { value: "uk", label: "Українська" },
          ]}
        />
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
            Facts
          </legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={settings.preserveFacts}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...settings, preserveFacts: e.target.checked })
              }
              className="h-4 w-4 accent-accent"
            />
            Keep names, facts, and numbers unchanged
          </label>
        </fieldset>
      </div>
    </details>
  );
}
