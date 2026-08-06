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
          Username eingeben — Auswertung über den öffentlichen RSS-Feed.{" "}
          <b>Ohne Pro-Abo.</b>
        </p>
      </header>

      <Analyzer />
    </main>
  );
}
