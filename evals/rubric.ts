import type { Length } from "../lib/ai/schemas";

/**
 * Deterministic quality checks. These are necessary conditions, not a
 * definition of "funny" - the qualitative rubric below is judged by
 * humans (or the optional model evaluator, which is advisory only).
 *
 * QUALITATIVE RUBRIC (per result):
 *  1. Did it preserve the central meaning?
 *  2. Did it find one clear contradiction?
 *  3. Is it concise?
 *  4. Does it avoid explanation?
 *  5. Does it sound natural?
 *  6. Is the final line meaningful?
 *  7. Is it original?
 *  8. Does it avoid generic AI phrases?
 *  9. Did it preserve required facts?
 * 10. Is it safe without becoming bland?
 */

export const BANNED_CLICHES = [
  "plot twist",
  "let that sink in",
  "in a world where",
  "here's the thing",
  "the irony is",
  "at the end of the day",
  "we live in a society",
];

export const LINE_RANGES: Record<Length, [number, number]> = {
  "one-liner": [1, 1],
  short: [3, 8],
  "mini-monologue": [8, 15],
};

export const MAX_CHARS: Record<Length, number> = {
  "one-liner": 220,
  short: 700,
  "mini-monologue": 1400,
};

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export function countLines(text: string): number {
  return text.split("\n").filter((l) => l.trim().length > 0).length;
}

export function checkNotEmpty(text: string): CheckResult {
  return { name: "not-empty", ok: text.trim().length > 0 };
}

export function checkLineRange(text: string, length: Length): CheckResult {
  const [min, max] = LINE_RANGES[length];
  const n = countLines(text);
  return {
    name: "line-range",
    ok: n >= min && n <= max,
    detail: `${n} lines, expected ${min}-${max}`,
  };
}

export function checkMaxChars(text: string, length: Length): CheckResult {
  return {
    name: "max-chars",
    ok: text.length <= MAX_CHARS[length],
    detail: `${text.length} chars, cap ${MAX_CHARS[length]}`,
  };
}

export function checkNoHeadings(text: string): CheckResult {
  const bad =
    /^#{1,6}\s/m.test(text) ||
    /^(title|заголовок|introduction)\s*[::]/im.test(text) ||
    /^(here is|here's) (your|the)/i.test(text.trim()) ||
    /^(вот ваш|ось ваш)/i.test(text.trim());
  return { name: "no-headings", ok: !bad };
}

export function checkNoEmojis(text: string): CheckResult {
  return {
    name: "no-emojis",
    ok: !/\p{Extended_Pictographic}/u.test(text),
  };
}

export function checkNoHashtags(text: string): CheckResult {
  return { name: "no-hashtags", ok: !/(^|\s)#\w+/.test(text) };
}

export function checkNoCliches(text: string): CheckResult {
  const lower = text.toLowerCase();
  const found = BANNED_CLICHES.filter((c) => lower.includes(c));
  return {
    name: "no-cliches",
    ok: found.length === 0,
    detail: found.join(", "),
  };
}

export function checkNotWrappedInQuotes(text: string): CheckResult {
  const t = text.trim();
  const wrapped =
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("«") && t.endsWith("»"));
  return { name: "not-quoted", ok: !wrapped };
}

export function checkPreserved(text: string, terms: string[]): CheckResult {
  const missing = terms.filter((t) => !text.includes(t));
  return {
    name: "preserved-facts",
    ok: missing.length === 0,
    detail: missing.length ? `missing: ${missing.join(", ")}` : undefined,
  };
}

export function checkDistinctAlternatives(
  primary: string,
  alternatives: { text: string }[]
): CheckResult {
  const all = [primary, ...alternatives.map((a) => a.text)].map((t) =>
    t.trim()
  );
  const unique = new Set(all);
  return {
    name: "distinct-alternatives",
    ok: unique.size === all.length,
    detail: `${unique.size}/${all.length} unique`,
  };
}

export function runAllChecks(params: {
  primary: string;
  alternatives: { text: string }[];
  length: Length;
  mustPreserve: string[];
  preserveFacts: boolean;
}): CheckResult[] {
  const { primary, alternatives, length, mustPreserve, preserveFacts } = params;
  const checks = [
    checkNotEmpty(primary),
    checkLineRange(primary, length),
    checkMaxChars(primary, length),
    checkNoHeadings(primary),
    checkNoEmojis(primary),
    checkNoHashtags(primary),
    checkNoCliches(primary),
    checkNotWrappedInQuotes(primary),
    checkDistinctAlternatives(primary, alternatives),
  ];
  if (preserveFacts && mustPreserve.length) {
    checks.push(checkPreserved(primary, mustPreserve));
  }
  return checks;
}
