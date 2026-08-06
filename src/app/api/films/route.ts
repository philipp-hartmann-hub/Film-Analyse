import { NextRequest, NextResponse } from "next/server";
import {
  fetchDisplayName,
  fetchFilmsViaRss,
  parseUsername,
} from "@/lib/letterboxd";
import type { EnrichedFilm, FilmEntry } from "@/lib/film";
import baked from "@/data/letterboxd.json";

export const runtime = "nodejs";
export const maxDuration = 30;

type BakedDump = {
  username: string;
  displayName: string;
  scrapedAt: string;
  films: EnrichedFilm[];
};

const bakedData = baked as BakedDump;

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get("username") ?? "";
    const username = parseUsername(input);

    // Prefer locally baked full library for the known profile (RSS only has diary entries).
    if (username === bakedData.username) {
      return NextResponse.json({
        films: bakedData.films,
        maxPage: 1,
        username: bakedData.username,
        displayName: bakedData.displayName,
        source: "baked" as const,
        scrapedAt: bakedData.scrapedAt,
      });
    }

    const films: FilmEntry[] = await fetchFilmsViaRss(username);

    let displayName = username;
    try {
      displayName = await fetchDisplayName(username);
    } catch {
      displayName = username;
    }

    return NextResponse.json({
      films,
      maxPage: 1,
      username,
      displayName,
      source: "rss" as const,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    const status = message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
