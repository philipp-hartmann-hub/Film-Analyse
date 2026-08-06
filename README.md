# Outside the box

Kostenlose Letterboxd-Auswertung: **Ratings** und **Top-Genres** — ohne Pro-Abo.

## Idee

Profil-Link oder Username eingeben → öffentliche Filmliste laden → Charts anzeigen.

## Lokal starten

```bash
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Deploy auf Vercel

1. Repo mit Vercel verbinden
2. Framework: Next.js (Auto-Detect)
3. Deploy

Keine Env-Vars nötig.

## Hinweise

- Letterboxd hat keine öffentliche API — die App liest öffentliche HTML-Seiten.
- Sehr große Bibliotheken: Ratings komplett, Genres für die neuesten 180 Filme (Vercel-Timeouts).
- Cloudflare kann Anfragen zeitweise blockieren — dann kurz warten und erneut versuchen.
