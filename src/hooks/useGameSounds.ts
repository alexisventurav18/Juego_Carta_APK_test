import { useCallback } from 'react';
import { getEngine } from '@/lib/audioEngine';
import { getPrefs, useMuted } from '@/lib/soundPrefs';
import { playEffect, type SoundEffect } from '@/lib/soundEffects';

export type { SoundEffect };

/** Efectos de sonido sintetizados con Web Audio (no hay archivos de audio que cargar). */
export function useGameSounds() {
  // El silencio es global: lo comparten el menú principal y todas las mesas.
  const { muted: isMuted, toggleMuted: toggleMute } = useMuted();

  const playSound = useCallback(
    (effect: SoundEffect) => {
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
