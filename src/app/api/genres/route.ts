import { NextRequest, NextResponse } from "next/server";
import { fetchFilmGenres } from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SLUGS = 12;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { slugs?: unknown };
    const slugs = Array.isArray(body.slugs)
      ? body.slugs.filter((s): s is string => typeof s === "string" && s.length > 0)
      : [];

    if (slugs.length === 0) {
      return NextResponse.json(
        { error: "Keine Film-Slugs übergeben." },
        { status: 400 },
      );
    }

    const limited = slugs.slice(0, MAX_SLUGS);
    const results = await Promise.all(
      limited.map(async (slug) => {
        try {
          const genres = await fetchFilmGenres(slug);
          return { slug, genres, error: null as string | null };
        } catch (error) {
          return {
            slug,
            genres: [] as string[],
            error: error instanceof Error ? error.message : "Fehler",
          };
        }
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
