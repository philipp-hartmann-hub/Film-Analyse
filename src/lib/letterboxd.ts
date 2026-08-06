import "server-only";
import * as cheerio from "cheerio";
import type { FilmEntry } from "@/lib/film";

export type { FilmEntry, EnrichedFilm } from "@/lib/film";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function headers(): HeadersInit {
  return {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: "https://letterboxd.com/",
    "Cache-Control": "no-cache",
  };
}

/**
 * Resolve profile input to a Letterboxd username.
 * Avoids URL() where possible — WebKit/Safari throws
 * "The string did not match the expected pattern." for some URL edge cases.
 */
export async function resolveUsername(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Bitte einen Letterboxd-Link oder Username eingeben.");
  }

  const plain = trimmed.replace(/^@/, "");
  if (/^[a-zA-Z0-9_]+$/.test(plain)) {
    return plain.toLowerCase();
  }

  const normalized = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const lower = normalized.toLowerCase();

  // boxd.it/{code} → follow redirect, extract username via regex
  if (lower.startsWith("boxd.it/")) {
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return resolveBoxdShortlink(href);
  }

  // letterboxd.com/{username}/...
  const lb = lower.match(/^letterboxd\.com\/([a-zA-Z0-9_]+)(?:\/|$)/);
  if (lb) {
    const username = lb[1];
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
    if (reserved.has(username)) {
      throw new Error("Kein Username im Link gefunden.");
    }
    return username;
  }

  throw new Error(
    "Ungültiger Link. Nutze Username, letterboxd.com/deinname oder boxd.it/…",
  );
}

async function resolveBoxdShortlink(href: string): Promise<string> {
  // Try Location header first (no body download)
  try {
    const res = await fetch(href, {
      method: "GET",
      redirect: "manual",
      headers: headers(),
      cache: "no-store",
    });
    const location = res.headers.get("location");
    const fromLocation = usernameFromLetterboxdHref(location);
    if (fromLocation) return fromLocation;
  } catch {
    // continue
  }

  // Follow redirects and inspect final URL string with regex only
  const followed = await fetchWithRetry(href, { redirect: "follow" });
  const fromFinal = usernameFromLetterboxdHref(followed.url);
  if (fromFinal) return fromFinal;

  throw new Error(
    "Kurzlink konnte nicht aufgelöst werden. Bitte Username nutzen (z. B. philipphartmann).",
  );
}

function usernameFromLetterboxdHref(href: string | null): string | null {
  if (!href) return null;
  const m = href.match(/letterboxd\.com\/([a-zA-Z0-9_]+)/i);
  if (!m) return null;
  const username = m[1].toLowerCase();
  if (username === "film" || username === "films") return null;
  return username;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 5,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { ...headers(), ...(init.headers || {}) },
        cache: "no-store",
      });

      if (res.status === 429 || res.status === 503 || res.status === 403) {
        lastError = new Error(`Letterboxd ${res.status}`);
        await sleep(600 * 2 ** i);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Netzwerkfehler");
      await sleep(400 * 2 ** i);
    }
  }

  throw lastError ?? new Error("Letterboxd nicht erreichbar.");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetchWithRetry(url);
  if (res.status === 404) throw new Error("Profil nicht gefunden.");
  if (!res.ok) {
    throw new Error(
      `Letterboxd antwortete mit ${res.status}. Bitte kurz warten und erneut versuchen.`,
    );
  }
  const html = await res.text();
  if (
    html.includes("Just a moment...") ||
    (html.includes("cf-browser-verification") && html.includes("Cloudflare"))
  ) {
    throw new Error(
      "Letterboxd blockiert gerade Anfragen. Bitte 20–30 Sekunden warten und erneut versuchen.",
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

export async function fetchDisplayName(username: string): Promise<string> {
  try {
    const html = await fetchHtml(`https://letterboxd.com/${username}/`);
    const $ = cheerio.load(html);
    const og = $('meta[property="og:title"]').attr("content");
    if (og) {
      return og
        .replace(/\s*[·•|].*$/, "")
        .replace(/'s profile$/i, "")
        .replace(/’s profile$/i, "")
        .replace(/\s+profile$/i, "")
        .trim();
    }
    const h1 = $("h1").first().text().trim();
    if (h1) return h1;
  } catch {
    // ignore
  }
  return username;
}

export async function fetchFilmsPage(
  username: string,
  page: number,
): Promise<{ films: FilmEntry[]; maxPage: number; username: string }> {
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Ungültiger Username.");
  }

  const path =
    page <= 1
      ? `https://letterboxd.com/${username}/films/`
      : `https://letterboxd.com/${username}/films/page/${page}/`;

  const html = await fetchHtml(path);
  const { films, maxPage } = parseFilmsPage(html);

  if (page === 1 && films.length === 0) {
    const looksLikeProfile =
      html.includes(`/${username}/`) || html.toLowerCase().includes("profile");
    if (!looksLikeProfile) throw new Error("Profil nicht gefunden.");
  }

  return { films, maxPage: Math.max(maxPage, page), username };
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
      // ignore malformed ld+json
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
