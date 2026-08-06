import { StatsReport } from "@/components/StatsReport";
import { ProfileNote } from "@/components/ProfileNote";
import { buildAnalysis } from "@/lib/analysis";
import type { EnrichedFilm } from "@/lib/film";
import data from "@/data/letterboxd.json";

type LetterboxdDump = {
  username: string;
  displayName: string;
  scrapedAt: string;
  films: EnrichedFilm[];
};

const dump = data as LetterboxdDump;

export default function Home() {
  const report = buildAnalysis(dump.username, dump.displayName, dump.films);

  return (
    <main className="page">
      <header className="landing-header">
        <div className="brand">
          <span className="dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          Outside the box
        </div>
        <h1>Deine Letterboxd-Statistik</h1>
        <p className="sub">
          Statische Auswertung von <b>{dump.displayName}</b> — ohne Live-Scrape,
          ohne Pro-Abo.
        </p>
      </header>

      <ProfileNote bakedUsername={dump.username} displayName={dump.displayName} />
      <StatsReport report={report} scrapedAt={dump.scrapedAt} />
    </main>
  );
}
