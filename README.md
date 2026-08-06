# Outside the box

Letterboxd-Statistik im Pro-Stil für ein festes Profil — **statisch gebacken**, kein Live-Scrape auf Vercel.

## Nutzung

```bash
npm install
npm run scrape          # lokal scrapen → src/data/letterboxd.json
npm run dev
```

Optional: `npx tsx scripts/scrape.ts andererusername` oder `LETTERBOXD_USER=…`.

## Deploy

1. `npm run scrape` lokal ausführen
2. `src/data/letterboxd.json` committen & pushen
3. Vercel deployt die statische Auswertung — **keine** Letterboxd-Requests zur Laufzeit

## Optional Env (nur fürs lokale Scrapen über Proxy)

| Variable | Zweck |
|----------|--------|
| `SCRAPER_API_KEY` | optional, lokal meist unnötig |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | optionaler Cache beim App-Server-Pfad (aktuell ungenutzt) |
