"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import {
  aggregateGenres,
  buildRatingDistribution,
  parseLetterboxdCsv,
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

const PAGE_CONCURRENCY = 2;
const GENRE_BATCH = 12;
const MAX_GENRE_FILMS = 200;

export function Analyzer() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmEntry[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);
  const [genreProgress, setGenreProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

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
    const subset = filmList.slice(0, MAX_GENRE_FILMS);
    setGenreProgress({ done: 0, total: subset.length });
    setStatus(
      subset.length < filmList.length
        ? `Lade Genres für ${subset.length} Filme…`
        : "Lade Genres…",
    );

    const collected: { slug: string; genres: string[] }[] = [];
    let failures = 0;

    for (let i = 0; i < subset.length; i += GENRE_BATCH) {
      const batch = subset.slice(i, i + GENRE_BATCH);
      try {
        const res = await fetch("/api/genres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ films: batch }),
        });
        const data = (await res.json()) as GenresResponse;
        if (!res.ok) {
          failures += batch.length;
        } else {
          for (const result of data.results) {
            collected.push({ slug: result.slug, genres: result.genres });
            if (result.error || result.genres.length === 0) failures += 1;
          }
        }
      } catch {
        failures += batch.length;
      }

      setGenreProgress({
        done: Math.min(i + batch.length, subset.length),
        total: subset.length,
      });
      setGenres(aggregateGenres(collected));
      setStatus(`Lade Genres… ${Math.min(i + batch.length, subset.length)}/${subset.length}`);
    }

    if (collected.every((c) => c.genres.length === 0)) {
      setWarning(
        "Genres konnten nicht geladen werden (oft Cloudflare). Ratings bleiben sichtbar — oder ZIP-Export nutzen.",
      );
    } else if (failures > subset.length * 0.4) {
      setWarning(
        "Einige Genres fehlten. Die Top-Genres basieren auf den erfolgreich geladenen Filmen.",
      );
    }
  }

  async function runWithFilms(label: string, filmList: FilmEntry[]) {
    if (filmList.length === 0) {
      throw new Error("Keine Filme gefunden.");
    }
    setUsername(label);
    setFilms(filmList);
    await loadGenres(filmList);
    setStatus("Fertig.");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setWarning(null);
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

  async function onZipSelected(file: File | null) {
    if (!file) return;
    setError(null);
    setWarning(null);
    setLoading(true);
    setFilms([]);
    setGenres([]);
    setGenreProgress({ done: 0, total: 0 });
    setUsername(null);
    setStatus("Lese Export…");

    try {
      const buffer = await file.arrayBuffer();
      let ratingsCsv = "";
      let watchedCsv = "";

      if (file.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(buffer);
        const names = Object.keys(zip.files);
        const ratingsFile = names.find((n) =>
          n.toLowerCase().endsWith("ratings.csv"),
        );
        const watchedFile = names.find((n) =>
          n.toLowerCase().endsWith("watched.csv"),
        );
        if (!ratingsFile && !watchedFile) {
          throw new Error(
            "ZIP enthält keine ratings.csv / watched.csv. Bitte Letterboxd-Export verwenden.",
          );
        }
        if (ratingsFile) {
          ratingsCsv = await zip.files[ratingsFile].async("text");
        }
        if (watchedFile) {
          watchedCsv = await zip.files[watchedFile].async("text");
        }
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        ratingsCsv = new TextDecoder().decode(buffer);
      } else {
        throw new Error("Bitte eine .zip oder .csv Datei wählen.");
      }

      const fromRatings = ratingsCsv ? parseLetterboxdCsv(ratingsCsv) : [];
      const fromWatched = watchedCsv ? parseLetterboxdCsv(watchedCsv) : [];

      // Merge: watched as base, overlay ratings
      const bySlug = new Map<string, FilmEntry>();
      for (const film of fromWatched) bySlug.set(film.slug, { ...film });
      for (const film of fromRatings) {
        const existing = bySlug.get(film.slug);
        if (existing) {
          existing.rating = film.rating ?? existing.rating;
        } else {
          bySlug.set(film.slug, { ...film });
        }
      }

      const merged = [...bySlug.values()];
      await runWithFilms("export", merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export konnte nicht gelesen werden.");
      setStatus("");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
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
            placeholder="philipphartmann, letterboxd.com/… oder boxd.it/…"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[var(--ink)] px-5 py-3 font-medium text-[var(--panel)] transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analysiere…" : "Auswertung starten"}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)]/70 p-5">
        <p className="text-sm font-medium text-[var(--ink)]">
          Alternativ: Letterboxd-Export (zuverlässiger)
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Settings → Import & Export → Export your data → ZIP hier hochladen.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.csv,application/zip,text/csv"
          disabled={loading}
          className="mt-3 block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--ink)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--panel)]"
          onChange={(e) => onZipSelected(e.target.files?.[0] ?? null)}
        />
      </div>

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

      {warning && !error && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
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
