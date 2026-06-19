import { lenis, observeRevealElements } from './scroll.js';

let paintings = [];
let openIndex = null;

// ── INIT ──────────────────────────────────────────────────────

export async function initGallery() {
  try {
    const res = await fetch('/paintings.json');
    if (!res.ok) throw new Error(res.status);
    paintings = await res.json();
  } catch (e) {
    console.error('Konnte paintings.json nicht laden:', e);
    document.getElementById('gallery-grid').innerHTML =
      '<p class="gallery__empty">Fehler beim Laden. Bitte starten Sie den Dev-Server: <code>npm run dev</code></p>';
    return;
  }

  renderHero();
  renderBio();
  renderGallery();
  setupContactForm();
}

// ── HERO ──────────────────────────────────────────────────────

function renderHero() {
  const p = paintings.find((x) => x.featured) ?? paintings[0];
  if (!p) return;

  const img = document.getElementById('hero-img');
  img.src = p.image;
  img.alt = p.title;

  const parts = [p.year, p.medium].filter(Boolean);
  document.getElementById('hero-caption').innerHTML =
    `<strong>${esc(p.title)}</strong>${parts.length ? ', ' + parts.map(esc).join(' · ') : ''}`;
}

// ── BIO ───────────────────────────────────────────────────────

function renderBio() {
  const p = paintings.find((x) => x.bio)
         ?? paintings.find((x) => !x.featured)
         ?? paintings[0];
  if (!p) return;

  const img = document.getElementById('bio-img');
  img.src = p.image;
  img.alt = p.title;
}

// ── GALLERY GRID ──────────────────────────────────────────────

function renderGallery() {
  const grid = document.getElementById('gallery-grid');

  if (!paintings.length) {
    grid.innerHTML = '<p class="gallery__empty">Noch keine Werke vorhanden.</p>';
    return;
  }

  grid.innerHTML = '';

  paintings.forEach((p, i) => {
    const fig = document.createElement('figure');
    fig.className = 'artwork-card reveal';
    fig.setAttribute('aria-label', p.title);
    fig.innerHTML =
      `<div class="artwork-card__frame">
        <img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">
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

  observeRevealElements(grid);
}

// ── DETAIL OVERLAY ────────────────────────────────────────────

function openDetail(i) {
  openIndex = i;
  const p = paintings[i];
  const overlay = document.getElementById('detail-overlay');

  overlay.setAttribute('aria-label', p.title);

  // Crossfade image when navigating
  const img = document.getElementById('detail-img');
  img.style.opacity = '0';
  const preload = new Image();
  preload.onload = () => { img.src = preload.src; img.alt = p.title; img.style.opacity = '1'; };
  preload.src = p.image;

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

// ── CONTACT FORM ──────────────────────────────────────────────

function setupContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    // If using mailto (default), let the browser open the email client as normal.
    // If the action is a Formspree URL, use fetch instead (no page reload).
    const action = form.action;
    if (!action.startsWith('mailto:')) {
      e.preventDefault();
      const data = new FormData(form);
      fetch(action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then((r) => {
          if (r.ok) showThankYou(form);
          else console.error('Formular-Fehler', r.status);
        })
        .catch(console.error);
    }
  });
}

function showThankYou(form) {
  form.innerHTML = '<p class="form-thankyou">Vielen Dank — Annerose meldet sich bald.</p>';
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

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
