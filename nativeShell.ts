import { isNativeApp } from './platform';

/**
 * Segunda capa para el APK (la primera es el código nativo de scripts/configureAndroid.mjs): al arrancar, la propia
 * app pide a Android horizontal y barra de estado oculta. Así, aunque el parche nativo no se haya aplicado, la
 * pantalla queda en horizontal y sin barra de notificaciones en cuanto abre la app.
 */
async function applyShell(): Promise<void> {
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch {
    // Sin el plugin nativo (navegador o APK sin sincronizar): lo resuelve la capa nativa.
  }
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.hide();
  } catch {
    // Igual que arriba.
  }
}

export function installNativeShell(): void {
  if (typeof window === 'undefined' || !isNativeApp()) return;
  void applyShell();
  // Al volver a la app (desde recientes o tras deslizar la barra) se vuelve a esconder todo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void applyShell();
  });
}
