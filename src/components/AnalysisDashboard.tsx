"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilmEntry, GenreCount, RatingBucket } from "@/lib/letterboxd";

type Props = {
  ratings: RatingBucket[];
  genres: GenreCount[];
  stats: {
    totalFilms: number;
    ratedFilms: number;
    unratedFilms: number;
    averageRating: number | null;
  };
  username: string;
  genreProgress: { done: number; total: number };
  topFilms: FilmEntry[];
};

function TooltipShell({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm shadow-sm">
      <div className="font-medium text-[var(--ink)]">{label}</div>
      <div className="text-[var(--muted)]">{payload[0].value} Filme</div>
    </div>
  );
}

export function AnalysisDashboard({
  ratings,
  genres,
  stats,
  username,
  genreProgress,
  topFilms,
}: Props) {
  const topGenres = genres.slice(0, 12);
  const genrePct = genreProgress.total
    ? Math.round((genreProgress.done / genreProgress.total) * 100)
    : 0;

  return (
    <section className="mt-14 space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--accent)]">
            Auswertung
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)] md:text-4xl">
            @{username}
          </h2>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <Stat label="Filme" value={String(stats.totalFilms)} />
          <Stat label="Bewertet" value={String(stats.ratedFilms)} />
          <Stat
            label="Ø Rating"
            value={stats.averageRating != null ? String(stats.averageRating) : "–"}
          />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 md:p-6">
          <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Ratings
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Verteilung deiner Sterne-Bewertungen (½–5).
          </p>
          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratings} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TooltipShell />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                Top-Genres
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Häufigkeit der Genres in deiner Bibliothek.
              </p>
            </div>
            {genreProgress.done < genreProgress.total && (
              <span className="shrink-0 rounded-full bg-[var(--wash)] px-2.5 py-1 text-xs text-[var(--muted)]">
                {genrePct}%
              </span>
            )}
          </div>

          {genreProgress.total > 0 && genreProgress.done < genreProgress.total && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--wash)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${genrePct}%` }}
              />
            </div>
          )}

          <div className="mt-6 h-72 w-full">
            {topGenres.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                Genres werden geladen…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topGenres}
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--line)" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="genre"
                    width={88}
                    tick={{ fill: "var(--ink)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<TooltipShell />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                  <Bar dataKey="count" fill="var(--ink)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </div>

      {topFilms.length > 0 && (
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 md:p-6">
          <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Höchste Ratings
          </h3>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {topFilms.map((film) => (
              <li
                key={film.slug}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <a
                  href={`https://letterboxd.com/film/${film.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--ink)] underline-offset-4 hover:underline"
                >
                  {film.title}
                  {film.year ? ` (${film.year})` : ""}
                </a>
                <span className="shrink-0 tabular-nums text-[var(--accent)]">
                  {film.rating != null ? `${film.rating}★` : "–"}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 text-lg font-medium tabular-nums text-[var(--ink)]">
        {value}
      </div>
    </div>
  );
}
