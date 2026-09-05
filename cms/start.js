// Starts the website dev server and the gallery editor together, so that the
// editor and the live preview are both available from a single command:
//
//   npm run edit
//
// Both children inherit stdio; stopping one stops the other.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cmsDir = fileURLToPath(new URL('.', import.meta.url));
const root = path.resolve(cmsDir, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [];
let stopping = false;

function start(command, args, label) {
  // Own process group per child: npm does not forward signals to what it
  // spawned, so stopping the group is the only way to take the dev server with
  // us. It also keeps Ctrl+C from reaching the children twice — the terminal
  // signals this process only, and stopAll() does the rest.
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', detached: true });
  child.on('error', (error) => {
    console.error(`  ${label} konnte nicht gestartet werden: ${error.message}`);
    stopAll(1);
  });
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
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
  process.exitCode = code;
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

start(npmCmd, ['run', 'dev'], 'Webseite');
start(process.execPath, [path.join(cmsDir, 'server.js')], 'Galerie-Editor');
