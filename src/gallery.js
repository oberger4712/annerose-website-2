import { lenis, observeRevealElements } from './scroll.js';

let paintings = [];     // flat list — used by hero, detail overlay
let galleryData = {};  // grouped by style — used for rendering
let imageSizes = {};   // originale Pixelmaße, erzeugt von scripts/generate-thumbs.js
let openIndex = null;
let detailToken = 0;   // verwirft Ladevorgänge, die durch schnelles Blättern überholt wurden

const THUMB_WIDTHS = [800, 1200];
const DETAIL_WIDTH = 2000;   // große Variante für die Detailansicht
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
    paintings = Object.values(galleryData).flatMap((g) => g.works ?? []);
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
  applyThumb(img, 'images/eisblumen.jpg', {
    sizes: '(max-width: 679px) 92vw, 520px',
  });
  img.alt = 'Eisblumen';

  const fig = img.closest('.reveal');
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
    if (!group.works?.length) continue;

    const section = document.createElement('div');
    section.className = 'gallery__group';
    section.innerHTML =
      `<div class="gallery__group-header">
        <h3 class="gallery__group-title">${esc(styleName)}</h3>
        ${group.description ? `<p class="gallery__group-desc">${esc(group.description)}</p>` : ''}
      </div>`;

    const grid = document.createElement('div');
    grid.className = 'gallery__grid';

    group.works.forEach((p) => {
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

function openDetail(i) {
  openIndex = i;
  const p = paintings[i];
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
  const sources = [thumbUrl(p.image, DETAIL_WIDTH), p.image];
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
  document.getElementById('detail-counter').textContent = `${i + 1} / ${paintings.length}`;

  const fields = document.getElementById('detail-fields');
  fields.innerHTML = '';
  if (p.medium)     fields.append(detailField('Technik', p.medium));
  if (p.dimensions) fields.append(detailField('Maße',    p.dimensions));

  const note = document.getElementById('detail-note');
  if (p.note) { note.textContent = p.note; note.style.display = ''; }
  else        { note.style.display = 'none'; }

  document.getElementById('detail-prev').disabled = i === 0;
  document.getElementById('detail-next').disabled = i === paintings.length - 1;

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
  if (openIndex > 0) openDetail(openIndex - 1);
});

document.getElementById('detail-next').addEventListener('click', () => {
  if (openIndex < paintings.length - 1) openDetail(openIndex + 1);
});

// Click backdrop to close
document.getElementById('detail-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDetail();
});

// Keyboard: Esc / arrows
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('detail-overlay').classList.contains('is-open')) return;
  if (e.key === 'Escape')     closeDetail();
  if (e.key === 'ArrowLeft'  && openIndex > 0)                      openDetail(openIndex - 1);
  if (e.key === 'ArrowRight' && openIndex < paintings.length - 1)   openDetail(openIndex + 1);
});

// ── HELPERS ───────────────────────────────────────────────────

// images/ophelia.jpg  →  images/thumbs/ophelia-800.webp
function thumbUrl(image, width) {
  const base = image.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
  return `images/thumbs/${base}-${width}.webp`;
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
