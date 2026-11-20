/**
 * Curva de tiempos del sorteo del repartidor (DealerReveal).
 *
 * El sorteo da vueltas por las casillas de los jugadores y frena en el
 * repartidor. Para que se sienta como un sorteo de verdad — ágil al
 * principio y con frenada al final — las demoras entre pasos crecen de
 * forma monótona y el total se mantiene en ~3,5-4 s jueguen 2 o 6
 * personas: con pocos jugadores hay más vueltas y cada paso dura más;
 * con muchos, cada paso es más corto.
 *
 * Puro y sin React, para poder probarlo en Node.
 */

/** Pausa inicial antes de que empiece a moverse el resaltado. */
export const DEALER_DRAW_INITIAL_MS = 250;

/** Duración objetivo de la fase de pasos (sin la pausa inicial), en ms. */
export const DEALER_DRAW_TARGET_MS = 3600;

/** Demora mínima y máxima entre dos pasos, en ms. */
export const DEALER_DRAW_MIN_STEP_MS = 80;
export const DEALER_DRAW_MAX_STEP_MS = 750;

/**
 * Vueltas completas por las casillas antes de frenar en el repartidor.
 * Con pocos jugadores se dan más vueltas para que el sorteo no termine
 * demasiado rápido.
 */
export function dealerDrawLaps(playerCount: number): number {
  if (playerCount <= 2) return 5;
  if (playerCount === 3) return 4;
  return 3;
}

/** Cuántos pasos da el sorteo: vueltas completas más lo que falta para el repartidor. */
export function dealerDrawSteps(playerCount: number, dealer: number): number {
  return dealerDrawLaps(playerCount) * playerCount + dealer;
}

/**
 * Demora entre cada paso y el siguiente (una por salto, en ms). La
 * primera es la más corta y la última la más larga: la curva es
 * monótona creciente, así el resaltado frena poco a poco.
 */
export function dealerDrawDelays(playerCount: number, dealer: number): number[] {
  const steps = dealerDrawSteps(playerCount, dealer);
  if (steps <= 1) return [];
  // Peso de cada salto: 0,30 al principio y 1,00 al final (curva
  // cuadrática, como la frenada de una ruleta). Se normaliza para que la
  // suma sea el total objetivo, y se limita cada demora al rango permitido.
  const weights = Array.from({ length: steps - 1 }, (_, k) => {
    const progress = k / (steps - 2);
    return 0.3 + 0.7 * progress * progress;
  });
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const scale = DEALER_DRAW_TARGET_MS / weightSum;
  return weights.map((w) =>
    Math.min(DEALER_DRAW_MAX_STEP_MS, Math.max(DEALER_DRAW_MIN_STEP_MS, Math.round(w * scale))),
  );
}

/** Duración total del sorteo, pausa inicial incluida, en ms. */
export function dealerDrawTotalMs(playerCount: number, dealer: number): number {
  return DEALER_DRAW_INITIAL_MS + dealerDrawDelays(playerCount, dealer).reduce((sum, d) => sum + d, 0);
}

/** Casilla señalada tras el paso `step` (el sorteo empieza en la casilla 0). */
export function dealerDrawHighlight(playerCount: number, step: number): number {
  return step % playerCount;
}
