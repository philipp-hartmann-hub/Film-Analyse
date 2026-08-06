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

export function parseUsername(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Bitte einen Letterboxd-Link oder Username eingeben.");
  }

  try {
    if (trimmed.includes("letterboxd.com") || trimmed.startsWith("http")) {
      const url = new URL(
        trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
      );
      if (!url.hostname.includes("letterboxd.com")) {
        throw new Error("Ungültiger Letterboxd-Link.");
      }
      const part = url.pathname.split("/").filter(Boolean)[0];
      if (!part || part === "film" || part === "films" || part === "list") {
        throw new Error("Kein Username im Link gefunden.");
      }
      return part.toLowerCase();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Letterboxd")) {
      throw error;
    }
    // fall through to username validation
  }

  const username = trimmed.replace(/^@/, "").replace(/\/+$/, "");
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Ungültiger Username.");
  }
  return username.toLowerCase();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: headers(),
    next: { revalidate: 0 },
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
  if (html.includes("Just a moment...") && html.includes("Cloudflare")) {
    throw new Error(
      "Letterboxd hat die Anfrage blockiert (Cloudflare). Bitte kurz warten und erneut versuchen.",
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
    // empty library or invalid profile that returned a page without posters
    const looksLikeProfile = html.includes(`/${username}/`) || html.includes("profile");
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

export function buildRatingDistribution(films: FilmEntry[]): RatingBucket[] {
  const counts = new Map<number, number>();
  for (let stars = 0.5; stars <= 5; stars += 0.5) {
    counts.set(stars, 0);
  }

  for (const film of films) {
    if (film.rating == null) continue;
    counts.set(film.rating, (counts.get(film.rating) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([stars, count]) => ({
      stars,
      label: formatStars(stars),
      count,
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
