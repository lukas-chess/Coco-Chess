import test from 'node:test';
import assert from 'node:assert/strict';

// Braucht chess.js. Ohne Paket werden die Tests ausdrücklich übersprungen.
let GameController = null;
let createSettingsStore = null;
try {
  ({ GameController } = await import('../src/game/controller.js'));
  ({ createSettingsStore } = await import('../src/storage/settings.js'));
} catch (e) {
  GameController = null;
}
const skip = GameController ? false : 'chess.js ist nicht installiert (bitte "npm install" ausführen)';
const settle = () => new Promise((r) => setTimeout(r, 15));

class FakeEngine {
  constructor(script = []) {
    this.script = script;
    this.calls = [];
    this.cancelled = 0;
    this.restarts = 0;
    this.status = 'ready';
    this.onStatus = null;
  }
  async init() { if (this.onStatus) this.onStatus('ready'); }
  async bestMove(moves, level) {
    this.calls.push({ moves: [...moves], level });
    const next = this.script.shift();
    if (typeof next === 'function') return next();
    if (next instanceof Error) throw next;
    return next;
  }
  async cancel() { this.cancelled++; }
  async newGame() {}
  async restart() { this.restarts++; }
  async healthCheck() { return true; }
}

const make = async (script, patch = {}) => {
  const settings = await createSettingsStore();
  if (Object.keys(patch).length) settings.update(patch);
  const engine = new FakeEngine(script);
  const controller = new GameController({ engine, settings });
  await controller.start(null);
  return { controller, engine, settings };
};

test('Spielerzug e2e4 -> Engine bekommt die Zugfolge -> Computerzug wird erst nach Validierung angezeigt', { skip }, async () => {
  const { controller, engine } = await make(['e7e5']);
  const r = controller.playerMove({ from: 'e2', to: 'e4' });
  assert.ok(r.ok);
  assert.equal(controller.snapshot().phase, 'thinking');
  assert.equal(controller.snapshot().moves.length, 1, 'Computerzug ist noch nicht sichtbar');
  await settle();
  const s = controller.snapshot();
  assert.deepEqual(engine.calls[0].moves, ['e2e4']);
  assert.equal(s.moves.length, 2);
  assert.equal(s.moves[1].from, 'e7');
  assert.equal(s.phase, 'idle');
  assert.ok(s.playerToMove);
});

test('Ungültiger Engine-Zug wird verworfen und nie angezeigt', { skip }, async () => {
  const { controller } = await make(['e2e4']); // illegal für Schwarz
  controller.playerMove({ from: 'e2', to: 'e4' });
  await settle();
  const s = controller.snapshot();
  assert.equal(s.phase, 'error');
  assert.equal(s.moves.length, 1);
  assert.match(s.error, /ungültigen Zug/);
});

test('Engine-Fehler -> "Erneut versuchen" startet die Engine neu und liefert den Zug', { skip }, async () => {
  const { controller, engine } = await make([new Error('abgestürzt'), 'e7e5']);
  controller.playerMove({ from: 'e2', to: 'e4' });
  await settle();
  assert.equal(controller.snapshot().phase, 'error');
  await controller.retryEngine();
  await settle();
  assert.equal(engine.restarts, 1);
  assert.equal(controller.snapshot().moves.length, 2);
  assert.equal(controller.snapshot().phase, 'idle');
});

test('Zurücknehmen entfernt Spieler- und Computerzug; Engine bekommt danach die richtige Stellung', { skip }, async () => {
  const { controller, engine } = await make(['e7e5', 'd7d5']);
  controller.playerMove({ from: 'e2', to: 'e4' });
  await settle();
  assert.ok(await controller.undo());
  let s = controller.snapshot();
  assert.equal(s.moves.length, 0);
  assert.equal(s.turn, 'w');
  controller.playerMove({ from: 'd2', to: 'd4' });
  await settle();
  assert.deepEqual(engine.calls[1].moves, ['d2d4'], 'Engine kennt den zurückgenommenen Zug nicht mehr');
});

test('Zurücknehmen während der Berechnung: späte Engine-Antwort wird ignoriert', { skip }, async () => {
  let release;
  const slow = () => new Promise((res) => (release = () => res('e7e5')));
  const { controller } = await make([slow]);
  controller.playerMove({ from: 'e2', to: 'e4' });
  await settle();
  assert.equal(controller.snapshot().phase, 'thinking');
  await controller.undo();
  release();
  await settle();
  const s = controller.snapshot();
  assert.equal(s.moves.length, 0);
  assert.equal(s.phase, 'idle');
});

test('Eingabe während der Berechnung wird abgelehnt', { skip }, async () => {
  const { controller } = await make([() => new Promise(() => {})]);
  controller.playerMove({ from: 'e2', to: 'e4' });
  const r = controller.playerMove({ from: 'd2', to: 'd4' });
  assert.equal(r.ok, false);
});

test('Spieler mit Schwarz: Engine eröffnet automatisch', { skip }, async () => {
  const { controller } = await make(['e2e4']);
  await controller.newGame('b');
  await settle();
  const s = controller.snapshot();
  assert.equal(s.moves.length, 1);
  assert.ok(s.playerToMove);
  assert.equal(s.canUndo, false, 'Rücknahme würde die Engine-Eröffnung entfernen');
});

test('Partieende + adaptiver Modus: Niederlage senkt die Stufe, Bilanz wird geführt', { skip }, async () => {
  const { controller, settings } = await make(['e7e5', 'd8h4'], { adaptive: true, level: 4 });
  controller.playerMove({ from: 'f2', to: 'f3' });
  await settle();
  controller.playerMove({ from: 'g2', to: 'g4' });
  await settle();
  assert.equal(controller.snapshot().over, true);
  assert.equal(controller.snapshot().outcome.winner, 'b');
  await controller.newGame('w');
  assert.equal(settings.get().level, 3);
  assert.equal(settings.get().stats.loss, 1);
});

test('Ohne adaptiven Modus bleibt die Stufe', { skip }, async () => {
  const { controller, settings } = await make(['e7e5', 'd8h4'], { adaptive: false, level: 6 });
  controller.playerMove({ from: 'f2', to: 'f3' });
  await settle();
  controller.playerMove({ from: 'g2', to: 'g4' });
  await settle();
  await controller.newGame('w');
  assert.equal(settings.get().level, 6);
});

test('Aufgeben zählt als Niederlage; Zurück macht es rückgängig', { skip }, async () => {
  const { controller } = await make([]);
  await controller.resign();
  assert.equal(controller.snapshot().over, true);
  assert.equal(controller.snapshot().outcome.kind, 'resigned');
  assert.ok(await controller.undo());
  assert.equal(controller.snapshot().over, false);
});

test('Speichern und Wiederherstellen einer Partie', { skip }, async () => {
  const a = await make(['e7e5']);
  a.controller.playerMove({ from: 'e2', to: 'e4' });
  await settle();
  const saved = JSON.parse(JSON.stringify(a.controller.serialize()));
  assert.deepEqual(saved.moves, ['e2e4', 'e7e5']);

  const b = await make([]);
  await b.controller.start(saved);
  assert.equal(b.controller.snapshot().fen, a.controller.snapshot().fen);
  assert.equal(b.controller.snapshot().moves.length, 2);

  const c = await make([]);
  await c.controller.start({ v: 1, moves: ['e2e4', 'e2e4'], playerColor: 'w' });
  assert.equal(c.controller.snapshot().moves.length, 0, 'beschädigte Speicherung -> saubere neue Partie');
});

test('Wiederherstellung, wenn die Engine am Zug ist, löst den Computerzug aus', { skip }, async () => {
  const { controller, engine } = await make(['e7e5']);
  await controller.start({ v: 1, moves: ['e2e4'], playerColor: 'w' });
  await settle();
  assert.deepEqual(engine.calls.at(-1).moves, ['e2e4']);
  assert.equal(controller.snapshot().moves.length, 2);
});
