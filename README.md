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

### Remove a painting

Delete the entry from `paintings.json`. The image file can stay or be deleted too.

### Special fields

| Field | Effect |
|-------|--------|
| `"featured": true` | This painting appears large in the hero section at the top |
| `"bio": true` | This painting appears in the "About the artist" section |

Without these fields a painting only appears in the gallery grid.

## Changing text and email

Headings, body text, and stats are written directly in **`index.html`** — just search and replace.

The contact email appears in two places (the email link `href` and the form `action`) — search for `kontakt@annerose-berger.de` to find both.

### Proper contact form delivery (recommended)

By default the form opens the visitor's email client (`mailto:`). For in-browser delivery without opening a mail app:

1. Create a free account at [Formspree](https://formspree.io)
2. In `index.html`, replace the form's `action` attribute:
   ```html
   action="https://formspree.io/f/YOUR-ID"
   ```
3. Remove the `enctype` attribute from the `<form>` tag

The form will then submit via fetch and show a confirmation message — no page reload.

## Deployment

After `npm run build` the **`dist/`** folder contains the finished website. Upload it to any static host:

- **Netlify**: drag and drop the `dist/` folder onto [app.netlify.com](https://app.netlify.com)
- **Vercel**: connect the repository, build command `npm run build`, output directory `dist`
- **GitHub Pages**: use [gh-pages](https://github.com/tschaub/gh-pages) or GitHub Actions

Once deployed, `public/paintings.json` and the images in `public/images/` can be updated directly on the server — no rebuild needed.

## Project structure

```
├── index.html              Page markup (HTML)
├── public/
│   ├── paintings.json      Painting data (edit this)
│   └── images/             Image files (put images here)
└── src/
    ├── main.js             Entry point
    ├── gallery.js          Gallery rendering & detail overlay
    ├── scroll.js           Smooth scroll (Lenis) & scroll animations
    └── style.css           All styles & design tokens
```
