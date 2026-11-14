import { useCallback, useEffect, useState } from 'react';

/**
 * Pantalla completa y orientación horizontal.
 *
 * En el APK (Capacitor) lo hace el código nativo (ver scripts/configureAndroid.mjs): barras ocultas,
 * notch y giro bloqueado. Aquí queda lo que hace falta en el navegador y en la PC:
 *  - API de pantalla completa (con prefijo webkit para Safari).
 *  - Bloqueo de orientación en horizontal (solo funciona en pantalla completa y en Android).
 *  - En móviles táctiles, entrar a pantalla completa con el primer toque (los navegadores exigen un gesto).
 */

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface LockableOrientation {
  lock?: (orientation: string) => Promise<void>;
}

export function isNativeApp(): boolean {
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
}

/** Instalada como PWA o abierta por un empaquetador: ya va sin barras del navegador. */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: fullscreen)').matches === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FullscreenElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreenNow(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

export async function lockLandscape(): Promise<void> {
  try {
    await (screen.orientation as unknown as LockableOrientation | undefined)?.lock?.('landscape');
  } catch {
    // iOS y la mayoría de navegadores de escritorio no permiten bloquear: no pasa nada.
  }
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as FullscreenElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    return;
  }
  await lockLandscape();
}

export async function exitFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
  } catch {
    // Ignorado: el navegador decide.
  }
}

/** Botón de pantalla completa del menú (en la app nativa no hace falta y no se muestra). */
export function useFullscreen() {
  const [active, setActive] = useState(isFullscreenNow);
  const supported = !isNativeApp() && fullscreenSupported();

  useEffect(() => {
    const update = () => setActive(isFullscreenNow());
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
    };
  }, []);

  const toggle = useCallback(() => {
    void (isFullscreenNow() ? exitFullscreen() : enterFullscreen());
  }, []);

  return { active, supported, toggle };
}

/**
 * Al primer toque en un móvil o tableta (navegador, no APK) se entra a pantalla completa y se bloquea en
 * horizontal. En la PC no se fuerza: allí se usa el botón del menú o F11.
 */
export function installImmersiveBoot(): void {
  if (typeof window === 'undefined' || isNativeApp() || isStandalone()) return;
  if (!window.matchMedia?.('(pointer: coarse)').matches || !fullscreenSupported()) return;

  const onFirstGesture = () => {
    window.removeEventListener('pointerup', onFirstGesture);
    if (!isFullscreenNow()) void enterFullscreen();
  };
  window.addEventListener('pointerup', onFirstGesture, { once: true });
}
