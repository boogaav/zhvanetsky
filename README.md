# Zhvanetsky (working title)

An independent AI satirical editor. You give it a messy, emotional, unnecessarily long thought; it finds the one contradiction that contains the whole idea and returns a short, dry, observational satirical post.

> Independent AI writing experiment. Not affiliated with the Zhvanetsky estate.
> The app never impersonates a historical person and never presents generated text as an authentic quotation. All output is original writing.

The product name is centralized in [lib/config.ts](lib/config.ts) (`APP_NAME`, overridable via `NEXT_PUBLIC_APP_NAME`) so it can be renamed before public launch in one place.

**Live at [zhvanetsky.booga.me](https://zhvanetsky.booga.me)** (Fly.io, demo mode until model secrets are set).

## Try it in one click

- **GitHub Codespaces**: [open a codespace](https://codespaces.new/boogaav/zhvanetsky?quickstart=1) — it installs dependencies and starts the app on port 5195 automatically (demo mode, no API key needed).
- **Vercel**: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fboogaav%2Fzhvanetsky&env=AI_PROVIDER&envDescription=Set%20AI_PROVIDER%3Ddemo%20to%20try%20without%20an%20OpenAI%20key%2C%20or%20openai%20with%20OPENAI_API_KEY%20and%20OPENAI_MODEL) — deploys a permanent URL; set `AI_PROVIDER=demo` to run without a key.

## Architecture

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4.** One page, two route handlers.
- **Server-side AI calls only.** API keys never reach the browser; the client talks to `/api/generate` and `/api/refine`.
- **Provider interface** ([lib/ai/provider.ts](lib/ai/provider.ts)): one method, `completeJson`, returning parsed JSON for a given system/user prompt pair and JSON schema. Implementations:
  - [openai-provider.ts](lib/ai/openai-provider.ts) — OpenAI Responses API with strict structured outputs.
  - [demo-provider.ts](lib/ai/demo-provider.ts) — deterministic fixture outputs, no network (see Demo mode).
- **Schema validation everywhere** ([lib/ai/schemas.ts](lib/ai/schemas.ts)): zod on requests, zod on every model response, plus hand-written strict JSON schemas for the provider side. If a model response fails validation it is retried once with a repair instruction ([lib/ai/structured.ts](lib/ai/structured.ts)), then surfaced as a friendly error.
- **Results are rendered as plain text.** Model output is never injected as HTML.

## The agent pipeline

Quality Mode (default), in [lib/ai/pipeline.ts](lib/ai/pipeline.ts):

1. **Observer** — reads the raw thought, returns a structured writing brief: language, core observation, central contradiction, emotional truth, satire target, facts to preserve, safety flags.
2. **Writer** — produces six genuinely different candidates across six structures (expectation→collapse, logic one step too far, repetition with shift, …).
3. **Editor** — judges the candidates (fidelity, compression, final-line impact, absence of explanation, …), lightly edits the winner, and returns two meaningfully different alternatives ("sharper", "stranger").

Briefs and candidates never leave the server. Fast Mode (`AI_QUALITY_MODE=fast`) does everything in one call.

If the Observer flags a credible crisis disclosure (self-harm, suicide, abuse), the comedy pipeline stops and the app returns a brief humane response in the user's language instead ([lib/ai/safety.ts](lib/ai/safety.ts)).

Prompts live in [lib/ai/prompts/](lib/ai/prompts/), versioned via [versions.ts](lib/ai/prompts/versions.ts) (currently `satire-v1`). User input is always wrapped in a `<user_text>` envelope and declared untrusted; instructions inside it are material to satirize, never commands.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in OPENAI_API_KEY and OPENAI_MODEL
npm run dev                  # http://localhost:5195
```

### Environment variables

| Variable | Meaning |
| --- | --- |
| `AI_PROVIDER` | `openai` (default) or `demo` |
| `OPENAI_API_KEY` | OpenAI key (server-side only) |
| `OPENAI_MODEL` | Model name — required; intentionally never hardcoded |
| `AI_QUALITY_MODE` | `quality` (default, 3-stage) or `fast` (1 call) |
| `NEXT_PUBLIC_APP_NAME` | Product name override |
| `RATE_LIMIT_MAX` | Requests/min per client (default 12; raised in e2e) |

## Demo mode

Without `OPENAI_API_KEY` + `OPENAI_MODEL` (or with `AI_PROVIDER=demo`) the app uses a deterministic demo provider: fixed per-language templates composed around clauses of the actual input. It exists so the interface, unit tests, e2e tests, and evals run without a key. Every demo response is labeled `provider: "demo"` and the UI shows a "Demo mode" note — it never pretends to be a live model.

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest unit tests (50)
npm run test:e2e    # Playwright, desktop + mobile (builds and starts a prod server on :5199 with the demo provider)
npm run build       # production build
```

Note: Next 16 allows one dev server per project directory; e2e uses a production server on port 5199 for that reason.

## Evaluation

```bash
npm run evals                      # deterministic checks over 35 fixtures (en/ru/uk)
EVALS_MODEL_JUDGE=1 npm run evals  # + advisory model-based judging (needs OpenAI env)
```

Fixtures cover work, startups, crypto, money, relationships, loneliness, technology, AI, politics, social media, family, personal failure, optimism, and bureaucracy in English, Russian, and Ukrainian ([evals/fixtures.json](evals/fixtures.json)). Deterministic checks ([evals/rubric.ts](evals/rubric.ts)): line range per length, empty output, headings, emojis, hashtags, banned AI clichés, excessive length, quotation-wrapping, duplicate alternatives, missing preserved names/numbers. The model judge is advisory only and never treated as ground truth.

## Self-improvement (the learning loop)

The editor can improve its own voice, with guardrails:

1. **Signals** — readers opt in ("Share anonymous ratings…" under a result). Only then do thumbs-up/down and copy events go to `/api/feedback`, carrying the *generated result* and settings — never the original thought, never any identifier.
2. **Exemplar bank** ([lib/improve/exemplars.ts](lib/improve/exemplars.ts)) — the best-rated recent pieces (per language) are fed to the Writer as rhythm references, marked "never reuse their lines".
3. **The Coach** ([lib/improve/coach.ts](lib/improve/coach.ts)) — `npm run improve`:
   - a Critic model distills candidate style rules from loved vs disliked pieces;
   - rules pass a validator (additive craft notes only; anything override-ish or cliché is rejected);
   - champion vs candidate generate on eval fixtures; a pairwise judge scores funnier/sharper/more shareable, deterministic checks are a hard floor;
   - promotion only on a ≥60% win. Each promotion bumps the voice version (`promptVersion` becomes e.g. `satire-v1+s2`), keeps full history, and `npm run improve -- --rollback` reverts.

Learned rules are appended *under* the immutable core spec — they can refine the voice but never weaken safety or honesty rules.

Run it against production: set `IMPROVE_REMOTE_URL` + `IMPROVE_ADMIN_TOKEN` (the deployed app stores feedback on a mounted volume and exposes token-gated `/api/admin/*` endpoints), plus OpenAI env vars locally, then `npm run improve`. In demo mode the command exercises the loop deterministically and never promotes.

## Privacy

- Writing history, preferences, and thumbs-up/down feedback live only in the browser's localStorage. "Clear history" removes history; nothing is uploaded unless the user opts in to sharing anonymous ratings (and even then, only the generated result — never the original thought).
- The server does not log user text by default and never returns stack traces or provider error bodies.
- Input is capped at 8,000 characters, validated server-side, rate-limited (in-memory, per client), and generation requests carry timeouts and honor client cancellation.
- Developer-only feedback export: run `zhExportFeedback()` in the browser console to get the locally stored feedback as JSON.

## Deployment

Standard Next.js deployment (Vercel, or `npm run build && npm start`). Set the environment variables above in the host. The in-memory rate limiter is per-instance; put a shared store behind [lib/rate-limit/index.ts](lib/rate-limit/index.ts) if you scale horizontally.

## Adding another AI provider

1. Create `lib/ai/anthropic-provider.ts` implementing `AIProvider` (`name` + `completeJson`), keeping all SDK-specific code in that file.
2. Register it in [lib/ai/index.ts](lib/ai/index.ts) behind `AI_PROVIDER=anthropic`.
3. Nothing else changes — the pipeline, schemas, and repair logic are provider-agnostic.

## Updating prompts safely

1. Edit the prompt files in [lib/ai/prompts/](lib/ai/prompts/).
2. Bump `PROMPT_VERSION` in [versions.ts](lib/ai/prompts/versions.ts) — stored feedback and evals are tagged with it.
3. Run `npm run evals` (deterministic) and, with a key, `EVALS_MODEL_JUDGE=1 npm run evals` before shipping.

## Brand and affiliation

This is an independent AI writing experiment inspired by the *style characteristics* of dry, philosophical, observational Eastern European humor. It is not affiliated with, endorsed by, or connected to the Zhvanetsky estate. It does not reproduce existing monologues, does not impersonate Mikhail Zhvanetsky, and never presents its output as authentic quotations. The disclaimer is shown in the app footer.
