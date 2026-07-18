"use client";

import { useEffect, useRef } from "react";
import { MAX_INPUT_LENGTH } from "@/lib/config";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  autoFocus?: boolean;
}

export default function WritingInput({
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const nearLimit = value.length > MAX_INPUT_LENGTH - 500;

  return (
    <div>
      <label htmlFor="thought" className="sr-only">
        Your raw thought
      </label>
      <textarea
        id="thought"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
        maxLength={MAX_INPUT_LENGTH}
        rows={7}
        placeholder="Write the messy, emotional, unnecessarily long version…"
        className="w-full resize-y rounded-sm border border-line bg-paper-deep/40 px-4 py-3.5 font-serif text-lg leading-relaxed text-ink placeholder:text-ink-faint/80 focus:border-ink-soft focus:bg-paper-deep/60 disabled:opacity-60"
      />
      <div className="mt-1.5 flex items-baseline justify-between text-xs text-ink-faint">
        <span>Cmd/Ctrl + Enter to generate</span>
        <span aria-live={nearLimit ? "polite" : "off"}>
          {nearLimit
            ? `${MAX_INPUT_LENGTH - value.length} characters left`
            : ""}
        </span>
      </div>
    </div>
  );
}
