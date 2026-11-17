import type { Card } from './cards';
import { randomInt } from './cards';
import { captureOptions, type RobaitoMove, type RobaitoState, topOf } from './robaito';

/**
 * Decisiones de los bots de El Robaíto. Solo usa información pública (su mano, la mesa y los paquetes),
 * así que juega igual con la vista de cualquier jugador.
 *
 *  1. Robar: si una carta de su mano iguala la cima del paquete de un rival, la juega. Entre varios robos
 *     posibles elige el que se lleve más cartas de paquetes (y, a igualdad, el que levante más de la mesa).
 *  2. Levantar: si no puede robar, juega la carta que empareje con más cartas de la mesa.
 *  3. Descartar: si tiene que botar, evita soltar una carta del mismo número que la cima de su propio paquete.
 */

function pickRandom<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

/** Las mejores cartas según una puntuación (todas las que empatan en el máximo). */
function bestBy(cards: Card[], score: (card: Card) => number): Card[] {
  let best = -Infinity;
  let result: Card[] = [];
  for (const card of cards) {
    const value = score(card);
    if (value > best) {
      best = value;
      result = [card];
    } else if (value === best) {
      result.push(card);
    }
  }
  return result;
}

export function chooseRobaitoCard(state: RobaitoState, seat: number): Card {
  const hand = state.hands[seat];
  const info = hand.map((card) => ({ card, options: captureOptions(state, seat, card) }));
  const optionsOf = (card: Card) => info.find((i) => i.card.id === card.id)!.options;

  // Prioridad 1: robar el paquete más grande posible.
  const stealers = info.filter((i) => i.options.steals.length > 0).map((i) => i.card);
  if (stealers.length > 0) {
    const stolenSize = (card: Card) => optionsOf(card).steals.reduce((sum, s) => sum + state.piles[s].length, 0);
    const bySize = bestBy(stealers, (card) => stolenSize(card) * 100 + optionsOf(card).table.length);
    return pickRandom(bySize);
  }

  // Prioridad 2: levantar de la mesa, llevándose cuantas más cartas iguales mejor.
  const lifters = info.filter((i) => i.options.table.length > 0).map((i) => i.card);
  if (lifters.length > 0) return pickRandom(bestBy(lifters, (card) => optionsOf(card).table.length));

  // Prioridad 3: botar sin repetir el número de la cima de mi propio paquete.
  const myTop = topOf(state.piles[seat]);
  const safe = myTop ? hand.filter((card) => card.rank !== myTop.rank) : hand;
  return pickRandom(safe.length > 0 ? safe : hand);
}

export function chooseRobaitoMove(state: RobaitoState): RobaitoMove {
  return { type: 'play', cardId: chooseRobaitoCard(state, state.turn).id };
}
