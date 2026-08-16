---
name: bilder
description: Bilder auf der Galerie-Website anneroseberger.de ändern - hinzufügen, entfernen, umbenennen, Beschreibungen ändern, Reihenfolge ändern. Use for ANY request about the paintings gallery, paintings.json, adding/removing/editing artwork entries or images on Annerose's website. Handles git pull, dev server, edits, commit and push.
---

# Bilder auf der Website ändern

Diese Anleitung ist für **Annerose** – sie kennt kein JSON und keine Programmierung.

Alle Pfade in dieser Anleitung sind relativ zum Projektordner (dort, wo `package.json` liegt).

## Grundregeln für die Kommunikation

- **Sprich immer Deutsch.**
- **Keine Fachbegriffe.** Nie "JSON", "Commit", "Repository", "Terminal", "Branch", "Port", "Server-Log".
  Stattdessen: "Bilder-Liste", "speichern", "veröffentlichen", "Vorschau".
- Kurze Sätze, freundlicher Ton, immer sagen was gerade passiert und was als Nächstes kommt.
- Wenn etwas schiefgeht: **nicht** die Fehlermeldung zeigen. Stattdessen erklären, was los ist,
  und sagen: „Bitte frag Ole – er kann das in zwei Minuten lösen."

---

## Schritt 1 – Neueste Fassung holen (immer zuerst!)

Immer zuerst ausführen, bevor irgendetwas geändert wird.

1. Prüfen, ob es ungespeicherte Änderungen gibt: `git status --porcelain`
2. Falls ja, zur Seite legen: `git stash push -u -m "bilder-skill-auto"`
3. Neueste Fassung holen: `git pull --no-rebase`
4. Falls in Schritt 2 etwas zur Seite gelegt wurde, zurückholen: `git stash pop`

**Abbruchregel:** Wenn beim `git pull` oder beim `git stash pop` ein Konflikt entsteht,
der nicht eindeutig und offensichtlich auflösbar ist:

- Zusammenführung rückgängig machen (`git merge --abort`). Bei einem Konflikt aus `git stash pop`
  **nicht raten**, welche Fassung die richtige ist – lieber abbrechen.
- **Sofort stoppen.** Keine weiteren Änderungen machen.
- Genau diese Nachricht ausgeben:

  > Da hat noch jemand anderes an der Website gearbeitet, und ich kann die beiden Fassungen nicht
  > sicher zusammenführen. Ich habe deshalb nichts verändert. Bitte sag Ole Bescheid – er löst das schnell.
  > Danach können wir sofort weitermachen.

---

## Schritt 2 – Vorschau starten

Die Vorschau zeigt die Website auf diesem Computer, damit Annerose Änderungen sofort sieht.

1. Prüfen, ob die Vorschau schon läuft, also ob `http://localhost:5173` antwortet.
   Antwortet dort nichts, auch `5174` und `5175` prüfen – die Vorschau weicht auf den nächsten
   freien Anschluss aus, wenn 5173 belegt ist.
   Beispiel unter Windows:
   ```powershell
   try { (Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 3).StatusCode } catch { 'AUS' }
   ```
2. Läuft sie noch nicht: `npm run dev` starten.
   **Wichtig:** Dieser Befehl läuft dauerhaft weiter und blockiert. Er muss deshalb im
   Hintergrund gestartet werden, sonst geht es nicht weiter.
3. Aus der Ausgabe die tatsächliche Adresse ablesen (meist `http://localhost:5173/`).

Dann Annerose genau das sagen (Adresse ggf. anpassen):

> **So siehst du die Website:**
> 1. Öffne deinen Internet-Browser (Chrome, Edge oder Firefox).
> 2. Tippe oben in die Adresszeile: **localhost:5173** und drücke Enter.
> 3. Die Website öffnet sich – das ist deine Vorschau, nur auf diesem Computer sichtbar.
>
> Diese Seite kannst du geöffnet lassen. Sobald ich etwas ändere, aktualisiert sie sich von selbst.
> Falls nicht: einmal die Taste **F5** drücken.

Wenn die Vorschau schon lief, nur kurz sagen: „Die Vorschau läuft schon – öffne im Browser **localhost:5173**."

---

## Schritt 3 – Die gewünschte Änderung machen

Die Bilder-Liste liegt in `public/paintings.json`. Sie hat zwei Bereiche
(**Gouache** und **Acryl**), jeder mit einem Einleitungstext und einer Liste von Werken.

Ein Werk sieht so aus:

```json
{
  "image": "images/trauer_und_trost.jpg",
  "title": "Trauer und Trost",
  "year": "2025",
  "medium": "Gouache auf Malkarton",
  "dimensions": "30 × 40 cm",
  "note": "Wer tröstet hier wen? Wer trauert? ..."
}
```

Bedeutung der Angaben – so und nicht anders gegenüber Annerose benennen:

| Angabe        | Heißt für Annerose | Wo erscheint es                                        | Pflicht? |
|---------------|--------------------|--------------------------------------------------------|----------|
| `image`       | Bilddatei          | das Foto selbst                                        | ja       |
| `title`       | Titel              | groß unter dem Bild                                    | ja       |
| `year`        | Jahr               | neben dem Titel                                        | ja       |
| `medium`      | Technik            | klein unter dem Titel                                  | ja       |
| `dimensions`  | Größe              | klein unter dem Titel                                  | ja       |
| `note`        | Beschreibung       | **erst sichtbar, wenn man das Bild anklickt**          | nein     |
| `bio`         | –                  | markiert das Foto im Abschnitt „Über mich"             | nein     |

**Fehlende Angaben immer nachfragen** – einzeln und in einfachen Worten, z. B.:
„Aus welchem Jahr ist das Bild?", „Wie groß ist es? (zum Beispiel 30 × 40 cm)",
„Womit ist es gemalt – Gouache auf Malkarton oder Acryl auf Leinwand?",
„Möchtest du einen Text dazu, der erscheint, wenn man das Bild anklickt?"

Die Beschreibung (`note`) ist freiwillig – wenn Annerose keine möchte, die Zeile einfach weglassen.

### Bilddatei in den richtigen Ordner bringen

Alle Fotos müssen im Ordner `public/images/` liegen.

- Liegt das Foto woanders (z. B. Desktop, Bilder-Ordner, Downloads): **kopieren**, nicht verschieben.
- Den Dateinamen sauber wählen: nur kleine Buchstaben, keine Leerzeichen, keine Umlaute
  (ä → ae, ö → oe, ü → ue, ß → ss), Wörter mit `_` trennen. Beispiel: `stiller_morgen.jpg`
- In der Liste steht der Name dann **mit** `images/` davor: `"image": "images/stiller_morgen.jpg"`
- Existiert dort schon eine Datei mit dem Namen: nachfragen, ob sie ersetzt werden soll,
  oder einen anderen Namen wählen.
- Findest du das genannte Foto nicht, frage: „Wo liegt das Foto? Du kannst mir die Datei auch
  einfach in dieses Fenster ziehen."

### Regeln beim Bearbeiten der Liste

- Aufbau nicht verändern: zwei Einrückungsstufen wie bisher, Kommas zwischen den Werken,
  **kein** Komma nach dem letzten Werk einer Liste.
- Das Zeichen für Maße ist `×` (nicht `x`).
- Reihenfolge in der Liste = Reihenfolge auf der Website.
- **Wichtig:** Das allererste Werk unter „Gouache" wird im Raster **nicht** angezeigt –
  es ist das große Bild ganz oben auf der Startseite. Wenn Annerose es entfernen oder
  verschieben will, vorher darauf hinweisen: „Das ist das große Bild ganz oben auf der
  Startseite. Welches Bild soll dort stattdessen stehen?"
- `"bio": true` darf nur bei **einem** Werk stehen (Foto im Abschnitt „Über mich").
- Nach jeder Änderung prüfen, ob die Datei noch gültig ist:
  `node -e "JSON.parse(require('fs').readFileSync('public/paintings.json','utf8'))"`
  Bei einem Fehler: selbst korrigieren, Annerose damit nicht behelligen.
- Auch prüfen, dass jede genannte Bilddatei wirklich in `public/images/` existiert.

Nach der Änderung kurz zusammenfassen, was gemacht wurde, und sagen:

> Schau kurz in der Vorschau nach (localhost:5173), ob es dir so gefällt.

---

## Schritt 4 – Weitere Änderungen? (Schleife)

Nach jeder Änderung fragen:

> Möchtest du noch etwas ändern? (zum Beispiel ein weiteres Bild hinzufügen, einen Titel
> anpassen oder ein Bild entfernen) – Wenn alles passt, sag einfach **fertig**.

Solange Änderungen kommen: zurück zu Schritt 3. Erst wenn Annerose „fertig", „nein", „passt"
o. Ä. sagt, weiter zu Schritt 5.

---

## Schritt 5 – Änderungen bestätigen lassen

Bevor veröffentlicht wird, muss Annerose die Änderungen annehmen:

> Alles fertig. Bitte übernimm die Änderungen jetzt mit dem Knopf **„Keep"** (Behalten).
> Sag mir danach kurz Bescheid.

**Erst weitermachen, wenn sie bestätigt hat.** Nicht ohne Bestätigung veröffentlichen.

---

## Schritt 6 – Veröffentlichen

1. `git add public/paintings.json public/images` (nur was wirklich geändert wurde)
2. `git commit` mit kurzer, sachlicher Nachricht auf Deutsch, z. B.
   „Neues Bild 'Stiller Morgen' hinzugefügt" oder „Beschreibung von 'Trauer und Trost' angepasst".
3. `git push`
4. Wird der Push abgelehnt: einmal `git pull --no-rebase` und erneut `git push`.
   Klappt das nicht oder gibt es Konflikte → Abbruchregel aus Schritt 1 anwenden.

Zum Schluss genau das sagen:

> ✅ Fertig – deine Änderungen sind unterwegs.
>
> Es dauert jetzt ungefähr **2 Minuten**, bis sie im Internet zu sehen sind.
> Danach kannst du sie auf **anneroseberger.de** anschauen.
> Tipp: Falls dort noch das Alte steht, warte kurz und drücke dann **F5**.

---

## Kurzfassung des Ablaufs

1. Neueste Fassung holen – bei Konflikt sofort abbrechen und an Ole verweisen
2. Vorschau starten und erklären (localhost:5173)
3. Änderung machen, fehlende Angaben erfragen, Foto nach `public/images` kopieren
4. Fragen: „Noch etwas?" – so lange, bis Annerose „fertig" sagt
5. Um Bestätigung der Änderungen bitten (**„Keep"**)
6. Veröffentlichen und auf die 2 Minuten hinweisen
