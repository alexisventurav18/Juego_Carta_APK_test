import { americanDeck, type Card, randomInt, shuffle } from './cards.ts';
import type { MoveResult, Player } from './shared.ts';

/**
 * El Cagao (el Old Maid dominicano). Baraja de 49 cartas: la inglesa sin tres de los cuatro Ases.
 * El A♠ no tiene pareja y es "El Cagao". Todas las cartas se reparten, cada jugador baja sus pares
 * y después, por turnos, cada uno le roba una carta a ciegas al jugador siguiente. Se salva quien
 * se queda sin cartas; pierde el último que queda, que siempre es quien tiene el A♠.
 *
 * El motor es puro: cada jugada devuelve un estado nuevo y nunca modifica el anterior.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** La carta sin pareja. */
export const CAGAO_CARD_ID = 'picas-1';

export interface CagaoPair {
  /** Quién bajó el par. */
  seat: number;
  cards: [Card, Card];
}

/** Lo que pasó en la última jugada. Es público, salvo `drawnCardId` (ver `projectState`). */
export interface CagaoEvent {
  /** Número de jugada (para animar y no repetir avisos). */
  seq: number;
  /** Quién robó. */
  by: number;
  /** A quién le robó. */
  from: number;
  /** Posición de la carta dentro de la mano oculta del rival. */
  index: number;
  /** El par que se bajó, si la carta robada hizo pareja. */
  pair: [Card, Card] | null;
  /** True si la carta robada fue El Cagao (A♠). */
  cagao: boolean;
  /** Id de la carta robada. Solo la ve quien la robó, salvo que sea El Cagao o haya formado un par. */
  drawnCardId: string | null;
  /** Quiénes se quedaron sin cartas con esta jugada (se salvan). */
  outSeats: number[];
}

export interface CagaoState {
  game: 'cagao';
  phase: 'playing' | 'gameOver';
  players: Player[];
  hands: Card[][];
  /** Todos los pares bajados, en orden. */
  pairs: CagaoPair[];
  /** Quien roba ahora. */
  turn: number;
  dealer: number;
  roundNo: number;
  /** Asientos que ya se salvaron, en el orden en que salieron. */
  finishOrder: number[];
  /** Quien se quedó con El Cagao (cuando la partida termina). */
  loserSeat: number | null;
  lastEvent: CagaoEvent | null;
}

export type CagaoMove = { type: 'draw'; index: number };

/** La baraja de El Cagao: 49 cartas, solo queda el A♠ de los Ases. */
export function cagaoDeck(): Card[] {
  return americanDeck().filter((card) => card.rank !== 1 || card.id === CAGAO_CARD_ID);
}

/** Primer asiento con cartas después de `from` (sin contar `from`), o -1 si no queda ninguno. */
export function nextActiveSeat(hands: Card[][], from: number): number {
  const seats = hands.length;
  for (let i = 1; i <= seats; i++) {
    const seat = (from + i) % seats;
    if (hands[seat].length > 0) return seat;
  }
  return -1;
}

/** A quién le roba el jugador que tiene el turno: el siguiente jugador que todavía tiene cartas. */
export function drawFromSeat(state: CagaoState): number {
  return nextActiveSeat(state.hands, state.turn);
}

export function activeSeats(hands: Card[][]): number[] {
  return hands.flatMap((hand, seat) => (hand.length > 0 ? [seat] : []));
}

/** Separa los pares de una mano. De tres cartas iguales se baja un par y queda una. */
export function takePairs(hand: Card[]): { hand: Card[]; pairs: [Card, Card][] } {
  const byRank = new Map<number, Card[]>();
  for (const card of hand) byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
  const pairs: [Card, Card][] = [];
  const leftover = new Set<string>();
  for (const cards of byRank.values()) {
    for (let i = 0; i + 1 < cards.length; i += 2) pairs.push([cards[i], cards[i + 1]]);
    if (cards.length % 2 === 1) leftover.add(cards[cards.length - 1].id);
  }
  return { hand: hand.filter((card) => leftover.has(card.id)), pairs };
}

/** Quien va a ser robado baraja su mano: así nadie deduce dónde quedó la carta que acaba de tomar. */
function shuffleNextVictim(state: CagaoState): CagaoState {
  if (state.phase !== 'playing') return state;
  const victim = drawFromSeat(state);
  if (victim < 0) return state;
  return { ...state, hands: state.hands.map((hand, seat) => (seat === victim ? shuffle(hand) : hand)) };
}

export function createCagaoGame(players: Player[], dealer?: number): CagaoState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error('El Cagao se juega de 2 a 6 jugadores.');
  }
  const seats = players.length;
  const dealerSeat = dealer ?? randomInt(seats);

  // Se reparte todo el mazo, una carta a la vez: unos jugadores quedan con una carta más.
  const dealt: Card[][] = Array.from({ length: seats }, () => []);
  shuffle(cagaoDeck()).forEach((card, i) => dealt[i % seats].push(card));

  // Fase 1: todos bajan los pares de su mano inicial.
  const pairs: CagaoPair[] = [];
  const hands = dealt.map((hand, seat) => {
    const split = takePairs(hand);
    for (const cards of split.pairs) pairs.push({ seat, cards });
    return split.hand;
  });

  const finishOrder = activeSeats(hands).length === seats ? [] : hands.flatMap((h, s) => (h.length === 0 ? [s] : []));
  const active = activeSeats(hands);
  const base: CagaoState = {
    game: 'cagao',
    phase: active.length <= 1 ? 'gameOver' : 'playing',
    players,
    hands,
    pairs,
    // Empieza el jugador que sigue al que reparte (entre los que todavía tienen cartas).
    turn: nextActiveSeat(hands, dealerSeat),
    dealer: dealerSeat,
    roundNo: 1,
    finishOrder,
    loserSeat: active.length === 1 ? active[0] : null,
    lastEvent: null,
  };
  return shuffleNextVictim(base);
}

export function applyCagaoMove(state: CagaoState, seat: number, move: CagaoMove): MoveResult<CagaoState> {
  if (state.phase !== 'playing') return { error: 'La partida ya terminó.' };
  if (seat !== state.turn) return { error: 'No es tu turno.' };
  if (move.type !== 'draw') return { error: 'Jugada no válida.' };

  const victim = drawFromSeat(state);
  if (victim < 0 || victim === seat) return { error: 'No hay a quién robarle.' };
  const victimHand = state.hands[victim];
  if (!Number.isInteger(move.index) || move.index < 0 || move.index >= victimHand.length) {
    return { error: 'Esa carta no existe.' };
  }

  const drawn = victimHand[move.index];
  const nextVictimHand = victimHand.filter((_, i) => i !== move.index);
  const myHand = state.hands[seat];
  const matchIndex = myHand.findIndex((card) => card.rank === drawn.rank);

  let nextMyHand: Card[];
  let pair: [Card, Card] | null = null;
  if (matchIndex >= 0) {
    // La carta robada hace pareja con una de las mías: se bajan las dos.
    pair = [myHand[matchIndex], drawn];
    nextMyHand = myHand.filter((_, i) => i !== matchIndex);
  } else {
    nextMyHand = [...myHand, drawn];
  }

  const hands = state.hands.map((hand, s) => (s === seat ? nextMyHand : s === victim ? nextVictimHand : hand));
  const outSeats = [seat, victim].filter((s) => hands[s].length === 0);
  const finishOrder = [...state.finishOrder, ...outSeats];
  const cagao = drawn.id === CAGAO_CARD_ID;
  const event: CagaoEvent = {
    seq: (state.lastEvent?.seq ?? 0) + 1,
    by: seat,
    from: victim,
    index: move.index,
    pair,
    cagao,
    drawnCardId: drawn.id,
    outSeats,
  };

  const active = activeSeats(hands);
  const next: CagaoState = {
    ...state,
    hands,
    pairs: pair ? [...state.pairs, { seat, cards: pair }] : state.pairs,
    finishOrder,
    lastEvent: event,
  };

  // Cuando solo queda un jugador con cartas, esa persona tiene El Cagao y pierde.
  if (active.length <= 1) {
    return { state: { ...next, phase: 'gameOver', loserSeat: active[0] ?? null } };
  }
  return { state: shuffleNextVictim({ ...next, turn: nextActiveSeat(hands, seat) }) };
}

/** Jugada del bot: una carta cualquiera de la mano oculta del rival. */
export function chooseCagaoMove(state: CagaoState): CagaoMove {
  const victim = drawFromSeat(state);
  return { type: 'draw', index: randomInt(Math.max(state.hands[victim]?.length ?? 1, 1)) };
}
