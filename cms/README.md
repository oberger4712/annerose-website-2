# Galerie-Editor

Ein kleines Programm zum Bearbeiten der Galerie auf der Webseite. Damit lassen
sich Bilder hinzufügen, ändern, umsortieren und löschen — ganz ohne die
Datei `public/paintings.json` von Hand zu bearbeiten.

Der Editor ist vollständig von der Webseite getrennt: er liegt komplett in
diesem Ordner (`cms/`) und wird nicht mit veröffentlicht.

## Starten

Im Hauptordner des Projekts ein Terminal öffnen und eingeben:

```
npm run edit
```

Damit starten zwei Dinge gleichzeitig:

| Was            | Adresse                 |
| -------------- | ----------------------- |
| Die Webseite   | http://localhost:5173   |
| Der Editor     | http://localhost:5174   |

Am besten beide Adressen nebeneinander im Browser öffnen. Jede Änderung im
Editor erscheint nach wenigen Sekunden automatisch auf der Webseite — so lässt
sich alles in Ruhe ansehen, bevor es hochgeladen wird.

Zum Beenden im Terminal `Strg + C` drücken.

Wenn nur der Editor gebraucht wird (ohne Vorschau): `npm run cms`

## Bearbeiten

Für jedes Bild gibt es ein eigenes Feld mit:

- **Bild** — Auswahlliste aller Bilder aus dem Ordner `public/images`.
  Es lässt sich nur ein Bild auswählen, das wirklich vorhanden ist.
  Ganz oben stehen unter „Neu" die Bilder, die in keinem
  anderen Eintrag vorkommen. Darunter stehen die übrigen — auswählen lassen
  sie sich trotzdem.
- **Titel**, **Jahr**, **Technik**
- **Maße** — Breite und Höhe einzeln eintragen, das `×` und das `cm` kommen
  von selbst dazu.
- **Notiz** — der längere Text, der in der Detailansicht erscheint.
  Kann leer bleiben.

Rechts neben jedem Feld:

- **▲ / ▼** verschiebt das Bild in der Reihenfolge nach oben oder unten.
- **✕** entfernt den Eintrag aus der Galerie. Die Bilddatei selbst bleibt
  erhalten.

Unter jeder Gruppe gibt es **„+ Neues Bild hinzufügen"**.

Alles wird automatisch gespeichert, ein paar Sekunden nach der letzten
Eingabe. Oben links steht, ob alles gespeichert ist.

## Ein neues Bild aufnehmen

1. Die Bilddatei (`.jpg`, `.png` oder `.webp`) in den Ordner `public/images`
   kopieren.
2. Im Editor auf **„+ Neues Bild hinzufügen"** klicken.
3. In der Auswahlliste **Bild** die neue Datei auswählen. Sie taucht dort von
   selbst auf, spätestens nach ein paar Sekunden — der Editor muss nicht neu
   gestartet werden.
4. Titel, Jahr, Technik und Maße eintragen.

## Fehlende Bilder

Wenn zu einem Eintrag die Bilddatei fehlt — zum Beispiel weil sie umbenannt
oder gelöscht wurde —, wird dieser Eintrag rot umrandet und zeigt eine
Meldung an. Oben im Kopfbereich erscheint zusätzlich eine Warnung, und die
Schaltfläche **„Speichern und Hochladen"** lässt sich so lange nicht anklicken,
bis für jeden Eintrag ein gültiges Bild ausgewählt ist.

## Änderungen herunterladen

Wenn jemand anderes etwas an der Galerie geändert hat, holt die Schaltfläche
**„Änderungen Herunterladen"** oben im Kopfbereich den neuesten Stand.

Das geht nur, solange hier alles hochgeladen ist. Gibt es noch eigene, nicht
hochgeladene Änderungen, erscheint ein Hinweis — dann zuerst
**„Speichern und Hochladen"** anklicken und es danach noch einmal versuchen.
Ein neu hineinkopiertes Foto, das noch in keinem Eintrag steht, stört dabei
nicht.

## Hochladen

Wenn alles passt: oben rechts auf **„Speichern und Hochladen"** klicken.
Dabei passiert der Reihe nach:

1. Die Vorschaubilder für neue Fotos werden erzeugt.
2. Die Änderungen werden gesammelt und gespeichert.
3. Alles wird zum Server hochgeladen.

Danach dauert es noch ein bis zwei Minuten, bis die Änderungen auf der echten
Webseite zu sehen sind.

Wenn dabei etwas schiefgeht, erscheint eine Meldung mit der Ursache. Unter
„Technische Einzelheiten" stehen die genauen Ausgaben — die sind hilfreich,
wenn Olli sich das ansehen soll.

## Für Entwickler

- Kein einziges npm-Paket: nur Node-Bordmittel (`http`, `fs`, `child_process`).
  Deshalb hat `cms/package.json` bewusst keine `dependencies` — der Editor darf
  niemals in den Build der Webseite geraten.
- Der Server lauscht ausschließlich auf `127.0.0.1`, weil er `git` und `npm`
  im umgebenden Repository ausführt. Nicht über `--host` freigeben.
- `public/paintings.json` wird atomar geschrieben (temporäre Datei plus
  `rename`), damit der Datei-Watcher von Vite nie eine halb geschriebene Datei
  sieht. Das automatische Neuladen der Webseite steckt bereits in
  `vite.config.js` und wurde nicht angefasst.
- Beim Schreiben werden die Felder in fester Reihenfolge abgelegt
  (`image, title, year, medium, dimensions, note`), leere optionale Felder
  entfallen.
- „Änderungen Herunterladen" macht `git pull --ff-only` und weigert sich,
  solange es Änderungen an `public/paintings.json` oder `public/images` gibt,
  die noch nicht committet sind. Automatisches Zusammenführen wäre die einzige
  Stelle, an der dieses Werkzeug Arbeit vernichten könnte.
- Anderer Port: `CMS_PORT=5180 npm run cms`
