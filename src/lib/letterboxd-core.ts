import * as cheerio from "cheerio";
import type { FilmEntry } from "@/lib/film";

export type { FilmEntry, EnrichedFilm } from "@/lib/film";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function headers(): HeadersInit {
  return {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://letterboxd.com/",
  };
}

/** Original working parser — regex only, no URL() (Safari-safe if ever reused). */
export function parseUsername(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Bitte einen Letterboxd-Link oder Username eingeben.");
  }

  const withoutProtocol = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  const lower = withoutProtocol.toLowerCase();

  if (lower.startsWith("boxd.it/")) {
    throw new Error(
      "Kurzlinks (boxd.it) bitte als Username eingeben, z. B. philipphartmann.",
    );
  }

  if (lower.startsWith("letterboxd.com/")) {
    const part = withoutProtocol.split("/").filter(Boolean)[1];
    if (
      !part ||
      ["film", "films", "list", "lists"].includes(part.toLowerCase())
    ) {
      throw new Error("Kein Username im Link gefunden.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(part)) {
      throw new Error("Ungültiger Username.");
    }
    return part.toLowerCase();
  }

  const username = trimmed.replace(/^@/, "").replace(/\/+$/, "");
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Ungültiger Username.");
  }
  return username.toLowerCase();
}

async function fetchHtml(url: string): Promise<string> {
  const scraperKey = process.env.SCRAPER_API_KEY;
  const requestUrl = scraperKey
    ? `https://api.scraperapi.com/?api_key=${scraperKey}&url=${encodeURIComponent(url)}`
    : url;

  const res = await fetch(requestUrl, {
    headers: scraperKey ? undefined : headers(),
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
      "Letterboxd hat die Anfrage blockiert. Bitte kurz warten und erneut versuchen.",
    );
  }
  return html;
}

function parseTitleYear(fullName: string): {
  title: string;
  year: number | null;
} {
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

    const ratingClass = item.find(".poster-viewingdata .rating").attr("class");
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

/** Public diary RSS — works from datacenter IPs; last ~50 entries, no genres. */
export async function fetchFilmsViaRss(username: string): Promise<FilmEntry[]> {
  const xml = await fetchHtml(`https://letterboxd.com/${username}/rss/`);
  const $ = cheerio.load(xml, { xmlMode: true });
  const films: FilmEntry[] = [];
  const seen = new Set<string>();

  $("item").each((_, el) => {
    const item = $(el);
    const title =
      item.find("letterboxd\\:filmTitle").first().text().trim() ||
      item.find("filmTitle").first().text().trim();
    const yearRaw =
      item.find("letterboxd\\:filmYear").first().text().trim() ||
      item.find("filmYear").first().text().trim();
    const ratingRaw =
      item.find("letterboxd\\:memberRating").first().text().trim() ||
      item.find("memberRating").first().text().trim();
    const link = item.find("link").first().text().trim();

    const slugMatch = link.match(/\/film\/([^/]+)\/?/);
    const slug = slugMatch?.[1] ?? null;
    if (!slug || !title || seen.has(slug)) return;
    seen.add(slug);

    const year =
      yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
    const ratingNum = ratingRaw ? Number(ratingRaw) : NaN;
    const rating = Number.isFinite(ratingNum) ? ratingNum : null;

    films.push({ slug, title, year, rating });
  });

  return films;
}

export function parseFilmDetails(html: string): {
  genres: string[];
  directors: string[];
  description: string;
} {
  const genres = new Set<string>();
  const directors = new Set<string>();
  let description = "";

  const ldBlocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json">\s*(?:\/\*[\s\S]*?\*\/\s*)?([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const block of ldBlocks) {
    try {
      const raw = block[1].replace(/^\/\*[\s\S]*?\*\//, "").trim();
      const data = JSON.parse(raw) as {
        "@type"?: string;
        genre?: string | string[];
        director?: Array<{ name?: string }> | { name?: string };
        description?: string;
      };
      if (data["@type"] !== "Movie" && !data.genre && !data.director) continue;

      if (Array.isArray(data.genre)) data.genre.forEach((g) => genres.add(g));
      else if (typeof data.genre === "string") genres.add(data.genre);

      const dirs = Array.isArray(data.director)
        ? data.director
        : data.director
          ? [data.director]
          : [];
      for (const d of dirs) {
        if (d?.name) directors.add(d.name);
      }
      if (data.description) description = data.description;
    } catch {
      // ignore
    }
  }

  if (genres.size === 0) {
    const jsonLdMatch = html.match(/"genre"\s*:\s*(\[[^\]]+\])/);
    if (jsonLdMatch) {
      try {
        const parsed = JSON.parse(jsonLdMatch[1]) as string[];
        parsed.forEach((g) => genres.add(g));
      } catch {
        // ignore
      }
    }
  }

  if (genres.size === 0) {
    const $ = cheerio.load(html);
    $('a[href^="/films/genre/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) genres.add(text);
    });
  }

  if (directors.size === 0) {
    for (const m of html.matchAll(
      /href="\/director\/[^"]+"[^>]*class="text-slug"[^>]*>([^<]+)/g,
    )) {
      directors.add(m[1].trim());
    }
  }

  return {
    genres: [...genres],
    directors: [...directors],
    description,
  };
}

export async function fetchFilmDetails(slug: string) {
  const html = await fetchHtml(`https://letterboxd.com/film/${slug}/`);
  return parseFilmDetails(html);
}

/** Original genre fetch — same film page, also returns directors for the new UI. */
export async function fetchFilmGenres(slug: string): Promise<string[]> {
  const details = await fetchFilmDetails(slug);
  return details.genres;
}

export async function fetchDisplayName(username: string): Promise<string> {
  try {
    const html = await fetchHtml(`https://letterboxd.com/${username}/`);
    const $ = cheerio.load(html);
    const og = $('meta[property="og:title"]').attr("content");
    if (og) {
      return og
        .replace(/\s*[·•|].*$/, "")
        .replace(/['’]s profile$/i, "")
        .replace(/\s+profile$/i, "")
        .trim();
    }
  } catch {
    // ignore
  }
  return username;
}
