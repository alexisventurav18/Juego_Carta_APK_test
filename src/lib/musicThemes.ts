import type { GameId } from '../games/shared';

/**
 * Temas de la música de fondo, uno por pantalla: el menú y cada modo de juego suena distinto, pero todos
 * comparten el mismo aire dominicano y suave (nada de disonancias ni de volumen alto). Este módulo es puro:
 * solo describe cada tema; quien lo toca es `music.ts`.
 */

export type MusicThemeId = 'lobby' | 'casino' | 'tresydos' | 'cagao' | 'robaito';

export interface MusicChord {
  /** Nota grave del acorde (midi), que suena como bajo en los tiempos fuertes. */
  root: number;
  /** Notas del arpegio (midi), de grave a aguda. */
  notes: number[];
}

export interface MusicTheme {
  id: MusicThemeId;
  /** Nombre que se ve en las opciones o en los registros, nunca en la mesa. */
  name: string;
  /** Pulsos por minuto: el carácter de cada modo también se siente en el tempo. */
  bpm: number;
  /** Progresión de acordes, uno por compás (se repite en bucle). */
  chords: MusicChord[];
  /** Patrón del arpegio: índices dentro de las notas del acorde, uno por corchea. */
  arpeggio: number[];
  /** Corcheas por acorde: debe coincidir con la longitud del arpegio. */
  stepsPerChord: number;
  /** Timbre del arpegio: 'sine' es el más cálido y redondo, 'triangle' el más brillante. */
  wave: 'triangle' | 'sine';
  /** Volumen del arpegio (0-1): todos los temas suenan más suaves que el tema único anterior (0.16). */
  pluckVol: number;
  /** Volumen del bajo (0-1): también más suave que antes (0.26). */
  bassVol: number;
  /** Volumen del güiro (0-1); 0 lo apaga del todo. */
  guiraVol: number;
  /** Frecuencia del filtro lowpass del arpegio al atacar (Hz): más cerrado = menos brillo agresivo. */
  pluckCutoff: number;
  /** Tiempo hasta el pico de cada nota (s): más lento = ataque más suave. */
  attack: number;
  /** Duración de cada nota del arpegio, en corcheas: menos de 2 suena staccato. */
  pluckLen: number;
}

// Acordes (midi). Am: [57, 60, 64, 69], Dm: [57, 62, 65, 69], E: [56, 59, 64, 68],
// C: [60, 64, 67, 72], G: [59, 62, 67, 71], F: [57, 60, 65, 69].
const AM = { root: 45, notes: [57, 60, 64, 69] };
const DM = { root: 50, notes: [57, 62, 65, 69] };
const E = { root: 52, notes: [56, 59, 64, 68] };
const C = { root: 48, notes: [60, 64, 67, 72] };
const G = { root: 43, notes: [59, 62, 67, 71] };
const F = { root: 41, notes: [57, 60, 65, 69] };

export const MUSIC_THEMES: Record<MusicThemeId, MusicTheme> = {
  lobby: {
    id: 'lobby',
    name: 'Bachata del menú',
    bpm: 100,
    chords: [AM, DM, E, AM],
    arpeggio: [0, 1, 2, 3, 2, 1, 2, 1],
    stepsPerChord: 8,
    wave: 'triangle',
    pluckVol: 0.11,
    bassVol: 0.18,
    guiraVol: 0.03,
    pluckCutoff: 1600,
    attack: 0.04,
    pluckLen: 2.4,
  },
  casino: {
    id: 'casino',
    name: 'Bolero de Casino',
    bpm: 88,
    chords: [AM, E, AM, E],
    arpeggio: [0, 2, 1, 3, 1, 2, 3, 2],
    stepsPerChord: 8,
    wave: 'sine',
    pluckVol: 0.1,
    bassVol: 0.17,
    guiraVol: 0,
    pluckCutoff: 1200,
    attack: 0.06,
    pluckLen: 3,
  },
  tresydos: {
    id: 'tresydos',
    name: 'Brisa de Tres y Dos',
    bpm: 104,
    chords: [C, G, AM, F],
    arpeggio: [0, 1, 2, 3, 2, 3, 2, 1],
    stepsPerChord: 8,
    wave: 'triangle',
    pluckVol: 0.11,
    bassVol: 0.16,
    guiraVol: 0.02,
    pluckCutoff: 2000,
    attack: 0.03,
    pluckLen: 2,
  },
  cagao: {
    id: 'cagao',
    name: 'Pícara de El Cagao',
    bpm: 96,
    chords: [AM, DM, AM, E],
    arpeggio: [0, 2, 3, 1, 2, 3, 1, 2],
    stepsPerChord: 8,
    wave: 'triangle',
    pluckVol: 0.1,
    bassVol: 0.15,
    guiraVol: 0.02,
    pluckCutoff: 1500,
    attack: 0.02,
    pluckLen: 1.3,
  },
  robaito: {
    id: 'robaito',
    name: 'Tropical de El Robaíto',
    bpm: 116,
    chords: [C, AM, F, G],
    arpeggio: [0, 1, 2, 3, 2, 1, 3, 2],
    stepsPerChord: 8,
    wave: 'triangle',
    pluckVol: 0.12,
    bassVol: 0.17,
    guiraVol: 0.03,
    pluckCutoff: 2200,
    attack: 0.03,
    pluckLen: 2.2,
  },
};

export const MUSIC_THEME_IDS: MusicThemeId[] = ['lobby', 'casino', 'tresydos', 'cagao', 'robaito'];

/** El tema de cada modo de juego; sin juego (menú) suena el del lobby. */
export function themeForGame(game: GameId | null | undefined): MusicThemeId {
  if (game === 'casino') return 'casino';
  if (game === 'tresydos') return 'tresydos';
  if (game === 'cagao') return 'cagao';
  if (game === 'robaito') return 'robaito';
  return 'lobby';
}
