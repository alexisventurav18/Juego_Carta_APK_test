/** Vibración (háptica) del teléfono: el toque que le falta al juego. Sin librerías. */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator === 'undefined') return;
    if (typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(pattern);
  } catch {
    // Sin vibración en este dispositivo o navegador: se ignora.
  }
}
