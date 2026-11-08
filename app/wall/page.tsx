"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import FunnierDuel from "@/components/funnier-duel";
import { APP_NAME } from "@/lib/config";

interface Piece {
  id: string;
  text: string;
  language: string;
}
interface Ranked extends Piece {
  wins: number;
  duels: number;
}

const LANGS = [
  { value: "", label: "All" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "uk", label: "Українська" },
];

export default function WallPage() {
  const [lang, setLang] = useState("");
  const [duel, setDuel] = useState<[Piece, Piece] | null>(null);
  const [top, setTop] = useState<Ranked[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [voting, setVoting] = useState(false);
  const [votes, setVotes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (language: string) => {
    try {
      const res = await fetch(`/api/wall${language ? `?lang=${language}` : ""}`);
      const data = await res.json();
      setDuel(data.duel);
      setTop(data.top);
      setError(null);
    } catch {
      setError("The Wall is quiet right now. Try again in a moment.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches external data on language change
    load(lang);
  }, [lang, load]);

  async function vote(side: "a" | "b") {
    if (!duel || voting) return;
    const [a, b] = duel;
    setVoting(true);
    try {
      await fetch("/api/wall/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          side === "a" ? { winner: a.id, loser: b.id } : { winner: b.id, loser: a.id }
        ),
      });
      setVotes((v) => v + 1);
      await load(lang);
    } finally {
      setVoting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      <p aria-live="polite" role="status" className="sr-only">
        {votes ? `Vote counted. ${votes} so far.` : ""}
      </p>

      <header className="mb-8">
        <Link
          href="/"
          className="mb-3 inline-block text-xs font-medium uppercase tracking-[0.25em] text-accent"
        >
          {APP_NAME}
        </Link>
        <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">
          The Wall.
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          Pieces readers chose to publish. Two at a time. You decide.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={lang === l.value}
            onClick={() => setLang(l.value)}
            className={`rounded-sm border px-2.5 py-1.5 text-sm transition-colors ${
              lang === l.value
                ? "border-accent bg-accent text-paper"
                : "border-line text-ink-soft hover:border-ink-faint"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-6 text-ink">
          {error}
        </p>
      )}

      <section aria-label="Duel">
        {duel ? (
          <FunnierDuel
            a={duel[0].text}
            b={duel[1].text}
            onPick={vote}
            disabled={voting}
            caption={votes ? `${votes} voted` : undefined}
          />
        ) : (
          loaded && (
            <p className="text-ink-soft">
              Not enough pieces here yet.{" "}
              <Link href="/" className="text-accent hover:underline">
                Write one and publish it
              </Link>
              .
            </p>
          )
        )}
      </section>

      {top.length > 0 && (
        <section className="mt-14" aria-label="Leaderboard">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-ink-faint">
            Funniest so far
          </h2>
          <ol className="space-y-6" data-testid="wall-top">
            {top.map((p, i) => (
              <li key={p.id} className="border-t border-line/70 pt-4">
                <p className="mb-2 text-xs text-ink-faint">
                  #{i + 1} · won {p.wins} of {p.duels}
                </p>
                <p className="whitespace-pre-wrap font-serif leading-7 text-ink">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
