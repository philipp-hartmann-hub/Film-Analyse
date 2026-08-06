/**
 * Client-safe profile input parsing — no URL() constructor (Safari throws
 * "The string did not match the expected pattern." for some URL edge cases).
 */

export type ParsedProfileInput =
  | { kind: "username"; username: string }
  | { kind: "shortlink"; href: string }
  | { kind: "invalid"; message: string };

export function parseProfileInput(raw: string): ParsedProfileInput {
  const input = raw.trim();
  if (!input) {
    return { kind: "invalid", message: "Bitte einen Link oder Username eingeben." };
  }

  // Plain username
  const plain = input.replace(/^@/, "");
  if (/^[a-zA-Z0-9_]+$/.test(plain)) {
    return { kind: "username", username: plain.toLowerCase() };
  }

  // Normalize for regex matching (no URL class)
  const lowered = input.toLowerCase();
  const withoutProtocol = lowered.replace(/^https?:\/\//, "").replace(/^www\./, "");

  // boxd.it short links — code is NOT the username
  if (withoutProtocol.startsWith("boxd.it/")) {
    const href = input.startsWith("http") ? input : `https://${input}`;
    return { kind: "shortlink", href };
  }

  // letterboxd.com/{username}/...
  const lb = withoutProtocol.match(/^letterboxd\.com\/([a-zA-Z0-9_]+)(?:\/|$)/);
  if (lb) {
    const username = lb[1];
    const reserved = new Set([
      "film",
      "films",
      "list",
      "lists",
      "actor",
      "director",
      "settings",
      "search",
      "reviews",
      "likes",
    ]);
    if (reserved.has(username)) {
      return {
        kind: "invalid",
        message: "Kein Profil-Link. Bitte den Link zu deinem Profil nutzen.",
      };
    }
    return { kind: "username", username };
  }

  return {
    kind: "invalid",
    message:
      "Ungültiger Link. Nutze Username, letterboxd.com/deinname oder boxd.it/…",
  };
}
