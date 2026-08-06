import { NextRequest, NextResponse } from "next/server";
import {
  fetchFilmGenres,
  fetchTmdbGenres,
  type FilmEntry,
} from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ITEMS = 15;

type GenreRequestItem = {
  slug: string;
  title?: string;
  year?: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      slugs?: unknown;
      films?: unknown;
    };

    let items: GenreRequestItem[] = [];

    if (Array.isArray(body.films)) {
      items = body.films
        .filter(
          (f): f is FilmEntry =>
            !!f &&
            typeof f === "object" &&
            typeof (f as FilmEntry).slug === "string",
        )
        .map((f) => ({
          slug: f.slug,
          title: f.title,
          year: f.year,
        }));
    } else if (Array.isArray(body.slugs)) {
      items = body.slugs
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .map((slug) => ({ slug }));
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Keine Filme übergeben." },
        { status: 400 },
      );
    }

    const limited = items.slice(0, MAX_ITEMS);
    const tmdbKey = process.env.TMDB_API_KEY;

    const results = await Promise.all(
      limited.map(async (item) => {
        try {
          let genres: string[] = [];

          if (tmdbKey && item.title) {
            genres = await fetchTmdbGenres(
              item.title,
              item.year ?? null,
              tmdbKey,
            );
          }

          if (genres.length === 0) {
            genres = await fetchFilmGenres(item.slug);
          }

          return { slug: item.slug, genres, error: null as string | null };
        } catch (error) {
          return {
            slug: item.slug,
            genres: [] as string[],
            error: error instanceof Error ? error.message : "Fehler",
          };
        }
      }),
    );

    return NextResponse.json({
      results,
      source: tmdbKey ? "tmdb+letterboxd" : "letterboxd",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
