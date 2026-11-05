/** Ergebnis aus Sicht des Spielers: 'win' | 'loss' | 'draw' */
export function outcomeForPlayer(outcome, playerColor) {
  if (!outcome) return null;
  if (!outcome.winner) return 'draw';
  return outcome.winner === playerColor ? 'win' : 'loss';
}

export const OUTCOME_TEXT = {
  checkmate: 'Schachmatt',
  stalemate: 'Patt',
  threefold: 'Dreifache Stellungswiederholung',
  fifty: '50-Züge-Regel',
  insufficient: 'Unzureichendes Material',
  resigned: 'Aufgegeben',
};

export function outcomeHeadline(outcome) {
  return outcome ? OUTCOME_TEXT[outcome.kind] || 'Partie beendet' : '';
}

export function outcomeSubline(outcome, playerColor) {
  const o = outcomeForPlayer(outcome, playerColor);
  if (o === 'win') return 'Du hast gewonnen.';
  if (o === 'loss') return outcome.kind === 'resigned' ? 'Du hast aufgegeben.' : 'Der Computer hat gewonnen.';
  if (o === 'draw') return 'Remis – unentschieden.';
  return '';
}
