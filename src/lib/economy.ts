import { useSyncExternalStore } from 'react';
import type { GameState } from '../games/index';
import { teamOf, type GameId } from '../games/shared';
import {
  applyMatch,
  claimMission as claimMissionPure,
  defaultMissions,
  refreshMissions,
  type MatchStats,
  type MissionPeriod,
  type MissionsState,
} from './missions';
import {
  CARD_BACK_THEMES,
  DEFAULT_VISUAL_PREFS,
  MENU_THEMES,
  TABLE_THEMES,
  getVisualPrefs,
  type CardBackTheme,
  type MenuTheme,
  type TableTheme,
  type VisualPrefs,
} from './visualPrefs';

/**
 * Monedas y cosméticos de Cartas Dominicanas.
 *
 * Las monedas solo se ganan jugando (victorias, rachas y recompensa diaria) y
 * solo se gastan en cosméticos: dorsos de cartas, mesas y fondos del menú.
 * No hay compras con dinero real ni ventajas de juego: todo es aspecto.
 * El saldo vive en localStorage, como el resto de preferencias del jugador.
 */

export const DAILY_REWARD_COINS = 50;

/** Monedas base por ganar una partida, según el modo. */
export const WIN_REWARDS: Record<GameId, number> = {
  casino: 100,
  tresydos: 80,
  robaito: 70,
  cagao: 60,
};

/** Bonus por racha: +10 por cada victoria consecutiva anterior, hasta +50. */
export const STREAK_BONUS_PER_WIN = 10;
export const STREAK_BONUS_MAX = 50;

export type CosmeticCategory = 'cardBack' | 'table' | 'menu';
export type WinOutcome = 'win' | 'tie' | 'loss';

export interface ShopItem {
  category: CosmeticCategory;
  id: string;
  label: string;
  price: number;
}

/**
 * Precios por nivel: el primer nivel (100) se alcanza con una sola victoria
 * en Casino (100 monedas), para que la primera compra no pida días de espera.
 * Los niveles altos (250-400) siguen siendo para jugadores con más partidas.
 */
const CARD_BACK_PRICES: Record<CardBackTheme, number> = {
  cacao: 0,
  azul: 100,
  rojo: 100,
  'madera-turquesa': 250,
  'dominicano-azul': 300,
  'dominicano-bandera': 400,
};

const TABLE_PRICES: Record<TableTheme, number> = {
  madera: 0,
  verde: 100,
  azul: 100,
  rojo: 150,
  bandera: 300,
  tropical: 350,
};

const MENU_PRICES: Record<MenuTheme, number> = {
  madera: 0,
  verde: 100,
  azul: 100,
  'playa-ilustrada': 350,
  'atardecer-tropical': 350,
};

export const SHOP_ITEMS: ShopItem[] = [
  ...CARD_BACK_THEMES.map((theme) => ({
    category: 'cardBack' as const,
    id: theme.id,
    label: theme.label,
    price: CARD_BACK_PRICES[theme.id],
  })),
  ...TABLE_THEMES.map((theme) => ({
    category: 'table' as const,
    id: theme.id,
    label: theme.label,
    price: TABLE_PRICES[theme.id],
  })),
  ...MENU_THEMES.map((theme) => ({
    category: 'menu' as const,
    id: theme.id,
    label: theme.label,
    price: MENU_PRICES[theme.id],
  })),
];

export function shopPrice(category: CosmeticCategory, id: string): number | null {
  return SHOP_ITEMS.find((item) => item.category === category && item.id === id)?.price ?? null;
}

export interface EconomyState {
  coins: number;
  /** Victorias totales (todas las partidas ganadas). */
  wins: number;
  /** Victorias consecutivas actuales; se reinicia al perder. */
  streak: number;
  /** Victorias por modo. */
  winsByGame: Record<GameId, number>;
  lastDailyDate: string | null;
  ownedCardBacks: CardBackTheme[];
  ownedTables: TableTheme[];
  ownedMenus: MenuTheme[];
  /** Partidas ya recompensadas: evita pagar dos veces la misma victoria. */
  awarded: string[];
  /** Misiones diarias y semanales (progreso y reclamos). */
  missions: MissionsState;
}

export function defaultEconomy(): EconomyState {
  return {
    coins: 0,
    wins: 0,
    streak: 0,
    winsByGame: { casino: 0, tresydos: 0, robaito: 0, cagao: 0 },
    lastDailyDate: null,
    ownedCardBacks: [DEFAULT_VISUAL_PREFS.cardBack],
    ownedTables: [DEFAULT_VISUAL_PREFS.table],
    ownedMenus: [DEFAULT_VISUAL_PREFS.menu],
    awarded: [],
    missions: defaultMissions(),
  };
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Migración al abrir la tienda por primera vez: el jugador conserva como
 * suyos los temas que ya tenía equipados (y los gratuitos por defecto),
 * aunque antes no existiera la economía.
 */
export function migrateEconomy(state: EconomyState, prefs: VisualPrefs): EconomyState {
  const knownCardBacks = CARD_BACK_THEMES.map(({ id }) => id);
  const knownTables = TABLE_THEMES.map(({ id }) => id);
  const knownMenus = MENU_THEMES.map(({ id }) => id);
  return {
    ...state,
    coins: Math.max(0, Math.floor(state.coins) || 0),
    ownedCardBacks: unique([
      ...state.ownedCardBacks.filter((id) => knownCardBacks.includes(id)),
      DEFAULT_VISUAL_PREFS.cardBack,
      prefs.cardBack,
    ]),
    ownedTables: unique([
      ...state.ownedTables.filter((id) => knownTables.includes(id)),
      DEFAULT_VISUAL_PREFS.table,
      prefs.table,
    ]),
    ownedMenus: unique([
      ...state.ownedMenus.filter((id) => knownMenus.includes(id)),
      DEFAULT_VISUAL_PREFS.menu,
      prefs.menu,
    ]),
    awarded: state.awarded.slice(-50),
    missions: sanitizeMissions(state.missions),
  };
}

/** Acepta las misiones guardadas si tienen forma válida; si no, empieza de cero. Al pasar, las pone al día. */
function sanitizeMissions(missions: unknown): MissionsState {
  if (
    typeof missions !== 'object' ||
    missions === null ||
    !Array.isArray((missions as MissionsState).daily) ||
    !Array.isArray((missions as MissionsState).weekly)
  ) {
    return defaultMissions();
  }
  const valid = (list: unknown[]): MissionsState['daily'] =>
    list
      .filter(
        (p): p is MissionsState['daily'][number] =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as { id?: unknown }).id === 'string' &&
          typeof (p as { progress?: unknown }).progress === 'number',
      )
      .map((p) => ({
        id: p.id,
        progress: Math.max(0, Math.floor(p.progress)),
        claimed: p.claimed === true,
        games: Array.isArray(p.games) ? p.games.filter((g): g is GameId => typeof g === 'string') : [],
      }));
  return refreshMissions({
    dailyKey: typeof (missions as MissionsState).dailyKey === 'string' ? (missions as MissionsState).dailyKey : null,
    daily: valid((missions as MissionsState).daily),
    weeklyKey:
      typeof (missions as MissionsState).weeklyKey === 'string' ? (missions as MissionsState).weeklyKey : null,
    weekly: valid((missions as MissionsState).weekly),
  });
}

export function isOwned(state: EconomyState, category: CosmeticCategory, id: string): boolean {
  if (category === 'cardBack') return state.ownedCardBacks.includes(id as CardBackTheme);
  if (category === 'table') return state.ownedTables.includes(id as TableTheme);
  return state.ownedMenus.includes(id as MenuTheme);
}

export type BuyResult =
  | { ok: true; state: EconomyState }
  | { ok: false; state: EconomyState; reason: 'owned' | 'funds' | 'unknown' };

export function buyItem(state: EconomyState, category: CosmeticCategory, id: string): BuyResult {
  const price = shopPrice(category, id);
  if (price === null) return { ok: false, state, reason: 'unknown' };
  if (isOwned(state, category, id)) return { ok: false, state, reason: 'owned' };
  if (state.coins < price) return { ok: false, state, reason: 'funds' };
  const next: EconomyState = {
    ...state,
    coins: state.coins - price,
    ownedCardBacks:
      category === 'cardBack' ? [...state.ownedCardBacks, id as CardBackTheme] : state.ownedCardBacks,
    ownedTables: category === 'table' ? [...state.ownedTables, id as TableTheme] : state.ownedTables,
    ownedMenus: category === 'menu' ? [...state.ownedMenus, id as MenuTheme] : state.ownedMenus,
  };
  return { ok: true, state: next };
}

/** Clave del día en hora local (AAAA-MM-DD): la recompensa diaria es una por día. */
export function todayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function claimDailyReward(
  state: EconomyState,
  date: Date = new Date(),
): { state: EconomyState; granted: number } {
  const today = todayKey(date);
  if (state.lastDailyDate === today) return { state, granted: 0 };
  return {
    state: { ...state, coins: state.coins + DAILY_REWARD_COINS, lastDailyDate: today },
    granted: DAILY_REWARD_COINS,
  };
}

/** Monedas por una victoria, con el bonus de racha incluido. Un empate paga la mitad. */
export function winRewardAmount(game: GameId, outcome: WinOutcome, streakBefore: number): number {
  const base = WIN_REWARDS[game];
  const streakBonus = Math.min(STREAK_BONUS_MAX, Math.max(0, streakBefore) * STREAK_BONUS_PER_WIN);
  const total = base + streakBonus;
  return outcome === 'tie' ? Math.floor(total / 2) : total;
}

/** ¿Ganó, empató o perdió el jugador del asiento `seat`? Null si la partida no terminó. */
export function humanOutcome(state: GameState, seat: number): WinOutcome | null {
  if (state.phase !== 'gameOver') return null;
  if (state.game === 'casino') {
    if (state.winnerTeam === null) return null;
    return state.winnerTeam === teamOf(seat) ? 'win' : 'loss';
  }
  if (state.game === 'tresydos') {
    if (state.winnerSeat === null) return null;
    return state.winnerSeat === seat ? 'win' : 'loss';
  }
  if (state.game === 'cagao') {
    if (state.loserSeat === null) return null;
    return state.loserSeat === seat ? 'loss' : 'win';
  }
  // robaito
  if (!state.winnerSeats.includes(seat)) return 'loss';
  return state.winnerSeats.length > 1 ? 'tie' : 'win';
}

/** Huella de una partida terminada: distingue una partida de la siguiente, aunque se repita la sala. */
export function matchFingerprint(state: GameState): string {
  const playerIds = state.players.map((p) => p.id);
  if (state.game === 'casino') {
    return JSON.stringify(['casino', playerIds, state.scores, state.winnerTeam, state.roundNo]);
  }
  if (state.game === 'tresydos') {
    return JSON.stringify(['tresydos', playerIds, state.wins, state.winnerSeat, state.roundNo]);
  }
  if (state.game === 'cagao') {
    return JSON.stringify(['cagao', playerIds, state.loserSeat, state.finishOrder]);
  }
  return JSON.stringify([
    'robaito',
    playerIds,
    state.winnerSeats,
    state.piles.map((pile) => pile.length),
  ]);
}

export function recordWin(
  state: EconomyState,
  game: GameId,
  outcome: WinOutcome,
  matchKey: string,
): { state: EconomyState; awarded: number | null } {
  if (state.awarded.includes(matchKey)) return { state, awarded: null };
  const awarded = [...state.awarded, matchKey].slice(-50);
  if (outcome === 'loss') {
    return { state: { ...state, streak: 0, awarded }, awarded: null };
  }
  const amount = winRewardAmount(game, outcome, state.streak);
  return {
    state: {
      ...state,
      coins: state.coins + amount,
      wins: state.wins + 1,
      streak: state.streak + 1,
      winsByGame: { ...state.winsByGame, [game]: state.winsByGame[game] + 1 },
      awarded,
    },
    awarded: amount,
  };
}

/* ------------------------------------------------------------------ */
/* Almacenamiento (localStorage, como el resto de preferencias)        */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'cartas-dominicanas:economy-v1';

/**
 * Carga la economía guardada (o la inicial) migrando siempre los temas que
 * el jugador ya tiene equipados: son suyos sin pagar nada. Función pura
 * para poder probarla; readStored() solo le pasa el localStorage real.
 */
export function loadEconomy(raw: string | null, prefs: VisualPrefs): EconomyState {
  if (!raw) return migrateEconomy(defaultEconomy(), prefs);
  try {
    const data = JSON.parse(raw) as Partial<EconomyState>;
    const base = defaultEconomy();
    return migrateEconomy(
      {
        ...base,
        ...data,
        winsByGame: { ...base.winsByGame, ...(data.winsByGame ?? {}) },
        ownedCardBacks: Array.isArray(data.ownedCardBacks) ? data.ownedCardBacks : base.ownedCardBacks,
        ownedTables: Array.isArray(data.ownedTables) ? data.ownedTables : base.ownedTables,
        ownedMenus: Array.isArray(data.ownedMenus) ? data.ownedMenus : base.ownedMenus,
        awarded: Array.isArray(data.awarded) ? data.awarded : [],
        missions: data.missions !== undefined ? (data.missions as MissionsState) : base.missions,
      },
      prefs,
    );
  } catch {
    return migrateEconomy(defaultEconomy(), prefs);
  }
}

function readStored(): EconomyState {
  try {
    if (typeof window === 'undefined') return defaultEconomy();
    return loadEconomy(window.localStorage.getItem(STORAGE_KEY), getVisualPrefs());
  } catch {
    return migrateEconomy(defaultEconomy(), getVisualPrefs());
  }
}

let economy: EconomyState = readStored();
const listeners = new Set<() => void>();

function save(next: EconomyState): void {
  economy = next;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Sin almacenamiento: las monedas duran solo mientras la app esté abierta.
  }
  listeners.forEach((listener) => listener());
}

export function getEconomy(): EconomyState {
  return economy;
}

/** Recompensa una partida terminada una sola vez. Devuelve las monedas pagadas, o null. */
export function awardMatch(matchKey: string, game: GameId, outcome: WinOutcome): number | null {
  return awardMatchWithStats(matchKey, game, outcome, { game, outcome }).awarded;
}

/**
 * Como awardMatch, pero además registra las estadísticas de la partida en las misiones
 * (capturas y viraos del Casino). Devuelve las monedas pagadas y las misiones que se
 * completaron con esta partida.
 */
export function awardMatchWithStats(
  matchKey: string,
  game: GameId,
  outcome: WinOutcome,
  stats: MatchStats,
): { awarded: number | null; completed: import('./missions').MissionDef[] } {
  // La huella evita contar dos veces la misma partida, también en las misiones:
  // una vista que se actualice varias veces en gameOver no suma progreso extra.
  if (economy.awarded.includes(matchKey)) return { awarded: null, completed: [] };
  const result = recordWin(economy, game, outcome, matchKey);
  const beforeMissions = JSON.stringify(result.state.missions);
  const missions = applyMatch(result.state.missions, stats);
  const missionsChanged = JSON.stringify(missions.state) !== beforeMissions;
  if (result.state === economy && !missionsChanged) {
    return { awarded: result.awarded, completed: [] };
  }
  save({ ...result.state, missions: missions.state });
  return { awarded: result.awarded, completed: missions.completed };
}

/** Reclama una misión completa: paga sus monedas. Devuelve las monedas otorgadas, o 0. */
export function claimMissionReward(period: MissionPeriod, id: string): number {
  const result = claimMissionPure(economy.missions, period, id);
  if (result.granted <= 0) return 0;
  save({ ...economy, coins: economy.coins + result.granted, missions: result.state });
  return result.granted;
}

/** Recompensa diaria: 50 monedas la primera vez que se abre la app cada día. */
export function claimDaily(): number {
  const result = claimDailyReward(economy);
  if (result.granted > 0) save(result.state);
  return result.granted;
}

/** Compra un cosmético. Devuelve si se pudo y por qué no, si no se pudo. */
export function buyCosmetic(
  category: CosmeticCategory,
  id: string,
): { ok: boolean; reason?: 'owned' | 'funds' | 'unknown' } {
  const result = buyItem(economy, category, id);
  if (!result.ok) return { ok: false, reason: result.reason };
  save(result.state);
  return { ok: true };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEconomy(): EconomyState {
  return useSyncExternalStore(subscribe, getEconomy, getEconomy);
}
