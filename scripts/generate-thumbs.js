// Erzeugt kleinere WebP-Varianten aller Bilder aus public/images/ für die
// Galerie-Übersicht. Die Detailansicht zeigt weiterhin das Original.
//
//   npm run images
//
// public/images/thumbs/ und public/images/sizes.json sind Build-Ergebnisse und
// nicht im Repo. npm run dev und npm run build erzeugen sie automatisch (pre-
// Skripte), im Deploy übernimmt das die GitHub Action.

import { readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root      = fileURLToPath(new URL('..', import.meta.url));
const imagesDir = path.join(root, 'public', 'images');
const thumbsDir = path.join(imagesDir, 'thumbs');
const sizesFile = path.join(imagesDir, 'sizes.json');

// 800/1200 für das Galerie-Raster, 2000 für die Detailansicht. Bei 2000 px
// braucht auch ein 4K-Bildschirm das Original nicht mehr — es wird nur noch
// als Fallback geladen, wenn die WebP-Variante fehlt.
export const WIDTHS = [800, 1200, 2000];
const SOURCE_EXT = /\.(jpe?g|png|webp)$/i;

async function mtime(file) {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return 0; // existiert nicht
  }
}

async function main() {
  await mkdir(thumbsDir, { recursive: true });

  const entries = await readdir(imagesDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && SOURCE_EXT.test(e.name))
    .map((e) => e.name)
    .sort();

  const sizes = {};
  let written = 0;
  let skipped = 0;

  for (const name of files) {
    const source = path.join(imagesDir, name);
    const base = name.replace(SOURCE_EXT, '');
    const sourceTime = await mtime(source);

    const meta = await sharp(source).metadata();
    sizes[`images/${name}`] = { w: meta.width, h: meta.height };

    for (const width of WIDTHS) {
      const target = path.join(thumbsDir, `${base}-${width}.webp`);
      if (await mtime(target) > sourceTime) {
        skipped++;
        continue;
      }
      await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(target);
      written++;
      console.log(`  ${path.relative(root, target)}`);
    }
  }

  await writeFile(sizesFile, JSON.stringify(sizes, null, 2) + '\n');

  console.log(
    `\n${files.length} Bilder · ${written} Varianten erzeugt · ${skipped} übersprungen (aktuell)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
