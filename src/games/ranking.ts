import { randomInt } from './cards';
import type { GameState } from './index';
import { teamOf, type GameId } from './shared';

/*
 * Ranking, temporadas y torneos: reglas puras del lado del servidor.
 *
 * - Puntos por partida: los mismos valores que las monedas por ganar
 *   (Casino 100, Tres y Dos 80, Robaíto 70, Cagao 60); empate la mitad,
 *   derrota 0. Solo suman los jugadores humanos (los bots no tienen perfil).
 * - Temporada: el mes en America/Santo_Domingo ('YYYY-MM').
 * - Torneo: cada fin de semana, de sábado 00:00 a domingo 23:59 en
 *   America/Santo_Domingo (sábado 04:00 UTC a lunes 04:00 UTC, porque la
 *   isla no tiene horario de verano). El juego rota por semana ISO:
 *   casino -> tresydos -> cagao -> robaito.
 */

export const RANK_POINTS: Record<GameId, number> = { casino: 100, tresydos: 80, robaito: 70, cagao: 60 };

export type MatchOutcome = 'win' | 'tie' | 'loss';

/** Puntos de ranking (y de torneo) por resultado en ese juego. */
export function pointsFor(game: GameId, outcome: MatchOutcome): number {
  const total = RANK_POINTS[game];
  if (outcome === 'win') return total;
  if (outcome === 'tie') return total / 2;
  return 0;
}

/** Premios en monedas para los 3 primeros (temporada y torneo). */
export const PRIZES = [500, 300, 150] as const;

/** Monedas por quedar en ese puesto (1-3); 0 fuera del podio. */
export function prizeForPlace(place: number): number {
  return place >= 1 && place <= 3 ? PRIZES[place - 1] : 0;
}

/** Alfabeto del código de amigo: sin 0/O/1/I para que no se confunda al dictarlo. */
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LENGTH = 6;

/** Código de amigo de 6 caracteres, aleatorio con crypto. */
export function makeFriendCode(): string {
  let code = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) code += FRIEND_CODE_ALPHABET[randomInt(FRIEND_CODE_ALPHABET.length)];
  return code;
}

/** America/Santo_Domingo es UTC-4 todo el año (sin horario de verano). */
const AST_OFFSET_MS = -4 * 60 * 60 * 1000;

interface AstParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

/** Año/mes/día/día de semana de esa fecha en Santo Domingo. */
function astParts(date: Date): AstParts {
  const ast = new Date(date.getTime() + AST_OFFSET_MS);
  return {
    year: ast.getUTCFullYear(),
    month: ast.getUTCMonth(),
    day: ast.getUTCDate(),
    weekday: ast.getUTCDay(),
  };
}

/** Temporada de esa fecha: 'YYYY-MM' en Santo Domingo. */
export function seasonId(date: Date): string {
  const { year, month } = astParts(date);
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Temporada anterior a la de esa fecha (la última completada). */
export function previousSeasonId(date: Date): string {
  const { year, month } = astParts(date);
  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  return `${prev.year}-${String(prev.month + 1).padStart(2, '0')}`;
}

/** Número de semana ISO (1-53) de esa fecha, en Santo Domingo. */
export function isoWeekNumber(date: Date): number {
  const { year, month, day } = astParts(date);
  const thursday = new Date(Date.UTC(year, month, day));
  const dow = (thursday.getUTCDay() + 6) % 7; // lunes = 0
  thursday.setUTCDate(thursday.getUTCDate() - dow + 3); // jueves de esta semana
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export const TOURNAMENT_GAMES: GameId[] = ['casino', 'tresydos', 'cagao', 'robaito'];

export type TournamentStatus = 'upcoming' | 'active' | 'finished';

export interface TournamentInfo {
  id: string;
  game: GameId;
  /** Inicio de la ventana (sábado 00:00 AST), en milisegundos desde epoch. */
  startsAt: number;
  /** Fin de la ventana (lunes 00:00 AST, exclusivo), en milisegundos desde epoch. */
  endsAt: number;
  status: TournamentStatus;
}

/** Milisegundos desde epoch del sábado 00:00 AST de esa fecha (el sábado más reciente). */
function saturdayStartMs(date: Date): number {
  const { year, month, day, weekday } = astParts(date);
  const daysSinceSaturday = (weekday + 1) % 7; // sábado = 0
  const saturday = new Date(Date.UTC(year, month, day - daysSinceSaturday));
  // 00:00 AST = 04:00 UTC.
  return saturday.getTime() + 4 * 60 * 60 * 1000;
}

/** El torneo del sábado que empieza en `saturdayStart` (ms desde epoch). */
function tournamentForSaturday(saturdayStart: number): TournamentInfo {
  const saturday = new Date(saturdayStart);
  const { year, month, day } = astParts(saturday);
  const game = TOURNAMENT_GAMES[isoWeekNumber(saturday) % TOURNAMENT_GAMES.length];
  return {
    id: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}-${game}`,
    game,
    startsAt: saturdayStart,
    endsAt: saturdayStart + 48 * 60 * 60 * 1000,
    status: 'active',
  };
}

/**
 * El torneo vigente en esa fecha: el del fin de semana que está corriendo
 * ('active', sábado y domingo) o el que acaba de terminar ('finished', de
 * lunes a viernes, con la tabla final y el premio por reclamar).
 */
export function currentTournament(date: Date): TournamentInfo {
  const tournament = tournamentForSaturday(saturdayStartMs(date));
  const now = date.getTime();
  return { ...tournament, status: now >= tournament.endsAt ? 'finished' : 'active' };
}

/** El torneo del próximo fin de semana ('upcoming'). */
export function nextTournament(date: Date): TournamentInfo {
  const tournament = tournamentForSaturday(saturdayStartMs(date) + 7 * 24 * 60 * 60 * 1000);
  return { ...tournament, status: 'upcoming' };
}

/** El torneo activo en esa fecha, o null si no hay ventana abierta. */
export function tournamentAt(date: Date): TournamentInfo | null {
  const tournament = currentTournament(date);
  return tournament.status === 'active' ? tournament : null;
}

/** El último torneo terminado en esa fecha (para reclamar su premio). */
export function lastFinishedTournament(date: Date): TournamentInfo {
  const current = currentTournament(date);
  if (current.status === 'finished') return current;
  const previous = tournamentForSaturday(saturdayStartMs(date) - 7 * 24 * 60 * 60 * 1000);
  return { ...previous, status: 'finished' };
}

export interface SeatOutcome {
  seat: number;
  outcome: MatchOutcome;
}

/**
 * Quién ganó, empató o perdió una partida terminada, leído del estado real
 * de cada juego:
 * - Casino: gana el equipo de `winnerTeam` (si es null, empate de todos:
 *   el desempate por picas siempre decide, pero sin datos se juega otra ronda).
 * - Tres y Dos: gana `winnerSeat`.
 * - El Cagao: pierden solo quien queda con el A♠ (`loserSeat`); los demás ganan.
 * - El Robaíto: gana el asiento de `winnerSeats`; si hay varios, empatan entre ellos.
 */
export function matchOutcomes(state: GameState): SeatOutcome[] {
  const seats = state.players.map((_, seat) => seat);
  if (state.game === 'casino') {
    if (state.winnerTeam === null) return seats.map((seat) => ({ seat, outcome: 'tie' as const }));
    return seats.map((seat) => ({
      seat,
      outcome: teamOf(seat) === state.winnerTeam ? ('win' as const) : ('loss' as const),
    }));
  }
  if (state.game === 'tresydos') {
    if (state.winnerSeat === null) return seats.map((seat) => ({ seat, outcome: 'tie' as const }));
    return seats.map((seat) => ({ seat, outcome: seat === state.winnerSeat ? ('win' as const) : ('loss' as const) }));
  }
  if (state.game === 'cagao') {
    if (state.loserSeat === null) return seats.map((seat) => ({ seat, outcome: 'tie' as const }));
    return seats.map((seat) => ({ seat, outcome: seat === state.loserSeat ? ('loss' as const) : ('win' as const) }));
  }
  if (state.winnerSeats.length === 0) return seats.map((seat) => ({ seat, outcome: 'tie' as const }));
  if (state.winnerSeats.length === 1) {
    return seats.map((seat) => ({
      seat,
      outcome: seat === state.winnerSeats[0] ? ('win' as const) : ('loss' as const),
    }));
  }
  const winners = new Set(state.winnerSeats);
  return seats.map((seat) => ({ seat, outcome: winners.has(seat) ? ('tie' as const) : ('loss' as const) }));
}
