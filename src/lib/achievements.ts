/*
 * Logros y racha diaria (módulo puro, sin React).
 *
 * Los logros se guardan dentro del estado de la economía (mismo
 * localStorage), así viajan con la copia de seguridad en la nube. Cada
 * logro se desbloquea una sola vez y su recompensa se cobra una sola
 * vez (botón "Reclamar" por logro o "Reclamar todo", como las misiones).
 *
 * La racha diaria cuenta días consecutivos entrando al juego (fecha
 * local, mismo criterio de día que `lastDailyDate` en economy.ts): si
 * se salta un día, la racha vuelve a 1. La racha se cobra junto con la
 * rueda diaria: cada día de racha suma un extra al premio de la rueda.
 */

import type { GameId } from '../games/shared';

/** Iconos (nombres de lucide-react) que el modal mapea a componentes. */
export type AchievementIcon =
  | 'trophy'
  | 'spade'
  | 'skull'
  | 'zap'
  | 'flame'
  | 'crown'
  | 'layers'
  | 'star'
  | 'target'
  | 'coins'
  | 'sparkles'
  | 'calendar';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  /** Monedas que cobra el jugador al reclamar el logro. */
  reward: number;
  /** Meta que muestra la barra de progreso del modal. */
  target: number;
  /**
   * Logros que dependen de una sola partida (p. ej. capturar 20 cartas
   * en una mano de Casino): el progreso no se acumula entre partidas,
   * así que la barra muestra 0/1 o 1/1.
   */
  perMatch?: boolean;
}

/**
 * Catálogo acotado (12). Nombres dominicanos; ninguno depende de datos
 * del servidor (torneos, ranking): todo se evalúa con lo que el cliente
 * ya conoce al terminar la partida o al girar la rueda.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'primera-casino',
    title: 'Primera mano ganada',
    description: 'Gana tu primera partida de Casino.',
    icon: 'spade',
    reward: 50,
    target: 1,
  },
  {
    id: 'primera-tresydos',
    title: 'Tres y Dos, ¡cantado!',
    description: 'Gana tu primera partida de Tres y Dos.',
    icon: 'trophy',
    reward: 50,
    target: 1,
  },
  {
    id: 'primera-cagao',
    title: 'Sobreviviente',
    description: 'Gana tu primera partida de El Cagao sin quedarte con el A♠.',
    icon: 'skull',
    reward: 50,
    target: 1,
  },
  {
    id: 'primera-robaito',
    title: 'Manos rápidas',
    description: 'Gana tu primera partida de El Robaíto.',
    icon: 'zap',
    reward: 50,
    target: 1,
  },
  {
    id: 'racha-5',
    title: 'En llamas',
    description: 'Gana 5 partidas seguidas.',
    icon: 'flame',
    reward: 100,
    target: 5,
  },
  {
    id: 'racha-10',
    title: 'Imparable',
    description: 'Gana 10 partidas seguidas.',
    icon: 'crown',
    reward: 250,
    target: 10,
  },
  {
    id: 'cuatro-modos-dia',
    title: 'Todoterreno total',
    description: 'Gana en los 4 modos el mismo día.',
    icon: 'layers',
    reward: 200,
    target: 4,
  },
  {
    id: 'cien-partidas',
    title: 'Veterano de mesa',
    description: 'Juega 100 partidas.',
    icon: 'star',
    reward: 150,
    target: 100,
  },
  {
    id: 'nivel-10',
    title: 'Estrella en ascenso',
    description: 'Llega al nivel 10.',
    icon: 'target',
    reward: 100,
    target: 10,
  },
  {
    id: 'cazador-casino',
    title: 'Cazador de mesa',
    description: 'Captura 20 cartas o más en una partida de Casino.',
    icon: 'coins',
    reward: 100,
    target: 1,
    perMatch: true,
  },
  {
    id: 'roba-todo',
    title: 'El Robaíto mayor',
    description: 'Gana El Robaíto con 30 cartas o más en tu paquete.',
    icon: 'sparkles',
    reward: 150,
    target: 1,
    perMatch: true,
  },
  {
    id: 'rueda-7',
    title: 'Una semana de suerte',
    description: 'Gira la rueda diaria 7 días seguidos.',
    icon: 'calendar',
    reward: 150,
    target: 7,
  },
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Lo que un logro ya desbloqueado guarda: su id en `unlocked` y, cuando
 * se cobra, en `claimed`. `modesWonToday` recuerda en qué modos se ganó
 * hoy (para "Todoterreno total"); se reinicia al cambiar de día.
 */
export interface AchievementsState {
  unlocked: string[];
  claimed: string[];
  modesWonToday: { date: string | null; games: GameId[] };
}

export function defaultAchievements(): AchievementsState {
  return { unlocked: [], claimed: [], modesWonToday: { date: null, games: [] } };
}

const GAME_IDS: GameId[] = ['casino', 'tresydos', 'robaito', 'cagao'];

/** Limpia un estado de logros que venga de localStorage o de la nube. */
export function sanitizeAchievements(value: unknown): AchievementsState {
  const fallback = defaultAchievements();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const unlocked = Array.isArray(record.unlocked)
    ? record.unlocked.filter((id): id is string => typeof id === 'string' && getAchievement(id) !== undefined)
    : [];
  const claimed = Array.isArray(record.claimed)
    ? record.claimed.filter((id): id is string => typeof id === 'string' && unlocked.includes(id))
    : [];
  let modesWonToday = fallback.modesWonToday;
  const raw = record.modesWonToday;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Array.isArray(r.games)) {
      modesWonToday = {
        date: r.date,
        games: r.games.filter((g): g is GameId => typeof g === 'string' && (GAME_IDS as string[]).includes(g)),
      };
    }
  }
  return { unlocked, claimed, modesWonToday };
}

export function isAchievementUnlocked(state: AchievementsState, id: string): boolean {
  return state.unlocked.includes(id);
}

export function isAchievementClaimed(state: AchievementsState, id: string): boolean {
  return state.claimed.includes(id);
}

/**
 * Todo lo que se necesita para evaluar los logros al terminar una
 * partida o al girar la rueda. `casinoCapturesThisMatch` y
 * `robaitoCardsThisMatch` son de ESTA partida (los logros por partida
 * no se acumulan); el resto es acumulado.
 */
export interface AchievementSnapshot {
  winsByGame: Record<GameId, number>;
  gamesPlayed: number;
  bestStreak: number;
  level: number;
  modesWonToday: GameId[];
  casinoCapturesThisMatch: number;
  robaitoCardsThisMatch: number;
  robaitoWon: boolean;
  wheelStreakDays: number;
}

/** Progreso actual de un logro (para la barra del modal). */
export function achievementProgress(
  def: AchievementDef,
  state: AchievementsState,
  snap: AchievementSnapshot,
): { current: number; target: number } {
  if (isAchievementUnlocked(state, def.id)) return { current: def.target, target: def.target };
  switch (def.id) {
    case 'primera-casino':
      return { current: Math.min(snap.winsByGame.casino, 1), target: 1 };
    case 'primera-tresydos':
      return { current: Math.min(snap.winsByGame.tresydos, 1), target: 1 };
    case 'primera-cagao':
      return { current: Math.min(snap.winsByGame.cagao, 1), target: 1 };
    case 'primera-robaito':
      return { current: Math.min(snap.winsByGame.robaito, 1), target: 1 };
    case 'racha-5':
      return { current: Math.min(snap.bestStreak, 5), target: 5 };
    case 'racha-10':
      return { current: Math.min(snap.bestStreak, 10), target: 10 };
    case 'cuatro-modos-dia':
      return { current: Math.min(snap.modesWonToday.length, 4), target: 4 };
    case 'cien-partidas':
      return { current: Math.min(snap.gamesPlayed, 100), target: 100 };
    case 'nivel-10':
      return { current: Math.min(snap.level, 10), target: 10 };
    case 'cazador-casino':
    case 'roba-todo':
      // Logro por partida: sin progreso acumulado; 0/1 hasta desbloquearse.
      return { current: 0, target: 1 };
    case 'rueda-7':
      return { current: Math.min(snap.wheelStreakDays, 7), target: 7 };
    default:
      return { current: 0, target: def.target };
  }
}

/** ¿Cumple este logro con el estado actual? */
function isEarned(def: AchievementDef, snap: AchievementSnapshot): boolean {
  switch (def.id) {
    case 'primera-casino':
      return snap.winsByGame.casino >= 1;
    case 'primera-tresydos':
      return snap.winsByGame.tresydos >= 1;
    case 'primera-cagao':
      return snap.winsByGame.cagao >= 1;
    case 'primera-robaito':
      return snap.winsByGame.robaito >= 1;
    case 'racha-5':
      return snap.bestStreak >= 5;
    case 'racha-10':
      return snap.bestStreak >= 10;
    case 'cuatro-modos-dia':
      return snap.modesWonToday.length >= 4;
    case 'cien-partidas':
      return snap.gamesPlayed >= 100;
    case 'nivel-10':
      return snap.level >= 10;
    case 'cazador-casino':
      return snap.casinoCapturesThisMatch >= 20;
    case 'roba-todo':
      return snap.robaitoWon && snap.robaitoCardsThisMatch >= 30;
    case 'rueda-7':
      return snap.wheelStreakDays >= 7;
    default:
      return false;
  }
}

/**
 * Evalúa los logros con el estado actual. `wonGame`/`outcome` solo se
 * pasan al terminar una partida: si se ganó (el empate cuenta como
 * victoria, igual que en las misiones), el modo se anota en
 * `modesWonToday` (reiniciado si cambió el día). Devuelve el estado
 * nuevo y los logros recién desbloqueados (vacío si no hay ninguno).
 */
export function evaluateAchievements(
  prev: AchievementsState,
  snap: AchievementSnapshot,
  opts?: { wonGame?: GameId; date?: Date },
): { state: AchievementsState; newlyUnlocked: AchievementDef[] } {
  const today = dayKey(opts?.date ?? new Date());
  let modesWonToday = prev.modesWonToday;
  if (modesWonToday.date !== today) modesWonToday = { date: today, games: [] };
  if (opts?.wonGame && !modesWonToday.games.includes(opts.wonGame)) {
    modesWonToday = { date: today, games: [...modesWonToday.games, opts.wonGame] };
  }
  const effectiveSnap: AchievementSnapshot = { ...snap, modesWonToday: modesWonToday.games };
  const newlyUnlocked = ACHIEVEMENTS.filter(
    (def) => !prev.unlocked.includes(def.id) && isEarned(def, effectiveSnap),
  );
  if (newlyUnlocked.length === 0 && modesWonToday === prev.modesWonToday) {
    return { state: prev, newlyUnlocked: [] };
  }
  return {
    state: {
      unlocked: [...prev.unlocked, ...newlyUnlocked.map((d) => d.id)],
      claimed: prev.claimed,
      modesWonToday,
    },
    newlyUnlocked,
  };
}

/**
 * Cobra la recompensa de un logro desbloqueado. Idempotente: si ya
 * estaba cobrado (o no desbloqueado), no paga nada.
 */
export function claimAchievement(
  state: AchievementsState,
  id: string,
): { state: AchievementsState; granted: number } {
  const def = getAchievement(id);
  if (!def || !state.unlocked.includes(id) || state.claimed.includes(id)) {
    return { state, granted: 0 };
  }
  return { state: { ...state, claimed: [...state.claimed, id] }, granted: def.reward };
}

/** Cobra todos los logros desbloqueados que falten por cobrar. */
export function claimAllAchievements(state: AchievementsState): {
  state: AchievementsState;
  granted: number;
  count: number;
} {
  let granted = 0;
  let count = 0;
  const claimed = [...state.claimed];
  for (const def of ACHIEVEMENTS) {
    if (state.unlocked.includes(def.id) && !claimed.includes(def.id)) {
      claimed.push(def.id);
      granted += def.reward;
      count += 1;
    }
  }
  return { state: { ...state, claimed }, granted, count };
}

/** Lo que falta por cobrar (para el aviso de resultados y el botón de Logros). */
export function unclaimedAchievementRewards(state: AchievementsState): { count: number; coins: number } {
  let count = 0;
  let coins = 0;
  for (const def of ACHIEVEMENTS) {
    if (state.unlocked.includes(def.id) && !state.claimed.includes(def.id)) {
      count += 1;
      coins += def.reward;
    }
  }
  return { count, coins };
}

/* ------------------------------------------------------------------ */
/* Racha diaria                                                        */
/* ------------------------------------------------------------------ */

/** Días consecutivos entrando al juego; `lastDate` es el último día contado. */
export interface DailyStreak {
  days: number;
  lastDate: string | null;
}

export function defaultDailyStreak(): DailyStreak {
  return { days: 0, lastDate: null };
}

/** Misma clave de día local que `lastDailyDate` (AAAA-MM-DD). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysKey(date: Date, delta: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + delta);
  return dayKey(copy);
}

/**
 * Registra la entrada de hoy: mismo día dos veces no suma; día
 * consecutivo suma 1; día saltado reinicia a 1.
 */
export function recordDailyVisit(streak: DailyStreak, date: Date): DailyStreak {
  const today = dayKey(date);
  if (streak.lastDate === today) return streak;
  const days = streak.lastDate === addDaysKey(date, -1) ? streak.days + 1 : 1;
  return { days, lastDate: today };
}

/**
 * Extra que suma la racha al premio de la rueda: +50 el día 1, +10 por
 * cada día más, hasta +150 (día 11 en adelante).
 */
export function streakBonusForDay(days: number): number {
  if (days <= 0) return 0;
  return Math.min(50 + 10 * (days - 1), 150);
}
