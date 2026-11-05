/** Berechnet, was die große Karte oben zeigt. Reine Funktion (testbar). */
import { describeMove } from '../chess/notation.js';
import { outcomeHeadline, outcomeSubline, outcomeForPlayer } from '../chess/outcome.js';
import { getLevel, nextLevel } from '../engine/levels.js';

export function heroModel(s) {
  const lvl = getLevel(s.level);
  if (s.over) {
    let sub = outcomeSubline(s.outcome, s.playerColor);
    if (s.adaptive) {
      const nl = nextLevel(s.level, outcomeForPlayer(s.outcome, s.playerColor));
      sub += nl !== s.level ? ` Nächste Partie: Stufe ${nl} (${getLevel(nl).name}).` : ' Die Stufe bleibt gleich.';
    }
    return { tone: 'over', label: 'PARTIE BEENDET', move: outcomeHeadline(s.outcome), sub, hints: [], retry: false };
  }
  if (s.phase === 'error') {
    return {
      tone: 'error', label: 'FEHLER', move: 'Engine', sub: s.error || 'Unbekannter Fehler.',
      hints: ['Deine bisherigen Züge sind gespeichert. Tippe auf „Erneut versuchen“.'], retry: true,
    };
  }
  if (s.phase === 'thinking') {
    return {
      tone: 'think', label: 'COMPUTER', move: '', thinking: true,
      sub: s.engineStatus === 'loading'
        ? 'Engine wird geladen – das dauert beim ersten Start einen Moment.'
        : `Stockfish rechnet auf Stufe ${lvl.id} (${lvl.name}).`,
      hints: [], retry: false,
    };
  }
  const last = s.moves[s.moves.length - 1];
  if (last && last.color !== s.playerColor) {
    const d = describeMove(last);
    return { tone: 'move', label: 'COMPUTERZUG', move: d.title, sub: d.pieceName, hints: d.hints, retry: false };
  }
  return {
    tone: 'idle', label: 'DEIN ZUG', move: s.playerColor === 'w' ? 'Weiß beginnt' : 'Los geht’s',
    sub: 'Gib deinen Zug unten ein.', hints: s.check ? ['Du stehst im Schach!'] : [], retry: false,
  };
}
