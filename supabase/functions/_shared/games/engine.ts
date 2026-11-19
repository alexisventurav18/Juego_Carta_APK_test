import { applyCagaoMove, type CagaoMove } from './cagao.ts';
import { applyCasinoMove, type CasinoMove } from './casino.ts';
import { applyRobaitoMove, type RobaitoMove } from './robaito.ts';
import { applyTresYDosMove, type TresYDosMove } from './tresYDos.ts';
import type { GameState } from './index.ts';
import type { MoveResult } from './shared.ts';

/** Mensaje para excepciones inesperadas del motor: distinto de "Jugada no válida." para no confundir un error interno con una jugada ilegal. */
export const ENGINE_INTERNAL_ERROR = 'Error interno al aplicar la jugada. Inténtalo de nuevo.';

/** true en builds de desarrollo (Vite / tests): ahí el error se registra en consola. */
const IS_DEV = (() => {
  try {
    const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
    if (env) return env.DEV === true;
  } catch {
    // Sin import.meta.env (p. ej. Node plano): se considera desarrollo salvo producción.
    return typeof process === 'undefined' || process.env?.NODE_ENV !== 'production';
  }
  return typeof process === 'undefined' || process.env?.NODE_ENV !== 'production';
})();

/** Aplica una jugada llegada de la red al juego correcto. Las propias reglas validan los detalles. */
export function applyGameMove(state: GameState, seat: number, move: unknown): MoveResult<GameState> {
  if (typeof move !== 'object' || move === null || typeof (move as { type?: unknown }).type !== 'string') {
    return { error: 'Jugada no válida.' };
  }
  try {
    if (state.game === 'casino') return applyCasinoMove(state, seat, move as CasinoMove);
    if (state.game === 'tresydos') return applyTresYDosMove(state, seat, move as TresYDosMove);
    if (state.game === 'robaito') return applyRobaitoMove(state, seat, move as RobaitoMove);
    return applyCagaoMove(state, seat, move as CagaoMove);
  } catch (err) {
    // Una jugada ilegal real nunca llega aquí: las reglas devuelven { error }.
    // Si algo lanza, es un error interno del motor, no del jugador.
    if (IS_DEV) console.error('[engine] error interno al aplicar la jugada', err);
    return { error: ENGINE_INTERNAL_ERROR };
  }
}
