# Testbericht Coco Chess

Stand der Entwicklungsumgebung: **ohne Internetzugang**. Deshalb konnten `chess.js`, `stockfish`
und `vite` dort **nicht installiert** werden. Alles, was diese Pakete braucht, wurde **nicht**
von mir ausgeführt. Hier steht nur, was tatsächlich gelaufen ist.

## Tatsächlich ausgeführt (Node 22, `node --test`)

Ergebnis: **23 bestanden, 0 fehlgeschlagen, 29 übersprungen** (die 29 brauchen chess.js).

| Bereich | Was geprüft wurde |
|---|---|
| Stufen | 10 Stufen mit den geforderten Namen; Bedenkzeit, Elo und Skill steigen monoton; Elo ≥ 1320 (Stockfish-Minimum); Stufe 10 ohne Begrenzung |
| Adaptiver Modus | Sieg +1, Niederlage −1, Remis 0, Grenzen 1 und 10; Ergebnis aus Spielersicht |
| Zugeingabe (Text) | `e2e4`, `g1f3`, `b1c3`, `E2-E4`, `e2 e4`, `e7e8q`, `e7e8=N`; Fehlermeldungen für leer, nur ein Feld, `0-0`, gleiches Feld, Unsinn, SAN |
| Zugbeschreibung | Rochade kurz/lang, en passant, Schlagen, Umwandlung, Schach, Matt |
| Engine-Protokoll (simulierter UCI-Worker) | Start (`uci`/`isready`); `position startpos moves …`; `go movetime … depth …`; Optionen pro Stufe; Optionen nicht doppelt senden; Abbrechen mit `stop`; nächste Suche nach Abbruch; **Engine-Neustart** nach Timeout; Fehler nach zwei Fehlversuchen (kein erfundener Zug); fehlendes Worker-Skript; Health-Check; `bestmove (none)` |
| Service-Worker-Generator | Platzhalter ersetzt, gültiges JavaScript, Version ändert sich mit Inhalt |
| Service-Worker-Logik (simulierte Browser-APIs) | Install legt Engine-Datei und Startseite in den Cache; **offline** werden Dateien aus dem Cache geliefert; Navigation fällt auf die App-Seite zurück; unbekannte Datei → 503 |
| Bündelung | `esbuild` bündelt die App fehlerfrei (≈ 53 KB JS, 13 KB CSS ohne Engine und chess.js) |
| Oberfläche (Chromium, 390×844, mit **Attrappe** für chess.js und einem Mini-UCI-Worker statt Stockfish) | Dark und Light Mode; Tab-Navigation; Feldauswahl inkl. Abdunkeln unmöglicher Ziele; Texteingabe mit Fehlermeldung; Ablauf Spielerzug → „Computer rechnet“ → COMPUTERZUG → Zurück; Neue-Partie-Dialog; keine JavaScript-Fehler |

## Geschrieben, aber hier NICHT ausgeführt (brauchen `npm install`)

Laufen automatisch bei jedem Veröffentlichen (GitHub-Reiter *Actions → test*) oder mit `npm test`.

- `tests/rules.test.js` (16): e2e4 als erster Zug, Schäfermatt, Narrenmatt, Rochade kurz und lang, en passant,
  Bauernumwandlung, ungültige Züge, Schach-Abwehr, Patt, unzureichendes Material, dreifache Wiederholung,
  50-Züge-Regel, Aufgabe, Zurücknehmen, Wiederaufbau aus Zugliste, Zielfelder.
- `tests/controller.test.js` (12): Computerzug erst nach Validierung sichtbar; ungültiger Engine-Zug wird verworfen;
  Engine-Fehler + „Erneut versuchen“; Zurücknehmen (auch während der Berechnung); Spieler mit Schwarz;
  Partieende + adaptive Stufe; Aufgeben; Speichern und Wiederherstellen (auch beschädigte Daten).

## Nie geprüft (bekannte Lücken)

- **Echtes Stockfish im Browser / auf dem iPhone.** Dateinamen und das Worker-Verhalten von `stockfish.js`
  stammen aus meinem Wissen, nicht aus einem Test. Das Build-Skript sucht die Dateien selbst und bricht
  mit einer klaren Meldung ab, wenn es nichts Passendes findet.
- **`vite build` und die echte PWA-Installation.** Der Service Worker wurde nur simuliert getestet.
  „Stockfish offline nach Installation“ ist daher **nicht verifiziert** – bitte am Gerät prüfen (Anleitung im README).
- **Safari/iOS-Verhalten** (Worker im Hintergrund, Speicher-Räumung, WebAssembly-Version). Nur Chromium wurde genutzt.
- **Spielstärke der Stufen.** Die Einstellungen steigen nachweislich; gemessen wurde die Stärke nicht
  (Elo-Werte sind Engine-Parameter der Lite-Variante bei kurzer Bedenkzeit, nicht reale Wertungszahlen).
- Offline-Verhalten nach einem Update des Service Workers und die Speicherung unter iOS-Datenschutz-Einstellungen.
