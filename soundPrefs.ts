import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferencias de audio y avisos compartidas por toda la app: el menú principal, el panel de opciones y cada
 * mesa leen y escriben el mismo valor, y se recuerda entre sesiones.
 */
const STORAGE_KEY = 'cartas-dominicanas:prefs';
/** Clave antigua (solo guardaba el silencio): se respeta para no perder la elección de quien ya jugaba. */
const LEGACY_MUTED_KEY = 'cartas-dominicanas:muted';

export interface AudioPrefs {
  /** Silencia todo el audio (música y efectos). */
  muted: boolean;
  /** Volumen general, de 0 a 1. */
  master: number;
  musicOn: boolean;
  /** Volumen de la música de fondo, de 0 a 1. */
  music: number;
  sfxOn: boolean;
  /** Volumen de efectos y tonos, de 0 a 1. */
  sfx: number;
  /** Avisos dentro de la partida (consejos, banners y aviso de turno). */
  notifications: boolean;
}

const DEFAULTS: AudioPrefs = {
  muted: false,
  master: 0.8,
  musicOn: true,
  music: 0.35,
  sfxOn: true,
  sfx: 0.8,
  notifications: true,
};

const clamp01 = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

function readStored(): AudioPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<Record<keyof AudioPrefs, unknown>>;
      return {
        muted: bool(data.muted, DEFAULTS.muted),
        master: clamp01(data.master, DEFAULTS.master),
        musicOn: bool(data.musicOn, DEFAULTS.musicOn),
        music: clamp01(data.music, DEFAULTS.music),
        sfxOn: bool(data.sfxOn, DEFAULTS.sfxOn),
        sfx: clamp01(data.sfx, DEFAULTS.sfx),
        notifications: bool(data.notifications, DEFAULTS.notifications),
      };
    }
    return { ...DEFAULTS, muted: window.localStorage.getItem(LEGACY_MUTED_KEY) === '1' };
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs: AudioPrefs = typeof window === 'undefined' ? { ...DEFAULTS } : readStored();
const listeners = new Set<() => void>();

export function getPrefs(): AudioPrefs {
  return prefs;
}

export function setPrefs(patch: Partial<AudioPrefs>): void {
  const next = { ...prefs, ...patch };
  if ((Object.keys(next) as (keyof AudioPrefs)[]).every((key) => next[key] === prefs[key])) return;
  prefs = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: la preferencia dura solo mientras la app esté abierta.
  }
  listeners.forEach((listener) => listener());
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isMuted(): boolean {
  return prefs.muted;
}

export function setMuted(value: boolean): void {
  setPrefs({ muted: value });
}

/** Todas las preferencias de audio y avisos, y la función para cambiarlas. */
export function usePrefs(): { prefs: AudioPrefs; update: (patch: Partial<AudioPrefs>) => void } {
  const value = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
  return { prefs: value, update: setPrefs };
}

/** Estado de silencio y su interruptor, para cualquier componente. */
export function useMuted(): { muted: boolean; toggleMuted: () => void } {
  const { prefs: value } = usePrefs();
  const toggleMuted = useCallback(() => setMuted(!getPrefs().muted), []);
  return { muted: value.muted, toggleMuted };
}

/** ¿Se muestran los avisos de la partida (consejos, banners)? */
export function useNotificationsOn(): boolean {
  return usePrefs().prefs.notifications;
}
