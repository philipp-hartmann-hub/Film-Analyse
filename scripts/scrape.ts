import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EnrichedFilm, FilmEntry } from "../src/lib/film";
import {
  fetchDisplayName,
  fetchFilmDetails,
  fetchFilmsPage,
} from "../src/lib/letterboxd-core";

const DETAIL_PAUSE_MS = 550;
const PAGE_PAUSE_MS = 2000;
const MAX_RETRIES = 6;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const wait = 800 * attempt * attempt;
      console.warn(
        `  ⚠ ${label} fehlgeschlagen (${attempt}/${MAX_RETRIES}): ${lastError.message}. Warte ${wait}ms…`,
      );
      await sleep(wait);
    }
  }
  throw lastError ?? new Error(`${label} fehlgeschlagen`);
}

async function loadAllFilms(username: string): Promise<FilmEntry[]> {
  const first = await withRetry(`Filme Seite 1`, () =>
    fetchFilmsPage(username, 1),
  );
  const films = [...first.films];
  console.log(`Seite 1/${first.maxPage}: ${first.films.length} Filme`);

  for (let page = 2; page <= first.maxPage; page++) {
    await sleep(PAGE_PAUSE_MS * page);
    try {
      const data = await withRetry(`Filme Seite ${page}`, () =>
        fetchFilmsPage(username, page),
      );
      films.push(...data.films);
      console.log(
        `Seite ${page}/${first.maxPage}: +${data.films.length} (gesamt ${films.length})`,
      );
    } catch (error) {
      console.warn(
        `Seite ${page} übersprungen (${error instanceof Error ? error.message : error}). Fahre mit ${films.length} Filmen fort.`,
      );
      break;
    }
  }

  return films;
}

async function enrichFilms(films: FilmEntry[]): Promise<EnrichedFilm[]> {
  const unique = new Map<string, FilmEntry>();
  for (const film of films) {
    if (!unique.has(film.slug)) unique.set(film.slug, film);
  }

  const slugs = [...unique.keys()];
  const enriched: EnrichedFilm[] = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const base = unique.get(slug)!;
    process.stdout.write(`\rDetails ${i + 1}/${slugs.length}: ${slug}`.padEnd(80));

    try {
      const details = await withRetry(`Film ${slug}`, () =>
        fetchFilmDetails(slug),
      );
      enriched.push({
        ...base,
        genres: details.genres,
        directors: details.directors,
        description: details.description,
      });
    } catch (error) {
      console.warn(
        `\n  ⚠ ${slug} übersprungen: ${error instanceof Error ? error.message : error}`,
      );
      enriched.push({
        ...base,
        genres: [],
        directors: [],
        description: "",
      });
    }

    await sleep(DETAIL_PAUSE_MS);
  }

  console.log("");
  return enriched;
}

async function main() {
  const username = (
    process.argv[2] ||
    process.env.LETTERBOXD_USER ||
    "philipphartmann"
  )
    .trim()
    .toLowerCase();

  console.log(`Scrape Letterboxd-Profil: ${username}`);

  const displayName = await withRetry("Display-Name", () =>
    fetchDisplayName(username),
  );
  console.log(`Display-Name: ${displayName}`);

  const films = await loadAllFilms(username);
  console.log(`Filmliste komplett: ${films.length} Einträge`);

  const enriched = await enrichFilms(films);
  const withGenres = enriched.filter((f) => f.genres.length > 0).length;
  console.log(`Angereichert: ${withGenres}/${enriched.length} mit Genres`);

  const payload = {
    username,
    displayName,
    scrapedAt: new Date().toISOString(),
    films: enriched,
  };

  const outDir = path.join(process.cwd(), "src", "data");
  const outFile = path.join(outDir, "letterboxd.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Geschrieben: ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
