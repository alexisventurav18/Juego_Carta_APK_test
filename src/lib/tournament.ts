import type { GameId } from '../games/shared';

/**
 * Ranking, amigos y torneos: constantes y ayudas puras del cliente.
 *
 * Los puntos, las temporadas y los premios los decide el servidor; aquí solo
 * viven los valores que la pantalla muestra (premios del podio) y el formato
 * de la cuenta atrás. Nada de esto calcula rotaciones ni clasificaciones: toda
 * esa información viene en las respuestas del servidor (ver `rooms.ts`).
 */

/** Monedas del podio de un torneo o de una temporada: 1º, 2º y 3º. */
export const TOURNAMENT_PRIZES = [500, 300, 150] as const;

/** Monedas que gana el puesto `place` (1-3); fuera del podio no hay premio. */
export function prizeForPlace(place: number): number {
  if (!Number.isInteger(place) || place < 1 || place > TOURNAMENT_PRIZES.length) return 0;
  return TOURNAMENT_PRIZES[place - 1];
}

/** Nombres de los modos para las pestañas del ranking. */
export const RANKING_TABS: { id: GameId | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'casino', label: 'Casino' },
  { id: 'tresydos', label: 'Tres y Dos' },
  { id: 'cagao', label: 'El Cagao' },
  { id: 'robaito', label: 'El Robaíto' },
];

/**
 * Cuenta atrás legible: "2d 3h" si falta más de un día, "4h 12m" si faltan
 * horas, y "12m 30s" cuando falta menos de una hora. Con 0 o negativo, "ahora".
 */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'ahora';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
