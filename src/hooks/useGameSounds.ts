import { useCallback } from 'react';
import { getEngine } from '@/lib/audioEngine';
import { vibrate } from '@/lib/haptics';
import { getPrefs, useMuted } from '@/lib/soundPrefs';
import { playEffect, type SoundEffect } from '@/lib/soundEffects';

export type { SoundEffect };

/** Vibración que acompaña a cada efecto (el tacto que le falta al juego).
 *  No depende del silencio: es respuesta al tacto, no sonido. */
const HAPTICS: Partial<Record<SoundEffect, number | number[]>> = {
  turn: 12,
  virao: [15, 40, 25],
  win: [20, 50, 20, 50, 40],
  lose: 60,
  coin: 10,
  steal: [10, 30, 10],
  pairMatch: 15,
  cagaoAlert: [30, 50, 30],
};

/** Efectos de sonido sintetizados con Web Audio (no hay archivos de audio que cargar). */
export function useGameSounds() {
  // El silencio es global: lo comparten el menú principal y todas las mesas.
  const { muted: isMuted, toggleMuted: toggleMute } = useMuted();

  const playSound = useCallback(
    (effect: SoundEffect) => {
      const pattern = HAPTICS[effect];
      if (pattern !== undefined) vibrate(pattern);
      const prefs = getPrefs();
      if (isMuted || prefs.muted || !prefs.sfxOn || prefs.sfx === 0 || prefs.master === 0) return;

      try {
        const engine = getEngine();
        if (!engine) throw new Error('Sin audio');
        playEffect(engine, effect);
      } catch {
        // Ignora errores si el navegador bloquea el audio antes de la interacción
      }
    },
    [isMuted],
  );

  return { playSound, isMuted, toggleMute };
}
