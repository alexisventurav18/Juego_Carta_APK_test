/**
 * Pantalla de bienvenida (Splash Screen): duración y mensajes de carga.
 *
 * La animación en sí es CSS (ver `SplashScreen.tsx` e `index.css`); aquí queda
 * solo la lógica comprobable: cuánto dura como mínimo y qué dice en cada tramo,
 * para que los tests puedan verificarla sin montar React.
 */

/** Duración mínima del splash: da tiempo a ver el reparto sin hacer esperar. */
export const SPLASH_DURATION_MS = 2400;

/** Mensajes de carga, en orden, según el progreso (0-100). */
export const SPLASH_STEPS = [
  'Barajando las cartas…',
  'Repartiendo la mesa…',
  'Preparando tus monedas…',
  '¡A jugar!',
] as const;

/** Mensaje que corresponde a un progreso dado (0-100, se limita a ese rango). */
export function splashStep(progress: number): string {
  const clamped = Math.max(0, Math.min(100, progress));
  if (clamped < 30) return SPLASH_STEPS[0];
  if (clamped < 60) return SPLASH_STEPS[1];
  if (clamped < 85) return SPLASH_STEPS[2];
  return SPLASH_STEPS[3];
}
