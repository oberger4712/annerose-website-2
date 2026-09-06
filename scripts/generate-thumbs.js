// Erzeugt kleinere WebP-Varianten aller Bilder aus public/images/ für die
// Galerie-Übersicht. Die Detailansicht zeigt die große WebP-Variante.
//
//   npm run images
//
// public/images/thumbs/ und public/images/sizes.json sind Build-Ergebnisse und
// nicht im Repo. npm run dev und npm run build erzeugen sie automatisch (pre-
// Skripte), im Deploy übernimmt das die GitHub Action.
//
// Was bereits aktuell ist, wird übersprungen: .cache/thumbs.json merkt sich pro
// Bild den Inhalts-Hash. Absichtlich kein Zeitstempel-Vergleich — git checkout
// setzt alle mtimes auf den Checkout-Zeitpunkt, ein ausgetauschtes Bild wäre in
// der CI sonst unsichtbar und würde mit der alten Vorschau ausgeliefert.

import { readdir, stat, mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root      = fileURLToPath(new URL('..', import.meta.url));
const imagesDir = path.join(root, 'public', 'images');
const thumbsDir = path.join(imagesDir, 'thumbs');
const sizesFile = path.join(imagesDir, 'sizes.json');
const cacheFile = path.join(root, '.cache', 'thumbs.json');

// Raster: echte Breiten, denn sie stehen als w-Deskriptoren im srcset.
export const GRID_WIDTHS = [800, 1200];

// Detailansicht: begrenzt die längste Kante, nicht die Breite. 14 der Bilder
// sind Hochformate, und das Overlay ist über max-height begrenzt (style.css) —
// eine Breitenbegrenzung lässt ein Hochformat also fast unverkleinert und
// liefert Höhe aus, die nie sichtbar wird. 2000 px lange Kante deckt auch einen
// 4K-Bildschirm ab.
export const DETAIL_MAX = 2000;

const QUALITY = 78;
const SOURCE_EXT = /\.(jpe?g|png|webp)$/i;

// Ändern sich Maße oder Qualität, sind alle Varianten veraltet — auch die,
// deren Quellbild unverändert ist.
const CONFIG_KEY = `${GRID_WIDTHS.join(',')}+d${DETAIL_MAX}@${QUALITY}`;

function gridName(base, width) {
  return `${base}-${width}.webp`;
}

function detailName(base) {
  return `${base}-detail.webp`;
}

// Alle Dateinamen, die zu einem Quellbild gehören.
function variantNames(base) {
  return [...GRID_WIDTHS.map((w) => gridName(base, w)), detailName(base)];
}

async function hashFile(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 16);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readCache() {
  try {
    const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (cache.config !== CONFIG_KEY) return {};
    return cache.images ?? {};
  } catch {
    return {}; // kein Cache, unlesbar oder veraltet — alles neu erzeugen
  }
}

// Arbeitet die Liste mit so vielen Bildern gleichzeitig ab, wie Kerne da sind.
// Die Bilder sind unabhängig voneinander, und sharp rechnet außerhalb des
// Event-Loops — sequentiell würde ein Kern rechnen und der Rest warten.
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// Varianten, deren Quellbild es nicht mehr gibt. Ohne das würden gelöschte
// Bilder über den CI-Cache endlos weitergeschleppt und mit ausgeliefert.
async function pruneOrphans(expected) {
  const entries = await readdir(thumbsDir, { withFileTypes: true });
  const orphans = entries
    .filter((e) => e.isFile() && e.name.endsWith('.webp') && !expected.has(e.name))
    .map((e) => e.name);

  for (const name of orphans) await unlink(path.join(thumbsDir, name));
  return orphans;
}

async function main() {
  await mkdir(thumbsDir, { recursive: true });
  await mkdir(path.dirname(cacheFile), { recursive: true });

  const entries = await readdir(imagesDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && SOURCE_EXT.test(e.name))
    .map((e) => e.name)
    .sort();

  const cache = await readCache();
  const limit = Math.max(1, cpus().length);

  const results = await mapPool(files, limit, async (name) => {
    const source = path.join(imagesDir, name);
    const base = name.replace(SOURCE_EXT, '');
    const hash = await hashFile(source);
    const cached = cache[name];

    // Unverändert und alle Varianten liegen vor: Maße aus dem Cache übernehmen,
    // nichts neu kodieren.
    if (cached?.hash === hash) {
      const complete = await Promise.all(
        variantNames(base).map((file) => exists(path.join(thumbsDir, file)))
      );
      if (complete.every(Boolean)) {
        return { name, base, hash, w: cached.w, h: cached.h, written: 0 };
      }
    }

    const meta = await sharp(source).metadata();

    for (const width of GRID_WIDTHS) {
      await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(path.join(thumbsDir, gridName(base, width)));
    }

    await sharp(source)
      .resize({ width: DETAIL_MAX, height: DETAIL_MAX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(path.join(thumbsDir, detailName(base)));

    console.log(`  ${name} → ${GRID_WIDTHS.join('/')} px + detail`);
    return { name, base, hash, w: meta.width, h: meta.height, written: variantNames(base).length };
  });

  const sizes = {};
  const images = {};
  const expected = new Set();

  for (const { name, base, hash, w, h } of results) {
    sizes[`images/${name}`] = { w, h };
    images[name] = { hash, w, h };
    for (const file of variantNames(base)) expected.add(file);
  }

  const orphans = await pruneOrphans(expected);

  await writeFile(sizesFile, JSON.stringify(sizes, null, 2) + '\n');
  await writeFile(cacheFile, JSON.stringify({ config: CONFIG_KEY, images }, null, 2) + '\n');

  const written = results.reduce((sum, r) => sum + r.written, 0);
  const skipped = results.filter((r) => r.written === 0).length;

  console.log(
    `\n${files.length} Bilder · ${written} Varianten erzeugt · ${skipped} unverändert` +
    (orphans.length ? ` · ${orphans.length} verwaiste entfernt` : '')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
