import type { GameId } from '../games/shared';
import { GAME_ENVIRONMENTS } from './visualPrefs';

/**
 * Configuración pura del movimiento por modo (vía 3).
 *
 * No hay nada de DOM aquí: solo datos, para que se pueda testear sin
 * navegador. El acento de cada modo sale de GAME_ENVIRONMENTS, así el
 * ambiente siempre coincide con el brillo de la mesa.
 */

/** Forma de partícula ambiental de cada modo. */
export type AmbientKind = 'sparkles' | 'bubbles' | 'embers' | 'drops';

export interface MotionConfig {
  game: GameId;
  kind: AmbientKind;
  /** Color de acento del modo (el mismo que tiñe la mesa). */
  accent: string;
  /** Partículas simultáneas: pocas, para no cargar el teléfono. */
  particleCount: number;
  /** Duración de un ciclo de partícula, en segundos. */
  minDurationS: number;
  maxDurationS: number;
}

/** Límites de partículas ambientales por pantalla (rendimiento en teléfono). */
export const MIN_AMBIENT_PARTICLES = 10;
export const MAX_AMBIENT_PARTICLES = 14;

/** Monedas de la lluvia de victoria: suficientes para celebrarla, sin saturar. */
export const COIN_RAIN_COUNT = 22;

function makeConfig(
  game: GameId,
  kind: AmbientKind,
  particleCount: number,
  minDurationS: number,
  maxDurationS: number,
): MotionConfig {
  return {
    game,
    kind,
    accent: GAME_ENVIRONMENTS[game].accent,
    particleCount,
    minDurationS,
    maxDurationS,
  };
}

export const MOTION_CONFIGS: Record<GameId, MotionConfig> = {
  /** Casino: destellos dorados que suben, como chispas de la mesa. */
  casino: makeConfig('casino', 'sparkles', 12, 7, 12),
  /** Tres y Dos: burbujas larimar que flotan despacio. */
  tresydos: makeConfig('tresydos', 'bubbles', 12, 8, 13),
  /** El Cagao: brasas rojas que ascienden y parpadean. */
  cagao: makeConfig('cagao', 'embers', 10, 6, 10),
  /** El Robaíto: gotas turquesa que caen suaves, como lluvia caribeña. */
  robaito: makeConfig('robaito', 'drops', 14, 7, 11),
};

export function getMotionConfig(game: GameId): MotionConfig {
  return MOTION_CONFIGS[game];
}

/**
 * Resuelve la config de movimiento a partir del acento que recibe
 * TableLayout (GAME_ENVIRONMENTS[modo].accent). Así AmbientParticles no
 * necesita que cada mesa le pase el modo: el color ya lo dice. Un acento
 * desconocido o ausente cae al dorado de Casino, nunca rompe nada.
 */
export function getMotionConfigForAccent(accent: string | undefined): MotionConfig {
  if (accent) {
    const found = (Object.values(MOTION_CONFIGS) as MotionConfig[]).find(
      (config) => config.accent.toLowerCase() === accent.toLowerCase(),
    );
    if (found) return found;
  }
  return MOTION_CONFIGS.casino;
}
