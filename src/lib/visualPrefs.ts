import { useSyncExternalStore } from 'react';
import type { GameId } from '../games/shared';
import { DOMINICAN_PALETTE } from './dominicanPalette';
import { publicAsset } from './publicAsset';

const STORAGE_KEY = 'cartas-dominicanas:visual-prefs';

export type CardBackTheme = 'cacao' | 'azul' | 'rojo' | 'madera-turquesa' | 'dominicano-azul' | 'dominicano-bandera' | 'larimar' | 'ambar' | 'palma-real' | 'larimar-mar' | 'carnaval' | 'cafetal' | 'amanecer-caribe' | 'arena-playa' | 'selva' | 'atardecer' | 'concho-clasico' | 'velocidad-nocturna' | 'aventura-4x4';
export type TableTheme = 'madera' | 'verde' | 'azul' | 'rojo' | 'bandera' | 'tropical' | 'mar-caribe' | 'cana' | 'arena-playa' | 'selva' | 'atardecer-mesa';
export type MenuTheme = 'madera' | 'verde' | 'azul' | 'playa-ilustrada' | 'atardecer-tropical' | 'fiesta-tropical' | 'palmeras' | 'amanecer-caribe' | 'carnaval' | 'cafetal';

export interface VisualPrefs {
  cardBack: CardBackTheme;
  table: TableTheme;
  menu: MenuTheme;
}

export const DEFAULT_VISUAL_PREFS: VisualPrefs = {
  cardBack: 'cacao',
  table: 'madera',
  menu: 'fiesta-tropical',
};

export const CARD_BACK_THEMES: { id: CardBackTheme; label: string; color: string }[] = [
  { id: 'cacao', label: 'Cacao', color: '#bd6a20' },
  { id: 'azul', label: 'Azul', color: '#2563a6' },
  { id: 'rojo', label: 'Rojo', color: '#a8323e' },
  { id: 'madera-turquesa', label: 'Madera turquesa', color: '#4b2a1c' },
  { id: 'dominicano-azul', label: 'Dominicano azul', color: '#173a70' },
  { id: 'dominicano-bandera', label: 'Bandera dominicana', color: '#e8e1cf' },
  { id: 'larimar', label: 'Larimar', color: DOMINICAN_PALETTE.azulLarimar },
  { id: 'ambar', label: 'Ámbar', color: DOMINICAN_PALETTE.ambar },
  { id: 'palma-real', label: 'Palma real', color: DOMINICAN_PALETTE.azulBandera },
  { id: 'larimar-mar', label: 'Larimar y mar', color: DOMINICAN_PALETTE.turquesaCaribe },
  { id: 'carnaval', label: 'Carnaval', color: DOMINICAN_PALETTE.rojoBandera },
  { id: 'cafetal', label: 'Cafetal', color: DOMINICAN_PALETTE.verdePalma },
  { id: 'amanecer-caribe', label: 'Amanecer caribe', color: DOMINICAN_PALETTE.turquesaCaribe },
  { id: 'arena-playa', label: 'Arena de playa', color: DOMINICAN_PALETTE.ambar },
  { id: 'selva', label: 'Selva', color: '#2e7a4c' },
  { id: 'atardecer', label: 'Atardecer', color: DOMINICAN_PALETTE.rosaBayahibe },
  // Carros: diseños genéricos dibujados en SVG, sin marcas ni modelos reales.
  { id: 'concho-clasico', label: 'Concho clásico', color: '#a8323e' },
  { id: 'velocidad-nocturna', label: 'Velocidad nocturna', color: '#1d2f6e' },
  { id: 'aventura-4x4', label: '4x4 Aventura', color: '#2e7a4c' },
];

export const TABLE_THEMES: { id: TableTheme; label: string; color: string; image: string }[] = [
  {
    id: 'madera',
    label: 'Madera',
    color: '#8a5a2b',
    image: 'repeating-linear-gradient(92deg, rgb(60 30 10 / 0.2) 0 1px, transparent 1px 6px), repeating-linear-gradient(88deg, rgb(255 225 170 / 0.09) 0 2px, transparent 0 12px), radial-gradient(ellipse at 50% 40%, #b57a3c 0%, #8a5a2b 55%, #6a4220 100%)',
  },
  {
    id: 'verde',
    label: 'Fieltro verde',
    color: DOMINICAN_PALETTE.verdePalma,
    image: 'radial-gradient(ellipse at 50% 40%, #2e9e57 0%, #1b7a3d 60%, #0e4a26 100%)',
  },
  {
    id: 'azul',
    label: 'Fieltro azul',
    color: DOMINICAN_PALETTE.azulBandera,
    image: 'radial-gradient(ellipse at 50% 40%, #1e5aa8 0%, #002d62 60%, #001a3d 100%)',
  },
  {
    id: 'rojo',
    label: 'Fieltro rojo',
    color: DOMINICAN_PALETTE.rojoBandera,
    image: 'radial-gradient(ellipse at 50% 40%, #e0475a 0%, #ce1126 60%, #7a0a17 100%)',
  },
  {
    id: 'bandera',
    label: 'Bandera',
    color: DOMINICAN_PALETTE.azulBandera,
    image: `url("${publicAsset('images/temas/mesas/mesa-bandera.webp')}")`,
  },
  {
    id: 'tropical',
    label: 'Tropical',
    color: DOMINICAN_PALETTE.verdePalma,
    image: `url("${publicAsset('images/temas/mesas/mesa-tropical.webp')}")`,
  },
  {
    id: 'mar-caribe',
    label: 'Mar Caribe',
    color: DOMINICAN_PALETTE.turquesaCaribe,
    image: 'radial-gradient(ellipse at 50% 40%, #2ec4d4 0%, #0ea5b7 60%, #065a66 100%)',
  },
  {
    id: 'cana',
    label: 'Caña',
    color: DOMINICAN_PALETTE.verdePalma,
    image: 'radial-gradient(ellipse at 50% 40%, #2ec4b6 0%, #1b7a3d 55%, #0b3d20 100%)',
  },
  {
    id: 'arena-playa',
    label: 'Arena de playa',
    color: DOMINICAN_PALETTE.ambar,
    image: `url("${publicAsset('images/temas/mesas/mesa-arena-playa.webp')}")`,
  },
  {
    id: 'selva',
    label: 'Selva',
    color: DOMINICAN_PALETTE.verdePalma,
    image: `url("${publicAsset('images/temas/mesas/mesa-selva.webp')}")`,
  },
  {
    id: 'atardecer-mesa',
    label: 'Atardecer',
    color: DOMINICAN_PALETTE.rosaBayahibe,
    image: `url("${publicAsset('images/temas/mesas/mesa-atardecer.webp')}")`,
  },
];

export const MENU_THEMES: { id: MenuTheme; label: string; color: string; image: string }[] = [
  {
    id: 'madera',
    label: 'Madera',
    color: '#2a160a',
    image: 'radial-gradient(ellipse at 50% 35%, #4a2a12, #1e0e05 75%)',
  },
  {
    id: 'verde',
    label: 'Verde',
    color: '#0e3a22',
    image: 'radial-gradient(ellipse at 50% 35%, #2e7a4c, #0e3a22 75%)',
  },
  {
    id: 'azul',
    label: 'Azul',
    color: '#0a1f3d',
    image: 'radial-gradient(ellipse at 50% 35%, #1e5aa8, #0a1f3d 75%)',
  },
  {
    id: 'playa-ilustrada',
    label: 'Playa ilustrada',
    color: '#143b5a',
    image: `url("${publicAsset('images/temas/menu/playa-ilustrada.webp')}")`,
  },
  {
    id: 'atardecer-tropical',
    label: 'Atardecer tropical',
    color: '#3e2446',
    image: `url("${publicAsset('images/temas/menu/atardecer-tropical.webp')}")`,
  },
  {
    id: 'fiesta-tropical',
    label: 'Fiesta tropical',
    color: '#122c46',
    image: `url("${publicAsset('images/temas/menu/fiesta-tropical.webp')}")`,
  },
  {
    id: 'palmeras',
    label: 'Palmeras',
    color: '#0b2e4f',
    image: 'radial-gradient(ellipse at 50% 0%, #2ec4d4 0%, transparent 55%), linear-gradient(180deg, #002d62 0%, #0b4a6b 50%, #1b7a3d 100%)',
  },
  {
    id: 'amanecer-caribe',
    label: 'Amanecer caribe',
    color: DOMINICAN_PALETTE.turquesaCaribe,
    image: `url("${publicAsset('images/temas/menu/amanecer-caribe.webp')}")`,
  },
  {
    id: 'carnaval',
    label: 'Carnaval',
    color: DOMINICAN_PALETTE.azulBandera,
    image: `url("${publicAsset('images/temas/menu/carnaval.webp')}")`,
  },
  {
    id: 'cafetal',
    label: 'Cafetal',
    color: DOMINICAN_PALETTE.verdePalma,
    image: `url("${publicAsset('images/temas/menu/cafetal.webp')}")`,
  },
];

/**
 * Entorno de cada modo: el color que tiñe la sala de espera y el brillo de
 * la mesa mientras se juega ese modo. `table` es la mesa que se sugiere para
 * el modo (no se impone: la que el jugador compró y equipó siempre manda).
 */
export interface GameEnvironment {
  /** Mesa sugerida para el modo. */
  table: TableTheme;
  /** Color de acento del modo (textos, anillos y brillos). */
  accent: string;
}

export const GAME_ENVIRONMENTS: Record<GameId, GameEnvironment> = {
  casino: { table: 'verde', accent: DOMINICAN_PALETTE.ambar },
  tresydos: { table: 'azul', accent: DOMINICAN_PALETTE.azulLarimar },
  cagao: { table: 'rojo', accent: DOMINICAN_PALETTE.rojoBandera },
  robaito: { table: 'tropical', accent: DOMINICAN_PALETTE.turquesaCaribe },
};

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function readStored(): VisualPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISUAL_PREFS };
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      cardBack: isOneOf(data.cardBack, CARD_BACK_THEMES.map(({ id }) => id)) ? data.cardBack : DEFAULT_VISUAL_PREFS.cardBack,
      table: isOneOf(data.table, TABLE_THEMES.map(({ id }) => id)) ? data.table : DEFAULT_VISUAL_PREFS.table,
      menu: isOneOf(data.menu, MENU_THEMES.map(({ id }) => id)) ? data.menu : DEFAULT_VISUAL_PREFS.menu,
    };
  } catch {
    return { ...DEFAULT_VISUAL_PREFS };
  }
}

let prefs: VisualPrefs = typeof window === 'undefined' ? { ...DEFAULT_VISUAL_PREFS } : readStored();
const listeners = new Set<() => void>();

export function getVisualPrefs(): VisualPrefs {
  return prefs;
}

export function setVisualPrefs(patch: Partial<VisualPrefs>): void {
  const next = { ...prefs, ...patch };
  if ((Object.keys(next) as (keyof VisualPrefs)[]).every((key) => next[key] === prefs[key])) return;
  prefs = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: la preferencia dura solo mientras la app esté abierta.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVisualPrefs(): { prefs: VisualPrefs; update: (patch: Partial<VisualPrefs>) => void } {
  const value = useSyncExternalStore(subscribe, getVisualPrefs, getVisualPrefs);
  return { prefs: value, update: setVisualPrefs };
}
