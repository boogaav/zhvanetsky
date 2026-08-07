import { AIProvider, JsonCompletionParams } from "./provider";

/**
 * DEMO PROVIDER - deterministic fixture outputs, no network.
 *
 * Used when no API key is configured (and in unit/e2e tests) so the
 * interface and automated tests stay usable. Its output is clearly
 * labeled "demo" in every API response; the UI shows a demo-mode note.
 * It never pretends to be a live model.
 *
 * It composes text from fixed per-language templates around clauses of
 * the actual input, so results are stable for a given input.
 */

type Lang = "en" | "ru" | "uk";
type Len = "one-liner" | "short" | "mini-monologue";

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export function detectLanguage(text: string): Lang {
  if (/[іїєґІЇЄҐ]/.test(text)) return "uk";
  if (/[а-яА-ЯёЁ]/.test(text)) return "ru";
  return "en";
}

const CRISIS_PATTERNS = [
  /kill myself/i,
  /end my life/i,
  /want to die/i,
  /suicide/i,
  /hurt myself/i,
  /покончить с собой/i,
  /не хочу жить/i,
  /суицид/i,
  /накласти на себе руки/i,
  /не хочу жити/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

function extractUserText(user: string): string {
  const m = user.match(/<user_text>\n?([\s\S]*?)\n?<\/user_text>/);
  return (m ? m[1] : user).trim();
}

function extractPreviousResult(user: string): string {
  const m = user.match(/CURRENT VERSION\n([\s\S]*)$/);
  return (m ? m[1] : "").trim();
}

function clauses(input: string): { first: string; last: string } {
  const parts = input
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim().replace(/[.!?…]+$/, ""))
    .filter((s) => s.length > 1);
  const clip = (s: string) => {
    if (s.length <= 140) return s;
    const cut = s.slice(0, 140);
    return cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 140);
  };
  const first = clip(parts[0] ?? input.slice(0, 140).trim());
  const last = clip(parts.length > 1 ? parts[parts.length - 1] : first);
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return { first: cap(first), last: cap(last) };
}

/* ---------------- templates ---------------- */

const SHORT: Record<Lang, ((f: string, l: string) => string)[]> = {
  en: [
    (f) =>
      `${f}.\nThat's what I said out loud.\nOut loud it sounded like a plan.\nQuietly it sounded like the reason I needed one.`,
    (f) =>
      `${f}.\nEveryone agreed with me immediately.\nThat's how I knew nobody was going to help.\nAgreement is what people give you instead.`,
    (f) =>
      `${f}.\nI've explained this to myself twice.\nBoth times I was very convincing.\nBoth times I stayed exactly where I was.`,
  ],
  ru: [
    (f) =>
      `${f}.\nЯ сказал это вслух.\nВслух прозвучало как план.\nПро себя — как причина, по которой нужен план.`,
    (f) =>
      `${f}.\nВсе сразу со мной согласились.\nТак я понял, что помогать никто не будет.\nСогласие — это то, что дают вместо помощи.`,
    (f) =>
      `${f}.\nЯ дважды объяснил это самому себе.\nОба раза был очень убедителен.\nОба раза остался там же, где был.`,
  ],
  uk: [
    (f) =>
      `${f}.\nЯ сказав це вголос.\nВголос прозвучало як план.\nПро себе — як причина, з якої потрібен план.`,
    (f) =>
      `${f}.\nУсі одразу зі мною погодилися.\nТак я зрозумів, що допомагати ніхто не буде.\nЗгода — це те, що дають замість допомоги.`,
    (f) =>
      `${f}.\nЯ двічі пояснив це самому собі.\nОбидва рази був дуже переконливий.\nОбидва рази лишився там, де був.`,
  ],
};

const ONE_LINER: Record<Lang, ((f: string) => string)[]> = {
  en: [
    (f) => `${f} — I say it like a decision and live it like a description.`,
    (f) => `${f} — everyone agrees, which is how I know I'm alone with it.`,
  ],
  ru: [
    (f) => `${f} — говорю как решение, живу как описание.`,
    (f) => `${f} — все согласны, поэтому я с этим один.`,
  ],
  uk: [
    (f) => `${f} — кажу як рішення, живу як опис.`,
    (f) => `${f} — усі згодні, тому я з цим сам.`,
  ],
};

const MINI: Record<Lang, (f: string, l: string) => string> = {
  en: (f, l) =>
    `${f}.\nI said it in the morning.\nBy lunch I believed myself.\nBy evening I was quoting myself.\n${l}.\nNotice how nothing in that sentence moved.\nThe situation stayed. The words got better.\nThat's called growth now.\nI checked.`,
  ru: (f, l) =>
    `${f}.\nУтром я это сказал.\nК обеду — поверил.\nК вечеру уже цитировал.\n${l}.\nЗаметьте: ничего не сдвинулось.\nСитуация осталась. Слова стали лучше.\nТеперь это называется рост.\nЯ проверял.`,
  uk: (f, l) =>
    `${f}.\nЗранку я це сказав.\nДо обіду — повірив.\nДо вечора вже цитував.\n${l}.\nЗауважте: нічого не зрушило.\nСитуація лишилась. Слова стали кращі.\nТепер це називається зростання.\nЯ перевіряв.`,
};

const SHARPER: Record<Lang, (f: string) => string> = {
  en: (f) =>
    `${f}.\nI keep announcing it like a decision.\nIt isn't a decision. It's a description.`,
  ru: (f) =>
    `${f}.\nЯ объявляю это как решение.\nА это не решение. Это описание.`,
  uk: (f) =>
    `${f}.\nЯ оголошую це як рішення.\nА це не рішення. Це опис.`,
};

const STRANGER: Record<Lang, (f: string) => string> = {
  en: (f) =>
    `${f}.\nSomewhere there is a version of me this worked out for.\nHe doesn't call. He's busy.\nI understand him completely.`,
  ru: (f) =>
    `${f}.\nГде-то живёт человек, у которого это получилось.\nОн мне не звонит. Он занят.\nЯ его прекрасно понимаю.`,
  uk: (f) =>
    `${f}.\nДесь живе людина, у якої це вийшло.\nВона мені не дзвонить. Вона зайнята.\nЯ її чудово розумію.`,
};

const PHILOSOPHICAL_LINE: Record<Lang, string> = {
  en: "People survive everything. Mostly by describing it.",
  ru: "Человек всё переживает. В основном — пересказывая.",
  uk: "Людина все переживає. Здебільшого — переказуючи.",
};

const ABSURD_LINE: Record<Lang, string> = {
  en: "I'm thinking of franchising the problem.",
  ru: "Думаю оформить проблему как франшизу.",
  uk: "Думаю оформити проблему як франшизу.",
};

const HUMAN_LINE: Record<Lang, string> = {
  en: "I don't know. Maybe.",
  ru: "Не знаю. Может быть.",
  uk: "Не знаю. Може.",
};

/* ---------------- prompt-context parsing ---------------- */

function requestedLang(system: string, input: string): Lang {
  if (/Output language: English/.test(system)) return "en";
  if (/Output language: Russian/.test(system)) return "ru";
  if (/Output language: Ukrainian/.test(system)) return "uk";
  return detectLanguage(input);
}

function requestedLen(system: string): Len {
  if (/Length: a single line/.test(system)) return "one-liner";
  if (/Length: a mini-monologue/.test(system)) return "mini-monologue";
  return "short";
}

function requestedRefineMode(system: string): string {
  if (/Make it sharper/.test(system)) return "sharper";
  if (/Make it shorter/.test(system)) return "shorter";
  if (/more absurd/.test(system)) return "absurd";
  if (/more philosophical/.test(system)) return "philosophical";
  if (/more human/.test(system)) return "human";
  return "another-angle";
}

/* ---------------- composition ---------------- */

export function composeDemo(
  input: string,
  lang: Lang,
  len: Len,
  variant: number
): string {
  const { first, last } = clauses(input);
  if (len === "one-liner") {
    const set = ONE_LINER[lang];
    return set[variant % set.length](first);
  }
  if (len === "mini-monologue") return MINI[lang](first, last);
  const set = SHORT[lang];
  return set[variant % set.length](first, last);
}

function refineDemo(
  input: string,
  previous: string,
  mode: string,
  lang: Lang,
  len: Len
): string {
  const { first } = clauses(input);
  const lines = previous.split("\n").filter((l) => l.trim().length > 0);
  switch (mode) {
    case "sharper":
      return SHARPER[lang](first);
    case "shorter": {
      if (lines.length >= 3) return [lines[0], lines[lines.length - 1]].join("\n");
      return lines[lines.length - 1] ?? previous;
    }
    case "absurd":
      return [...lines, ABSURD_LINE[lang]].join("\n");
    case "philosophical":
      return [...lines.slice(0, -1), PHILOSOPHICAL_LINE[lang]].join("\n");
    case "human": {
      const out = [...lines];
      out.splice(1, 0, HUMAN_LINE[lang]);
      return out.join("\n");
    }
    default:
      // another-angle: different template applied to the ORIGINAL input
      return composeDemo(input, lang, len, hash(input) + lines.length + 1);
  }
}

function extractPreserved(input: string): string[] {
  const numbers = input.match(/\d[\d.,%]*/g) ?? [];
  const names =
    input.match(/(?<![.!?]\s)(?<!^)\b[A-ZА-ЯІЇЄҐ][a-zа-яіїєґ']{2,}\b/g) ?? [];
  return [...new Set([...numbers, ...names])].slice(0, 8);
}

/* ---------------- provider ---------------- */

export class DemoProvider implements AIProvider {
  readonly name = "demo";

  async completeJson(params: JsonCompletionParams): Promise<unknown> {
    const input = extractUserText(params.user);
    const lang = requestedLang(params.system, input);
    const len = requestedLen(params.system);
    const variant = hash(input);

    switch (params.schemaName) {
      case "writing_brief": {
        const detected = detectLanguage(input);
        const { first } = clauses(input);
        return {
          language: detected,
          coreObservation: first,
          centralContradiction:
            "What is said as a decision is lived as a description.",
          emotionalTruth: "Tiredness disguised as clarity.",
          satireTarget: "the narrator's own ritual of announcing",
          mustPreserve: extractPreserved(input),
          mayRemove: ["everything after the second explanation"],
          emotionalTemperature: "quiet resignation",
          crisis: detectCrisis(input),
          crisisNote: detectCrisis(input)
            ? "Credible first-person disclosure of self-harm."
            : "",
        };
      }
      case "candidates": {
        const structures = [
          "observation-contradiction-truth",
          "expectation-reality-collapse",
          "personal-universal",
          "logic-one-step-too-far",
          "repetition-shift",
          "ordinary-detail-absurdity",
        ];
        return {
          candidates: structures.map((structure, i) => ({
            structure,
            text: composeDemo(input, lang, len, variant + i),
          })),
        };
      }
      case "editor_result":
      case "fast_result": {
        return {
          primary: composeDemo(input, lang, len, variant),
          alternatives: [
            {
              mode: "sharper",
              text:
                len === "one-liner"
                  ? ONE_LINER[lang][(variant + 1) % ONE_LINER[lang].length](
                      clauses(input).first
                    )
                  : SHARPER[lang](clauses(input).first),
            },
            { mode: "stranger", text: STRANGER[lang](clauses(input).first) },
          ],
        };
      }
      case "refine_result": {
        const previous = extractPreviousResult(params.user);
        const mode = requestedRefineMode(params.system);
        return { text: refineDemo(input, previous, mode, lang, len) };
      }
      // Self-improvement stubs: deterministic, and the judge always
      // keeps the champion so demo mode can never "learn" by accident.
      case "style_rules": {
        return {
          rules: [
            "End on the line that quietly reverses the first line.",
            "Prefer one concrete household detail over any abstraction.",
          ],
        };
      }
      case "pairwise_verdict": {
        return { winner: "B", reason: "Demo judge: the champion holds." };
      }
      default:
        throw new Error(`DemoProvider: unknown schema ${params.schemaName}`);
    }
  }
}
