/**
 * Self-improvement runner: `npm run improve`
 *
 * Sources feedback + current style from the local store, or from a
 * deployed instance when IMPROVE_REMOTE_URL and IMPROVE_ADMIN_TOKEN are
 * set (the Coach itself always runs here, where an OpenAI key lives).
 *
 * Flags:
 *   --dry-run       analyze and judge, but do not promote
 *   --min-events N  minimum feedback events required (default 10)
 *   --fixtures N    fixtures per language for the championship (default 4)
 *   --rollback      revert to the previous style version and exit
 */
import fixturesJson from "../../evals/fixtures.json";
import { getProvider } from "../ai";
import { runCoach, type CoachFixture } from "./coach";
import { learningEvents } from "./wall";
import {
  promoteStyle,

  readStyleState,
  rollbackStyle,
} from "./store";
import type { FeedbackEvent, StyleState, StyleVersion } from "./types";

interface Fixture {
  id: string;
  language: string;
  input: string;
  mustPreserve: string[];
  settings: Record<string, unknown>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

function pickFixtures(perLanguage: number): CoachFixture[] {
  const all = (fixturesJson as Fixture[]).filter(
    (f) => !f.settings.length // default "short" fixtures only
  );
  const out: CoachFixture[] = [];
  for (const lang of ["en", "ru", "uk"]) {
    out.push(
      ...all
        .filter((f) => f.language === lang)
        .slice(0, perLanguage)
        .map((f) => ({
          id: f.id,
          language: f.language,
          input: f.input,
          mustPreserve: f.mustPreserve,
        }))
    );
  }
  return out;
}

const remoteUrl = process.env.IMPROVE_REMOTE_URL?.replace(/\/$/, "");
const remoteToken = process.env.IMPROVE_ADMIN_TOKEN;
const useRemote = Boolean(remoteUrl && remoteToken);

async function remoteGet<T>(path: string): Promise<T> {
  const res = await fetch(`${remoteUrl}${path}`, {
    headers: { authorization: `Bearer ${remoteToken}` },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function remotePost(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${remoteUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${remoteToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
}

async function main() {
  if (has("--rollback")) {
    if (useRemote) {
      await remotePost("/api/admin/style", { action: "rollback" });
      const state = await remoteGet<StyleState>("/api/admin/style");
      console.log(
        `Rolled back. Active: ${state.active ? `voice v${state.active.version}` : "base voice (no learned style)"}`
      );
    } else {
      const state = rollbackStyle();
      console.log(
        `Rolled back. Active: ${state.active ? `voice v${state.active.version}` : "base voice (no learned style)"}`
      );
    }
    return;
  }

  const provider = getProvider();
  const events: FeedbackEvent[] = useRemote
    ? (await remoteGet<{ events: FeedbackEvent[] }>("/api/admin/feedback")).events
    : learningEvents();
  const styleState: StyleState = useRemote
    ? await remoteGet<StyleState>("/api/admin/style")
    : readStyleState();

  console.log(
    `\nSelf-improvement run (provider: ${provider.name}, source: ${useRemote ? remoteUrl : "local store"})`
  );
  console.log(
    `Champion: ${styleState.active ? `voice v${styleState.active.version}` : "base voice (no learned style yet)"}\n`
  );
  if (provider.name === "demo") {
    console.log(
      "NOTE: demo provider — this exercises the loop deterministically; real learning needs OPENAI_API_KEY + OPENAI_MODEL.\n"
    );
  }

  const report = await runCoach(provider, events, styleState, {
    fixtures: pickFixtures(Number(arg("--fixtures") ?? 4)),
    minEvents: Number(arg("--min-events") ?? 10),
    log: (line) => console.log(line),
  });

  console.log(`\nResult: ${report.reason}`);
  if (report.promoted && report.newVersion) {
    if (has("--dry-run")) {
      console.log("(dry run — not persisting the new version)");
    } else if (useRemote) {
      await remotePost("/api/admin/style", {
        action: "promote",
        version: report.newVersion,
      });
      console.log(`Promoted voice v${report.newVersion.version} on ${remoteUrl}`);
    } else {
      promoteStyle(report.newVersion as StyleVersion);
      console.log(`Promoted voice v${report.newVersion.version} locally`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Improvement run failed:", (err as Error).message);
  process.exit(1);
});
