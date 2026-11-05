# Coco Chess

Dein persönlicher Schachcomputer für das **echte Brett**. Du spielst auf deinem
Holzbrett, das iPhone nimmt deine Züge entgegen und zeigt dir die Züge des Gegners
(Stockfish) an. Die App zeigt absichtlich **kein** digitales Brett.

- Läuft komplett lokal im Browser (kein Server, keine Konten, keine Cloud-KI).
- Installierbar auf dem iPhone-Home-Bildschirm, funktioniert danach auch **offline**.
- 10 Schwierigkeitsstufen + optionaler adaptiver Modus.
- Zugeingabe per Feldauswahl (Linie + Reihe) oder per Text (`e2e4`).

---

## So veröffentlichst du die App kostenlos (ohne Programmierkenntnisse)

Du brauchst nur einen Computer mit Browser und ein kostenloses GitHub-Konto.
GitHub baut die App dann selbst zusammen – du musst nichts installieren.

**Schritt 1 – ZIP entpacken.** Entpacke `coco-chess.zip` auf deinem Computer.

**Schritt 2 – GitHub-Konto.** Gehe auf https://github.com und lege ein kostenloses Konto an.

**Schritt 3 – Repository anlegen.** Oben rechts auf **+ → New repository**.
Name: `coco-chess`. Wähle **Public** (Pflicht für kostenloses GitHub Pages; passt auch
zur Lizenz, siehe unten). Auf **Create repository** klicken.

**Schritt 4 – Dateien hochladen.** Auf der neuen Seite den Link **„uploading an existing file“**
anklicken. Ziehe den **gesamten Inhalt** des entpackten Ordners (alle Dateien und Ordner) ins
Browserfenster. Warten, bis alles hochgeladen ist, dann unten **Commit changes**.

> **Wichtig – versteckter Ordner `.github`:** Er enthält die Bauanleitung. Manche Systeme
> blenden ihn aus (Mac: im Finder `Cmd + Shift + .` drücken, um versteckte Ordner zu sehen).
> Kontrolle: Im Repository muss `.github/workflows/deploy.yml` sichtbar sein.
> Falls nicht: **Add file → Create new file**, als Namen genau `.github/workflows/deploy.yml`
> eintippen, den Inhalt der Datei `GITHUB-WORKFLOW-KOPIE.txt` einfügen und **Commit changes**.

**Schritt 5 – GitHub Pages einschalten.** Im Repository **Settings → Pages**. Unter
**Build and deployment → Source** **„GitHub Actions“** auswählen.

**Schritt 6 – Warten.** Reiter **Actions** öffnen. Der Lauf „Coco Chess veröffentlichen“
braucht ca. 2–5 Minuten. Wenn er einen grünen Haken hat, ist die App online unter

`https://DEIN-GITHUB-NAME.github.io/coco-chess/`

Falls der erste Lauf rot ist, weil Pages noch nicht eingeschaltet war: Lauf öffnen →
**Re-run all jobs**.

> Der Lauf besteht aus drei Teilen: *test*, *build*, *deploy*. Für die Veröffentlichung zählen
> *build* und *deploy*. Ist nur *test* rot, läuft die App trotzdem – schick mir dann bitte
> die Fehlermeldung.

## Auf dem iPhone installieren

1. Öffne die Adresse oben in **Safari** (nicht in einem anderen Browser).
2. Tippe auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Starte Coco Chess über das neue Symbol.
4. Lass die App **einmal mit Internet** offen, bis unter **Einstellungen → Status**
   „Offline-Speicher: Engine gespeichert ✓“ steht (die Engine ist ca. 7 MB groß, das dauert einen Moment).
5. Test: Flugmodus an, App neu starten, eine Partie beginnen.

## Bedienung

1. **Neue Partie** (Farbe wählen) – bei Schwarz zieht der Computer zuerst.
2. Deinen Zug auf dem **echten Brett** spielen und in der App eintragen:
   - *Felder wählen:* Linie und Reihe des Ausgangsfelds tippen (z. B. `e` `2`), dann des Zielfelds (`e` `4`),
     **Zug spielen**. Nach der Wahl des Ausgangsfelds werden unmögliche Ziele abgedunkelt.
   - *Text eingeben:* `e2e4`, `g1f3`, … Rochade als Königszug (`e1g1`), Umwandlung mit Buchstaben (`e7e8q`).
3. Die App prüft deinen Zug. Ist er ungültig, erscheint eine Erklärung.
4. Der Computer rechnet, dann erscheint groß **COMPUTERZUG**. Spiele ihn auf deinem Brett nach.
   Bei Schlagen, Rochade, en passant und Umwandlung steht darunter, was du am Brett tun musst.
5. **Zurück** nimmt deinen letzten Zug *und* die Antwort des Computers zurück.

| Stufe | Name | Einstellung (Stockfish) |
|---|---|---|
| 1 | Anfänger | Skill 0, Tiefe 1 |
| 2 | Sehr leicht | Skill 3, Tiefe 2 |
| 3 | Leicht | Skill 6, Tiefe 3 |
| 4 | Normal | Skill 9, Tiefe 5 |
| 5 | Mittel | Elo-Begrenzung 1400 |
| 6 | Fortgeschritten | Elo-Begrenzung 1650 |
| 7 | Schwer | Elo-Begrenzung 1950 |
| 8 | Sehr schwer | Elo-Begrenzung 2300 |
| 9 | Experte | Elo-Begrenzung 2750 |
| 10 | Maximale Stärke | volle Stärke, 3 s Bedenkzeit |

Die Elo-Zahlen sind **Engine-Einstellungen, keine gemessene Spielstärke** (Details im Testbericht).
Adaptiver Modus: Sieg → eine Stufe höher, Niederlage → eine Stufe tiefer, Remis → gleich.

## Wenn etwas nicht klappt

- **„Engine-Fehler“ / „Engine wird geladen“ bleibt stehen:** Auf **Erneut versuchen** tippen. Hilft das nicht:
  App komplett schließen und neu öffnen. Dein Spielstand bleibt erhalten.
- **Engine startet auf einem älteren iPhone nicht:** Ich konnte die Engine nicht auf echten Geräten prüfen.
  Sie nutzt WebAssembly; sicherheitshalber **iOS 16.4 oder neuer** verwenden.
- **Nach einem Update sieht die App alt aus:** App einmal komplett schließen und neu öffnen.

## Für Neugierige / Weiterentwicklung (optional)

```
npm install      # Bibliotheken holen
npm run dev      # Entwicklungsserver (iPhone-Installation geht nur über https, also GitHub Pages)
npm test         # Tests
npm run build    # fertige App im Ordner dist/
```

Wichtige Ordner: `src/engine` (Stockfish-Anbindung, Stufen), `src/chess` (Regeln über chess.js),
`src/game` (Spielablauf), `src/storage` (IndexedDB), `src/ui` (Oberfläche), `scripts` (Build-Helfer).

## Datenschutz

Alle Berechnungen und Daten bleiben auf deinem Gerät (IndexedDB). Kleine Ausnahme: Die gewählte
Hell/Dunkel-Einstellung wird zusätzlich in `localStorage` gespiegelt, damit beim Start nichts aufblitzt.
Es werden keine Züge oder Partien übertragen.

## Lizenz

Coco Chess steht unter **GPL-3.0-or-later**, weil Stockfish (GPL-3.0) mit der App ausgeliefert wird.
Das bedeutet: Der Quellcode muss öffentlich zugänglich bleiben (öffentliches GitHub-Repository erfüllt das).
Lizenztexte und Quellen: Menü **Einstellungen → Über Coco Chess** bzw. `public/licenses/NOTICE.txt`.
Ich bin kein Anwalt; bei kommerzieller Nutzung oder Weitergabe bitte rechtlich prüfen lassen.
