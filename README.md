# Outside the box

Letterboxd-Statistik ohne Pro-Abo.

## Datenquellen

| Profil | Quelle |
|--------|--------|
| `philipphartmann` | Lokale JSON-Bibliothek (`src/data/letterboxd.json`) inkl. Genres/Regie |
| andere User | Öffentlicher RSS-Feed (nur Tagebuch, max. 100, ohne Genres) |

Der RSS-Feed listet **nur Diary-Einträge**. Wer Filme nur als „watched“ markiert, ohne sie zu loggen, sieht im RSS wenig — deshalb die gebackene Liste für dein Profil.

## Nutzung

```bash
npm install
npm run scrape   # Bibliothek lokal aktualisieren
npm run dev
```
