/**
 * Tiempos del reparto visible. Una sola fuente de verdad: la animación (useDealIntro) y el
 * bloqueo de los bots (bots.ts) leen estos mismos números, así que el bloqueo dura exactamente
 * lo que dura el reparto en pantalla. Este módulo es puro y no importa nada: vive en
 * src/games para que la Edge Function también lo tenga (ver sync:functions).
 */

/** Pasos de barajado antes de repartir. */
export const SHUFFLE_TICKS = 10;
/** Milisegundos por paso de barajado. */
export const SHUFFLE_TICK_MS = 80;
/**
 * Milisegundos por carta repartida: se aprecia carta a carta sin eternizar la partida.
 * Con 4 jugadores el reparto más largo (Tres y Dos, 21 cartas) tarda ~7 s en total.
 */
export const DEAL_STEP_MS = 280;

/**
 * Duración total del reparto visible (barajar + carta a carta) para estos asientos y cartas.
 * El último paso también cuenta: el reparto termina un paso después de revelarse la última carta.
 */
export function dealIntroMs(seats: number, cardsPerHand: number, cardsOnTable: number): number {
  const dealSteps = seats * cardsPerHand + cardsOnTable;
  return SHUFFLE_TICKS * SHUFFLE_TICK_MS + (dealSteps + 1) * DEAL_STEP_MS;
}

/**
 * ¿Ya se reveló esta carta de la mano? El reparto es por rondas de asientos: la carta `index`
 * del asiento `seat` es la número `index * seats + seat` de las repartidas (`revealed` van
 * reveladas hasta ahora). Es la lógica que la mesa lee para esconder las cartas hasta que les
 * toque ser repartidas.
 */
export function isHandCardDealt(revealed: number, seats: number, seat: number, index: number): boolean {
  return index * seats + seat < revealed;
}

/**
 * ¿Ya se reveló esta carta de la mesa? Las cartas de la mesa se reparten después de las manos.
 * Si en este reparto no se pone nada en la mesa (`cardsOnTable === 0`, como el reparto de
 * manos nuevas de El Robaíto), las que ya hay nunca se ocultan.
 */
export function isTableCardDealt(
  revealed: number,
  seats: number,
  cardsPerHand: number,
  cardsOnTable: number,
  index: number,
): boolean {
  return cardsOnTable === 0 || seats * cardsPerHand + index < revealed;
}
export function cagaoDealIntroMs(seats: number): number {
  return SHUFFLE_TICKS * SHUFFLE_TICK_MS + (seats + 1) * DEAL_STEP_MS;
}
