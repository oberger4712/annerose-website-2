import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const paintingsFile = fileURLToPath(new URL('./public/paintings.json', import.meta.url))

// Dateien in public/ gehören nicht zum Modul-Graphen, deshalb löst Vite bei
// Änderungen an paintings.json von sich aus kein Neuladen aus. Dieses Plugin
// beobachtet die Datei und lädt die Seite bei jeder Änderung neu — damit sieht
// man neue Bilder sofort, ohne F5 zu drücken.
function reloadOnPaintingsChange() {
  return {
    name: 'reload-on-paintings-change',
    apply: 'serve',
    configureServer(server) {
      let timer
      server.watcher.add(paintingsFile)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) !== paintingsFile) return
        // Windows meldet einen Speichervorgang mehrfach — kurz sammeln.
        clearTimeout(timer)
        timer = setTimeout(() => {
          server.config.logger.info('  paintings.json geändert – Seite wird neu geladen')
          ;(server.hot ?? server.ws).send({ type: 'full-reload', path: '*' })
        }, 100)
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [reloadOnPaintingsChange()],
})
