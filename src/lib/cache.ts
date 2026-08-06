import "server-only";
import { Redis } from "@upstash/redis";

export type CachedFilmDetails = {
  genres: string[];
  directors: string[];
  description: string;
};

const FILM_DETAILS_PREFIX = "film:details:";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isCachedFilmDetails(value: unknown): value is CachedFilmDetails {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.genres) &&
    record.genres.every((g) => typeof g === "string") &&
    Array.isArray(record.directors) &&
    record.directors.every((d) => typeof d === "string") &&
    typeof record.description === "string"
  );
}

export async function getCachedFilmDetails(
  slug: string,
): Promise<CachedFilmDetails | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get<unknown>(`${FILM_DETAILS_PREFIX}${slug}`);
    if (!isCachedFilmDetails(value)) return null;
    return value;
  } catch {
    return null;
  }
}

export async function setCachedFilmDetails(
  slug: string,
  details: CachedFilmDetails,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    // Genres/directors are stable — keep entries indefinitely.
    await redis.set(`${FILM_DETAILS_PREFIX}${slug}`, details);
  } catch {
    // Cache must never break the app.
  }
}
