import type { Card } from './cards.ts';
import { applyCasinoMove, nextDealerSeat } from './casino.ts';
import { casinoBotMove } from './casinoBot.ts';
import { applyTresYDosMove, chooseTresYDosMove, nextDealerSeat as nextTresYDosDealer, type TresYDosState } from './tresYDos.ts';
import { applyBurakoMove, type BurakoState, cardPoints, isValidMeld, isWild, type Meld } from './burako.ts';
import type { GameState } from './index.ts';
import { isBotPlayer, type MoveResult, teamOf } from './shared.ts';

const BOT_MOVE_MS = 1000;
const ROUND_PAUSE_MS = 6000;

export interface BotStep {
  result: MoveResult<GameState>;
  delayMs: number;
}

function isBotTurn(state: GameState): boolean {
  return state.phase === 'playing' && isBotPlayer(state.players[state.turn]);
}

/**
 * Espera antes de la siguiente jugada automática, o null si ahora no le toca a un bot.
 * Solo usa datos públicos, así que funciona con la vista de cualquier jugador.
 */
export function botTickDelay(state: GameState): number | null {
  if (state.phase === 'roundEnd') {
    if (state.game === 'tresydos') {
      return isBotPlayer(state.players[nextTresYDosDealer(state)]) ? ROUND_PAUSE_MS : null;
    }
    if (state.game === 'casino') {
      return isBotPlayer(state.players[nextDealerSeat(state)]) ? ROUND_PAUSE_MS : null;
    }
    return state.summary ? ROUND_PAUSE_MS : BOT_MOVE_MS;
  }
  return isBotTurn(state) ? BOT_MOVE_MS : null;
}

export function botStep(state: GameState): BotStep | null {
  if (state.phase === 'roundEnd') {
    if (state.game === 'tresydos') {
      const dealerSeat = nextTresYDosDealer(state);
      if (!isBotPlayer(state.players[dealerSeat])) return null;
      return { result: applyTresYDosMove(state, dealerSeat, { type: 'nextRound' }), delayMs: ROUND_PAUSE_MS };
    }
    if (state.game === 'casino') {
      const dealerSeat = nextDealerSeat(state);
      if (!isBotPlayer(state.players[dealerSeat])) return null;
      return { result: applyCasinoMove(state, dealerSeat, { type: 'nextRound' }), delayMs: ROUND_PAUSE_MS };
    }
    const result = applyBurakoMove(state, 0, { type: 'nextRound' });
    return { result, delayMs: state.summary ? ROUND_PAUSE_MS : BOT_MOVE_MS };
  }
  if (!isBotTurn(state)) return null;
  const result =
    state.game === 'casino'
      ? casinoBotMove(state)
      : state.game === 'tresydos'
        ? tresYDosBotMove(state)
        : burakoBotMove(state);
  return { result, delayMs: BOT_MOVE_MS };
}

export function tresYDosBotMove(state: TresYDosState): MoveResult<TresYDosState> {
  return applyTresYDosMove(state, state.turn, chooseTresYDosMove(state));
}

function subsetsUpTo<T>(items: T[], maxSize: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, chosen: T[]) => {
    if (chosen.length > 0) out.push(chosen);
    if (chosen.length === maxSize) return;
    for (let i = start; i < items.length; i++) walk(i + 1, [...chosen, items[i]]);
  };
  walk(0, []);
  return out;
}

interface Placement {
  handIds: string[];
  meldId?: string;
}

function findPlacement(extra: Card[], hand: Card[], melds: Meld[]): Placement | null {
  const subsets = subsetsUpTo(hand, 4);
  for (const meld of melds) {
    const picked = subsets.find((cards) => cards.length <= 3 && isValidMeld([...meld.cards, ...extra, ...cards]));
    if (picked) return { handIds: picked.map((c) => c.id), meldId: meld.id };
  }
  const fresh = subsets.find((cards) => isValidMeld([...extra, ...cards]));
  return fresh ? { handIds: fresh.map((c) => c.id) } : null;
}

export function burakoBotMove(state: BurakoState): MoveResult<BurakoState> {
  const seat = state.turn;
  const melds = state.melds[teamOf(seat)];
  const hand = state.hands[seat];

  if (!state.drawn) {
    const top = state.pile[state.pile.length - 1];
    const placement = top ? findPlacement([top], hand, melds) : null;
    if (placement) {
      return applyBurakoMove(state, seat, { type: 'takePile', ...placement });
    }
    return applyBurakoMove(state, seat, { type: 'draw' });
  }

  const placement = findPlacement([], hand, melds);
  if (placement) return applyBurakoMove(state, seat, { type: 'meld', ...placement });

  return applyBurakoMove(state, seat, { type: 'discard', cardId: pickBurakoDiscard(state, seat).id });
}

/**
 * Descarta la carta menos útil: sin vecinas en mi mano, que no encaje en mis juegos y que no le
 * sirva a los rivales (quien levanta el pozo se lleva todo). Los comodines no se tiran.
 * A igualdad, se suelta la de más puntos para reducir lo que quedaría sin bajar.
 */
function pickBurakoDiscard(state: BurakoState, seat: number): Card {
  const hand = state.hands[seat];
  const team = teamOf(seat);
  const mine = state.melds[team];
  const rivals = state.melds[1 - team];
  const keepScore = (card: Card): number => {
    if (isWild(card)) return 1000;
    let synergy = 0;
    for (const other of hand) {
      if (other.id === card.id || isWild(other)) continue;
      if (other.rank === card.rank) synergy += 2;
      else if (other.suit === card.suit) {
        const gap = Math.abs(other.rank - card.rank);
        if (gap === 1) synergy += 1.5;
        else if (gap === 2) synergy += 1;
      }
    }
    const extendsMine = mine.some((m) => isValidMeld([...m.cards, card]));
    const extendsRival = rivals.some((m) => isValidMeld([...m.cards, card]));
    return synergy * 3 + (extendsMine ? 10 : 0) + (extendsRival ? 8 : 0) - cardPoints(card) * 0.05;
  };
  return hand.reduce((best, card) => (keepScore(card) < keepScore(best) ? card : best));
}
