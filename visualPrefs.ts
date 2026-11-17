import { useSyncExternalStore } from 'react';
import { publicAsset } from './publicAsset';

const STORAGE_KEY = 'cartas-dominicanas:visual-prefs';

export type CardBackTheme = 'cacao' | 'azul' | 'rojo' | 'madera-turquesa' | 'dominicano-azul' | 'dominicano-bandera';
export type TableTheme = 'madera' | 'verde' | 'azul' | 'bandera' | 'tropical';
export type MenuTheme = 'madera' | 'verde' | 'azul' | 'playa-ilustrada' | 'atardecer-tropical';

export interface VisualPrefs {
  cardBack: CardBackTheme;
  table: TableTheme;
  menu: MenuTheme;
}

export const DEFAULT_VISUAL_PREFS: VisualPrefs = {
  cardBack: 'cacao',
  table: 'madera',
  menu: 'madera',
};

export const CARD_BACK_THEMES: { id: CardBackTheme; label: string; color: string }[] = [
  { id: 'cacao', label: 'Cacao', color: '#bd6a20' },
  { id: 'azul', label: 'Azul', color: '#2563a6' },
  { id: 'rojo', label: 'Rojo', color: '#a8323e' },
  { id: 'madera-turquesa', label: 'Madera turquesa', color: '#4b2a1c' },
  { id: 'dominicano-azul', label: 'Dominicano azul', color: '#173a70' },
  { id: 'dominicano-bandera', label: 'Bandera dominicana', color: '#e8e1cf' },
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
    color: '#17603b',
    image: 'radial-gradient(ellipse at 50% 40%, #25834f 0%, #17603b 60%, #0b3824 100%)',
  },
  {
    id: 'azul',
    label: 'Fieltro azul',
    color: '#24577e',
    image: 'radial-gradient(ellipse at 50% 40%, #3479a6 0%, #24577e 60%, #12334d 100%)',
  },
  {
    id: 'bandera',
    label: 'Bandera',
    color: '#172c55',
    image: `url("${publicAsset('images/temas/mesas/mesa-bandera.webp')}")`,
  },
  {
    id: 'tropical',
    label: 'Tropical',
    color: '#17603b',
    image: `url("${publicAsset('images/temas/mesas/mesa-tropical.webp')}")`,
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
    color: '#102d20',
    image: 'radial-gradient(ellipse at 50% 35%, #245b3a, #102d20 75%)',
  },
  {
    id: 'azul',
    label: 'Azul',
    color: '#10233c',
    image: 'radial-gradient(ellipse at 50% 35%, #244b70, #10233c 75%)',
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
];

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
