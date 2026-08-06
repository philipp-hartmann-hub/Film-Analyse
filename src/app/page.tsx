import { Analyzer } from "@/components/Analyzer";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-14 md:px-8 md:pt-20">
      <header className="max-w-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
          Film-Analyse
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-tight text-[var(--ink)] md:text-6xl">
          Deine Letterboxd-Bibliothek, ausgewertet.
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)] md:text-xl">
          Profil-Link eingeben — Ratings und Top-Genres ohne Pro-Abo.
        </p>
      </header>

      <Analyzer />

      <footer className="mt-20 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
        Nutzt nur öffentlich sichtbare Letterboxd-Daten. Nicht mit Letterboxd
        affiliated.
      </footer>
    </main>
  );
}
