import { NextRequest, NextResponse } from "next/server";
import {
  fetchDisplayName,
  fetchFilmsPage,
  resolveUsername,
} from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 30;

function friendlyError(error: unknown): string {
  if (!(error instanceof Error)) return "Unbekannter Fehler";
  if (/expected pattern|invalid url|failed to construct/i.test(error.message)) {
    return "Ungültiger Link oder Username.";
  }
  return error.message;
}

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get("username") ?? "";
    const pageParam = request.nextUrl.searchParams.get("page") ?? "1";
    const page = Math.max(1, Number(pageParam) || 1);
    const username = await resolveUsername(input);

    const data = await fetchFilmsPage(username, page);
    const displayName =
      page === 1 ? await fetchDisplayName(username) : username;

    return NextResponse.json({ ...data, displayName });
  } catch (error) {
    const message = friendlyError(error);
    const status = message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Prefer POST so full profile URLs are not mangled in query strings. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      page?: number | string;
    };
    const input = body.username ?? "";
    const page = Math.max(1, Number(body.page) || 1);
    const username = await resolveUsername(input);

    const data = await fetchFilmsPage(username, page);
    const displayName =
      page === 1 ? await fetchDisplayName(username) : username;

    return NextResponse.json({ ...data, displayName });
  } catch (error) {
    const message = friendlyError(error);
    const status = message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
