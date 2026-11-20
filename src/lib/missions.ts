import type { GameId } from '../games/shared';

/**
 * Misiones diarias y semanales: objetivos que se cumplen jugando y pagan monedas al reclamarlos.
 *
 * Cada día (y cada semana) se eligen 3 misiones de un fondo común, siempre las mismas para ese día/semana,
 * así que dos jugadores ven las mismas misiones. El progreso vive dentro de la economía (localStorage),
 * junto a las monedas, y se reinicia solo cuando cambia el día o la semana. No hay compras ni ventajas:
 * las misiones solo dan monedas para cosméticos.
 */

export type MissionPeriod = 'daily' | 'weekly';
export type MissionKind = 'win' | 'play' | 'modesPlayed' | 'modesWon' | 'capture' | 'virao';

export interface MissionDef {
  id: string;
  period: MissionPeriod;
  kind: MissionKind;
  title: string;
  description: string;
  /** Cuánto hay que hacer para completarla. */
  target: number;
  /** Monedas al reclamarla. */
  reward: number;
  /** Si existe, la misión solo cuenta partidas de ese modo. */
  game?: GameId;
}

export interface MissionProgress {
  id: string;
  progress: number;
  claimed: boolean;
  /** Modos distintos que ya contaron (para las misiones de modos). */
  games: GameId[];
}

export interface MissionsState {
  dailyKey: string | null;
  daily: MissionProgress[];
  weeklyKey: string | null;
  weekly: MissionProgress[];
}

/** Fondo de misiones diarias: cada día se eligen 3. */
export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'd-win1', period: 'daily', kind: 'win', title: 'Primera victoria', description: 'Gana 1 partida en cualquier modo.', target: 1, reward: 30 },
  { id: 'd-win2', period: 'daily', kind: 'win', title: 'En racha', description: 'Gana 2 partidas en cualquier modo.', target: 2, reward: 40 },
  { id: 'd-play3', period: 'daily', kind: 'play', title: 'A calentar', description: 'Juega 3 partidas en cualquier modo.', target: 3, reward: 25 },
  { id: 'd-play5', period: 'daily', kind: 'play', title: 'Sesión larga', description: 'Juega 5 partidas en cualquier modo.', target: 5, reward: 40 },
  { id: 'd-modes2', period: 'daily', kind: 'modesPlayed', title: 'Explorador', description: 'Juega en 2 modos distintos.', target: 2, reward: 30 },
  { id: 'd-capture15', period: 'daily', kind: 'capture', title: 'Cazador', description: 'Captura 15 cartas en el Casino.', target: 15, reward: 35, game: 'casino' },
  { id: 'd-virao1', period: 'daily', kind: 'virao', title: 'Mesa limpia', description: 'Haz 1 virao en el Casino.', target: 1, reward: 40, game: 'casino' },
  { id: 'd-win-casino', period: 'daily', kind: 'win', title: 'Rey del Casino', description: 'Gana 1 partida de Casino.', target: 1, reward: 35, game: 'casino' },
];

/** Fondo de misiones semanales: cada semana se eligen 3. */
export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: 'w-win5', period: 'weekly', kind: 'win', title: 'Campeón semanal', description: 'Gana 5 partidas en cualquier modo.', target: 5, reward: 150 },
  { id: 'w-play15', period: 'weekly', kind: 'play', title: 'Maratonista', description: 'Juega 15 partidas en cualquier modo.', target: 15, reward: 120 },
  { id: 'w-modes3', period: 'weekly', kind: 'modesWon', title: 'Todoterreno', description: 'Gana en 3 modos distintos.', target: 3, reward: 150 },
  { id: 'w-capture60', period: 'weekly', kind: 'capture', title: 'Cazador experto', description: 'Captura 60 cartas en el Casino.', target: 60, reward: 130, game: 'casino' },
  { id: 'w-virao3', period: 'weekly', kind: 'virao', title: 'Rey del virao', description: 'Haz 3 viraos en el Casino.', target: 3, reward: 140, game: 'casino' },
  { id: 'w-win-casino3', period: 'weekly', kind: 'win', title: 'Casino a fondo', description: 'Gana 3 partidas de Casino.', target: 3, reward: 120, game: 'casino' },
];

export const MISSIONS_PER_PERIOD = 3;

export const ALL_MISSION_DEFS: MissionDef[] = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS];

export function missionDef(id: string): MissionDef | undefined {
  return ALL_MISSION_DEFS.find((def) => def.id === id);
}

/** Clave del día en hora local (AAAA-MM-DD). */
export function dayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Clave de la semana: el lunes que la abre, en hora local (AAAA-MM-DD). */
export function weekKey(date: Date = new Date()): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = monday.getDay(); // 0 = domingo
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  return dayKey(monday);
}

/** Generador pseudoaleatorio con semilla (mulberry32): la misma clave da siempre las mismas misiones. */
function seededRandom(seed: string): () => number {
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

/** Elige `count` definiciones distintas del fondo, en orden aleatorio con semilla. */
function pickMissions(pool: MissionDef[], key: string, count: number): MissionDef[] {
  const rng = seededRandom(key);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function freshProgress(defs: MissionDef[]): MissionProgress[] {
  return defs.map((def) => ({ id: def.id, progress: 0, claimed: false, games: [] }));
}

export function defaultMissions(date: Date = new Date()): MissionsState {
  return {
    dailyKey: dayKey(date),
    daily: freshProgress(pickMissions(DAILY_MISSIONS, `d-${dayKey(date)}`, MISSIONS_PER_PERIOD)),
    weeklyKey: weekKey(date),
    weekly: freshProgress(pickMissions(WEEKLY_MISSIONS, `w-${weekKey(date)}`, MISSIONS_PER_PERIOD)),
  };
}

/**
 * Pone al día el estado de misiones: si cambió el día o la semana, regenera ese periodo con las
 * misiones nuevas y deja el otro intacto. Función pura para poder probarla.
 */
export function refreshMissions(state: MissionsState, date: Date = new Date()): MissionsState {
  const today = dayKey(date);
  const week = weekKey(date);
  const next = { ...state };
  if (state.dailyKey !== today) {
    next.dailyKey = today;
    next.daily = freshProgress(pickMissions(DAILY_MISSIONS, `d-${today}`, MISSIONS_PER_PERIOD));
  }
  if (state.weeklyKey !== week) {
    next.weeklyKey = week;
    next.weekly = freshProgress(pickMissions(WEEKLY_MISSIONS, `w-${week}`, MISSIONS_PER_PERIOD));
  }
  return next;
}

/** Estadísticas de una partida terminada que pueden contar para las misiones. */
export interface MatchStats {
  game: GameId;
  /** 'win' o 'tie' cuentan como victoria para las misiones; 'loss' no. */
  outcome: 'win' | 'tie' | 'loss';
  /** Cartas capturadas por el jugador (solo Casino). */
  capturedCards?: number;
  /** Viraos del equipo del jugador (solo Casino). */
  viraos?: number;
}

function applyToMission(progress: MissionProgress, def: MissionDef, stats: MatchStats): MissionProgress {
  if (def.game !== undefined && def.game !== stats.game) return progress;
  const won = stats.outcome !== 'loss';
  switch (def.kind) {
    case 'win':
      return won ? { ...progress, progress: progress.progress + 1 } : progress;
    case 'play':
      return { ...progress, progress: progress.progress + 1 };
    case 'modesPlayed':
      if (progress.games.includes(stats.game)) return progress;
      return { ...progress, games: [...progress.games, stats.game], progress: progress.games.length + 1 };
    case 'modesWon':
      if (!won || progress.games.includes(stats.game)) return progress;
      return { ...progress, games: [...progress.games, stats.game], progress: progress.games.length + 1 };
    case 'capture':
      return { ...progress, progress: progress.progress + (stats.capturedCards ?? 0) };
    case 'virao':
      return { ...progress, progress: progress.progress + (stats.viraos ?? 0) };
  }
}

/**
 * Registra una partida terminada en las misiones y devuelve las que se completaron con esta partida
 * (las que pasaron de incompletas a completas). Las ya completadas no se vuelven a anunciar.
 */
export function applyMatch(
  state: MissionsState,
  stats: MatchStats,
  date: Date = new Date(),
): { state: MissionsState; completed: MissionDef[] } {
  const refreshed = refreshMissions(state, date);
  const completed: MissionDef[] = [];
  const advance = (list: MissionProgress[]): MissionProgress[] =>
    list.map((progress) => {
      const def = missionDef(progress.id);
      if (!def) return progress;
      const wasComplete = progress.progress >= def.target;
      const next = applyToMission(progress, def, stats);
      if (!wasComplete && next.progress >= def.target) completed.push(def);
      return next;
    });
  return { state: { ...refreshed, daily: advance(refreshed.daily), weekly: advance(refreshed.weekly) }, completed };
}

/** ¿Está completa esta misión? */
export function isMissionComplete(progress: MissionProgress): boolean {
  const def = missionDef(progress.id);
  return def !== undefined && progress.progress >= def.target;
}

/** Misiones completadas sin reclamar (para el distintivo del lobby). */
export function unclaimedCompleted(state: MissionsState): number {
  return [...state.daily, ...state.weekly].filter((p) => !p.claimed && isMissionComplete(p)).length;
}

/**
 * Reclama una misión completa. Devuelve las monedas otorgadas (0 si no estaba completa o ya se reclamó).
 * Quien llama suma las monedas al saldo; esta función solo marca la misión como reclamada.
 */
export function claimMission(
  state: MissionsState,
  period: MissionPeriod,
  id: string,
  date: Date = new Date(),
): { state: MissionsState; granted: number } {
  const refreshed = refreshMissions(state, date);
  const list = period === 'daily' ? refreshed.daily : refreshed.weekly;
  const progress = list.find((p) => p.id === id);
  const def = missionDef(id);
  if (!progress || !def || def.period !== period || progress.claimed || !isMissionComplete(progress)) {
    return { state: refreshed, granted: 0 };
  }
  const nextList = list.map((p) => (p.id === id ? { ...p, claimed: true } : p));
  const next = period === 'daily' ? { ...refreshed, daily: nextList } : { ...refreshed, weekly: nextList };
  return { state: next, granted: def.reward };
}

/** Tiempo que falta para el próximo reinicio, en texto corto ("5 h 23 min" o "2 d 4 h"). */
export function timeUntilReset(period: MissionPeriod, date: Date = new Date()): string {
  const now = date.getTime();
  let target: Date;
  if (period === 'daily') {
    target = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  } else {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + 7);
    target = monday;
  }
  const diffMs = Math.max(0, target.getTime() - now);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}
