import { NextRequest, NextResponse } from "next/server";
import { resolveUsername } from "@/lib/letterboxd";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Resolve any profile input (username, letterboxd URL, boxd.it) to a username. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { input?: string };
    const input = (body.input ?? "").trim();
    if (!input) {
      return NextResponse.json(
        { error: "Bitte einen Link oder Username eingeben." },
        { status: 400 },
      );
    }
    const username = await resolveUsername(input);
    return NextResponse.json({ username });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kurzlink konnte nicht aufgelöst werden.";
    return NextResponse.json(
      {
        error: /expected pattern|invalid url/i.test(message)
          ? "Kurzlink konnte nicht aufgelöst werden. Bitte Username nutzen (z. B. philipphartmann)."
          : message,
      },
      { status: 400 },
    );
  }
}
