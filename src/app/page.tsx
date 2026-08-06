import { Analyzer } from "@/components/Analyzer";

export default function Home() {
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
          Profil-Link eingeben — Bewertungen, Genres, Regisseure und das Muster
          dahinter. <b>Ohne Pro-Abo.</b>
        </p>
      </header>

      <Analyzer />
    </main>
  );
}
