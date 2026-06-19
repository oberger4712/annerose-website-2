# Annerose Berger — Ateliergalerie

Statische Künstler-Website. Kein CMS, keine Datenbank — Gemälde werden über eine JSON-Datei und einen Bildordner verwaltet.

## Erste Schritte

```bash
npm install
npm run dev       # Vorschau → http://localhost:5173
npm run build     # Produktions-Build → dist/
```

## Gemälde verwalten

Alle Gemälde stehen in **`public/paintings.json`**. Bilder liegen in **`public/images/`**.

### Bild hinzufügen

1. Bilddatei in `public/images/` ablegen, z.B. `mein-bild.jpg`
2. Eintrag in `public/paintings.json` ergänzen:

```json
{
  "image": "images/mein-bild.jpg",
  "title": "Titel des Werks",
  "year": "2026",
  "medium": "Acryl auf Leinwand",
  "dimensions": "40 × 50 cm",
  "note": "Optionaler Beschreibungstext (erscheint in der Detailansicht)"
}
```

### Bild entfernen

Eintrag aus `paintings.json` löschen. Die Bilddatei kann bleiben oder ebenfalls gelöscht werden.

### Sonderfelder

| Feld | Bedeutung |
|------|-----------|
| `"featured": true` | Dieses Bild erscheint groß im Hero-Bereich ganz oben |
| `"bio": true` | Dieses Bild erscheint in der „Über die Künstlerin"-Sektion |

Ohne diese Felder landen alle Bilder nur im Galerie-Raster.

## Texte und E-Mail anpassen

Überschriften, Fließtexte und Statistiken stehen direkt in **`index.html`** — einfach suchen und ersetzen.

Die E-Mail-Adresse für Kontaktanfragen ist an zwei Stellen eingetragen (im `href` des E-Mail-Links und im `action` des Formulars) — nach `kontakt@annerose-berger.de` suchen.

### Kontaktformular mit echtem Versand (empfohlen)

Das Formular öffnet standardmäßig das E-Mail-Programm des Besuchers (`mailto:`). Für einen echten Versand direkt im Browser:

1. Kostenloses Konto bei [Formspree](https://formspree.io) erstellen
2. In `index.html` das `action`-Attribut des Formulars ersetzen:
   ```html
   action="https://formspree.io/f/IHRE-ID"
   ```
3. Das `enctype`-Attribut aus dem `<form>`-Tag entfernen

Das Formular sendet dann per Fetch und zeigt eine Bestätigungsmeldung — ohne Seitenreload.

## Deployment

Nach `npm run build` enthält der Ordner **`dist/`** die fertige Website. Diesen Ordner auf einen beliebigen statischen Hoster hochladen:

- **Netlify**: `dist/`-Ordner per Drag & Drop auf [app.netlify.com](https://app.netlify.com) ziehen
- **Vercel**: Repository verbinden, Build-Befehl `npm run build`, Output `dist`
- **GitHub Pages**: mit [gh-pages](https://github.com/tschaub/gh-pages) oder GitHub Actions

Nach dem Deploy können `public/paintings.json` und die Bilder in `public/images/` direkt auf dem Server aktualisiert werden — ohne Rebuild.

## Projektstruktur

```
├── index.html              Seitenstruktur (HTML)
├── public/
│   ├── paintings.json      Gemälde-Daten (hier editieren)
│   └── images/             Bilddateien (hier ablegen)
└── src/
    ├── main.js             Einstiegspunkt
    ├── gallery.js          Galerie-Rendering & Detail-Overlay
    ├── scroll.js           Smooth Scroll (Lenis) & Scroll-Animationen
    └── style.css           Alle Stile & Design-Tokens
```
