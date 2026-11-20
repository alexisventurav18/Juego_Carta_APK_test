import { drawProb, randomInt, type Card } from './cards';
import { applyRobaitoMove, captureOptions, type RobaitoMove, type RobaitoState, topOf } from './robaito';

/**
 * Decisiones de los bots de El Robaíto. Solo usa información pública (su mano,
 * la mesa, las cimas y los tamaños de los paquetes), así que juega igual con
 * la vista de cualquier jugador.
 *
 * Cada carta se valora mirando una jugada adelante:
 *   cartas que se lleva ahora  −  lo que el siguiente jugador podría llevarse
 *   en su turno de la mesa que queda.
 * La pérdida esperada es hipergeométrica: de cada número quedan 4 copias menos
 * las que se ven (mi mano, la mesa y las cimas); el rival roba entre las cartas
 * que nadie ha visto, y si juega un número que levanta cartas de la mesa o roba
 * un paquete (incluido el mío), esas cartas se cuentan como pérdida.
 * Además, botar una carta del mismo número que la cima de mi propio paquete
 * se castiga un poco: le deja al rival la mesa servida para robarme el paquete.
 */

/** Castigo por botar una carta que repite la cima de mi propio paquete. */
const OWN_TOP_PENALTY = 0.25;

function pickRandom<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

/** Cartas visibles para el bot: su mano, la mesa y la cima de cada paquete. */
function seenCards(state: RobaitoState, seat: number): Card[] {
  const seen = [...state.hands[seat], ...state.table];
  for (const pile of state.piles) {
    const top = topOf(pile);
    if (top) seen.push(top);
  }
  return seen;
}

/**
 * Lo que el siguiente jugador podría llevarse de la posición `next`, en
 * cartas esperadas. El rival no ve mi mano ni lo de abajo de los paquetes:
 * cada número que no se ha visto tiene las copias que quedan repartidas entre
 * las cartas que nadie ha visto, y su mano es una muestra de esas cartas.
 */
function expectedLoss(next: RobaitoState, seat: number): number {
  if (next.phase !== 'playing' || next.lastEvent?.redeal) return 0;
  const rival = (seat + 1) % next.players.length;
  const rivalHand = next.hands[rival].length;
  if (rivalHand === 0) return 0;

  const seen = seenCards(next, seat);
  const unseenTotal = 52 - seen.length;
  if (unseenTotal <= 0) return 0;
  const seenByRank = new Map<number, number>();
  for (const c of seen) seenByRank.set(c.rank, (seenByRank.get(c.rank) ?? 0) + 1);
  const tableByRank = new Map<number, number>();
  for (const c of next.table) tableByRank.set(c.rank, (tableByRank.get(c.rank) ?? 0) + 1);

  // Paquetes que el rival robaría con cada número (nunca el suyo).
  const stealable = new Map<number, number>();
  next.piles.forEach((pile, s) => {
    if (s === rival || pile.length === 0) return;
    const top = topOf(pile);
    if (!top) return;
    stealable.set(top.rank, (stealable.get(top.rank) ?? 0) + pile.length);
  });

  const outcomes: { p: number; loss: number }[] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const copies = 4 - (seenByRank.get(rank) ?? 0);
    if (copies <= 0) continue;
    const p = drawProb(unseenTotal, copies, rivalHand, 1);
    if (p <= 0) continue;
    const tableTaken = tableByRank.get(rank) ?? 0;
    const stolen = stealable.get(rank) ?? 0;
    // Sin captura ni robo, la carta del rival queda en la mesa: no gana nada.
    const loss = tableTaken + stolen > 0 ? tableTaken + stolen + 1 : 0;
    if (loss > 0) outcomes.push({ p, loss });
  }
  // Como en el bot de Casino: se encadenan los resultados de mayor a menor pérdida.
  outcomes.sort((a, b) => b.loss - a.loss);
  let remaining = 1;
  let expected = 0;
  for (const { p, loss } of outcomes) {
    expected += remaining * p * loss;
    remaining *= 1 - p;
  }
  return expected;
}

export function chooseRobaitoCard(state: RobaitoState, seat: number): Card {
  const hand = state.hands[seat];
  const myTop = topOf(state.piles[seat]);
  let best: Card | null = null;
  let bestScore = -Infinity;
  for (const card of hand) {
    const result = applyRobaitoMove(state, seat, { type: 'play', cardId: card.id });
    if ('error' in result) continue;
    const next = result.state;
    const gained = next.piles[seat].length - state.piles[seat].length;
    let score = gained - expectedLoss(next, seat);
    const options = captureOptions(state, seat, card);
    if (options.table.length === 0 && options.steals.length === 0 && myTop && card.rank === myTop.rank) {
      score -= OWN_TOP_PENALTY;
    }
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  // Sin jugadas válidas (no debería pasar): se juega la primera carta.
  if (!best) return pickRandom(hand);
  return best;
}

export function chooseRobaitoMove(state: RobaitoState): RobaitoMove {
  return { type: 'play', cardId: chooseRobaitoCard(state, state.turn).id };
}
