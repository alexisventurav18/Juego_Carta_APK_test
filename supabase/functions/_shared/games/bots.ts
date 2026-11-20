import { applyCagaoMove, chooseCagaoMove, type CagaoState, seatsWithPairs } from './cagao.ts';
import { applyCasinoMove, nextDealerSeat } from './casino.ts';
import { applyRobaitoMove, type RobaitoState } from './robaito.ts';
import { chooseRobaitoMove } from './robaitoBot.ts';
import { casinoBotMove } from './casinoBot.ts';
import { randomInt } from './cards.ts';
import type { GameState } from './index.ts';
import { isBotPlayer, type MoveResult } from './shared.ts';
import { applyTresYDosMove, chooseTresYDosMove, nextDealerSeat as nextTresYDosDealer, type TresYDosState } from './tresYDos.ts';

/**
 * Espera humana antes de cada jugada del bot: aleatoria en cada turno, para que no se sienta
 * robótico. El retardo fijo de antes (1 s) hacía que el bot jugara como un metrónomo.
 */
const BOT_MOVE_MIN_MS = 1400;
const BOT_MOVE_MAX_MS = 2600;
/** En El Cagao el bot espera un poco más: así se alcanza a ver qué carta le robó a quién. */
const CAGAO_MOVE_MIN_MS = 1700;
const CAGAO_MOVE_MAX_MS = 2900;
/** Pausa entre un bot y otro al bajar sus pares iniciales en El Cagao. */
const PAIRING_MS = 900;
const ROUND_PAUSE_MS = 6000;

export interface BotStep {
  result: MoveResult<GameState>;
  delayMs: number;
}

function isBotTurn(state: GameState): boolean {
  return state.phase === 'playing' && isBotPlayer(state.players[state.turn]);
}

/** Un tiempo de espera humano: aleatorio entre min y max (ambos incluidos), distinto en cada jugada. */
function humanDelay(minMs: number, maxMs: number): number {
  return minMs + randomInt(maxMs - minMs + 1);
}

function moveDelay(state: GameState): number {
  return state.game === 'cagao'
    ? humanDelay(CAGAO_MOVE_MIN_MS, CAGAO_MOVE_MAX_MS)
    : humanDelay(BOT_MOVE_MIN_MS, BOT_MOVE_MAX_MS);
}

/**
 * Espera antes de la siguiente jugada automática, o null si ahora no le toca a un bot.
 * Solo usa datos públicos, así que funciona con la vista de cualquier jugador.
 *
 * `dealing` es el reparto visible de la mesa: mientras se reparte nadie juega. La mesa lo
 * sabe (su animación) y el humano ya estaba bloqueado por ella; este parámetro es el mismo
 * bloqueo para los bots, en todas las rondas. El caso especial del primer reparto de El
 * Robaíto ya no hace falta: el bloqueo lo cubre.
 */
/** En la fase inicial de El Cagao, el primer bot que todavía tiene pares por bajar. */
function cagaoPairingBot(state: CagaoState): number | undefined {
  return seatsWithPairs(state).find((seat) => isBotPlayer(state.players[seat]));
}

export function botTickDelay(state: GameState, dealing = false): number | null {
  // Mientras se reparte en pantalla nadie juega: ni los bots ni el humano.
  if (dealing) return null;
  if (state.game === 'cagao' && state.phase === 'pairing') {
    return cagaoPairingBot(state) === undefined ? null : PAIRING_MS;
  }
  if (state.phase === 'roundEnd') {
    const dealer = state.game === 'tresydos' ? nextTresYDosDealer(state) : nextDealerSeat(state);
    return isBotPlayer(state.players[dealer]) ? ROUND_PAUSE_MS : null;
  }
  return isBotTurn(state) ? moveDelay(state) : null;
}

export function botStep(state: GameState): BotStep | null {
  if (state.game === 'cagao' && state.phase === 'pairing') {
    const seat = cagaoPairingBot(state);
    if (seat === undefined) return null;
    return { result: applyCagaoMove(state, seat, { type: 'pairAll' }), delayMs: PAIRING_MS };
  }
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
        : state.game === 'robaito'
          ? robaitoBotMove(state)
          : cagaoBotMove(state);
  return { result, delayMs: moveDelay(state) };
}

export function tresYDosBotMove(state: TresYDosState): MoveResult<TresYDosState> {
  return applyTresYDosMove(state, state.turn, chooseTresYDosMove(state));
}

export function cagaoBotMove(state: CagaoState): MoveResult<CagaoState> {
  return applyCagaoMove(state, state.turn, chooseCagaoMove(state));
}

export function robaitoBotMove(state: RobaitoState): MoveResult<RobaitoState> {
  return applyRobaitoMove(state, state.turn, chooseRobaitoMove(state));
}
