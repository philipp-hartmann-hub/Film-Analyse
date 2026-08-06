"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import {
  aggregateGenres,
  buildRatingDistribution,
  ratingStats,
  type FilmEntry,
  type GenreCount,
} from "@/lib/letterboxd";

type FilmsResponse = {
  films: FilmEntry[];
  maxPage: number;
  username: string;
  error?: string;
};

type GenresResponse = {
  results: Array<{ slug: string; genres: string[]; error: string | null }>;
  error?: string;
};

const PAGE_CONCURRENCY = 3;
const GENRE_BATCH = 10;
const MAX_GENRE_FILMS = 180;

export function Analyzer() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmEntry[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);
  const [genreProgress, setGenreProgress] = useState({ done: 0, total: 0 });

  const ratings = useMemo(() => buildRatingDistribution(films), [films]);
  const stats = useMemo(() => ratingStats(films), [films]);
  const topFilms = useMemo(
    () =>
      [...films]
        .filter((f) => f.rating != null)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 8),
    [films],
  );

  async function fetchFilmsPage(user: string, page: number): Promise<FilmsResponse> {
    const res = await fetch(
      `/api/films?username=${encodeURIComponent(user)}&page=${page}`,
    );
    const data = (await res.json()) as FilmsResponse;
    if (!res.ok) {
      throw new Error(data.error || "Filme konnten nicht geladen werden.");
    }
    return data;
  }

  async function loadRemainingFilms(
    user: string,
    startFilms: FilmEntry[],
    maxPage: number,
  ) {
    const all = [...startFilms];
    let nextPage = 2;

    while (nextPage <= maxPage) {
      const batchPages: number[] = [];
      for (let i = 0; i < PAGE_CONCURRENCY && nextPage + i <= maxPage; i++) {
        batchPages.push(nextPage + i);
      }

      setStatus(
        `Lade Filmliste… Seite ${batchPages[0]}–${batchPages.at(-1)} / ${maxPage}`,
      );

      const results = await Promise.all(
        batchPages.map((page) => fetchFilmsPage(user, page)),
      );
      for (const result of results) all.push(...result.films);

      nextPage += batchPages.length;
      setFilms([...all]);
    }

    return all;
  }

  async function loadGenres(filmList: FilmEntry[]) {
    const uniqueSlugs = [...new Set(filmList.map((f) => f.slug))].slice(
      0,
      MAX_GENRE_FILMS,
    );

    setGenreProgress({ done: 0, total: uniqueSlugs.length });
    setStatus(
      uniqueSlugs.length < filmList.length
        ? `Lade Genres für die neuesten ${uniqueSlugs.length} Filme…`
        : "Lade Genres…",
    );

    const collected: { slug: string; genres: string[] }[] = [];

    for (let i = 0; i < uniqueSlugs.length; i += GENRE_BATCH) {
      const batch = uniqueSlugs.slice(i, i + GENRE_BATCH);
      const res = await fetch("/api/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: batch }),
      });
      const data = (await res.json()) as GenresResponse;
      if (!res.ok) {
        throw new Error(data.error || "Genres konnten nicht geladen werden.");
      }

      for (const result of data.results) {
        collected.push({ slug: result.slug, genres: result.genres });
      }

      setGenreProgress({ done: collected.length, total: uniqueSlugs.length });
      setGenres(aggregateGenres(collected));
      setStatus(`Lade Genres… ${collected.length}/${uniqueSlugs.length}`);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setFilms([]);
    setGenres([]);
    setGenreProgress({ done: 0, total: 0 });
    setUsername(null);
    setStatus("Lade Filmliste…");

    try {
      const first = await fetchFilmsPage(input, 1);
      setUsername(first.username);
      setFilms(first.films);

      const allFilms =
        first.maxPage > 1
          ? await loadRemainingFilms(first.username, first.films, first.maxPage)
          : first.films;

      setFilms(allFilms);
      await loadGenres(allFilms);
      setStatus("Fertig.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mt-10">
        <label
          htmlFor="letterboxd"
          className="block text-sm font-medium text-[var(--ink)]"
        >
          Letterboxd-Profil
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="letterboxd"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://letterboxd.com/deinname/ oder deinname"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2"
            disabled={loading}
            required
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[var(--ink)] px-5 py-3 font-medium text-[var(--panel)] transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analysiere…" : "Auswertung starten"}
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Öffentliche Watch-Liste wird ausgelesen. Genres kommen von den
          Filmseiten (bei großen Bibliotheken die neuesten {MAX_GENRE_FILMS}{" "}
          Filme).
        </p>
      </form>

      {(loading || status) && !error && (
        <p className="mt-4 text-sm text-[var(--muted)]" aria-live="polite">
          {status || "Starte…"}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {username && films.length > 0 && (
        <AnalysisDashboard
          username={username}
          ratings={ratings}
          genres={genres}
          stats={stats}
          genreProgress={genreProgress}
          topFilms={topFilms}
        />
      )}
    </div>
  );
}
