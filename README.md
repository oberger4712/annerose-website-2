# Annerose Berger — Gallery

Static artist website. No CMS, no database — paintings are managed via a JSON file and an image folder.

## Getting started

```bash
npm install
npm run dev       # preview → http://localhost:5173
npm run build     # production build → dist/
```

## Managing paintings

All paintings are defined in **`public/paintings.json`**. Images go in **`public/images/`**.

### Add a painting

1. Drop the image file into `public/images/`, e.g. `my-painting.jpg`
2. Add an entry to `public/paintings.json`:

```json
{
  "image": "images/my-painting.jpg",
  "title": "Title of the work",
  "year": "2026",
  "medium": "Acrylic on canvas",
  "dimensions": "40 × 50 cm",
  "note": "Optional description shown in the detail view"
}
```

3. Commit the image and `paintings.json` — the previews are generated automatically.

### Generate preview images (`npm run images`)

The gallery grid must not load the full-resolution originals (~1.5 MB each), otherwise
scrolling gets slow. `npm run images` creates small WebP versions (800/1200 px wide)
in `public/images/thumbs/` and records the original dimensions in `public/images/sizes.json`.
The detail overlay still shows the original file.

Both folders are **build output and not checked in** — only the originals are. `npm run dev`
and `npm run build` run the script automatically, and so does the GitHub Action on deploy,
so adding a painting means committing the original only. Existing variants are skipped by
timestamp, so re-running is cheap. Run it by hand after dropping in an image while the dev
server is already running. If the thumbs are missing, the grid falls back to the originals:
correct, just slow.

### Remove a painting

Delete the entry from `paintings.json`. The image file can stay or be deleted too.

### Special fields

| Field | Effect |
|-------|--------|
| `"bio": true` | This painting appears in the "About the artist" section |

Without these fields a painting only appears in the gallery grid.

### Contact address

The "Kontakt" button is a `mailto:` link that opens the visitor's own mail program.
Replace the placeholder address in `index.html` (footer, `class="footer__mail"`) in
**both** places: the `href` of the button and the address shown in the note below it.

## Deployment

After `npm run build` the **`dist/`** folder contains the finished website. Upload it to any static host:

- **Netlify**: drag and drop the `dist/` folder onto [app.netlify.com](https://app.netlify.com)
- **Vercel**: connect the repository, build command `npm run build`, output directory `dist`
- **GitHub Pages**: use [gh-pages](https://github.com/tschaub/gh-pages) or GitHub Actions

A push to `develop` triggers `.github/workflows/deploy.yml`, which runs `npm run build`
(previews included) and publishes `dist/` to GitHub Pages.

Once deployed, `paintings.json` and the images can also be updated directly on the server —
no rebuild needed. In that case run `npm run images` locally first and upload the matching
files from `images/thumbs/` and the updated `images/sizes.json` along with the original.

## Project structure

```
├── index.html              Page markup (HTML)
├── public/
│   ├── paintings.json      Painting data (edit this)
│   ├── images/             Image files (put images here)
│   └── images/thumbs/      Generated previews — not in git, npm run images
└── src/
    ├── main.js             Entry point
    ├── gallery.js          Gallery rendering & detail overlay
    ├── scroll.js           Smooth scroll (Lenis) & scroll animations
    └── style.css           All styles & design tokens
```
