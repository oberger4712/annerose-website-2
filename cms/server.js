// Minimal backend for the gallery editor.
//
//   npm run cms          (this server only)
//   npm run edit         (this server plus the website dev server)
//
// It has no dependencies beyond Node built-ins. It binds to localhost only,
// because it runs git and npm on the surrounding repository — it must never be
// reachable from the network.
//
// User facing strings are German on purpose: the editor is used by a
// non-technical person. Code and comments stay English.

import { createServer } from 'node:http';
import { readFile, writeFile, rename, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cmsDir        = fileURLToPath(new URL('.', import.meta.url));
const root          = path.resolve(cmsDir, '..');
const publicDir     = path.join(root, 'public');
const imagesDir     = path.join(publicDir, 'images');
const paintingsFile = path.join(publicDir, 'paintings.json');
const staticDir     = path.join(cmsDir, 'public');
const tmpFile       = path.join(cmsDir, '.paintings.json.tmp');

const PORT = Number(process.env.CMS_PORT) || 5174;
const HOST = '127.0.0.1';

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
// Key order used when writing paintings.json, so the file stays tidy no matter
// in which order the browser sends the fields.
const WORK_KEYS = ['image', 'title', 'year', 'medium', 'dimensions', 'note'];
// Always written, even when empty, so the website never renders "undefined".
const REQUIRED_KEYS = ['image', 'title'];

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Everything the gallery owns; nothing else is ever committed.
const PUBLISH_PATHS = ['public/paintings.json', 'public/images'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
};

// --- data ------------------------------------------------------------------

async function listImages() {
  const entries = await readdir(imagesDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && IMAGE_EXT.test(e.name))
    .map((e) => `images/${e.name}`)
    .sort((a, b) => a.localeCompare(b, 'de'));
}

async function readPaintings() {
  return JSON.parse(await readFile(paintingsFile, 'utf8'));
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Die Daten konnten nicht gelesen werden.');
  }
}

// Accepts whatever the browser sends and returns a structurally valid document.
// Deliberately permissive about content: a half finished entry must still save,
// otherwise autosave fails while she is still typing. Missing image files are
// caught later, when publishing.
function normalize(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Die Daten haben ein unerwartetes Format.');
  }
  const result = {};
  for (const [group, value] of Object.entries(data)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Die Gruppe "${group}" hat ein unerwartetes Format.`);
    }
    const works = Array.isArray(value.works) ? value.works : [];
    result[group] = {
      description: typeof value.description === 'string' ? value.description.trim() : '',
      works: works.map((work, index) => normalizeWork(work, group, index)),
    };
  }
  return result;
}

function normalizeWork(work, group, index) {
  if (!work || typeof work !== 'object' || Array.isArray(work)) {
    throw new Error(`Eintrag ${index + 1} in "${group}" hat ein unerwartetes Format.`);
  }
  const out = {};
  for (const key of WORK_KEYS) {
    const value = typeof work[key] === 'string' ? work[key].trim() : '';
    if (value || REQUIRED_KEYS.includes(key)) out[key] = value;
  }
  return out;
}

// Write through a temp file, so the website's file watcher never picks up a
// half written document.
async function writePaintings(data) {
  const text = JSON.stringify(data, null, 2) + '\n';
  await writeFile(tmpFile, text, 'utf8');
  await rename(tmpFile, paintingsFile);
}

async function findMissingImages(data) {
  const available = new Set(await listImages());
  const missing = [];
  for (const [group, value] of Object.entries(data)) {
    (value.works ?? []).forEach((work, index) => {
      if (available.has(work.image)) return;
      missing.push({
        group,
        index,
        title: work.title || `Eintrag ${index + 1}`,
        image: work.image,
      });
    });
  }
  return missing;
}

// --- publishing ------------------------------------------------------------

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', (error) => resolve({ code: -1, out, err: err + error.message }));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

function step(label, result) {
  return {
    label,
    ok: result.code === 0,
    output: [result.out, result.err].filter(Boolean).join('\n').trim(),
  };
}

function pushHint(output) {
  if (/non-fast-forward|fetch first|behind|rejected/i.test(output)) {
    return 'Auf dem Server gibt es neuere Änderungen. Bitte kurz Bescheid geben — '
         + 'die Änderungen müssen erst zusammengeführt werden.';
  }
  if (/could not read|authentication|permission denied|publickey/i.test(output)) {
    return 'Der Zugang zum Server wurde abgelehnt. Bitte kurz Bescheid geben.';
  }
  return 'Das Hochladen hat nicht geklappt. Bitte kurz Bescheid geben.';
}

async function publish() {
  const steps = [];
  const data = await readPaintings();

  const missing = await findMissingImages(data);
  if (missing.length) {
    const names = missing.map((m) => `„${m.title}"`).join(', ');
    return {
      ok: false,
      steps,
      error: `Es fehlen noch Bilder: ${names}. Bitte zuerst für jeden Eintrag ein Bild auswählen.`,
    };
  }

  const images = await run(npmCmd, ['run', 'images']);
  steps.push(step('Vorschaubilder erzeugen', images));
  if (images.code !== 0) {
    return { ok: false, steps, error: 'Die Vorschaubilder konnten nicht erzeugt werden.' };
  }

  const add = await run('git', ['add', '--', ...PUBLISH_PATHS]);
  steps.push(step('Änderungen sammeln', add));
  if (add.code !== 0) {
    return { ok: false, steps, error: 'Die Änderungen konnten nicht gesammelt werden.' };
  }

  // exit code 0 means "no staged changes"
  const staged = await run('git', ['diff', '--cached', '--quiet', '--', ...PUBLISH_PATHS]);
  if (staged.code === 0) {
    return { ok: true, steps, nothing: true, message: 'Es gibt nichts hochzuladen — alles ist schon aktuell.' };
  }

  const date = new Date().toLocaleDateString('de-DE');
  // Pathspec form: commits only the gallery, even if something unrelated
  // happens to be staged in the repository.
  const commit = await run('git', ['commit', '-m', `Galerie aktualisiert (${date})`, '--', ...PUBLISH_PATHS]);
  steps.push(step('Änderungen speichern', commit));
  if (commit.code !== 0) {
    return { ok: false, steps, error: 'Die Änderungen konnten nicht gespeichert werden.' };
  }

  const push = await run('git', ['push']);
  steps.push(step('Hochladen', push));
  if (push.code !== 0) {
    return { ok: false, steps, error: pushHint(`${push.out}\n${push.err}`) };
  }

  return {
    ok: true,
    steps,
    message: 'Fertig! Die Webseite wird in ein bis zwei Minuten aktualisiert.',
  };
}

// --- http ------------------------------------------------------------------

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

async function sendFile(res, file, { cache = 'no-store' } = {}) {
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': cache,
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
}

function readBody(req, limit = 5_000_000) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', (chunk) => {
      text += chunk;
      if (text.length > limit) reject(new Error('Die Daten sind zu groß.'));
    });
    req.on('end', () => resolve(text));
    req.on('error', reject);
  });
}

// Keeps a request from escaping the directory it is meant to serve.
function safeJoin(base, urlPath) {
  const target = path.resolve(base, '.' + decodeURIComponent(urlPath));
  return target === base || target.startsWith(base + path.sep) ? target : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;

  try {
    if (route === '/api/state' && req.method === 'GET') {
      const [data, images] = await Promise.all([readPaintings(), listImages()]);
      return sendJson(res, 200, { data, images });
    }

    if (route === '/api/images' && req.method === 'GET') {
      return sendJson(res, 200, { images: await listImages() });
    }

    if (route === '/api/paintings' && req.method === 'PUT') {
      const body = await readBody(req);
      const data = normalize(parseJson(body));
      await writePaintings(data);
      return sendJson(res, 200, { ok: true, data });
    }

    if (route === '/api/publish' && req.method === 'POST') {
      return sendJson(res, 200, await publish());
    }

    if (route.startsWith('/images/')) {
      const file = safeJoin(imagesDir, route.slice('/images'.length));
      if (!file) return sendJson(res, 400, { error: 'Ungültiger Pfad' });
      return sendFile(res, file, { cache: 'no-cache' });
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const rel = route === '/' ? '/index.html' : route;
      const file = safeJoin(staticDir, rel);
      if (!file) return sendJson(res, 400, { error: 'Ungültiger Pfad' });
      return sendFile(res, file);
    }

    sendJson(res, 404, { error: 'Nicht gefunden' });
  } catch (error) {
    sendJson(res, 400, { error: error.message ?? String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`  Galerie-Editor:  http://localhost:${PORT}`);
});
