# Outside the box

Letterboxd-Statistik im Pro-Stil.

## Nutzung

Username oder `https://letterboxd.com/deinname/` eingeben.

```bash
npm install
npm run dev
```

## Technik

- Datenpipeline: `GET /api/films` + `POST /api/genres`
- UI wie der Letterboxd-Statistik-Report (Kacheln, Histogramme, Regisseur, These)
- Auf Vercel: Letterboxd-Abrufe über ScraperAPI (Cloudflare blockiert sonst Vercel-IPs)
- Optional: Upstash Redis cached Film-Details (Genres/Regisseur) dauerhaft pro Slug

## Vercel Environment Variables

In Project → Settings → Environment Variables setzen:

| Variable | Pflicht | Zweck |
|----------|---------|--------|
| `SCRAPER_API_KEY` | ja (Production) | HTML-Abrufe über [ScraperAPI](https://www.scraperapi.com/) |
| `UPSTASH_REDIS_REST_URL` | empfohlen | Film-Details-Cache |
| `UPSTASH_REDIS_REST_TOKEN` | empfohlen | Film-Details-Cache |

Lokal reichen leere Werte / fehlende Vars: direkter Fetch, kein Cache.
