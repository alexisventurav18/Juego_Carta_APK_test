/**
 * Decisión táctil del abanico de mano (HandFan), sin tocar el DOM: distinguir
 * un toque de un deslizamiento y de un arrastre.
 *
 * El problema: en el abanico las zonas de toque se solapan mucho y cada carta
 * visible es una franja estrecha, así que al tocar, una deriva de pocos
 * píxeles al soltar hacía que se activara la carta VECINA en vez de la que
 * se pulsó. La regla es:
 * - Toque casi quieto (movimiento total <= umbral): se activa LA CARTA QUE
 *   SE PULSÓ, no la que quedó bajo el dedo al soltar.
 * - Solo cuando el dedo deslizó de verdad (> umbral) se activa la carta que
 *   quedó bajo el dedo al soltar (el gesto de "deslizar para elegir").
 * - Arrastrar hacia la mesa es otra cosa: con el ratón vale cualquier
 *   dirección; con el dedo, solo si el movimiento es sobre todo vertical,
 *   porque moverse de lado es deslizar por las cartas.
 */

/** Distancia (px) a partir de la cual un toque se considera arrastre y no un simple toque. */
export const DRAG_THRESHOLD = 10;

/** A quién se activa al soltar sin haber arrastrado. */
export type ReleaseTarget = 'pressed' | 'under-finger' | 'none';

/**
 * Qué se activa al soltar: la carta pulsada, la que quedó bajo el dedo, o
 * nada (con el ratón, moverse más del umbral sin arrastrar no activa nada).
 */
export function resolveReleaseTarget(movedPx: number, pointerType: string, threshold: number = DRAG_THRESHOLD): ReleaseTarget {
  if (movedPx <= threshold) return 'pressed';
  return pointerType === 'mouse' ? 'none' : 'under-finger';
}

/**
 * Resuelve la carta a activar al soltar. `idUnderFinger` es la carta bajo el
 * punto de suelta (o null si no hay ninguna): si no hay ninguna, se usa la
 * pulsada. Devuelve null cuando no se activa ninguna carta.
 */
export function resolveActivation(
  movedPx: number,
  pointerType: string,
  pressedId: string,
  idUnderFinger: string | null,
  threshold: number = DRAG_THRESHOLD,
): string | null {
  const target = resolveReleaseTarget(movedPx, pointerType, threshold);
  if (target === 'pressed') return pressedId;
  if (target === 'under-finger') return idUnderFinger ?? pressedId;
  return null;
}

/** ¿Este movimiento empieza un arrastre hacia la mesa? */
export function wantsDrag(dx: number, dy: number, pointerType: string, threshold: number = DRAG_THRESHOLD): boolean {
  if (Math.hypot(dx, dy) <= threshold) return false;
  return pointerType === 'mouse' ? true : Math.abs(dy) >= Math.abs(dx) * 0.8;
}
