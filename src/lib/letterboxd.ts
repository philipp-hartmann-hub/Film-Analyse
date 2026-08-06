import "server-only";
import { getCachedFilmDetails, setCachedFilmDetails } from "@/lib/cache";
import {
  fetchFilmDetails as fetchFilmDetailsUncached,
  fetchDisplayName,
  fetchFilmGenres,
  fetchFilmsPage,
  parseFilmDetails,
  parseFilmsPage,
  parseUsername,
} from "@/lib/letterboxd-core";

export type { FilmEntry, EnrichedFilm } from "@/lib/film";
export {
  fetchDisplayName,
  fetchFilmGenres,
  fetchFilmsPage,
  parseFilmDetails,
  parseFilmsPage,
  parseUsername,
};

export async function fetchFilmDetails(slug: string) {
  const cached = await getCachedFilmDetails(slug);
  if (cached) return cached;

  const details = await fetchFilmDetailsUncached(slug);
  await setCachedFilmDetails(slug, details);
  return details;
}
