"use client";

import { FormEvent, useState } from "react";
import { StatsReport } from "@/components/StatsReport";
import { buildAnalysis, type AnalysisReport } from "@/lib/analysis";
import type { EnrichedFilm, FilmEntry } from "@/lib/film";

type FilmsResponse = {
  films: FilmEntry[];
  maxPage: number;
  username: string;
  displayName?: string;
  error?: string;
};

type GenresResponse = {
  results: Array<{
    slug: string;
    genres: string[];
    directors?: string[];
    description?: string;
    error: string | null;
  }>;
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
  const [report, setReport] = useState<AnalysisReport | null>(null);

  /** Exact original call: pass raw input, server parses username. */
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

  async function loadAllFilms(rawInput: string) {
    setStatus("Lade Filmliste…");
    const first = await fetchFilmsPage(rawInput, 1);
    const all = [...first.films];
    const { username, maxPage, displayName } = first;

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
        batchPages.map((page) => fetchFilmsPage(username, page)),
      );
      for (const result of results) all.push(...result.films);
      nextPage += batchPages.length;
    }

    return {
      username,
      displayName: displayName || username,
      films: all,
    };
  }

  async function enrichFilms(films: FilmEntry[]): Promise<EnrichedFilm[]> {
    const map = new Map<string, EnrichedFilm>();
    for (const f of films) {
      map.set(f.slug, { ...f, genres: [], directors: [], description: "" });
    }

    const uniqueSlugs = [...new Set(films.map((f) => f.slug))].slice(
      0,
      MAX_GENRE_FILMS,
    );

    for (let i = 0; i < uniqueSlugs.length; i += GENRE_BATCH) {
      const batch = uniqueSlugs.slice(i, i + GENRE_BATCH);
      setStatus(
        `Lade Details… ${Math.min(i + batch.length, uniqueSlugs.length)}/${uniqueSlugs.length}`,
      );

      try {
        const res = await fetch("/api/genres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs: batch }),
        });
        const data = (await res.json()) as GenresResponse;
        if (res.ok) {
          for (const result of data.results) {
            const film = map.get(result.slug);
            if (!film) continue;
            film.genres = result.genres;
            film.directors = result.directors ?? [];
            film.description = result.description ?? "";
          }
        }
      } catch {
        // keep going — ratings report still works without full details
      }
    }

    return [...map.values()];
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setReport(null);
    setLoading(true);
    setStatus("Lade Filmliste…");

    try {
      // Pass raw input exactly like the first working version
      const { username, displayName, films } = await loadAllFilms(input);
      if (!films.length) {
        throw new Error("Keine Filme in diesem Profil gefunden.");
      }

      const enriched = await enrichFilms(films);
      setReport(buildAnalysis(username, displayName, enriched));
      setStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!report && (
        <form onSubmit={onSubmit} className="search-form">
          <label htmlFor="letterboxd">Letterboxd-Profil</label>
          <div className="search-row">
            <input
              id="letterboxd"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="philipphartmann oder https://letterboxd.com/philipphartmann/"
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? "Analysiere…" : "Auswertung starten"}
            </button>
          </div>
          <p className="hint">
            Username oder letterboxd.com-Profil-Link — wie in der ersten
            funktionierenden Version.
          </p>
        </form>
      )}

      {loading && (
        <p className="status" aria-live="polite">
          {status || "Starte…"}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {report && (
        <>
          <div className="again">
            <button
              type="button"
              onClick={() => {
                setReport(null);
                setError(null);
              }}
            >
              Anderes Profil analysieren
            </button>
          </div>
          <StatsReport report={report} />
        </>
      )}
    </div>
  );
}
