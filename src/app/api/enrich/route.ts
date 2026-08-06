import { NextRequest, NextResponse } from "next/server";
import { fetchFilmDetails } from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX = 5;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { slugs?: unknown };
    const slugs = Array.isArray(body.slugs)
      ? body.slugs.filter((s): s is string => typeof s === "string" && !!s)
      : [];

    if (!slugs.length) {
      return NextResponse.json({ error: "Keine Slugs." }, { status: 400 });
    }

    const limited = slugs.slice(0, MAX);
    const results = [];

    for (const slug of limited) {
      try {
        const details = await fetchFilmDetails(slug);
        results.push({ slug, ...details, error: null as string | null });
      } catch (error) {
        results.push({
          slug,
          genres: [] as string[],
          directors: [] as string[],
          description: "",
          error: error instanceof Error ? error.message : "Fehler",
        });
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 400 },
    );
  }
}
