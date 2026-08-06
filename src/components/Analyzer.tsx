"use client";

import { FormEvent, useState } from "react";
import { StatsReport } from "@/components/StatsReport";
import { buildAnalysis, type AnalysisReport } from "@/lib/analysis";
import type { EnrichedFilm, FilmEntry } from "@/lib/film";

type FilmsResponse = {
  films: Array<FilmEntry | EnrichedFilm>;
  maxPage: number;
  username: string;
  displayName?: string;
  source?: "baked" | "rss";
  scrapedAt?: string;
  error?: string;
};

export function Analyzer() {
  const [input, setInput] = useState("philipphartmann");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [source, setSource] = useState<"baked" | "rss" | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | undefined>();

  async function loadFilms(rawInput: string) {
    setStatus("Lade Filmliste…");
    const res = await fetch(
      `/api/films?username=${encodeURIComponent(rawInput)}`,
    );
    const data = (await res.json()) as FilmsResponse;
    if (!res.ok) {
      throw new Error(data.error || "Filme konnten nicht geladen werden.");
    }
    return data;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setReport(null);
    setSource(null);
    setScrapedAt(undefined);
    setLoading(true);

    try {
      const data = await loadFilms(input);
      const { username, displayName, films } = data;
      if (!films.length) {
        throw new Error("Keine Filme gefunden.");
      }

      const dataSource = data.source ?? "rss";
      setSource(dataSource);
      setScrapedAt(data.scrapedAt);

      const enriched: EnrichedFilm[] = films.map((f) => {
        const withDetails = f as EnrichedFilm;
        if (dataSource === "baked") {
          return {
            ...f,
            genres: withDetails.genres ?? [],
            directors: withDetails.directors ?? [],
            description: withDetails.description ?? "",
          };
        }
        return {
          ...f,
          genres: [],
          directors: [],
          description: "",
        };
      });

      setReport(buildAnalysis(username, displayName || username, enriched));
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
              placeholder="philipphartmann"
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? "Analysiere…" : "Auswertung starten"}
            </button>
          </div>
          <p className="hint">
            Für <b>philipphartmann</b>: volle gebackene Bibliothek. Andere
            Profile: RSS (Tagebuch, max. 100).
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
                setSource(null);
              }}
            >
              Anderes Profil analysieren
            </button>
          </div>
          <StatsReport
            report={report}
            scrapedAt={scrapedAt}
            rssLimited={source === "rss"}
            bakedLibrary={source === "baked"}
          />
        </>
      )}
    </div>
  );
}
