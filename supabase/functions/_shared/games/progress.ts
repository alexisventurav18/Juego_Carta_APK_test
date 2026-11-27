import type { RoomResponse, RoomStore } from './roomService.ts';
import { authenticateProfile, readAuth, RoomError } from './roomService.ts';
import type { GameId } from './shared.ts';

/*
 * Respaldo del progreso en la nube (A+B). El servidor solo guarda la foto
 * tal cual: no es autoridad de monedas ni de XP (eso seguiría premiándose
 * en el teléfono, como siempre). La foto incluye `awarded[]` y
 * `lastDailyDate`: sin ellos, restaurar una copia vieja permitiría cobrar
 * dos veces la misma victoria o la misma rueda diaria. También incluye la
 * racha diaria (`dailyStreak`) y los logros (`achievements`): sin ellos, al
 * restaurar se perderían los logros desbloqueados y la racha.
 *
 * Conflicto: gana la copia más reciente por `updatedAt`. Quien sube manda
 * `baseUpdatedAt` (la fecha de la copia del servidor que conoce); si la
 * nube tiene una copia más nueva, no se pisa: se devuelve la copia de la
 * nube para que el jugador elija (ver `progress_conflict`).
 *
 * Este módulo solo importa de `roomService` (tipos y autenticación) y de
 * `shared`: la Edge Function copia solo `src/games/*` (ver
 * `scripts/syncFunctions.ts`), así que nada de aquí puede importar de
 * `src/lib` (la economía vive ahí y no viaja al servidor).
 */

/** Economía tal como se guarda en la nube (forma de `EconomyState`). */
export interface ProgressEconomy {
  coins: number;
  wins: number;
  gamesPlayed: number;
  losses: number;
  streak: number;
  bestStreak: number;
  winsByGame: Record<GameId, number>;
  xp: number;
  lastDailyDate: string | null;
  ownedCardBacks: string[];
  ownedTables: string[];
  ownedMenus: string[];
  /** Partidas y premios ya cobrados (anti-doble-pago). */
  awarded: string[];
  /** Misiones tal cual las guarda el cliente (él las vuelve a validar). */
  missions: unknown;
  /** Racha de días consecutivos entrando al juego. */
  dailyStreak: { days: number; lastDate: string | null };
  /** Logros tal cual los guarda el cliente (él los vuelve a validar). */
  achievements: unknown;
}

/** La foto completa: economía + temas equipados. */
export interface ProgressSnapshot {
  economy: ProgressEconomy;
  visualPrefs: { cardBack: string; table: string; menu: string } | null;
}

function asNonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function asWinsByGame(value: unknown): Record<GameId, number> {
  const base: Record<GameId, number> = { casino: 0, tresydos: 0, robaito: 0, cagao: 0 };
  if (typeof value !== 'object' || value === null) return base;
  const record = value as Record<string, unknown>;
  for (const game of ['casino', 'tresydos', 'robaito', 'cagao'] as const) {
    base[game] = asNonNegativeInt(record[game]);
  }
  return base;
}

/** Las misiones pasan tal cual si tienen forma de listas; si no, null (el cliente las reinicia). */
function asMissions(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.daily) || !Array.isArray(record.weekly)) return null;
  return value;
}

function asDailyStreak(value: unknown): { days: number; lastDate: string | null } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { days: 0, lastDate: null };
  const record = value as Record<string, unknown>;
  return {
    days: asNonNegativeInt(record.days),
    lastDate:
      typeof record.lastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.lastDate) ? record.lastDate : null,
  };
}

/** Los logros pasan tal cual si tienen forma de listas; si no, null (el cliente los reinicia). */
function asAchievements(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.unlocked) || !Array.isArray(record.claimed)) return null;
  return value;
}

function asVisualPrefs(value: unknown): ProgressSnapshot['visualPrefs'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.cardBack !== 'string' || typeof record.table !== 'string' || typeof record.menu !== 'string') {
    return null;
  }
  return { cardBack: record.cardBack, table: record.table, menu: record.menu };
}

/**
 * Valida y limpia una foto que manda el cliente. Nunca se confía en el
 * cliente: números imposibles se ponen a 0, listas raras se vacían y, si
 * la foto no tiene forma de foto, se rechaza entera (null).
 */
export function sanitizeProgressSnapshot(raw: unknown): ProgressSnapshot | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const economy = record.economy;
  if (typeof economy !== 'object' || economy === null || Array.isArray(economy)) return null;
  const e = economy as Record<string, unknown>;
  return {
    economy: {
      coins: asNonNegativeInt(e.coins),
      wins: asNonNegativeInt(e.wins),
      gamesPlayed: asNonNegativeInt(e.gamesPlayed),
      losses: asNonNegativeInt(e.losses),
      streak: asNonNegativeInt(e.streak),
      bestStreak: asNonNegativeInt(e.bestStreak),
      winsByGame: asWinsByGame(e.winsByGame),
      xp: asNonNegativeInt(e.xp),
      lastDailyDate:
        typeof e.lastDailyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.lastDailyDate) ? e.lastDailyDate : null,
      ownedCardBacks: asStringList(e.ownedCardBacks, 64),
      ownedTables: asStringList(e.ownedTables, 64),
      ownedMenus: asStringList(e.ownedMenus, 64),
      awarded: asStringList(e.awarded, 50),
      missions: asMissions(e.missions),
      dailyStreak: asDailyStreak(e.dailyStreak),
      achievements: asAchievements(e.achievements),
    },
    visualPrefs: asVisualPrefs(record.visualPrefs),
  };
}

function readBaseUpdatedAt(req: Record<string, unknown>): number {
  const value = req.baseUpdatedAt;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Guarda la foto del progreso. Si la nube tiene una copia más nueva que la
 * que conoce quien sube (`baseUpdatedAt`), no se pisa: se devuelve la
 * copia de la nube (`progress_conflict`) para que el jugador elija.
 */
export async function saveProgress(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const snapshot = sanitizeProgressSnapshot(req.economy);
  if (!snapshot) throw new RoomError('El progreso no tiene un formato válido.');
  const baseUpdatedAt = readBaseUpdatedAt(req);
  const stored = await store.getProgress(auth.playerId);
  if (stored && stored.updatedAt > baseUpdatedAt) {
    return { ok: true, data: { kind: 'progress_conflict', economy: stored.economy, updatedAt: stored.updatedAt } };
  }
  const updatedAt = Date.now();
  await store.saveProgress(auth.playerId, snapshot, updatedAt);
  return { ok: true, data: { kind: 'progress_saved', updatedAt } };
}

/**
 * Baja la foto del progreso (o null si nunca se respaldó). Devuelve
 * también el perfil (nombre, avatar, nivel) para que un teléfono nuevo
 * recupere su cara además de sus monedas.
 */
export async function loadProgress(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const profile = await authenticateProfile(store, auth);
  const stored = await store.getProgress(auth.playerId);
  return {
    ok: true,
    data: {
      kind: 'progress',
      economy: stored ? stored.economy : null,
      updatedAt: stored ? stored.updatedAt : null,
      profile: {
        name: profile.name,
        ...(profile.avatar ? { avatar: profile.avatar } : {}),
        ...(profile.level !== undefined ? { level: profile.level } : {}),
      },
    },
  };
}
