import {
  formatAvg,
  formatStars,
  type EnrichedFilm,
} from "@/lib/letterboxd";

export type BarItem = {
  label: string;
  value: number;
  display: string;
  pct: number;
  color: "g" | "b" | "o";
};

export type AnalysisReport = {
  username: string;
  displayName: string;
  totalFilms: number;
  ratedFilms: number;
  averageRating: number | null;
  fiveStarCount: number;
  topDecadeLabel: string | null;
  topDecadeShare: number | null;
  ratingBuckets: Array<{
    stars: number;
    label: string;
    count: number;
    pct: number;
    heightPct: number;
  }>;
  ratingInsight: string;
  decades: BarItem[];
  decadeInsight: string;
  genres: BarItem[];
  director: {
    name: string;
    count: number;
    average: number;
    films: Array<{ title: string; year: number | null; rating: number | null }>;
    blurb: string;
  } | null;
  franchises: BarItem[];
  franchiseInsight: string;
  genreAverages: BarItem[];
  genreAvgInsight: string;
  fiveStars: Array<{
    title: string;
    year: number | null;
    slug: string;
  }>;
  thesis: {
    kick: string;
    title: string;
    titleEm: string;
    body: string;
    stats: Array<{ value: string; label: string; green?: boolean }>;
  };
};

const FRANCHISES: Array<{ name: string; test: (title: string) => boolean }> = [
  {
    name: "Star Wars",
    test: (t) => /star wars|rogue one|solo:\s*a star wars/i.test(t),
  },
  {
    name: "Harry Potter",
    test: (t) => /harry potter|fantastic beasts/i.test(t),
  },
  {
    name: "Marvel (MCU)",
    test: (t) =>
      /avengers|iron man|captain america|thor[:\s]|guardians of the galaxy|black panther|doctor strange|spider-man|ant-man|captain marvel|black widow|shang-chi|eternals|wakanda|the marvels|deadpool|logan|wolverine|venom|morbius|blade/i.test(
        t,
      ),
  },
  {
    name: "James Bond",
    test: (t) =>
      /james bond|casino royale|skyfall|spectre|no time to die|quantum of solace|die another day|goldeneye|tomorrow never dies/i.test(
        t,
      ) || /\b007\b/.test(t),
  },
  {
    name: "Pixar",
    test: (t) =>
      /toy story|finding nemo|finding dory|inside out|up\b|wall-e|ratatouille|the incredibles|coco|soul\b|turning red|elemental|luca|lightyear|cars\b|monsters,? inc|monsters university|brave\b|onward|a bug's life/i.test(
        t,
      ),
  },
  {
    name: "Robert Langdon",
    test: (t) => /da vinci code|angels & demons|infernos?|langdon/i.test(t),
  },
  {
    name: "Fast & Furious",
    test: (t) => /fast (&|and) furious|fate of the furious|furious [0-9]|hobbs & shaw/i.test(t),
  },
  {
    name: "Mission: Impossible",
    test: (t) => /mission:\s*impossible/i.test(t),
  },
  {
    name: "Batman",
    test: (t) => /batman|dark knight|joker/i.test(t),
  },
  {
    name: "Lord of the Rings",
    test: (t) => /lord of the rings|hobbit/i.test(t),
  },
];

const THEME_RULES: Array<{
  em: string;
  keywords: RegExp;
  label: string;
}> = [
  {
    em: "Macht, Wahlen und Institutionen",
    label: "Macht & Institutionen",
    keywords:
      /power|politic|president|minister|war|churchill|brexit|lobby|conspiracy|trial|court|nazi|election|campaign|white house|parliament|fbi|cia|government|king|queen|pope|vatican|finance|wall street|bank|dictator|regime|nuremberg|collini|sloane|oppenheimer|darkest hour|cheney|lbj|palin|vice\b|social network|big short|margin call/i,
  },
  {
    em: "Raum, Zeit und große Systeme",
    label: "Raum & Systeme",
    keywords:
      /space|interstellar|inception|matrix|ai\b|android|future|dystopia|time|multiverse|quantum|planet|alien|mars|moon/i,
  },
  {
    em: "Familie, Schuld und Beziehungen",
    label: "Familie & Beziehungen",
    keywords:
      /family|mother|father|son|daughter|marriage|love|divorce|home|child|sister|brother|wife|husband/i,
  },
  {
    em: "Krieg, Überleben und Moral",
    label: "Krieg & Moral",
    keywords:
      /war|battle|soldier|army|nazi|holocaust|dunkirk|1917|saving private|apocalypse|combat|resistance/i,
  },
];

function decadeOf(year: number): string {
  const d = Math.floor(year / 10) * 10;
  return `${d}er`;
}

export function buildAnalysis(
  username: string,
  displayName: string,
  films: EnrichedFilm[],
): AnalysisReport {
  const rated = films.filter((f) => f.rating != null);
  const avg =
    rated.length > 0
      ? rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length
      : null;

  const fiveStars = rated
    .filter((f) => f.rating === 5)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  // Full-star histogram like the HTML (★ to ★★★★★ using half-star grouping into display buckets)
  // HTML used: ★★★, ★★★½, ★★★★, ★★★★½, ★★★★★ — only buckets that appear, or fixed 3-5 range
  const bucketStars = [3, 3.5, 4, 4.5, 5];
  const bucketCounts = new Map(bucketStars.map((s) => [s, 0]));
  let belowThree = 0;
  for (const f of rated) {
    const r = f.rating!;
    if (r < 3) {
      belowThree += 1;
      continue;
    }
    const key = Math.round(r * 2) / 2;
    if (bucketCounts.has(key)) {
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }
  }
  const maxBucket = Math.max(...bucketCounts.values(), 1);
  const ratingBuckets = bucketStars.map((stars) => {
    const count = bucketCounts.get(stars) ?? 0;
    return {
      stars,
      label: formatStars(stars),
      count,
      pct: rated.length ? Math.round((count / rated.length) * 100) : 0,
      heightPct: Math.max(6, Math.round((count / maxBucket) * 100)),
    };
  });

  const highShare = rated.length
    ? Math.round(
        (rated.filter((f) => (f.rating ?? 0) >= 3.5).length / rated.length) *
          100,
      )
    : 0;

  const ratingInsight =
    belowThree === 0 && rated.length > 0
      ? `Du hast keinen einzigen Film unter drei Sternen vergeben. ${highShare} % deiner Bewertungen liegen bei ★★★½ oder höher — ein sehr wohlwollender, aber klar abgestufter Blick.`
      : belowThree > 0
        ? `${belowThree} deiner Filme liegen unter drei Sternen. ${highShare} % bleiben trotzdem bei ★★★½ oder höher — du sortierst klar, ohne nur Extremnoten zu vergeben.`
        : "Noch keine Bewertungen gefunden.";

  // Decades
  const decadeMap = new Map<string, number>();
  let oldest: EnrichedFilm | null = null;
  for (const f of films) {
    if (f.year == null) continue;
    const label = decadeOf(f.year);
    decadeMap.set(label, (decadeMap.get(label) ?? 0) + 1);
    if (!oldest || (oldest.year ?? 9999) > f.year) oldest = f;
  }
  const decadeEntries = [...decadeMap.entries()].sort((a, b) => {
    const ay = Number(a[0].replace("er", ""));
    const by = Number(b[0].replace("er", ""));
    return by - ay;
  });
  const maxDecade = Math.max(...decadeEntries.map(([, c]) => c), 1);
  const decades: BarItem[] = decadeEntries.map(([label, value], i) => ({
    label,
    value,
    display: String(value),
    pct: Math.round((value / maxDecade) * 100),
    color: i === 0 || value === maxDecade ? "g" : "b",
  }));
  // mark top decade green
  const topDecade = decadeEntries.sort((a, b) => b[1] - a[1])[0];
  for (const d of decades) {
    d.color = topDecade && d.label === topDecade[0] ? "g" : "b";
  }
  const pre2000 = films.filter((f) => f.year != null && f.year < 2000).length;
  const decadeInsight = oldest
    ? pre2000 <= Math.max(3, Math.round(films.length * 0.1))
      ? `Ein durch und durch zeitgenössischer Blick: nur ${pre2000} deiner ${films.length} Filme stammen von vor 2000, der älteste ist ${oldest.title}${oldest.year ? ` (${oldest.year})` : ""}. Klassisches Kino ist noch weißer Fleck auf der Karte.`
      : `Dein Blick spannt sich über mehrere Epochen. Der älteste Film in der Sammlung ist ${oldest.title}${oldest.year ? ` (${oldest.year})` : ""}.`
    : "Keine Erscheinungsjahre gefunden.";

  // Genres count
  const genreCount = new Map<string, number>();
  const genreRatings = new Map<string, number[]>();
  for (const f of films) {
    for (const g of f.genres) {
      const de = translateGenre(g);
      genreCount.set(de, (genreCount.get(de) ?? 0) + 1);
      if (f.rating != null) {
        const arr = genreRatings.get(de) ?? [];
        arr.push(f.rating);
        genreRatings.set(de, arr);
      }
    }
  }
  const genreSorted = [...genreCount.entries()].sort((a, b) => b[1] - a[1]);
  const maxGenre = genreSorted[0]?.[1] ?? 1;
  const genres: BarItem[] = genreSorted.slice(0, 8).map(([label, value]) => ({
    label,
    value,
    display: String(value),
    pct: Math.round((value / maxGenre) * 100),
    color: "g",
  }));

  // Director spotlight: most watched with min 2 films, prefer highest avg among those with enough films
  const byDirector = new Map<string, EnrichedFilm[]>();
  for (const f of films) {
    for (const d of f.directors) {
      const list = byDirector.get(d) ?? [];
      list.push(f);
      byDirector.set(d, list);
    }
  }
  let director: AnalysisReport["director"] = null;
  const directorCandidates = [...byDirector.entries()]
    .map(([name, list]) => {
      const ratedList = list.filter((f) => f.rating != null);
      const average =
        ratedList.length > 0
          ? ratedList.reduce((s, f) => s + (f.rating ?? 0), 0) / ratedList.length
          : 0;
      return { name, list, average, count: list.length };
    })
    .filter((d) => d.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.average - a.average;
    });

  // Prefer highest average among directors with at least 3 films, else most watched
  const spotlight =
    directorCandidates
      .filter((d) => d.count >= 3)
      .sort((a, b) => b.average - a.average || b.count - a.count)[0] ||
    directorCandidates[0];

  if (spotlight) {
    const chips = [...spotlight.list]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6);
    director = {
      name: spotlight.name,
      count: spotlight.count,
      average: Number(spotlight.average.toFixed(1)),
      films: chips.map((f) => ({
        title: f.title,
        year: f.year,
        rating: f.rating,
      })),
      blurb: `${spotlight.count === 1 ? "Ein Film" : `${spotlight.count} Filme`}, Ø ${formatAvg(spotlight.average)} — ${
        spotlight.average >= 4.3
          ? "dein mit Abstand am höchsten bewerteter Regisseur und einer, dem du besonders treu folgst."
          : spotlight.count >= 4
            ? "einer der Regisseure, denen du am konsequentesten folgst."
            : "ein klarer Favorit in deiner Sammlung."
      }`,
    };
  }

  // Franchises
  const franchiseHits = FRANCHISES.map((fr) => ({
    name: fr.name,
    films: films.filter((f) => fr.test(f.title)),
  })).filter((f) => f.films.length >= 2);
  franchiseHits.sort((a, b) => b.films.length - a.films.length);
  const maxFr = franchiseHits[0]?.films.length ?? 1;
  const franchiseFilmSet = new Set(
    franchiseHits.flatMap((f) => f.films.map((x) => x.slug)),
  );
  const franchises: BarItem[] = franchiseHits.slice(0, 8).map((f) => ({
    label: f.name,
    value: f.films.length,
    display: String(f.films.length),
    pct: Math.round((f.films.length / maxFr) * 100),
    color: "o",
  }));
  const franchiseShare = films.length
    ? Math.round((franchiseFilmSet.size / films.length) * 100)
    : 0;
  const topTwo = franchiseHits.slice(0, 2).map((f) => f.name);
  const franchiseInsight =
    franchiseHits.length === 0
      ? "Kaum erkennbare Franchise-Cluster — deine Sammlung wirkt eher einzelwerkorientiert."
      : `${franchiseFilmSet.size} von ${films.length} Filmen gehören zu einer Reihe (${franchiseShare} %).${
          topTwo.length
            ? ` Besonders präsent: ${topTwo.join(" und ")}.`
            : ""
        }`;

  // Genre averages (min 3 rated)
  const genreAvgEntries = [...genreRatings.entries()]
    .map(([label, ratings]) => ({
      label,
      avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      n: ratings.length,
    }))
    .filter((g) => g.n >= 3)
    .sort((a, b) => b.avg - a.avg);
  const genreAverages: BarItem[] = genreAvgEntries.slice(0, 6).map((g) => ({
    label: g.label,
    value: g.avg,
    display: formatAvg(g.avg),
    pct: Math.round((g.avg / 5) * 100),
    color: g.avg >= 4 ? "g" : "b",
  }));
  const topG = genreAvgEntries[0];
  const lowG = genreAvgEntries[genreAvgEntries.length - 1];
  const genreAvgInsight =
    topG && lowG && topG.label !== lowG.label
      ? `${topG.label} liegt mit Ø ${formatAvg(topG.avg)} vorn — ${lowG.label} mit Ø ${formatAvg(lowG.avg)} eher zurückhaltend. Deine Noten sortieren Geschmack klar nach Ton und Thema.`
      : "Noch zu wenig Genres mit Bewertungen für einen Vergleich.";

  // Thesis
  const thesis = buildThesis(films, fiveStars, avg);

  return {
    username,
    displayName,
    totalFilms: films.length,
    ratedFilms: rated.length,
    averageRating: avg != null ? Number(avg.toFixed(1)) : null,
    fiveStarCount: fiveStars.length,
    topDecadeLabel: topDecade ? topDecade[0] : null,
    topDecadeShare: topDecade
      ? Math.round((topDecade[1] / films.length) * 100)
      : null,
    ratingBuckets,
    ratingInsight,
    decades: decades.sort((a, b) => {
      const ay = Number(a.label.replace("er", ""));
      const by = Number(b.label.replace("er", ""));
      return by - ay;
    }),
    decadeInsight,
    genres,
    director,
    franchises,
    franchiseInsight,
    genreAverages,
    genreAvgInsight,
    fiveStars: fiveStars.map((f) => ({
      title: f.title,
      year: f.year,
      slug: f.slug,
    })),
    thesis,
  };
}

function translateGenre(g: string): string {
  const map: Record<string, string> = {
    Drama: "Drama",
    Action: "Action",
    Adventure: "Abenteuer",
    History: "Historie",
    "Science Fiction": "Science-Fiction",
    Thriller: "Thriller",
    Comedy: "Komödie",
    Fantasy: "Fantasy",
    Crime: "Krimi",
    War: "Krieg",
    Romance: "Romantik",
    Horror: "Horror",
    Mystery: "Mystery",
    Animation: "Animation",
    Family: "Familie",
    Documentary: "Dokumentation",
    Music: "Musik",
    Western: "Western",
    "TV Movie": "TV-Film",
  };
  return map[g] ?? g;
}

function buildThesis(
  films: EnrichedFilm[],
  fiveStars: EnrichedFilm[],
  avg: number | null,
): AnalysisReport["thesis"] {
  const scored = THEME_RULES.map((rule) => {
    const matched = films.filter((f) => {
      const hay = `${f.title} ${f.description} ${f.genres.join(" ")}`;
      return rule.keywords.test(hay);
    });
    const rated = matched.filter((f) => f.rating != null);
    const themeAvg =
      rated.length > 0
        ? rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length
        : 0;
    const fiveOverlap = fiveStars.filter((f) => matched.includes(f)).length;
    return { rule, matched, themeAvg, fiveOverlap };
  }).sort(
    (a, b) =>
      b.matched.length + b.fiveOverlap * 2 - (a.matched.length + a.fiveOverlap * 2),
  );

  const best = scored[0];
  if (!best || best.matched.length < 3) {
    const topGenre = [...films.flatMap((f) => f.genres)]
      .reduce<Map<string, number>>((m, g) => {
        const de = translateGenre(g);
        m.set(de, (m.get(de) ?? 0) + 1);
        return m;
      }, new Map());
    const g = [...topGenre.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      kick: "Das rote Fadenmuster",
      title: "Deine Sammlung sortiert sich um",
      titleEm: g ? translateGenre(g[0]) : "klare Vorlieben",
      body: g
        ? `${g[1]} Filme tragen das Genre ${translateGenre(g[0])} — das ist der stabilste Nenner in deiner Liste. Dazu kommen starke Einzelwerke und Reihen, die den Geschmack weiter schärfen.`
        : "Mit wachsender Bibliothek treten Muster klarer hervor — Bewertungen und Genres zeigen schon jetzt eine erkennbare Handschrift.",
      stats: [
        {
          value: String(films.length),
          label: "Filme in der Auswertung",
        },
        {
          value: avg != null ? formatAvg(avg) : "–",
          label: "⌀ Bewertung",
          green: true,
        },
        {
          value: String(fiveStars.length),
          label: "Fünf-Sterne-Filme",
        },
      ],
    };
  }

  const examples = best.matched
    .filter((f) => (f.rating ?? 0) >= 4)
    .slice(0, 4)
    .map((f) => f.title);
  const fiveInTheme = best.fiveOverlap;
  const body = `${
    examples.length
      ? examples.join(", ")
      : best.matched
          .slice(0, 3)
          .map((f) => f.title)
          .join(", ")
  } — ${best.matched.length} deiner Filme erzählen davon, wie ${best.rule.label.toLowerCase()} den Ton setzen. Und genau die bewertest du oft besonders hoch.${
    fiveStars.length && fiveInTheme
      ? ` ${fiveInTheme} deiner ${fiveStars.length} Fünf-Sterne-Filme gehören dazu.`
      : ""
  }`;

  return {
    kick: "Das rote Fadenmuster",
    title: "Deine Sammlung dreht sich um",
    titleEm: best.rule.em,
    body,
    stats: [
      {
        value: String(best.matched.length),
        label: `Filme über ${best.rule.label}`,
      },
      {
        value: formatAvg(best.themeAvg || avg || 0),
        label: "⌀ Bewertung dieser Filme",
        green: true,
      },
      {
        value: fiveStars.length
          ? `${fiveInTheme}/${fiveStars.length}`
          : "0",
        label: "deiner Fünf-Sterne-Filme",
      },
    ],
  };
}
