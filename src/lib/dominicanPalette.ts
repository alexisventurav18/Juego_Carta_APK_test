/**
 * Paleta canónica dominicana de Cartas Dominicanas.
 *
 * Los colores salen de la bandera y de la cultura dominicana: el azul y el
 * rojo de la bandera, el verde de la palma y la caña, el turquesa del mar
 * Caribe, el ámbar, el azul larimar (piedra única del país) y el rosa de la
 * flor de Bayahibe, la flor nacional. El cacao es el marrón de siempre.
 *
 * Esta es la única fuente de verdad para estos tonos: los entornos por modo,
 * los temas de mesa y menú, el confeti y la rueda diaria los toman de aquí,
 * así un cambio de tono se hace en un solo sitio.
 */
export const DOMINICAN_PALETTE = {
  /** Azul de la bandera dominicana. */
  azulBandera: '#002D62',
  /** Rojo de la bandera dominicana. */
  rojoBandera: '#CE1126',
  /** Blanco de la cruz de la bandera. */
  blanco: '#FFFFFF',
  /** Verde de la palma y de la caña de azúcar. */
  verdePalma: '#1B7A3D',
  /** Turquesa del mar Caribe. */
  turquesaCaribe: '#0EA5B7',
  /** Ámbar dominicano: el acento dorado del juego. */
  ambar: '#E8A020',
  /** Azul larimar: claro y legible sobre fondos oscuros. */
  azulLarimar: '#7FB5D5',
  /** Rosa de la flor de Bayahibe, flor nacional. */
  rosaBayahibe: '#E75480',
  /** Marrón cacao, el color base de siempre. */
  cacao: '#6B4020',
} as const;

export type DominicanColorName = keyof typeof DOMINICAN_PALETTE;

/** Colores del confeti (victoria y sorteo del repartidor): bandera + ámbar. */
export const CONFETTI_COLORS: readonly string[] = [
  DOMINICAN_PALETTE.azulBandera,
  DOMINICAN_PALETTE.rojoBandera,
  DOMINICAN_PALETTE.blanco,
  DOMINICAN_PALETTE.ambar,
];

/** Colores de los segmentos de la rueda diaria: uno distinto por premio, de
    la paleta dominicana. El orden es el de DAILY_WHEEL_PRIZES (+25, +50,
    +100, +150, +250): el premio mayor queda en ámbar. Antes eran 4 colores
    en ciclo y el +250 repetía el azul del +25. */
export const WHEEL_COLORS: readonly string[] = [
  DOMINICAN_PALETTE.azulBandera,
  DOMINICAN_PALETTE.rojoBandera,
  DOMINICAN_PALETTE.verdePalma,
  DOMINICAN_PALETTE.turquesaCaribe,
  DOMINICAN_PALETTE.ambar,
];

/** Color del texto de cada segmento de la rueda, en el mismo orden: blanco
    sobre los colores oscuros y azul bandera sobre el turquesa y el ámbar
    (contraste ≥ 4,5:1 en los cinco, ver tests/dailyWheel.test.ts). */
export const WHEEL_LABEL_COLORS: readonly string[] = [
  '#FFFFFF',
  '#FFFFFF',
  '#FFFFFF',
  DOMINICAN_PALETTE.azulBandera,
  DOMINICAN_PALETTE.azulBandera,
];

/** Un color hexadecimal válido (#RRGGBB). */
export function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
