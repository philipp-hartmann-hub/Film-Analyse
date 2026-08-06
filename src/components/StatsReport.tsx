"use client";

import { useEffect, useState } from "react";
import { formatAvg, formatStars } from "@/lib/film";
import type { AnalysisReport, BarItem } from "@/lib/analysis";

function Dots() {
  return (
    <span className="dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function Bars({ items }: { items: BarItem[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [items]);

  return (
    <div className="bars">
      {items.map((item) => (
        <div className="row" key={item.label}>
          <span className="rl">{item.label}</span>
          <div className="track">
            <div
              className={`fill ${item.color}`}
              style={{ width: ready ? `${item.pct}%` : "0%" }}
            />
          </div>
          <span className="rv">{item.display}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsReport({
  report,
  scrapedAt,
  rssLimited = false,
  bakedLibrary = false,
}: {
  report: AnalysisReport;
  scrapedAt?: string;
  rssLimited?: boolean;
  bakedLibrary?: boolean;
}) {
  const [histoReady, setHistoReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHistoReady(true));
    return () => cancelAnimationFrame(id);
  }, [report]);

  const decadeTile =
    report.topDecadeLabel && report.topDecadeShare != null
      ? {
          value: `${report.topDecadeShare}`,
          suffix: "%",
          label: `aus den ${report.topDecadeLabel}`,
        }
      : {
          value: String(report.ratedFilms),
          suffix: "",
          label: "bewertet",
        };

  return (
    <div className="report">
      {bakedLibrary && (
        <p className="rss-banner">
          <span className="rss-badge baked">Bibliothek</span>
          Vollständige Auswertung aus der lokal gebackenen Filmliste (
          <b>{report.totalFilms}</b> Filme inkl. Genres &amp; Regisseure).
        </p>
      )}
      {rssLimited && (
        <p className="rss-banner">
          <span className="rss-badge">RSS · max. 100</span>
          Basierend auf den letzten <b>{report.totalFilms}</b>{" "}
          Tagebuch-Einträgen
          {report.totalFilms >= 100 ? " (Limit erreicht)" : ""}. Genre- und
          Regie-Auswertung sind hier nicht verfügbar — der RSS-Feed listet nur
          geloggte Diary-Einträge, nicht die ganze Watch-Liste.
        </p>
      )}

      <header className="report-header">
        <div className="eyebrow">
          <Dots /> Pro · Deine Statistik
        </div>
        <h1>{report.displayName}</h1>
        <p className="lede">
          Eine Auswertung deiner{" "}
          <b>{report.totalFilms} protokollierten Filme</b> — Bewertungen,
          Vorlieben und das Muster dahinter.
        </p>

        <div className="tiles">
          <div className="tile">
            <div className="v num">{report.totalFilms}</div>
            <div className="l">Filme gesehen</div>
          </div>
          <div className="tile">
            <div className="v num green">
              {report.averageRating != null
                ? formatAvg(report.averageRating)
                : "–"}
              <small> ⌀</small>
            </div>
            <div className="l">Bewertung</div>
          </div>
          <div className="tile">
            <div className="v num">
              {report.fiveStarCount}
              <small>×</small>
            </div>
            <div className="l">Fünf Sterne</div>
          </div>
          <div className="tile">
            <div className="v num">
              {decadeTile.value}
              <small>{decadeTile.suffix}</small>
            </div>
            <div className="l">{decadeTile.label}</div>
          </div>
        </div>
      </header>

      <section>
        <div className="sechead">
          <h2>Bewertungsverteilung</h2>
          <span className="note">{report.ratedFilms} bewertete Filme</span>
        </div>
        <div className="histo">
          {report.ratingBuckets.map((b) => (
            <div className="hcol" key={b.stars}>
              <span className="hcount">{b.count}</span>
              <div
                className="hbar"
                style={{ height: histoReady ? `${b.heightPct}%` : "0%" }}
              />
              <span className="hstars">{b.label}</span>
              <span className="hpct">{b.pct}%</span>
            </div>
          ))}
        </div>
        <p className="histo-foot">{report.ratingInsight}</p>
      </section>

      {report.decades.length > 0 && (
        <section>
          <div className="sechead">
            <h2>Nach Jahrzehnt</h2>
            <span className="note">Erscheinungsjahr</span>
          </div>
          <Bars items={report.decades} />
          <p className="histo-foot left">{report.decadeInsight}</p>
        </section>
      )}

      {report.genres.length > 0 && (
        <section>
          <div className="sechead">
            <h2>Meistgesehene Genres</h2>
            <span className="note">Mehrfachnennung je Film</span>
          </div>
          <Bars items={report.genres} />
        </section>
      )}

      {report.director && (
        <section>
          <div className="sechead">
            <h2>Dein Regisseur</h2>
          </div>
          <div className="spot">
            <div className="big">
              {formatAvg(report.director.average)}
              <small>
                ⌀ von {report.director.count}
              </small>
            </div>
            <div>
              <div className="who">{report.director.name}</div>
              <p className="desc">{report.director.blurb}</p>
              <div className="chips">
                {report.director.films.map((f) => (
                  <span className="chip" key={f.title}>
                    {f.title}{" "}
                    {f.rating != null && <b>{formatStars(f.rating)}</b>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {report.franchises.length > 0 && (
        <section>
          <div className="sechead">
            <h2>Reihen &amp; Franchises</h2>
            <span className="note">Cluster in der Sammlung</span>
          </div>
          <Bars items={report.franchises} />
          <p className="histo-foot left">{report.franchiseInsight}</p>
        </section>
      )}

      {report.genreAverages.length > 0 && (
        <section>
          <div className="sechead">
            <h2>Wo du am großzügigsten bist</h2>
            <span className="note">⌀ Bewertung je Genre</span>
          </div>
          <Bars items={report.genreAverages} />
          <p className="histo-foot left">{report.genreAvgInsight}</p>
        </section>
      )}

      {report.fiveStars.length > 0 && (
        <section>
          <div className="sechead">
            <h2>Deine Fünf-Sterne-Filme</h2>
            <span className="note">
              {report.fiveStars.length} von {report.totalFilms}
            </span>
          </div>
          <div className="fivelist">
            {report.fiveStars.map((f, i) => (
              <a
                key={f.slug}
                className="fl"
                href={`https://letterboxd.com/film/${f.slug}/`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="rank num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="t">{f.title}</span>
                <span className="y">{f.year ?? ""}</span>
                <span className="s">★★★★★</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="last">
        <div className="thesis">
          <div className="kick">{report.thesis.kick}</div>
          <h3>
            {report.thesis.title} <em>{report.thesis.titleEm}</em>.
          </h3>
          <p>{report.thesis.body}</p>
          <div className="tstat">
            {report.thesis.stats.map((s) => (
              <div key={s.label}>
                <div className={`n num ${s.green ? "green" : ""}`}>
                  {s.value}
                </div>
                <div className="c">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="report-footer">
        {scrapedAt && (
          <>
            Datenstand:{" "}
            {new Date(scrapedAt).toLocaleString("de-DE", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            <br />
          </>
        )}
        Auswertung aus dem öffentlichen Profil auf{" "}
        <a
          href={`https://letterboxd.com/${report.username}/`}
          target="_blank"
          rel="noreferrer"
        >
          letterboxd.com/{report.username}
        </a>
        .
        <br />
        Kein offizielles Letterboxd-Produkt · Outside the box
      </footer>
    </div>
  );
}
