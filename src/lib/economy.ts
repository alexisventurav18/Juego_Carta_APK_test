import { useSyncExternalStore } from 'react';
import type { GameState } from '../games/index';
import { teamOf, type GameId } from '../games/shared';
import {
  applyMatch,
  claimAllMissions as claimAllMissionsPure,
  claimMission as claimMissionPure,
  defaultMissions,
  refreshMissions,
  type MatchStats,
  type MissionPeriod,
  type MissionsState,
} from './missions';
import { addXp, xpGainForWin, type XpGain } from './experience';
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

/** Monedas extra por cada nivel de experiencia que se sube al ganar. */
export const LEVEL_UP_COIN_BONUS = 50;

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
  larimar: 150,
  ambar: 250,
  'palma-real': 250,
  'larimar-mar': 300,
  carnaval: 150,
  cafetal: 250,
  'amanecer-caribe': 150,
  'arena-playa': 250,
  selva: 150,
  atardecer: 250,
  'concho-clasico': 250,
  'velocidad-nocturna': 250,
  'aventura-4x4': 150,
};

const TABLE_PRICES: Record<TableTheme, number> = {
  madera: 0,
  verde: 100,
  azul: 100,
  rojo: 150,
  bandera: 300,
  tropical: 350,
  'mar-caribe': 150,
  cana: 250,
  'arena-playa': 300,
  selva: 350,
  'atardecer-mesa': 300,
};

const MENU_PRICES: Record<MenuTheme, number> = {
  madera: 0,
  verde: 100,
  azul: 100,
  'playa-ilustrada': 350,
  'atardecer-tropical': 350,
  'fiesta-tropical': 0,
  palmeras: 250,
  'amanecer-caribe': 350,
  carnaval: 350,
  cafetal: 350,
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
  /** Partidas terminadas (victorias + empates + derrotas). */
  gamesPlayed: number;
  /** Derrotas totales. */
  losses: number;
  /** Victorias consecutivas actuales; se reinicia al perder. */
  streak: number;
  /** Mejor racha de victorias consecutivas. */
  bestStreak: number;
  /** Victorias por modo. */
  winsByGame: Record<GameId, number>;
  /** Experiencia total acumulada (niveles en src/lib/experience.ts). */
  xp: number;
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
    gamesPlayed: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    winsByGame: { casino: 0, tresydos: 0, robaito: 0, cagao: 0 },
    xp: 0,
    lastDailyDate: null,
    ownedCardBacks: [DEFAULT_VISUAL_PREFS.cardBack],
    ownedTables: [DEFAULT_VISUAL_PREFS.table],
    // La madera era el fondo por defecto anterior y sigue siendo gratis
    // para todos, aunque el default actual sea la Fiesta tropical.
    ownedMenus: [DEFAULT_VISUAL_PREFS.menu, 'madera'],
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
    gamesPlayed: Math.max(0, Math.floor(state.gamesPlayed) || 0),
    losses: Math.max(0, Math.floor(state.losses) || 0),
    bestStreak: Math.max(0, Math.floor(state.bestStreak) || 0),
    xp: Math.max(0, Math.floor(state.xp) || 0),
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
      // La madera era el fondo por defecto anterior y sigue siendo gratis.
      'madera',
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

/* ------------------------------------------------------------------ */
/* Rueda diaria: la recompensa de entrar cada día es un giro con premio */
/* variable, en vez de 50 fijas. El giro es lo que hace volver mañana: */
/* no saber qué toca pesa más que la cantidad exacta.                  */
/* ------------------------------------------------------------------ */

/** Segmentos de la rueda: premio y peso relativo (suman 100). */
export const DAILY_WHEEL_PRIZES: { amount: number; weight: number; label: string }[] = [
  { amount: 25, weight: 30, label: '+25' },
  { amount: 50, weight: 40, label: '+50' },
  { amount: 100, weight: 20, label: '+100' },
  { amount: 150, weight: 8, label: '+150' },
  { amount: 250, weight: 2, label: '¡+250!' },
];

/** Sortea el premio de la rueda (se puede inyectar el azar en las pruebas). */
export function rollDailyPrize(random: () => number = Math.random): number {
  const total = DAILY_WHEEL_PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = random() * total;
  for (const prize of DAILY_WHEEL_PRIZES) {
    roll -= prize.weight;
    if (roll < 0) return prize.amount;
  }
  return DAILY_WHEEL_PRIZES[0].amount;
}

/** ¿Queda la recompensa diaria de hoy por reclamar? */
export function isDailyAvailable(state: EconomyState, date: Date = new Date()): boolean {
  return state.lastDailyDate !== todayKey(date);
}

/** Otorga el premio girado (una sola vez al día). Devuelve lo otorgado, o 0. */
export function claimDailyAmount(
  state: EconomyState,
  amount: number,
  date: Date = new Date(),
): { state: EconomyState; granted: number } {
  const today = todayKey(date);
  if (state.lastDailyDate === today || amount <= 0) return { state, granted: 0 };
  return {
    state: { ...state, coins: state.coins + amount, lastDailyDate: today },
    granted: amount,
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

/**
 * Registra una partida terminada: paga monedas (base + racha + bonus por
 * subir de nivel) y suma experiencia. `awarded` incluye el bonus de nivel:
 * la primera victoria en Casino paga 150 (100 + 50 por subir del nivel 1
 * al 2). En derrota o partida ya premiada no hay XP ni monedas.
 */
export function recordWin(
  state: EconomyState,
  game: GameId,
  outcome: WinOutcome,
  matchKey: string,
): { state: EconomyState; awarded: number | null; xpGain: XpGain | null } {
  if (state.awarded.includes(matchKey)) return { state, awarded: null, xpGain: null };
  const awarded = [...state.awarded, matchKey].slice(-50);
  if (outcome === 'loss') {
    return {
      state: { ...state, streak: 0, gamesPlayed: state.gamesPlayed + 1, losses: state.losses + 1, awarded },
      awarded: null,
      xpGain: null,
    };
  }
  const gain = addXp(state.xp, xpGainForWin(game, outcome));
  const amount = winRewardAmount(game, outcome, state.streak) + LEVEL_UP_COIN_BONUS * gain.levelsGained;
  const newStreak = state.streak + 1;
  return {
    state: {
      ...state,
      coins: state.coins + amount,
      wins: state.wins + 1,
      gamesPlayed: state.gamesPlayed + 1,
      streak: newStreak,
      bestStreak: Math.max(state.bestStreak, newStreak),
      winsByGame: { ...state.winsByGame, [game]: state.winsByGame[game] + 1 },
      xp: gain.totalXp,
      awarded,
    },
    awarded: amount,
    xpGain: gain,
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
  // Respaldo en la nube (A): la copia se sube con debounce. Import
  // dinámico para no crear un ciclo estático con `progress.ts` (que a su
  // vez importa la economía). Sin conexión el juego sigue 100 % local.
  if (typeof window !== 'undefined') {
    void import('./progress')
      .then((module) => module.scheduleProgressUpload())
      .catch(() => undefined);
  }
}

/**
 * Reemplaza la economía entera por una foto bajada de la nube: se revalida
 * con `loadEconomy` (migra y limpia), se guarda y se avisa a los
 * suscriptores como cualquier otro cambio.
 */
export function replaceEconomy(state: EconomyState): void {
  save(loadEconomy(JSON.stringify(state), getVisualPrefs()));
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
 * (capturas y viraos del Casino). Devuelve las monedas pagadas, la XP ganada y las
 * misiones que se completaron con esta partida.
 */
export function awardMatchWithStats(
  matchKey: string,
  game: GameId,
  outcome: WinOutcome,
  stats: MatchStats,
): { awarded: number | null; xpGain: XpGain | null; completed: import('./missions').MissionDef[] } {
  // La huella evita contar dos veces la misma partida, también en las misiones:
  // una vista que se actualice varias veces en gameOver no suma progreso extra.
  if (economy.awarded.includes(matchKey)) return { awarded: null, xpGain: null, completed: [] };
  const result = recordWin(economy, game, outcome, matchKey);
  const beforeMissions = JSON.stringify(result.state.missions);
  const missions = applyMatch(result.state.missions, stats);
  const missionsChanged = JSON.stringify(missions.state) !== beforeMissions;
  if (result.state === economy && !missionsChanged) {
    return { awarded: result.awarded, xpGain: result.xpGain, completed: [] };
  }
  save({ ...result.state, missions: missions.state });
  return { awarded: result.awarded, xpGain: result.xpGain, completed: missions.completed };
}

/** Reclama una misión completa: paga sus monedas. Devuelve las monedas otorgadas, o 0. */
export function claimMissionReward(period: MissionPeriod, id: string): number {
  const result = claimMissionPure(economy.missions, period, id);
  if (result.granted <= 0) return 0;
  save({ ...economy, coins: economy.coins + result.granted, missions: result.state });
  return result.granted;
}

/**
 * Reclama de una vez todas las misiones completadas sin reclamar (diarias y
 * semanales). Devuelve las monedas totales y cuántas misiones se reclamaron.
 */
export function claimAllMissionRewards(): { granted: number; count: number } {
  const result = claimAllMissionsPure(economy.missions);
  if (result.granted <= 0) return { granted: 0, count: 0 };
  save({ ...economy, coins: economy.coins + result.granted, missions: result.state });
  return { granted: result.granted, count: result.claimed.length };
}

/**
 * Otorga las monedas de un premio (torneo o temporada) una sola vez por clave
 * ("tournament:<id>" o "season:<temporada>"): la clave queda en `awarded`,
 * como las huellas de partida, así que un segundo reclamo de la misma
 * respuesta no vuelve a pagar. Función pura para poder probarla.
 */
export function grantPrizeCoins(
  state: EconomyState,
  key: string,
  coins: number,
): { state: EconomyState; granted: number } {
  if (coins <= 0 || state.awarded.includes(key)) return { state, granted: 0 };
  return {
    state: { ...state, coins: state.coins + coins, awarded: [...state.awarded, key].slice(-50) },
    granted: coins,
  };
}

/**
 * Suma las monedas de un premio que el servidor ya confirmó, una sola vez por
 * clave. Devuelve las monedas otorgadas, o 0 si ya se reclamó.
 */
export function claimPrize(key: string, coins: number): number {
  const result = grantPrizeCoins(economy, key, coins);
  if (result.granted > 0) save(result.state);
  return result.granted;
}

/** Recompensa diaria: 50 monedas la primera vez que se abre la app cada día. */
export function claimDaily(): number {
  const result = claimDailyReward(economy);
  if (result.granted > 0) save(result.state);
  return result.granted;
}

/** ¿Queda la recompensa diaria de hoy por reclamar (para la rueda)? */
export function isDailyAvailableNow(): boolean {
  return isDailyAvailable(economy);
}

/** Otorga el premio que salió en la rueda diaria (una sola vez al día). */
export function claimDailyPrize(amount: number): number {
  const result = claimDailyAmount(economy, amount);
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
