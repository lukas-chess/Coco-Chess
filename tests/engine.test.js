import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, EngineCancelled } from '../src/engine/stockfish.js';
import { getLevel } from '../src/engine/levels.js';

/** Simuliert den UCI-Worker von Stockfish. */
class FakeWorker {
  constructor(opts = {}) {
    this.opts = opts;
    this.sent = [];
    this.onmessage = null;
    this.terminated = false;
    this.pending = false;
  }
  say(line) {
    if (!this.terminated && this.onmessage) this.onmessage({ data: line });
  }
  postMessage(cmd) {
    this.sent.push(cmd);
    setTimeout(() => this.reply(cmd), 0);
  }
  reply(cmd) {
    if (this.terminated) return;
    if (cmd === 'uci') {
      this.say('id name Stockfish Fake');
      this.say('uciok');
    } else if (cmd === 'isready') {
      if (!this.opts.mute) this.say('readyok');
    } else if (cmd.startsWith('go')) {
      if (this.opts.hang) return;
      this.pending = true;
      this.timer = setTimeout(() => {
        this.pending = false;
        this.say('bestmove e7e5 ponder g1f3');
      }, this.opts.thinkMs ?? 15);
    } else if (cmd === 'stop' && this.pending) {
      clearTimeout(this.timer);
      this.pending = false;
      this.say('bestmove d2d4');
    }
  }
  terminate() {
    this.terminated = true;
  }
}

const mk = (optsList = [{}], timeouts = { init: 500, ready: 300, extra: 100, health: 150 }) => {
  const workers = [];
  const engine = new Engine({
    createWorker: () => {
      const w = new FakeWorker(optsList[Math.min(workers.length, optsList.length - 1)]);
      workers.push(w);
      return w;
    },
    timeouts,
  });
  return { engine, workers };
};

test('init: uci/isready, Name wird gelesen, Status ready', async () => {
  const { engine, workers } = mk();
  const states = [];
  engine.onStatus = (s) => states.push(s);
  await engine.init();
  assert.deepEqual(states, ['loading', 'ready']);
  assert.equal(engine.name, 'Stockfish Fake');
  assert.deepEqual(workers[0].sent.slice(0, 2), ['uci', 'isready']);
  engine.destroy();
});

test('bestMove: sendet komplette Zugfolge ab Startstellung und liefert den Zug', async () => {
  const { engine, workers } = mk();
  const mv = await engine.bestMove(['e2e4'], getLevel(1));
  assert.equal(mv, 'e7e5');
  const sent = workers[0].sent;
  assert.ok(sent.includes('position startpos moves e2e4'));
  assert.ok(sent.includes('go movetime 60 depth 1'));
  assert.ok(sent.includes('setoption name Skill Level value 0'));
  assert.ok(sent.includes('setoption name UCI_LimitStrength value false'));
  await engine.bestMove([], getLevel(1));
  assert.ok(sent.includes('position startpos'), 'leere Zugliste');
  assert.equal(sent.filter((c) => c.startsWith('setoption name Skill')).length, 1, 'unveränderte Optionen werden nicht erneut gesendet');
  engine.destroy();
});

test('Elo-Stufen setzen UCI_LimitStrength und UCI_Elo; Stufe 10 hebt die Begrenzung auf', async () => {
  const { engine, workers } = mk();
  await engine.bestMove([], getLevel(6));
  assert.ok(workers[0].sent.includes('setoption name UCI_LimitStrength value true'));
  assert.ok(workers[0].sent.includes('setoption name UCI_Elo value 1650'));
  assert.ok(workers[0].sent.includes('go movetime 600'), 'ohne Tiefenbegrenzung');
  await engine.bestMove([], getLevel(10));
  assert.ok(workers[0].sent.includes('setoption name UCI_LimitStrength value false'));
  assert.ok(workers[0].sent.includes('setoption name Skill Level value 20'));
  engine.destroy();
});

test('cancel bricht eine laufende Berechnung ab (Ergebnis wird verworfen)', async () => {
  const { engine, workers } = mk([{ thinkMs: 500 }]);
  const p = engine.bestMove(['e2e4'], getLevel(10));
  await new Promise((r) => setTimeout(r, 40));
  await engine.cancel();
  await assert.rejects(p, EngineCancelled);
  assert.ok(workers[0].sent.includes('stop'));
  // Engine ist danach wieder benutzbar
  const { engine: e2 } = mk();
  assert.equal(await e2.bestMove([], getLevel(1)), 'e7e5');
  engine.destroy();
  e2.destroy();
});

test('nach cancel funktioniert die nächste Suche auf demselben Worker', async () => {
  const { engine, workers } = mk([{ thinkMs: 90 }]);
  const p1 = engine.bestMove(['e2e4'], getLevel(10));
  p1.catch(() => {});
  await new Promise((r) => setTimeout(r, 30));
  await engine.cancel();
  const mv = await engine.bestMove(['e2e4', 'e7e5'], getLevel(1));
  assert.equal(mv, 'e7e5');
  assert.equal(workers.length, 1, 'kein unnötiger Neustart');
  engine.destroy();
});

test('Engine-Neustart: hängende Engine -> Timeout -> neuer Worker -> Zug kommt an', async () => {
  const { engine, workers } = mk([{ hang: true }, {}]);
  const mv = await engine.bestMove(['e2e4'], getLevel(1));
  assert.equal(mv, 'e7e5');
  assert.equal(workers.length, 2, 'zweiter Worker wurde gestartet');
  assert.ok(workers[0].terminated, 'alter Worker wurde beendet');
  engine.destroy();
});

test('Dauerhaft kaputte Engine: nach zwei Versuchen kommt ein Fehler (kein falscher Zug)', async () => {
  const { engine, workers } = mk([{ hang: true }]);
  await assert.rejects(engine.bestMove([], getLevel(1)), /Zeitüberschreitung/);
  assert.equal(workers.length, 3, 'Erstversuch + zwei Neustarts');
  engine.destroy();
});

test('Worker, der nicht startet (Skript fehlt), meldet Fehler statt zu hängen', async () => {
  const engine = new Engine({
    createWorker: () => {
      throw new Error('engine.json fehlt');
    },
    timeouts: { init: 300, ready: 300, extra: 50 },
  });
  await assert.rejects(engine.init(), /engine.json fehlt/);
  assert.equal(engine.status, 'error');
});

test('healthCheck startet eine tote Engine neu', async () => {
  const { engine, workers } = mk([{}]);
  await engine.init();
  workers[0].opts.mute = true; // antwortet nicht mehr auf isready
  const ok = await engine.healthCheck();
  assert.equal(ok, false);
  assert.equal(workers.length, 2);
  engine.destroy();
});

test('bestmove (none) wird als Fehler behandelt', async () => {
  const w = [];
  const engine = new Engine({
    createWorker: () => {
      const f = new FakeWorker();
      f.reply = function (cmd) {
        if (cmd === 'uci') this.say('uciok');
        else if (cmd === 'isready') this.say('readyok');
        else if (cmd.startsWith('go')) this.say('bestmove (none)');
      };
      w.push(f);
      return f;
    },
    timeouts: { init: 300, ready: 300, extra: 50 },
  });
  await assert.rejects(engine.bestMove([], getLevel(1)), /keinen Zug/);
  engine.destroy();
});
