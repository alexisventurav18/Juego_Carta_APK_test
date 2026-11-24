import type { CardBackTheme } from './visualPrefs';
import { DOMINICAN_PALETTE } from './dominicanPalette';

/**
 * Cara de la carta (boca arriba) de un tema de baraja: cada dorso comprado
 * en la Tienda cambia también cómo se ve la carta de frente, a juego con
 * su dorso. Los valores llegan a las cartas como variables CSS
 * (--card-face-*) desde App.tsx; la cara por defecto (cacao) reproduce
 * exactamente la carta crema de siempre.
 *
 * Las caras son deliberadamente marcadas: fondo con tinte claro del tema y
 * marco sólido, para que el tema se note a simple vista sin tapar el rango
 * ni el palo. Los fondos se mantienen claros para que la tinta negra y la
 * roja sigan leyendo con contraste (ver tests/cardThemes.test.ts).
 */
export interface CardFaceTheme {
  /** Fondo de la cara. */
  bg: string;
  /** Marco interior (transparente = sin marco). */
  frame: string;
  /** Tinta de corazones y diamantes. */
  red: string;
  /** Tinta de picas y tréboles. */
  ink: string;
  /** Brillo central, radial y tenue detrás del palo grande. */
  accent: string;
  /** Degradado de la cresta dorada de las figuras (J/Q/K), inicio y fin. */
  crestA: string;
  crestB: string;
}

/** La cara de siempre: crema, tintas clásicas y cresta dorada. */
export const DEFAULT_CARD_FACE: CardFaceTheme = {
  bg: '#f7ecce',
  frame: 'transparent',
  red: '#b3202a',
  ink: '#1d1b2e',
  accent: '#f1e0b3',
  crestA: '#f8dc84',
  crestB: '#8a5f12',
};

const GOLD: Pick<CardFaceTheme, 'crestA' | 'crestB'> = { crestA: '#f8dc84', crestB: '#8a5f12' };

export const CARD_FACE_THEMES: Record<CardBackTheme, CardFaceTheme> = {
  cacao: DEFAULT_CARD_FACE,
  azul: {
    bg: '#d9e7f6',
    frame: '#2563a6',
    red: '#b3202a',
    ink: '#173a70',
    accent: '#83c5e8',
    ...GOLD,
  },
  rojo: {
    bg: '#f4d7d7',
    frame: '#a8323e',
    red: '#8f1d27',
    ink: '#3d1420',
    accent: '#f0a3a6',
    ...GOLD,
  },
  'madera-turquesa': {
    bg: '#d5e9de',
    frame: '#0e7a6b',
    red: '#b3202a',
    ink: '#20382c',
    accent: '#7fd4c0',
    ...GOLD,
  },
  'dominicano-azul': {
    bg: '#d3e0f3',
    frame: DOMINICAN_PALETTE.azulBandera,
    red: '#a31f2b',
    ink: '#0a1f3d',
    accent: DOMINICAN_PALETTE.azulLarimar,
    ...GOLD,
  },
  'dominicano-bandera': {
    bg: '#f7eeda',
    frame: DOMINICAN_PALETTE.rojoBandera,
    red: DOMINICAN_PALETTE.rojoBandera,
    ink: DOMINICAN_PALETTE.azulBandera,
    accent: DOMINICAN_PALETTE.azulLarimar,
    ...GOLD,
  },
  larimar: {
    bg: '#d5eaf7',
    frame: '#2e6da4',
    red: '#b3202a',
    ink: '#1c3a52',
    accent: DOMINICAN_PALETTE.azulLarimar,
    ...GOLD,
  },
  ambar: {
    bg: '#faeabd',
    frame: '#8a5f12',
    red: '#a8323e',
    ink: '#4a3220',
    accent: DOMINICAN_PALETTE.ambar,
    ...GOLD,
  },
  'palma-real': {
    bg: '#d3e4f3',
    frame: DOMINICAN_PALETTE.azulBandera,
    red: '#a31f2b',
    ink: '#0a2e4d',
    accent: DOMINICAN_PALETTE.turquesaCaribe,
    ...GOLD,
  },
  'larimar-mar': {
    bg: '#c9edf1',
    frame: DOMINICAN_PALETTE.turquesaCaribe,
    red: '#b3202a',
    ink: '#0b3d46',
    accent: '#2ec4d4',
    ...GOLD,
  },
  carnaval: {
    bg: '#ffe0a8',
    frame: DOMINICAN_PALETTE.rojoBandera,
    red: '#8f1d27',
    ink: '#1d1b2e',
    accent: '#f2a541',
    crestA: '#f3c13a',
    crestB: '#7a1414',
  },
  cafetal: {
    bg: '#e6d9b4',
    frame: DOMINICAN_PALETTE.verdePalma,
    red: '#8f2f2f',
    ink: '#241a10',
    accent: '#c47a2e',
    crestA: '#e8c97a',
    crestB: '#4a2408',
  },
  'amanecer-caribe': {
    bg: '#fbe3a0',
    frame: DOMINICAN_PALETTE.turquesaCaribe,
    red: '#a31f3d',
    ink: '#0f3350',
    accent: '#f2a541',
    crestA: '#f6d77a',
    crestB: '#0a6a7a',
  },
  'arena-playa': {
    bg: '#f5dc9e',
    frame: DOMINICAN_PALETTE.ambar,
    red: '#96401f',
    ink: '#3d2812',
    accent: '#eec96a',
    ...GOLD,
  },
  selva: {
    bg: '#d8e8b8',
    frame: DOMINICAN_PALETTE.verdePalma,
    red: '#a8323e',
    ink: '#0f2214',
    accent: '#7ab648',
    crestA: '#cfe08a',
    crestB: '#24400f',
  },
  atardecer: {
    bg: '#f8c4b4',
    frame: DOMINICAN_PALETTE.rosaBayahibe,
    red: '#9c1d44',
    ink: '#2a1428',
    accent: '#f08a3c',
    crestA: '#f6a8c0',
    crestB: '#7a2344',
  },
  'concho-clasico': {
    bg: '#f2d3a4',
    frame: '#a8323e',
    red: '#8f1d27',
    ink: '#2a1f14',
    accent: '#e8a020',
    crestA: '#f3c13a',
    crestB: '#6f1d2a',
  },
  'velocidad-nocturna': {
    bg: '#dfe6f5',
    frame: '#1d2f6e',
    red: '#a31f2b',
    ink: '#141c33',
    accent: '#5f7dd4',
    crestA: '#e8ecf7',
    crestB: '#3a4a7a',
  },
  'aventura-4x4': {
    bg: '#d3ddb2',
    frame: '#2e7a4c',
    red: '#9c2f38',
    ink: '#1c2b1a',
    accent: '#8a9a3b',
    crestA: '#cfe08a',
    crestB: '#24400f',
  },
};

export function cardFaceTheme(id: CardBackTheme): CardFaceTheme {
  return CARD_FACE_THEMES[id] ?? DEFAULT_CARD_FACE;
}
