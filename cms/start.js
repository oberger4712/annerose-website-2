// Starts the website dev server and the gallery editor together, so that the
// editor and the live preview are both available from a single command:
//
//   npm run edit
//
// Both children inherit stdio; stopping one stops the other.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cmsDir = fileURLToPath(new URL('.', import.meta.url));
const root = path.resolve(cmsDir, '..');

// Everything is started as a plain node process rather than through `npm run`:
// npm ships as a .cmd shim on Windows, which node refuses to spawn without a
// shell, and a shell in between would swallow the signals we need for shutdown.
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const thumbsScript = path.join(root, 'scripts', 'generate-thumbs.js');
const cmsServer = path.join(cmsDir, 'server.js');

const children = [];
let stopping = false;

function node(args, label) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
  child.on('error', (error) => {
    console.error(`  ${label} konnte nicht gestartet werden: ${error.message}`);
    stopAll(1);
  });
  return child;
}

function start(args, label) {
  const child = node(args, label);
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`  ${label} wurde beendet (${code}).`);
    stopAll(code ?? 0);
  });
  children.push(child);
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    try {
      child.kill('SIGTERM');
    } catch {
      // Already gone.
    }
  }
  process.exitCode = code;
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

if (!existsSync(viteBin)) {
  console.error('  Vite wurde nicht gefunden. Bitte zuerst "npm install" ausfuehren.');
  process.exit(1);
}

// Mirrors the `predev` hook of `npm run dev`: thumbnails first, then the
// servers, so the dev server never serves a half-built thumbnail directory.
const thumbs = node([thumbsScript], 'Thumbnail-Erzeugung');
thumbs.on('exit', (code) => {
  if (stopping) return;
  if (code !== 0) {
    console.error(`  Thumbnail-Erzeugung fehlgeschlagen (${code}).`);
    process.exitCode = code ?? 1;
    return;
  }
  start([viteBin], 'Webseite');
  start([cmsServer], 'Galerie-Editor');
});
