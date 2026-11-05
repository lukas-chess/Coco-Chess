/**
 * Spiel-Controller: verbindet chess.js (Regeln), Stockfish (Gegner) und UI.
 * Grundsatz: Ein Zug wird erst angezeigt, nachdem chess.js ihn als legal bestätigt hat.
 * Das gilt für Spielerzüge UND für Engine-Züge.
 */
import { Chess, tryMove, targetsFrom, gameStatus, plainMove, replay } from '../chess/rules.js';
import { toUci, fromUci, isUci } from '../chess/notation.js';
import { outcomeForPlayer } from '../chess/outcome.js';
import { getLevel, nextLevel } from '../engine/levels.js';
import { EngineCancelled } from '../engine/stockfish.js';

export class GameController {
  constructor({ engine, settings }) {
    this.engine = engine;
    this.settings = settings;
    this.chess = new Chess();
    this.playerColor = settings.get().playerColor;
    this.phase = 'idle'; // idle | thinking | error
    this.error = null;
    this.resigned = false;
    this.token = 0;
    this.listeners = new Set();
    this.engineStatus = 'loading';
    this._snap = null;
    this.engine.onStatus = (s) => {
      this.engineStatus = s;
      this._emit();
    };
    settings.subscribe(() => this._emit());
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    this._snap = null;
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  snapshot() {
    if (this._snap) return this._snap;
    const st = gameStatus(this.chess, this.resigned, this.playerColor);
    const cfg = this.settings.get();
    const turn = this.chess.turn();
    this._snap = {
      engineStatus: this.engineStatus,
      phase: this.phase,
      error: this.error,
      playerColor: this.playerColor,
      turn,
      playerToMove: turn === this.playerColor,
      moves: this.chess.history({ verbose: true }).map(plainMove),
      fen: this.chess.fen(),
      check: this.chess.inCheck(),
      over: st.over,
      outcome: st.outcome,
      level: cfg.level,
      adaptive: cfg.adaptive,
      canUndo: this.resigned || this._undoPlies() > 0,
    };
    return this._snap;
  }

  serialize() {
    return {
      v: 1,
      moves: this.chess.history({ verbose: true }).map(toUci),
      playerColor: this.playerColor,
      resigned: this.resigned,
      savedAt: Date.now(),
    };
  }

  /** Startet die App-Logik; stellt (falls vorhanden) eine gespeicherte Partie wieder her. */
  async start(saved) {
    if (saved && saved.moves.every(isUci)) {
      try {
        this.chess = replay(saved.moves, fromUci);
        this.playerColor = saved.playerColor === 'b' ? 'b' : 'w';
        this.resigned = !!saved.resigned;
      } catch (e) {
        this.chess = new Chess(); // beschädigte Speicherung: sauber neu beginnen
      }
    }
    this._emit();
    this.engine.init().catch((e) => this._fail(e));
    this._engineTurn();
  }

  _fail(e) {
    this.phase = 'error';
    this.error = e && e.message ? e.message : String(e);
    this._emit();
  }

  pgn() {
    return this.chess.pgn();
  }

  /** Zielfelder für die Feldauswahl-Eingabe. */
  targetsFrom(from) {
    return targetsFrom(this.chess, from, this.playerColor);
  }

  /** Spielerzug. Gibt {ok:true} oder {ok:false, error, needsPromotion?} zurück. */
  playerMove(input) {
    if (this.phase === 'thinking') return { ok: false, error: 'Der Computer rechnet noch. Bitte kurz warten.' };
    const st = gameStatus(this.chess, this.resigned, this.playerColor);
    if (st.over) return { ok: false, error: 'Die Partie ist beendet. Starte eine neue Partie oder nimm einen Zug zurück.' };
    if (this.chess.turn() !== this.playerColor) {
      return { ok: false, error: 'Du bist gerade nicht am Zug.' };
    }
    const res = tryMove(this.chess, input);
    if (!res.ok) return res;
    this.error = null;
    this._emit();
    this._engineTurn();
    return { ok: true, move: plainMove(res.move) };
  }

  async _engineTurn() {
    const st = gameStatus(this.chess, this.resigned, this.playerColor);
    if (st.over || this.chess.turn() === this.playerColor) return;
    const token = ++this.token;
    this.phase = 'thinking';
    this.error = null;
    this._emit();
    try {
      const history = this.chess.history({ verbose: true }).map(toUci);
      const uci = await this.engine.bestMove(history, getLevel(this.settings.get().level));
      if (token !== this.token) return; // zwischenzeitlich zurückgenommen / neue Partie
      const res = tryMove(this.chess, fromUci(uci));
      if (!res.ok) throw new Error(`Die Engine lieferte einen ungültigen Zug (${uci}). Er wurde verworfen.`);
      this.phase = 'idle';
      this._emit();
    } catch (e) {
      if (e instanceof EngineCancelled || token !== this.token) return;
      this._fail(e);
    }
  }

  async retryEngine() {
    this.token++;
    this.phase = 'idle';
    this.error = null;
    this._emit();
    try {
      await this.engine.restart();
    } catch (e) {
      return this._fail(e);
    }
    this._engineTurn();
  }

  async _abort() {
    this.token++;
    try {
      await this.engine.cancel();
    } catch (e) {
      /* ignorieren */
    }
    this.phase = 'idle';
    this.error = null;
  }

  /** Halbzüge, die "Zurücknehmen" entfernt: danach ist wieder der Spieler am Zug. */
  _undoPlies() {
    const n = this.chess.turn() === this.playerColor ? 2 : 1;
    return this.chess.history().length >= n ? n : 0;
  }

  async undo() {
    if (this.resigned) {
      await this._abort();
      this.resigned = false;
      this._emit();
      return true;
    }
    const n = this._undoPlies();
    if (!n) return false;
    await this._abort();
    for (let i = 0; i < n; i++) this.chess.undo();
    this._emit();
    return true;
  }

  async resign() {
    await this._abort();
    this.resigned = true;
    this._emit();
  }

  /** Bei beendeter Partie: Bilanz fortschreiben, im adaptiven Modus die Stufe anpassen. */
  _finalizeResult() {
    const st = gameStatus(this.chess, this.resigned, this.playerColor);
    if (!st.over) return;
    const outcome = outcomeForPlayer(st.outcome, this.playerColor);
    const cfg = this.settings.get();
    const patch = {
      stats: { ...cfg.stats, [outcome]: (cfg.stats[outcome] || 0) + 1 },
      recent: [...cfg.recent, { outcome, level: cfg.level, color: this.playerColor, at: Date.now() }].slice(-20),
    };
    if (cfg.adaptive) patch.level = nextLevel(cfg.level, outcome);
    this.settings.update(patch);
  }

  async newGame(playerColor = this.playerColor) {
    await this._abort();
    this._finalizeResult();
    this.chess = new Chess();
    this.playerColor = playerColor === 'b' ? 'b' : 'w';
    this.resigned = false;
    this.settings.update({ playerColor: this.playerColor });
    this._emit();
    await this.engine.newGame();
    this._engineTurn();
  }

  resetGame() {
    return this.newGame(this.playerColor);
  }

  /** Nach dem Wechsel in den Vordergrund: Engine prüfen (iOS kann Worker im Hintergrund beenden). */
  async checkEngine() {
    if (this.phase === 'thinking') return;
    const ok = await this.engine.healthCheck();
    if (!ok) this._emit();
  }
}
