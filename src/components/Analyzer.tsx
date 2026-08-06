"use client";

import { FormEvent, useState } from "react";
import { StatsReport } from "@/components/StatsReport";
import { buildAnalysis, type AnalysisReport } from "@/lib/analysis";
import type { EnrichedFilm, FilmEntry } from "@/lib/film";
import { parseProfileInput } from "@/lib/parseProfileInput";

type FilmsResponse = {
  films: FilmEntry[];
  maxPage: number;
  username: string;
  displayName?: string;
  error?: string;
};

type EnrichResponse = {
  results: Array<{
    slug: string;
    genres: string[];
    directors: string[];
    description: string;
    error: string | null;
  }>;
  error?: string;
};

const ENRICH_BATCH = 5;

export function Analyzer() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);

  async function resolveToUsername(raw: string): Promise<string> {
    const parsed = parseProfileInput(raw);
    if (parsed.kind === "invalid") throw new Error(parsed.message);

    if (parsed.kind === "username") {
      return parsed.username;
    }

    // shortlink → server resolve (no URL() in the browser)
    setStatus("Löse Kurzlink auf…");
    const res = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: parsed.href }),
    });
    const data = (await res.json()) as { username?: string; error?: string };
    if (!res.ok || !data.username) {
      throw new Error(
        data.error ||
          "Kurzlink fehlgeschlagen. Bitte Username eingeben (z. B. philipphartmann).",
      );
    }
    return data.username;
  }

  async function fetchFilmsPage(username: string, page: number) {
    const res = await fetch("/api/films", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, page }),
    });
    const data = (await res.json()) as FilmsResponse;
    if (!res.ok) {
      throw new Error(data.error || "Filme konnten nicht geladen werden.");
    }
    return data;
  }

  async function loadAllFilms(username: string) {
    setStatus("Lade Filmliste…");
    const first = await fetchFilmsPage(username, 1);
    const all = [...first.films];
    const { maxPage, displayName } = first;

    for (let page = 2; page <= maxPage; page++) {
      setStatus(`Lade Filmliste… Seite ${page} / ${maxPage}`);
      await new Promise((r) => setTimeout(r, 350));
      const nextPage = await fetchFilmsPage(username, page);
      all.push(...nextPage.films);
    }

    return {
      username,
      displayName: displayName || username,
      films: all,
    };
  }

  async function enrichFilms(films: FilmEntry[]) {
    const map = new Map<string, EnrichedFilm>();
    for (const f of films) {
      map.set(f.slug, { ...f, genres: [], directors: [], description: "" });
    }

    const slugs = films.map((f) => f.slug);
    for (let i = 0; i < slugs.length; i += ENRICH_BATCH) {
      const batch = slugs.slice(i, i + ENRICH_BATCH);
      setStatus(
        `Lade Details… ${Math.min(i + batch.length, slugs.length)}/${slugs.length}`,
      );

      let attempt = 0;
      while (attempt < 4) {
        try {
          const res = await fetch("/api/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slugs: batch }),
          });
          const data = (await res.json()) as EnrichResponse;
          if (!res.ok) throw new Error(data.error || "Details fehlgeschlagen");

          for (const r of data.results) {
            const film = map.get(r.slug);
            if (!film) continue;
            film.genres = r.genres;
            film.directors = r.directors;
            film.description = r.description;
          }
          break;
        } catch (err) {
          attempt += 1;
          if (attempt >= 4) console.error(err);
          else await new Promise((r) => setTimeout(r, 900 * attempt));
        }
      }

      await new Promise((r) => setTimeout(r, 250));
    }

    return [...map.values()];
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setReport(null);
    setLoading(true);

    try {
      const username = await resolveToUsername(input);
      const { displayName, films } = await loadAllFilms(username);
      if (!films.length) {
        throw new Error("Keine Filme in diesem Profil gefunden.");
      }

      const enriched = await enrichFilms(films);
      const analysis = buildAnalysis(username, displayName, enriched);
      setReport(analysis);
      setStatus("");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(
        /expected pattern|invalid url|failed to construct/i.test(raw)
          ? "Link-Verarbeitung fehlgeschlagen. Bitte einfach den Username eingeben (z. B. philipphartmann)."
          : raw,
      );
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
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="philipphartmann  oder  letterboxd.com/philipphartmann"
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? "Analysiere…" : "Auswertung starten"}
            </button>
          </div>
          <p className="hint">
            Am zuverlässigsten: nur der Username. Kurzlinks (boxd.it) werden
            serverseitig aufgelöst.
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
