import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type FilmEntry = {
  slug: string;
  title: string;
  year: number | null;
  rating: number | null; // 0.5–5.0 stars
};

export type RatingBucket = {
  stars: number;
  label: string;
  count: number;
};

export type GenreCount = {
  genre: string;
  count: number;
};

function headers(): HeadersInit {
  return {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://letterboxd.com/",
  };
}

/** Resolve boxd.it / letterboxd URLs or plain usernames to a username. */
export async function resolveUsername(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Bitte einen Letterboxd-Link oder Username eingeben.");
  }

  // Plain username
  if (/^[a-zA-Z0-9_]+$/.test(trimmed.replace(/^@/, ""))) {
    return trimmed.replace(/^@/, "").toLowerCase();
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Ungültiger Link oder Username.");
  }

  const host = url.hostname.replace(/^www\./, "");

  // Short links → follow redirect to letterboxd.com/username/
  if (host === "boxd.it" || host.endsWith(".boxd.it")) {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: headers(),
    });
    const location = res.headers.get("location");
    if (!location) {
      throw new Error("Kurzlink konnte nicht aufgelöst werden.");
    }
    return resolveUsername(location);
  }

  if (!host.includes("letterboxd.com")) {
    throw new Error("Ungültiger Letterboxd-Link.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const reserved = new Set([
    "film",
    "films",
    "list",
    "lists",
    "actor",
    "director",
    "writer",
    "settings",
    "search",
    "reviews",
    "likes",
  ]);
  const username = parts[0];
  if (!username || reserved.has(username.toLowerCase())) {
    throw new Error("Kein Username im Link gefunden.");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Ungültiger Username.");
  }
  return username.toLowerCase();
}

/** Sync parser for cases where we already have a username (no network). */
export function parseUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, "");
  if (/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  throw new Error("Ungültiger Username.");
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: headers(),
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error("Profil nicht gefunden.");
  }
  if (!res.ok) {
    throw new Error(
      `Letterboxd antwortete mit ${res.status}. Bitte später erneut versuchen.`,
    );
  }

  const html = await res.text();
  if (html.includes("Just a moment...") && html.includes("challenge")) {
    throw new Error(
      "Letterboxd hat die Anfrage blockiert (Cloudflare). Bitte ZIP-Export nutzen oder später erneut versuchen.",
    );
  }
  return html;
}

function parseTitleYear(fullName: string): { title: string; year: number | null } {
  const match = fullName.match(/^(.*)\s+\((\d{4})\)$/);
  if (!match) return { title: fullName, year: null };
  return { title: match[1], year: Number(match[2]) };
}

export function parseFilmsPage(html: string): {
  films: FilmEntry[];
  maxPage: number;
} {
  const $ = cheerio.load(html);
  const films: FilmEntry[] = [];

  $("li.griditem").each((_, el) => {
    const item = $(el);
    const slug =
      item.find("[data-item-slug]").attr("data-item-slug") ||
      item.find("[data-film-slug]").attr("data-film-slug");
    const fullName =
      item.find("[data-item-name]").attr("data-item-name") ||
      item.find("[data-film-name]").attr("data-film-name") ||
      "";

    if (!slug || !fullName) return;

    const ratingClass = item
      .find(".poster-viewingdata .rating")
      .attr("class");
    const ratedMatch = ratingClass?.match(/rated-(\d+)/);
    const rating = ratedMatch ? Number(ratedMatch[1]) / 2 : null;
    const { title, year } = parseTitleYear(fullName);

    films.push({ slug, title, year, rating });
  });

  let maxPage = 1;
  $("a[href*='/films/page/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/\/films\/page\/(\d+)/);
    if (match) maxPage = Math.max(maxPage, Number(match[1]));
  });

  return { films, maxPage };
}

export async function fetchFilmsPage(
  username: string,
  page: number,
): Promise<{ films: FilmEntry[]; maxPage: number; username: string }> {
  const path =
    page <= 1
      ? `https://letterboxd.com/${username}/films/`
      : `https://letterboxd.com/${username}/films/page/${page}/`;

  const html = await fetchHtml(path);
  const { films, maxPage } = parseFilmsPage(html);

  if (page === 1 && films.length === 0) {
    const looksLikeProfile =
      html.includes(`/${username}/`) || html.toLowerCase().includes("profile");
    if (!looksLikeProfile) {
      throw new Error("Profil nicht gefunden.");
    }
  }

  return { films, maxPage: Math.max(maxPage, page), username };
}

export function parseGenresFromFilmPage(html: string): string[] {
  const jsonLdMatch = html.match(/"genre"\s*:\s*(\[[^\]]+\])/);
  if (jsonLdMatch) {
    try {
      const genres = JSON.parse(jsonLdMatch[1]) as string[];
      if (Array.isArray(genres) && genres.length > 0) {
        return genres.map((g) => String(g));
      }
    } catch {
      // fall through
    }
  }

  const $ = cheerio.load(html);
  const genres = new Set<string>();
  $('a[href^="/films/genre/"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text) genres.add(text);
  });
  return [...genres];
}

export async function fetchFilmGenres(slug: string): Promise<string[]> {
  const html = await fetchHtml(`https://letterboxd.com/film/${slug}/`);
  return parseGenresFromFilmPage(html);
}

/** TMDB genre enrichment (optional, needs TMDB_API_KEY). */
export async function fetchTmdbGenres(
  title: string,
  year: number | null,
  apiKey: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query: title,
    include_adult: "false",
  });
  if (year) params.set("year", String(year));

  const searchRes = await fetch(
    `https://api.themoviedb.org/3/search/movie?${params}`,
    { cache: "no-store" },
  );
  if (!searchRes.ok) return [];
  const searchJson = (await searchRes.json()) as {
    results?: Array<{ id: number; title: string; release_date?: string }>;
  };
  const hit = searchJson.results?.[0];
  if (!hit) return [];

  const detailRes = await fetch(
    `https://api.themoviedb.org/3/movie/${hit.id}?api_key=${apiKey}`,
    { cache: "no-store" },
  );
  if (!detailRes.ok) return [];
  const detail = (await detailRes.json()) as {
    genres?: Array<{ name: string }>;
  };
  return (detail.genres ?? []).map((g) => g.name);
}

export function buildRatingDistribution(films: FilmEntry[]): RatingBucket[] {
  const steps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const counts = new Map<number, number>(steps.map((s) => [s, 0]));

  for (const film of films) {
    if (film.rating == null) continue;
    const key = Math.round(film.rating * 2) / 2;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return steps.map((stars) => ({
    stars,
    label: formatStars(stars),
    count: counts.get(stars) ?? 0,
  }));
}

export function formatStars(stars: number): string {
  const full = Math.floor(stars);
  const half = stars % 1 !== 0;
  return `${"★".repeat(full)}${half ? "½" : ""}`;
}

export function aggregateGenres(
  entries: { slug: string; genres: string[] }[],
): GenreCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const genre of entry.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export function ratingStats(films: FilmEntry[]) {
  const rated = films.filter((f) => f.rating != null);
  const sum = rated.reduce((acc, f) => acc + (f.rating ?? 0), 0);
  return {
    totalFilms: films.length,
    ratedFilms: rated.length,
    unratedFilms: films.length - rated.length,
    averageRating: rated.length ? Number((sum / rated.length).toFixed(2)) : null,
  };
}

export function slugFromLetterboxdUri(uri: string): string | null {
  const match = uri.match(/letterboxd\.com\/film\/([^/]+)/i);
  return match ? match[1] : null;
}

/** Parse Letterboxd ratings.csv / watched.csv content. */
export function parseLetterboxdCsv(csvText: string): FilmEntry[] {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headersRow = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const nameIdx = headersRow.findIndex((h) => h === "name");
  const yearIdx = headersRow.findIndex((h) => h === "year");
  const uriIdx = headersRow.findIndex(
    (h) => h === "letterboxd uri" || h === "uri",
  );
  const ratingIdx = headersRow.findIndex((h) => h === "rating");

  if (nameIdx < 0) return [];

  const films: FilmEntry[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const title = cols[nameIdx]?.trim();
    if (!title) continue;

    const yearRaw = yearIdx >= 0 ? cols[yearIdx]?.trim() : "";
    const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
    const uri = uriIdx >= 0 ? cols[uriIdx]?.trim() : "";
    const slug =
      (uri && slugFromLetterboxdUri(uri)) ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const ratingRaw = ratingIdx >= 0 ? cols[ratingIdx]?.trim() : "";
    const rating =
      ratingRaw && !Number.isNaN(Number(ratingRaw))
        ? Number(ratingRaw)
        : null;

    const key = slug || `${title}-${year ?? ""}`;
    if (seen.has(key)) {
      // Prefer row with rating if duplicate (ratings.csv + watched.csv)
      const existing = films.find((f) => f.slug === slug);
      if (existing && existing.rating == null && rating != null) {
        existing.rating = rating;
      }
      continue;
    }
    seen.add(key);
    films.push({ slug, title, year, rating });
  }

  return films;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}
