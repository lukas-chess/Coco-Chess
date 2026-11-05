/**
 * Kommunikation mit Stockfish (UCI-Protokoll) über einen Web Worker.
 * Die UI wird dadurch nie blockiert. Die Engine bekommt bei jeder Suche die
 * komplette Zugfolge ab der Startstellung ("position startpos moves ...").
 * Ein Zurücknehmen ist damit automatisch auch im Engine-Zustand korrekt,
 * und Stellungswiederholungen/50-Züge-Zähler stimmen.
 */

export class EngineCancelled extends Error {
  constructor() {
    super('Berechnung abgebrochen');
    this.name = 'EngineCancelled';
  }
}

export class Engine {
  /**
   * @param {{createWorker: () => (Worker|Promise<Worker>), timeouts?: object}} opts
   */
  constructor({ createWorker, timeouts = {} }) {
    this.createWorker = createWorker;
    this.t = { init: 45000, ready: 10000, extra: 15000, health: 3000, ...timeouts };
    this.worker = null;
    this.initPromise = null;
    this.waiters = new Set();
    this.active = null;
    this.gen = 0;
    this.chain = Promise.resolve();
    this.currentOptions = {};
    this.status = 'idle'; // idle | loading | ready | error
    this.onStatus = null;
    this.name = '';
  }

  _setStatus(s) {
    this.status = s;
    if (this.onStatus) this.onStatus(s);
  }

  async _spawn() {
    const w = await this.createWorker();
    this.worker = w;
    w.onmessage = (e) => {
      const d = typeof e.data === 'string' ? e.data : (e.data && e.data.data) || String(e.data);
      for (const raw of String(d).split('\n')) {
        const line = raw.trim();
        if (line) this._onLine(line);
      }
    };
    w.onerror = (e) => {
      this._failAll(new Error('Die Schachengine ist abgestürzt' + (e && e.message ? ': ' + e.message : '.')));
    };
  }

  _onLine(line) {
    if (line.startsWith('id name ')) this.name = line.slice(8);
    for (const w of [...this.waiters]) {
      if (w.test(line)) {
        this._clear(w);
        w.resolve(line);
      }
    }
  }

  _clear(w) {
    clearTimeout(w.timer);
    this.waiters.delete(w);
  }

  _failAll(err) {
    for (const w of [...this.waiters]) {
      this._clear(w);
      w.reject(err);
    }
  }

  _waitFor(test, ms, what) {
    return new Promise((resolve, reject) => {
      const w = { test, resolve, reject, timer: null };
      w.timer = setTimeout(() => {
        this.waiters.delete(w);
        reject(new Error(`Zeitüberschreitung: ${what}`));
      }, ms);
      this.waiters.add(w);
    });
  }

  _send(cmd) {
    if (!this.worker) throw new Error('Die Engine ist nicht gestartet.');
    this.worker.postMessage(cmd);
  }

  async _sync(ms = this.t.ready) {
    const p = this._waitFor((l) => l === 'readyok', ms, 'Engine antwortet nicht');
    this._send('isready');
    await p;
  }

  _kill() {
    try {
      if (this.worker) this.worker.terminate();
    } catch (e) {
      /* ignorieren */
    }
    this.worker = null;
    this.initPromise = null;
    this.currentOptions = {};
  }

  init() {
    if (!this.initPromise) {
      this._setStatus('loading');
      const p = (async () => {
        await this._spawn();
        const ok = this._waitFor((l) => l === 'uciok', this.t.init, 'Engine-Start');
        this._send('uci');
        await ok;
        await this._sync();
        this._setStatus('ready');
      })();
      this.initPromise = p;
      p.catch(() => {
        if (this.initPromise === p) {
          this._kill();
          this._setStatus('error');
        }
      });
    }
    return this.initPromise;
  }

  async restart() {
    this.gen++;
    this._failAll(new Error('Engine wird neu gestartet'));
    this._kill();
    this.active = null;
    return this.init();
  }

  async healthCheck() {
    if (!this.initPromise || this.active) return true;
    try {
      await this.initPromise;
      await this._sync(this.t.health);
      return true;
    } catch (e) {
      await this.restart().catch(() => {});
      return false;
    }
  }

  async newGame() {
    await this.cancel();
    try {
      await this.init();
      this._send('ucinewgame');
      await this._sync();
    } catch (e) {
      /* Fehler zeigt sich bei der nächsten Suche */
    }
  }

  _applyLevel(level) {
    const want = {
      UCI_LimitStrength: level.elo ? 'true' : 'false',
      'Skill Level': String(level.skill ?? 20),
    };
    if (level.elo) want.UCI_Elo = String(level.elo);
    for (const [k, v] of Object.entries(want)) {
      if (this.currentOptions[k] !== v) {
        this._send(`setoption name ${k} value ${v}`);
        this.currentOptions[k] = v;
      }
    }
  }

  async _search(moves, level) {
    await this.cancel(); // erhöht gen; danach erst merken
    const gen = this.gen;
    await this.init();
    if (gen !== this.gen) throw new EngineCancelled();
    const job = { cancelled: false, done: null };
    this.active = job;
    try {
      this._applyLevel(level);
      this._send('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
      job.done = this._waitFor((l) => l.startsWith('bestmove'), level.movetime + this.t.extra, 'Zugberechnung');
      this._send(`go movetime ${level.movetime}` + (level.depth ? ` depth ${level.depth}` : ''));
      const line = await job.done;
      if (job.cancelled || gen !== this.gen) throw new EngineCancelled();
      const mv = line.split(/\s+/)[1];
      if (!mv || mv === '(none)' || mv === '0000') throw new Error('Die Engine hat keinen Zug gefunden.');
      return mv;
    } finally {
      if (this.active === job) this.active = null;
    }
  }

  /**
   * Berechnet den besten Zug (UCI-Notation, z. B. "e7e5").
   * Bei einem technischen Fehler wird die Engine einmal neu gestartet und die Suche wiederholt.
   */
  bestMove(moves, level) {
    const run = async () => {
      let lastErr;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await this._search(moves, level);
        } catch (e) {
          if (e instanceof EngineCancelled) throw e;
          lastErr = e;
          await this.restart().catch(() => {});
        }
      }
      throw lastErr;
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }

  /** Bricht eine laufende Berechnung ab und wartet, bis die Engine wieder frei ist. */
  async cancel() {
    this.gen++;
    const job = this.active;
    if (!job) return;
    job.cancelled = true;
    try {
      this._send('stop');
    } catch (e) {
      /* ignorieren */
    }
    try {
      await job.done;
    } catch (e) {
      /* ignorieren */
    }
  }

  destroy() {
    this._failAll(new EngineCancelled());
    this._kill();
  }
}
