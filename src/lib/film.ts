export type FilmEntry = {
  slug: string;
  title: string;
  year: number | null;
  rating: number | null;
};

export type EnrichedFilm = FilmEntry & {
  genres: string[];
  directors: string[];
  description: string;
};

export function formatStars(stars: number): string {
  const full = Math.floor(stars);
  const half = stars % 1 !== 0;
  return `${"★".repeat(full)}${half ? "½" : ""}`;
}

export function formatAvg(n: number): string {
  return n.toFixed(1).replace(".", ",");
}
