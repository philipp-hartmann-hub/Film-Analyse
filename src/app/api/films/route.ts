import { NextRequest, NextResponse } from "next/server";
import { fetchDisplayName, fetchFilmsPage } from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Films API — accepts ONLY a plain username (like the early working version).
 * Resolve links via /api/resolve first.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      page?: number | string;
    };
    const username = (body.username ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(body.page) || 1);

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Bitte zuerst den Link auflösen oder nur den Username senden (z. B. philipphartmann).",
        },
        { status: 400 },
      );
    }

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
