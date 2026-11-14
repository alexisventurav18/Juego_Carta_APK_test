import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferencia de sonido compartida por toda la app: el botón del menú principal y el de cada mesa
 * controlan el mismo valor, y se recuerda entre sesiones.
 */
const STORAGE_KEY = 'cartas-dominicanas:muted';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = typeof window === 'undefined' ? false : readStored();
const listeners = new Set<() => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  if (value === muted) return;
  muted = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Sin almacenamiento: la preferencia dura solo mientras la app esté abierta.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Estado de silencio y su interruptor, para cualquier componente. */
export function useMuted(): { muted: boolean; toggleMuted: () => void } {
  const value = useSyncExternalStore(subscribe, isMuted, () => false);
  const toggleMuted = useCallback(() => setMuted(!isMuted()), []);
  return { muted: value, toggleMuted };
}
