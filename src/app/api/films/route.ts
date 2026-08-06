import { NextRequest, NextResponse } from "next/server";
import {
  fetchDisplayName,
  fetchFilmsPage,
  parseUsername,
} from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Original working endpoint: GET + parseUsername on the server. */
export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get("username") ?? "";
    const pageParam = request.nextUrl.searchParams.get("page") ?? "1";
    const page = Math.max(1, Number(pageParam) || 1);
    const username = parseUsername(input);

    const data = await fetchFilmsPage(username, page);
    const displayName =
      page === 1 ? await fetchDisplayName(username) : username;

    return NextResponse.json({ ...data, displayName });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    const status = message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
