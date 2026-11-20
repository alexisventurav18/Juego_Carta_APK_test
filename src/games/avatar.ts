/*
 * Catálogo y códigos de los avatares. Sin dependencias de React: lo usan la interfaz (dibujo y editor) y el
 * servidor (para dar cara a los bots y validar el avatar que envía cada jugador).
 *
 * Un avatar se guarda como un texto corto, por ejemplo "m3.2.5.1.2.0.1.0.0.0.0.0.0": género y luego los índices
 * de piel, cabello, color de cabello, ojos, color de ojos, boca, color de boca, bigote, color de bigote,
 * color de camisa, accesorio, barba y fondo. Los códigos viejos de 9 números siguen valiendo: los campos
 * nuevos toman su valor por defecto.
 */

export type Gender = 'm' | 'f';

export interface AvatarConfig {
  gender: Gender;
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyeType: number;
  eyeColor: number;
  mouthType: number;
  mouthColor: number;
  mustache: number;
  mustacheColor: number;
  /** Índice en SHIRT_COLORS. */
  shirtColor: number;
  /** Índice en ACCESSORY_STYLES. */
  accessory: number;
  /** Índice en BEARD_STYLES (solo hombres, como el bigote). */
  beard: number;
  /** Índice en AVATAR_BACKGROUNDS. */
  background: number;
}

export interface StyleOption {
  /** Posición dentro del catálogo (es lo que se guarda en el código). */
  id: number;
  label: string;
  /** Géneros para los que se ofrece. */
  genders: Gender[];
}

const both: Gender[] = ['m', 'f'];
const male: Gender[] = ['m'];
const female: Gender[] = ['f'];

export const SKIN_TONES = ['#FBE3CF', '#F4CBA6', '#E5B084', '#D09866', '#B67C4E', '#96603A', '#74472A', '#58321E'];
export const HAIR_COLORS = [
  '#1B1311', // negro
  '#3A2417', // castaño oscuro
  '#69431F', // castaño
  '#9C6430', // cobrizo
  '#C79A56', // rubio oscuro
  '#E3C77C', // rubio
  '#9A2F22', // pelirrojo
  '#7C7C84', // gris
  '#E9E9EE', // canoso
  '#2F5AA8', // azul
  '#7B3FA1', // violeta
];
export const EYE_COLORS = ['#2B1B12', '#5E3B1F', '#A07A2E', '#2F7050', '#3A6EB0', '#6D7B84', '#1A1A1A'];
export const MOUTH_COLORS = ['#B5645A', '#C9504F', '#A03A3A', '#D98A8A', '#8B4A3C', '#E0708C', '#6B2F3A'];
export const MUSTACHE_COLORS = HAIR_COLORS;
/** Colores de camisa. El primero (marrón) es el de siempre y sigue siendo el valor por defecto. */
export const SHIRT_COLORS = ['#6B4020', '#1F3A5F', '#2F7050', '#7C2D2D', '#4C1D95', '#0F766E', '#9C6430', '#374151'];

export interface AvatarBackground {
  /** Posición dentro del catálogo (es lo que se guarda en el código). */
  id: number;
  label: string;
  /** Paradas del degradado, de arriba a la izquierda a abajo a la derecha. */
  stops: string[];
}

/** Fondos del círculo del avatar. El primero (amarillo) es el de siempre y sigue siendo el valor por defecto. */
export const AVATAR_BACKGROUNDS: AvatarBackground[] = [
  { id: 0, label: 'Amarillo', stops: ['#FEF3C7', '#FCD34D'] },
  { id: 1, label: 'Azul', stops: ['#DBEAFE', '#60A5FA'] },
  { id: 2, label: 'Verde', stops: ['#D1FAE5', '#34D399'] },
  { id: 3, label: 'Rojo', stops: ['#FEE2E2', '#F87171'] },
  { id: 4, label: 'Morado', stops: ['#EDE9FE', '#A78BFA'] },
  { id: 5, label: 'Dominicano', stops: ['#002D62', '#FFFFFF', '#CE1126'] },
];

export const HAIR_STYLES: StyleOption[] = [
  { id: 0, label: 'Rapado', genders: male },
  { id: 1, label: 'Corto', genders: male },
  { id: 2, label: 'Raya al lado', genders: male },
  { id: 3, label: 'Ondulado', genders: male },
  { id: 4, label: 'Copete', genders: male },
  { id: 5, label: 'Calvo', genders: male },
  { id: 6, label: 'Afro', genders: both },
  { id: 7, label: 'Rizado', genders: both },
  { id: 8, label: 'Largo liso', genders: female },
  { id: 9, label: 'Largo ondulado', genders: female },
  { id: 10, label: 'Melena corta', genders: female },
  { id: 11, label: 'Cola de caballo', genders: female },
  { id: 12, label: 'Moño', genders: female },
  { id: 13, label: 'Rizos largos', genders: female },
  { id: 14, label: 'Pixie', genders: female },
];

export const EYE_TYPES: StyleOption[] = [
  { id: 0, label: 'Redondos', genders: both },
  { id: 1, label: 'Grandes', genders: both },
  { id: 2, label: 'Almendrados', genders: both },
  { id: 3, label: 'Cansados', genders: both },
  { id: 4, label: 'Serios', genders: male },
  { id: 5, label: 'Sonrientes', genders: both },
  { id: 6, label: 'Con pestañas', genders: female },
];

export const MOUTH_TYPES: StyleOption[] = [
  { id: 0, label: 'Sonrisa', genders: both },
  { id: 1, label: 'Sonrisa abierta', genders: both },
  { id: 2, label: 'Neutra', genders: both },
  { id: 3, label: 'Pícara', genders: both },
  { id: 4, label: 'Sorpresa', genders: both },
  { id: 5, label: 'Labios carnosos', genders: female },
  { id: 6, label: 'Firme', genders: male },
];

/** El primer estilo (id 0) es siempre "sin bigote". Solo el género masculino ofrece el resto. */
export const MUSTACHE_STYLES: StyleOption[] = [
  { id: 0, label: 'Sin bigote', genders: both },
  { id: 1, label: 'Clásico', genders: male },
  { id: 2, label: 'Fino', genders: male },
  { id: 3, label: 'Grueso', genders: male },
  { id: 4, label: 'Cepillo', genders: male },
  { id: 5, label: 'Manubrio', genders: male },
];

/** Accesorios. El primero (id 0) es "ninguno"; todos se ofrecen a ambos géneros. */
export const ACCESSORY_STYLES: StyleOption[] = [
  { id: 0, label: 'Ninguno', genders: both },
  { id: 1, label: 'Lentes', genders: both },
  { id: 2, label: 'Lentes de sol', genders: both },
  { id: 3, label: 'Gorra', genders: both },
  { id: 4, label: 'Aretes', genders: both },
];

/** Barbas. Como el bigote, solo el género masculino ofrece las que no son "sin barba". */
export const BEARD_STYLES: StyleOption[] = [
  { id: 0, label: 'Sin barba', genders: both },
  { id: 1, label: 'Barba corta', genders: male },
  { id: 2, label: 'Barba completa', genders: male },
  { id: 3, label: 'Chiva', genders: male },
];

/** Secciones del editor (y del aleatorio con candados): cada una agrupa los campos que se sortean juntos. */
export type AvatarSection = 'skin' | 'hair' | 'eyes' | 'mouth' | 'mustache' | 'beard' | 'shirt' | 'accessory' | 'background';

export const AVATAR_SECTIONS: AvatarSection[] = [
  'skin',
  'hair',
  'eyes',
  'mouth',
  'mustache',
  'beard',
  'shirt',
  'accessory',
  'background',
];

export const AVATAR_SECTION_FIELDS: Record<AvatarSection, (keyof AvatarConfig)[]> = {
  skin: ['skin'],
  hair: ['hairStyle', 'hairColor'],
  eyes: ['eyeType', 'eyeColor'],
  mouth: ['mouthType', 'mouthColor'],
  mustache: ['mustache', 'mustacheColor'],
  beard: ['beard'],
  shirt: ['shirtColor'],
  accessory: ['accessory'],
  background: ['background'],
};

export function optionsFor(catalog: StyleOption[], gender: Gender): StyleOption[] {
  return catalog.filter((option) => option.genders.includes(gender));
}

function validFor(catalog: StyleOption[], gender: Gender, id: number): boolean {
  return catalog.some((option) => option.id === id && option.genders.includes(gender));
}

/** Si la opción elegida no existe para ese género, usa la primera que sí. */
function coerce(catalog: StyleOption[], gender: Gender, id: number): number {
  return validFor(catalog, gender, id) ? id : optionsFor(catalog, gender)[0].id;
}

/** Ajusta un avatar a las reglas de su género (p. ej. al cambiar de género se descarta el bigote y la barba). */
export function normalizeAvatar(config: AvatarConfig): AvatarConfig {
  const g = config.gender;
  const pick = (value: number, max: number) => (Number.isInteger(value) && value >= 0 && value < max ? value : 0);
  return {
    gender: g,
    skin: pick(config.skin, SKIN_TONES.length),
    hairStyle: coerce(HAIR_STYLES, g, config.hairStyle),
    hairColor: pick(config.hairColor, HAIR_COLORS.length),
    eyeType: coerce(EYE_TYPES, g, config.eyeType),
    eyeColor: pick(config.eyeColor, EYE_COLORS.length),
    mouthType: coerce(MOUTH_TYPES, g, config.mouthType),
    mouthColor: pick(config.mouthColor, MOUTH_COLORS.length),
    mustache: coerce(MUSTACHE_STYLES, g, config.mustache),
    mustacheColor: pick(config.mustacheColor, MUSTACHE_COLORS.length),
    shirtColor: pick(config.shirtColor, SHIRT_COLORS.length),
    accessory: coerce(ACCESSORY_STYLES, g, config.accessory),
    beard: coerce(BEARD_STYLES, g, config.beard),
    background: pick(config.background, AVATAR_BACKGROUNDS.length),
  };
}

/** 9 números (código viejo) o 13 (código nuevo): los campos nuevos van al final. */
const CODE_PATTERN = /^[mf]\d{1,2}(?:\.\d{1,2}){8}(?:\.\d{1,2}){4}$|^[mf]\d{1,2}(?:\.\d{1,2}){8}$/;

export function isAvatarCode(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && CODE_PATTERN.test(value);
}

export function encodeAvatar(config: AvatarConfig): string {
  const c = normalizeAvatar(config);
  return `${c.gender}${c.skin}.${c.hairStyle}.${c.hairColor}.${c.eyeType}.${c.eyeColor}.${c.mouthType}.${c.mouthColor}.${c.mustache}.${c.mustacheColor}.${c.shirtColor}.${c.accessory}.${c.beard}.${c.background}`;
}

/** Lee un código; si no es válido devuelve null. Los índices fuera de rango se corrigen. */
export function decodeAvatar(code: unknown): AvatarConfig | null {
  if (!isAvatarCode(code)) return null;
  const gender = code[0] as Gender;
  const n = code.slice(1).split('.').map(Number);
  // Un código viejo trae 9 números: camisa, accesorio, barba y fondo quedan en su valor por defecto (0).
  const isOld = n.length === 9;
  return normalizeAvatar({
    gender,
    skin: n[0],
    hairStyle: n[1],
    hairColor: n[2],
    eyeType: n[3],
    eyeColor: n[4],
    mouthType: n[5],
    mouthColor: n[6],
    mustache: n[7],
    mustacheColor: n[8],
    shirtColor: isOld ? 0 : n[9],
    accessory: isOld ? 0 : n[10],
    beard: isOld ? 0 : n[11],
    background: isOld ? 0 : n[12],
  });
}

/** Generador pseudoaleatorio con semilla (mulberry32): el mismo texto da siempre el mismo avatar. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choose<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

/** Avatar al azar. Sin `gender` también elige el género. El bigote y la barba solo salen a una parte de los hombres. */
export function randomAvatar(rng: () => number = Math.random, gender?: Gender): AvatarConfig {
  const g: Gender = gender ?? (rng() < 0.5 ? 'm' : 'f');
  const mustaches = optionsFor(MUSTACHE_STYLES, g).filter((option) => option.id !== 0);
  const beards = optionsFor(BEARD_STYLES, g).filter((option) => option.id !== 0);
  const hairColor = Math.floor(rng() * HAIR_COLORS.length);
  // Los tonos de cabello poco comunes (azul, violeta) salen con menos frecuencia.
  const naturalHair = rng() < 0.9 ? Math.floor(rng() * 9) : hairColor;
  return normalizeAvatar({
    gender: g,
    skin: Math.floor(rng() * SKIN_TONES.length),
    hairStyle: choose(optionsFor(HAIR_STYLES, g), rng).id,
    hairColor: naturalHair,
    eyeType: choose(optionsFor(EYE_TYPES, g), rng).id,
    eyeColor: Math.floor(rng() * EYE_COLORS.length),
    mouthType: choose(optionsFor(MOUTH_TYPES, g), rng).id,
    mouthColor: Math.floor(rng() * MOUTH_COLORS.length),
    mustache: mustaches.length > 0 && rng() < 0.35 ? choose(mustaches, rng).id : 0,
    mustacheColor: naturalHair,
    shirtColor: Math.floor(rng() * SHIRT_COLORS.length),
    accessory: rng() < 0.6 ? 0 : 1 + Math.floor(rng() * (ACCESSORY_STYLES.length - 1)),
    beard: beards.length > 0 && rng() < 0.3 ? choose(beards, rng).id : 0,
    background: Math.floor(rng() * AVATAR_BACKGROUNDS.length),
  });
}

/**
 * Vuelve a sortear un avatar respetando los candados: las secciones bloqueadas conservan su valor actual
 * y solo se sortean las demás. Con todas bloqueadas devuelve el avatar tal cual (normalizado).
 */
export function randomizeAvatarSections(
  current: AvatarConfig,
  locked: ReadonlySet<AvatarSection>,
  rng: () => number = Math.random,
): AvatarConfig {
  const fresh = randomAvatar(rng, current.gender);
  const next: AvatarConfig = { ...current };
  for (const section of AVATAR_SECTIONS) {
    if (locked.has(section)) continue;
    for (const field of AVATAR_SECTION_FIELDS[section]) {
      // Cada campo es number o Gender: la asignación pasa por un índice
      // genérico porque TypeScript no puede probar campo a campo que los
      // tipos coinciden (sin esto, el destino se reduce a `never`).
      (next as Record<keyof AvatarConfig, number | Gender>)[field] = fresh[field];
    }
  }
  return normalizeAvatar(next);
}

/** Avatar estable para quien no envió el suyo (p. ej. otro jugador de una sala con un servidor antiguo). */
export function avatarFromSeed(seed: string): string {
  return encodeAvatar(randomAvatar(seededRandom(seed)));
}
