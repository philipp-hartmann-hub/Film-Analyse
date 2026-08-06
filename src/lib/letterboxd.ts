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

function toUrl(value: string, base?: string): URL {
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
      return new URL(value);
    }
    if (value.startsWith("//")) {
      return new URL(`https:${value}`);
    }
    if (base) {
      return new URL(value, base);
    }
    return new URL(`https://${value}`);
  } catch {
    throw new Error("Ungültiger Link oder Username.");
  }
}

export async function resolveUsername(input: string): Promise<string> {
  try {
    return await resolveUsernameInner(input);
  } catch (error) {
    if (error instanceof Error) {
      // Safari/WebKit: "The string did not match the expected pattern."
      if (/expected pattern|invalid url|failed to construct/i.test(error.message)) {
        throw new Error("Ungültiger Link oder Username.");
      }
      throw error;
    }
    throw new Error("Ungültiger Link oder Username.");
  }
}

async function resolveUsernameInner(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Bitte einen Letterboxd-Link oder Username eingeben.");
  }

  if (/^[a-zA-Z0-9_]+$/.test(trimmed.replace(/^@/, ""))) {
    return trimmed.replace(/^@/, "").toLowerCase();
  }

  const url = toUrl(trimmed);
  const host = url.hostname.replace(/^www\./, "");

  if (host === "boxd.it" || host.endsWith(".boxd.it")) {
    // Prefer following redirects — final res.url is the profile page.
    try {
      const followed = await fetchWithRetry(url.toString(), {
        redirect: "follow",
        method: "GET",
      });
      if (followed.url && followed.url !== url.toString()) {
        return resolveUsernameInner(followed.url);
      }
    } catch {
      // fall through to manual redirect handling
    }

    const res = await fetchWithRetry(url.toString(), { redirect: "manual" });
    const location = res.headers.get("location");
    if (!location) {
      throw new Error(
        "Kurzlink konnte nicht aufgelöst werden. Bitte den letterboxd.com-Link oder Username nutzen.",
      );
    }
    return resolveUsernameInner(toUrl(location, url.toString()).toString());
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

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 6,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...headers(),
          "sec-ch-ua":
            '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          "sec-ch-ua-mobile": "?0",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "same-origin",
          ...(init.headers || {}),
        },
        cache: "no-store",
      });

      if (res.status === 429 || res.status === 503 || res.status === 403) {
        lastError = new Error(`Letterboxd ${res.status}`);
        // Exponential backoff — Cloudflare cools down quickly if we wait.
        await sleep(700 * 2 ** i);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Netzwerkfehler");
      await sleep(500 * 2 ** i);
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
