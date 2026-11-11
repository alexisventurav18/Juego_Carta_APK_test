import { applyCagaoMove, chooseCagaoMove, type CagaoState } from './cagao.ts';
import { applyCasinoMove, nextDealerSeat } from './casino.ts';
import { casinoBotMove } from './casinoBot.ts';
import type { GameState } from './index.ts';
import { isBotPlayer, type MoveResult } from './shared.ts';
import { applyTresYDosMove, chooseTresYDosMove, nextDealerSeat as nextTresYDosDealer, type TresYDosState } from './tresYDos.ts';

const BOT_MOVE_MS = 1000;
/** En El Cagao el bot espera un poco más: así se alcanza a ver qué carta le robó a quién. */
const CAGAO_MOVE_MS = 1400;
const ROUND_PAUSE_MS = 6000;

export interface BotStep {
  result: MoveResult<GameState>;
  delayMs: number;
}

function isBotTurn(state: GameState): boolean {
  return state.phase === 'playing' && isBotPlayer(state.players[state.turn]);
}

function moveDelay(state: GameState): number {
  return state.game === 'cagao' ? CAGAO_MOVE_MS : BOT_MOVE_MS;
}

/**
 * Espera antes de la siguiente jugada automática, o null si ahora no le toca a un bot.
 * Solo usa datos públicos, así que funciona con la vista de cualquier jugador.
 */
export function botTickDelay(state: GameState): number | null {
  if (state.phase === 'roundEnd') {
    const dealer = state.game === 'tresydos' ? nextTresYDosDealer(state) : nextDealerSeat(state);
    return isBotPlayer(state.players[dealer]) ? ROUND_PAUSE_MS : null;
  }
  return isBotTurn(state) ? moveDelay(state) : null;
}

export function botStep(state: GameState): BotStep | null {
  if (state.phase === 'roundEnd') {
    if (state.game === 'tresydos') {
      const dealerSeat = nextTresYDosDealer(state);
      if (!isBotPlayer(state.players[dealerSeat])) return null;
      return { result: applyTresYDosMove(state, dealerSeat, { type: 'nextRound' }), delayMs: ROUND_PAUSE_MS };
    }
    const dealerSeat = nextDealerSeat(state);
    if (!isBotPlayer(state.players[dealerSeat])) return null;
    return { result: applyCasinoMove(state, dealerSeat, { type: 'nextRound' }), delayMs: ROUND_PAUSE_MS };
  }
  if (!isBotTurn(state)) return null;
  const result =
    state.game === 'casino'
      ? casinoBotMove(state)
      : state.game === 'tresydos'
        ? tresYDosBotMove(state)
        : cagaoBotMove(state);
  return { result, delayMs: moveDelay(state) };
}

export function tresYDosBotMove(state: TresYDosState): MoveResult<TresYDosState> {
  return applyTresYDosMove(state, state.turn, chooseTresYDosMove(state));
}

export function cagaoBotMove(state: CagaoState): MoveResult<CagaoState> {
  return applyCagaoMove(state, state.turn, chooseCagaoMove(state));
}
