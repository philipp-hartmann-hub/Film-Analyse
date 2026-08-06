# Outside the box

Kostenlose Letterboxd-Auswertung: **Ratings** und **Top-Genres** — ohne Pro-Abo.

## Idee

Zwei Wege:

1. **Profil-Link / Username / boxd.it** → öffentliche Filmliste scrapen  
2. **ZIP-Export** (Settings → Import & Export) → zuverlässiger, lokal geparst  

Genres: Letterboxd-Filmseiten, optional **TMDB** (wie in der Claude-Auswertung).

## Lokal starten

```bash
npm install
npm run dev
```

Optional: `.env.local` mit `TMDB_API_KEY=` (kostenlos bei [TMDB](https://www.themoviedb.org/settings/api)).

App: [http://localhost:3000](http://localhost:3000)

## Deploy auf Vercel

1. Repo verbinden, Framework **Next.js**
2. Optional Env: `TMDB_API_KEY`
3. Deploy

## Hinweise

- Letterboxd hat keine öffentliche API.
- Bei Cloudflare-Blocks: ZIP-Export nutzen.
- Genres-Fehler brechen die Ratings-Auswertung nicht mehr ab.
