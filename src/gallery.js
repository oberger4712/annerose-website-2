import { lenis, observeRevealElements } from './scroll.js';

let paintings = [];     // flat list of visible works — used by hero, detail overlay
let hiddenWorks = [];   // works with "hidden": true — not in the gallery, openable via openDetail
let galleryData = {};  // grouped by style — used for rendering
let imageSizes = {};   // originale Pixelmaße, erzeugt von scripts/generate-thumbs.js
let openIndex = null;
let detailToken = 0;   // verwirft Ladevorgänge, die durch schnelles Blättern überholt wurden

const THUMB_WIDTHS = [800, 1200];
// Passend zum Grid: auto-fill minmax(280px, 1fr) in einem 1280px breiten Container.
const GRID_SIZES = '(max-width: 679px) 92vw, (max-width: 1100px) 45vw, 300px';

// ── INIT ──────────────────────────────────────────────────────

export async function initGallery() {
  try {
    // Im Entwicklungsmodus Cache umgehen, damit Änderungen sofort sichtbar sind.
    const url = import.meta.env.BASE_URL + 'paintings.json' +
      (import.meta.env.DEV ? `?t=${Date.now()}` : '');
    const sizesUrl = import.meta.env.BASE_URL + 'images/sizes.json' +
      (import.meta.env.DEV ? `?t=${Date.now()}` : '');

    // sizes.json ist optional — fehlt es, entfallen nur width/height.
    const [res, sizesRes] = await Promise.all([
      fetch(url),
      fetch(sizesUrl).catch(() => null),
    ]);
    if (!res.ok) throw new Error(res.status);
    galleryData = await res.json();
    const all = Object.values(galleryData).flatMap((g) => g.works ?? []);
    // "hidden" works stay out of grid, hero and prev/next, but can be opened directly.
    paintings = all.filter((w) => !w.hidden);
    hiddenWorks = all.filter((w) => w.hidden);
    if (sizesRes?.ok) imageSizes = await sizesRes.json().catch(() => ({}));
  } catch (e) {
    console.error('Konnte paintings.json nicht laden:', e);
    document.getElementById('gallery-content').innerHTML =
      '<p class="gallery__empty">Fehler beim Laden. Bitte starten Sie den Dev-Server: <code>npm run dev</code></p>';
    return;
  }

  renderHero();
  renderBio();
  renderGallery();
}

// ── HERO ──────────────────────────────────────────────────────

function renderHero() {
  const p = paintings[0];
  if (!p) return;

  const img = document.getElementById('hero-img');
  // LCP-Bild: nicht lazy, größere Darstellung als im Grid.
  applyThumb(img, 'images/two-of-us.jpg', {
    sizes: '(max-width: 679px) 92vw, 640px',
    lazy: false,
  });
  img.alt = p.title;

  const parts = [p.year, p.medium].filter(Boolean);
  document.getElementById('hero-caption').innerHTML =
    `<strong>${esc(p.title)}</strong>${parts.length ? ', ' + parts.map(esc).join(' · ') : ''}`;
}

// ── BIO ───────────────────────────────────────────────────────

function renderBio() {
  const img = document.getElementById('bio-img');
  const image = 'images/fantasie_in_rosa_und_gruen.jpg';
  applyThumb(img, image, {
    sizes: '(max-width: 679px) 92vw, 520px',
  });

  const work = hiddenWorks.find((w) => w.image === image);
  img.alt = work?.title ?? '';

  const fig = img.closest('.reveal');
  if (fig && work) {
    fig.setAttribute('role', 'button');
    fig.tabIndex = 0;
    fig.setAttribute('aria-label', `${work.title} — Detailansicht öffnen`);
    fig.addEventListener('click', () => openDetail(work));
    fig.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openDetail(work);
    });
  }
  if (fig) observeRevealElements(fig.parentElement);
}

// ── GALLERY GRID ──────────────────────────────────────────────

function renderGallery() {
  const container = document.getElementById('gallery-content');

  if (!paintings.length) {
    container.innerHTML = '<p class="gallery__empty">Noch keine Werke vorhanden.</p>';
    return;
  }

  container.innerHTML = '';

  let flatIndex = 0;

  for (const [styleName, group] of Object.entries(galleryData)) {
    const works = (group.works ?? []).filter((w) => !w.hidden);
    if (!works.length) continue;

    const section = document.createElement('div');
    section.className = 'gallery__group';
    section.innerHTML =
      `<div class="gallery__group-header">
        <h3 class="gallery__group-title">${esc(styleName)}</h3>
        ${group.description ? `<p class="gallery__group-desc">${esc(group.description)}</p>` : ''}
      </div>`;

    const grid = document.createElement('div');
    grid.className = 'gallery__grid';

    works.forEach((p) => {
      const i = flatIndex++;
      if (i === 0) return;
      const fig = document.createElement('figure');
      fig.className = 'artwork-card reveal';
      fig.setAttribute('aria-label', p.title);
      fig.innerHTML =
        `<div class="artwork-card__frame">
          <img ${thumbAttrs(p.image)} alt="${esc(p.title)}">
        </div>
        <figcaption>
          <h3 class="artwork-card__title">${esc(p.title)}${p.year ? `<span>, ${esc(p.year)}</span>` : ''}</h3>
          ${(p.medium || p.dimensions)
            ? `<p class="artwork-card__meta">${[p.medium, p.dimensions].filter(Boolean).map(esc).join('  ·  ')}</p>`
            : ''}
        </figcaption>`;
      fig.addEventListener('click', () => openDetail(i));
      grid.appendChild(fig);
    });

    section.appendChild(grid);
    container.appendChild(section);
    observeRevealElements(grid);
  }
}

// ── DETAIL OVERLAY ────────────────────────────────────────────

// `target` is an index into `paintings`, or a work object that is not part of
// the gallery (hidden) — that one has no counter and no prev/next.
function openDetail(target) {
  const standalone = typeof target === 'object';
  const i = standalone ? null : target;
  const p = standalone ? target : paintings[i];
  openIndex = i;
  const overlay = document.getElementById('detail-overlay');

  overlay.setAttribute('aria-label', p.title);

  // Crossfade image when navigating. Zuerst das (meist schon geladene) Vorschau-
  // bild zeigen, damit das Overlay nie leer wirkt — das Original folgt, sobald es da ist.
  const img = document.getElementById('detail-img');
  img.style.opacity = '0';
  img.alt = p.title;
  const token = ++detailToken;

  const thumb = new Image();
  thumb.onload = () => {
    if (token !== detailToken || img.dataset.full === p.image) return;
    img.src = thumb.src;
    img.style.opacity = '1';
  };
  thumb.src = thumbUrl(p.image, 1200);

  // Erst die große WebP-Variante, dann das Original: solange ein frisch
  // hinzugefügtes Bild noch keine Varianten hat (npm run images), greift der
  // Fallback und die Detailansicht zeigt trotzdem etwas.
  const sources = [detailUrl(p.image), p.image];
  let attempt = 0;

  const preload = new Image();
  preload.onload = () => {
    if (token !== detailToken) return;
    img.src = preload.src;
    img.dataset.full = p.image;
    img.style.opacity = '1';
  };
  preload.onerror = () => {
    if (token !== detailToken) return;
    attempt++;
    if (attempt < sources.length) { preload.src = sources[attempt]; return; }
    img.style.opacity = '1';   // nichts ladbar — wenigstens das Vorschaubild zeigen
  };
  preload.src = sources[0];

  document.getElementById('detail-title').textContent   = p.title;
  document.getElementById('detail-year').textContent    = p.year ?? '';
  document.getElementById('detail-counter').textContent =
    standalone ? '' : `${i + 1} / ${paintings.length}`;

  const fields = document.getElementById('detail-fields');
  fields.innerHTML = '';
  if (p.medium)     fields.append(detailField('Technik', p.medium));
  if (p.dimensions) fields.append(detailField('Maße',    p.dimensions));

  const note = document.getElementById('detail-note');
  if (p.note) { note.textContent = p.note; note.style.display = ''; }
  else        { note.style.display = 'none'; }

  document.getElementById('detail-prev').disabled = standalone || i === 0;
  document.getElementById('detail-next').disabled = standalone || i === paintings.length - 1;

  overlay.classList.add('is-open');
  lenis?.stop();
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('is-open');
  lenis?.start();
  openIndex = null;
}

function detailField(label, value) {
  const div = document.createElement('div');
  div.innerHTML =
    `<div class="detail-field__label">${esc(label)}</div>
     <div class="detail-field__value">${esc(value)}</div>`;
  return div;
}

// ── EVENTS ────────────────────────────────────────────────────

document.getElementById('detail-close').addEventListener('click', closeDetail);

document.getElementById('detail-prev').addEventListener('click', () => {
  if (openIndex !== null && openIndex > 0) openDetail(openIndex - 1);
});

document.getElementById('detail-next').addEventListener('click', () => {
  if (openIndex !== null && openIndex < paintings.length - 1) openDetail(openIndex + 1);
});

// Click backdrop to close
document.getElementById('detail-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDetail();
});

// Keyboard: Esc / arrows
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('detail-overlay').classList.contains('is-open')) return;
  if (e.key === 'Escape')     closeDetail();
  if (openIndex === null) return;   // hidden work: no navigation
  if (e.key === 'ArrowLeft'  && openIndex > 0)                      openDetail(openIndex - 1);
  if (e.key === 'ArrowRight' && openIndex < paintings.length - 1)   openDetail(openIndex + 1);
});

// ── HELPERS ───────────────────────────────────────────────────

// images/ophelia.jpg  →  images/thumbs/ophelia-800.webp
function thumbUrl(image, width) {
  const base = image.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
  return `images/thumbs/${base}-${width}.webp`;
}

// Große Variante fürs Overlay — auf die längste Kante begrenzt, deshalb ohne
// Breite im Namen. Siehe scripts/generate-thumbs.js.
function detailUrl(image) {
  const base = image.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
  return `images/thumbs/${base}-detail.webp`;
}

// Attribute für ein Vorschaubild: srcset + Maße + Fallback aufs Original,
// falls die Thumbs noch nicht erzeugt wurden (npm run images).
function thumbAttrs(image, { sizes = GRID_SIZES, lazy = true } = {}) {
  const srcset = THUMB_WIDTHS.map((w) => `${thumbUrl(image, w)} ${w}w`).join(', ');
  const dim = imageSizes[image];
  return [
    `src="${esc(thumbUrl(image, 800))}"`,
    `srcset="${esc(srcset)}"`,
    `sizes="${esc(sizes)}"`,
    dim ? `width="${dim.w}" height="${dim.h}"` : '',
    lazy ? 'loading="lazy"' : 'fetchpriority="high"',
    'decoding="async"',
    `onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${esc(image)}'"`,
  ].filter(Boolean).join(' ');
}

// Gleiche Logik für <img>-Elemente, die bereits im HTML stehen (Hero, Bio).
function applyThumb(img, image, { sizes = GRID_SIZES, lazy = true } = {}) {
  img.srcset = THUMB_WIDTHS.map((w) => `${thumbUrl(image, w)} ${w}w`).join(', ');
  img.sizes = sizes;
  img.decoding = 'async';
  if (lazy) img.loading = 'lazy';
  else img.fetchPriority = 'high';
  const dim = imageSizes[image];
  if (dim) { img.width = dim.w; img.height = dim.h; }
  img.onerror = () => { img.onerror = null; img.removeAttribute('srcset'); img.src = image; };
  img.src = thumbUrl(image, 800);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
