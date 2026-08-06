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

export type RatingBucket = {
  stars: number;
  label: string;
  count: number;
};

export type GenreCount = {
  genre: string;
  count: number;
};

export function formatStars(stars: number): string {
  const full = Math.floor(stars);
  const half = stars % 1 !== 0;
  return `${"★".repeat(full)}${half ? "½" : ""}`;
}

export function formatAvg(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

export function buildRatingDistribution(films: FilmEntry[]): RatingBucket[] {
  const steps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const counts = new Map<number, number>(steps.map((s) => [s, 0]));

  for (const film of films) {
    if (film.rating == null) continue;
    const key = Math.round(film.rating * 2) / 2;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return steps.map((stars) => ({
    stars,
    label: formatStars(stars),
    count: counts.get(stars) ?? 0,
  }));
}

export function aggregateGenres(
  entries: { slug: string; genres: string[] }[],
): GenreCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const genre of entry.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export function ratingStats(films: FilmEntry[]) {
  const rated = films.filter((f) => f.rating != null);
  const sum = rated.reduce((acc, f) => acc + (f.rating ?? 0), 0);
  return {
    totalFilms: films.length,
    ratedFilms: rated.length,
    unratedFilms: films.length - rated.length,
    averageRating: rated.length ? Number((sum / rated.length).toFixed(2)) : null,
  };
}
