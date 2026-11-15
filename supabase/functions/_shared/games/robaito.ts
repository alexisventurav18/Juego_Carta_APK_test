import { americanDeck, type Card, randomInt, shuffle } from './cards.ts';
import type { MoveResult, Player } from './shared.ts';

/**
 * El Robaíto. Baraja americana de 52 cartas; solo importa el número (el palo es visual).
 * Cada jugador recibe 4 cartas y hay 4 boca arriba en la mesa. En tu turno juegas una carta:
 *  - si hay cartas del mismo número en la mesa, te las llevas todas junto con tu carta;
 *  - si la cima del paquete de un rival tiene ese número, le robas el paquete entero;
 *  - si no hay nada de eso, tu carta queda en la mesa.
 * Cada paquete se apila boca arriba: solo se ve la última carta que entró (la cima).
 * Gana quien termine con más cartas en su paquete.
 *
 * El motor es puro: cada jugada devuelve un estado nuevo y nunca modifica el anterior.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const HAND_SIZE = 4;
export const TABLE_SIZE = 4;

export type RobaitoKind = 'capture' | 'steal' | 'discard';

/** Lo que pasó en la última jugada. Todo es público. */
export interface RobaitoEvent {
  /** Número de jugada (para animar y no repetir avisos). */
  seq: number;
  /** Quién jugó. */
  by: number;
  /** La carta jugada. */
  card: Card;
  /** 'steal' si se robó algún paquete (con o sin cartas de la mesa), 'capture' si solo se levantó de la mesa. */
  kind: RobaitoKind;
  /** Cartas de la mesa que se llevó. */
  tableTaken: Card[];
  /** Paquetes robados: a quién y cuántas cartas tenía. */
  stolen: { seat: number; count: number }[];
  /** Cartas que sumó a su paquete con esta jugada (incluida la jugada). */
  gained: number;
  /** Cartas sueltas de la mesa que pasaron al último en capturar al terminar la partida. */
  swept: number;
  /** Se repartieron 4 cartas nuevas a cada jugador después de esta jugada. */
  redeal: boolean;
}

export interface RobaitoState {
  game: 'robaito';
  phase: 'playing' | 'gameOver';
  players: Player[];
  hands: Card[][];
  deck: Card[];
  /** Cartas sueltas boca arriba en el centro. */
  table: Card[];
  /** Paquete de cada jugador. La cima es la última carta del arreglo. */
  piles: Card[][];
  turn: number;
  dealer: number;
  /** Cuántos repartos de manos van (1 = el inicial). */
  dealNo: number;
  /** Siempre 1: el Robaíto no tiene rondas. Lo usan las pistas de inicio de la mesa. */
  roundNo: number;
  /** Id del último jugador que se llevó cartas (mesa o robo). Recibe lo que quede en la mesa. */
  lastCapturerId: string | null;
  /** Asientos ganadores al terminar (más de uno si hay empate). */
  winnerSeats: number[];
  lastEvent: RobaitoEvent | null;
}

export type RobaitoMove = { type: 'play'; cardId: string };

/** Qué se llevaría una carta si se jugara ahora. */
export interface CaptureOptions {
  /** Cartas de la mesa del mismo número. */
  table: Card[];
  /** Asientos rivales cuya cima tiene ese número y tienen paquete. */
  steals: number[];
}

export function topOf(pile: Card[]): Card | null {
  return pile.length > 0 ? pile[pile.length - 1] : null;
}

export function captureOptions(state: RobaitoState, seat: number, card: Card): CaptureOptions {
  return {
    table: state.table.filter((c) => c.rank === card.rank),
    steals: state.piles.flatMap((pile, s) => (s !== seat && topOf(pile)?.rank === card.rank ? [s] : [])),
  };
}

export function robaitoKind(options: CaptureOptions): RobaitoKind {
  if (options.steals.length > 0) return 'steal';
  return options.table.length > 0 ? 'capture' : 'discard';
}

/** Reparte hasta 4 cartas a cada jugador, de una en una, empezando por quien sigue al que reparte. */
function dealHands(
  deck: Card[],
  seats: number,
  first: number,
): { hands: Card[][]; deck: Card[] } {
  const hands: Card[][] = Array.from({ length: seats }, () => []);
  const rest = [...deck];
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let i = 0; i < seats; i++) {
      const card = rest.shift();
      if (card) hands[(first + i) % seats].push(card);
    }
  }
  return { hands, deck: rest };
}

export function createRobaitoGame(players: Player[], dealer?: number): RobaitoState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error('El Robaíto se juega de 2 a 4 jugadores.');
  }
  const seats = players.length;
  const dealerSeat = dealer ?? randomInt(seats);
  const first = (dealerSeat + 1) % seats;
  const dealt = dealHands(shuffle(americanDeck()), seats, first);
  return {
    game: 'robaito',
    phase: 'playing',
    players,
    hands: dealt.hands,
    deck: dealt.deck.slice(TABLE_SIZE),
    table: dealt.deck.slice(0, TABLE_SIZE),
    piles: Array.from({ length: seats }, () => []),
    turn: first,
    dealer: dealerSeat,
    dealNo: 1,
    roundNo: 1,
    lastCapturerId: null,
    winnerSeats: [],
    lastEvent: null,
  };
}

/** Asientos con más cartas en su paquete (varios si hay empate). */
export function leadingSeats(piles: Card[][]): number[] {
  const best = Math.max(...piles.map((pile) => pile.length));
  return piles.flatMap((pile, seat) => (pile.length === best ? [seat] : []));
}

export function applyRobaitoMove(state: RobaitoState, seat: number, move: RobaitoMove): MoveResult<RobaitoState> {
  if (state.phase === 'gameOver') return { error: 'La partida ya terminó.' };
  if (move.type !== 'play') return { error: 'Jugada no válida.' };
  if (seat !== state.turn) return { error: 'No es tu turno.' };

  const hand = state.hands[seat];
  const card = hand.find((c) => c.id === move.cardId);
  if (!card) return { error: 'Esa carta no está en tu mano.' };

  const options = captureOptions(state, seat, card);
  const kind = robaitoKind(options);

  let hands = state.hands.map((h, s) => (s === seat ? h.filter((c) => c.id !== card.id) : h));
  let table = state.table;
  let piles = state.piles;
  let lastCapturerId = state.lastCapturerId;
  let gained = 0;

  if (kind === 'discard') {
    table = [...table, card];
  } else {
    const stolenCards = options.steals.flatMap((s) => state.piles[s]);
    // Mi paquete, lo de la mesa, los paquetes robados y, encima de todo, la carta jugada.
    const merged = [...state.piles[seat], ...options.table, ...stolenCards, card];
    gained = merged.length - state.piles[seat].length;
    table = table.filter((c) => c.rank !== card.rank);
    piles = state.piles.map((pile, s) => (s === seat ? merged : options.steals.includes(s) ? [] : pile));
    lastCapturerId = state.players[seat].id;
  }

  let deck = state.deck;
  let dealNo = state.dealNo;
  let redeal = false;
  // Cuando todos se quedan sin cartas y aún hay mazo, se reparten 4 nuevas a cada uno (la mesa no recibe).
  if (hands.every((h) => h.length === 0) && deck.length > 0) {
    const dealt = dealHands(deck, state.players.length, (seat + 1) % state.players.length);
    hands = dealt.hands;
    deck = dealt.deck;
    dealNo += 1;
    redeal = true;
  }

  let swept = 0;
  let phase: RobaitoState['phase'] = 'playing';
  let winnerSeats: number[] = [];
  if (hands.every((h) => h.length === 0) && deck.length === 0) {
    // Fin: lo que quede suelto en la mesa es del último que capturó o robó.
    const owner = lastCapturerId === null ? -1 : state.players.findIndex((p) => p.id === lastCapturerId);
    if (owner >= 0 && table.length > 0) {
      swept = table.length;
      piles = piles.map((pile, s) => (s === owner ? [...pile, ...table] : pile));
      table = [];
    }
    phase = 'gameOver';
    winnerSeats = leadingSeats(piles);
  }

  const event: RobaitoEvent = {
    seq: (state.lastEvent?.seq ?? 0) + 1,
    by: seat,
    card,
    kind,
    tableTaken: options.table,
    stolen: options.steals.map((s) => ({ seat: s, count: state.piles[s].length })),
    gained,
    swept,
    redeal,
  };

  return {
    state: {
      ...state,
      phase,
      hands,
      deck,
      table,
      piles,
      turn: phase === 'gameOver' ? state.turn : (seat + 1) % state.players.length,
      dealNo,
      lastCapturerId,
      winnerSeats,
      lastEvent: event,
    },
  };
}
