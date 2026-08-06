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

export function Analyzer() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);

  async function loadFilms(rawInput: string) {
    setStatus("Lade Filmliste (RSS)…");
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
    setLoading(true);

    try {
      const { username, displayName, films } = await loadFilms(input);
      if (!films.length) {
        throw new Error("Keine Einträge im Letterboxd-RSS gefunden.");
      }

      const enriched: EnrichedFilm[] = films.map((f) => ({
        ...f,
        genres: [],
        directors: [],
        description: "",
      }));

      setReport(
        buildAnalysis(username, displayName || username, enriched),
      );
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
            Auswertung über den öffentlichen RSS-Feed (letzte Einträge).
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
          <StatsReport report={report} rssLimited />
        </>
      )}
    </div>
  );
}
