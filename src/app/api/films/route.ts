import { NextRequest, NextResponse } from "next/server";
import {
  fetchDisplayName,
  fetchFilmsViaRss,
  parseUsername,
} from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get("username") ?? "";
    const username = parseUsername(input);
    const films = await fetchFilmsViaRss(username);

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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    const status = message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
