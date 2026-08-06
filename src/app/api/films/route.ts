import { NextRequest, NextResponse } from "next/server";
import { fetchFilmsPage, parseUsername } from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get("username") ?? "";
    const pageParam = request.nextUrl.searchParams.get("page") ?? "1";
    const page = Math.max(1, Number(pageParam) || 1);
    const username = parseUsername(input);

    const data = await fetchFilmsPage(username, page);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    const status = message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
