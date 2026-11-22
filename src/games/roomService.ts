import { isAvatarCode } from './avatar';
import { botStep } from './bots';
import { randomInt } from './cards';
import { applyGameMove } from './engine';
import { canStartGame, createGameState, createSoloPlayers, fillWithBots, GAMES, type GameState, isGameFinished, minValidPlayerCount } from './index';
import {
  currentTournament,
  lastFinishedTournament,
  makeFriendCode,
  matchOutcomes,
  nextTournament,
  pointsFor,
  previousSeasonId,
  prizeForPlace,
  seasonId,
  tournamentAt,
  type MatchOutcome,
  type TournamentInfo,
} from './ranking';
import { type GameId, botLevelFor, hostSeat, isBotPlayer, MAX_LEVEL, type Player } from './shared';
import { projectState } from './view';

/*
 * Lógica del servidor de salas. No sabe de Supabase: recibe un `RoomStore`, así se prueba en memoria
 * y la Edge Function solo aporta el almacenamiento real.
 *
 * Modelo de seguridad:
 *  - El estado completo (manos, mazo) vive solo en el servidor (tabla room_secrets).
 *  - Cada jugador se identifica con su id (público) y una clave secreta que solo guarda su navegador;
 *    el servidor guarda únicamente el hash de la clave.
 *  - Los navegadores nunca escriben en la base de datos: piden jugadas y reciben su vista (projectState).
 */

export type RoomStatus = 'waiting' | 'playing';

export interface RoomRecord {
  id: string;
  code: string;
  game: GameId;
  status: RoomStatus;
  players: Player[];
  version: number;
  /** True si es una sala de matchmaking (se puede entrar con "Jugar online"). */
  isPublic: boolean;
  /** Cuándo se creó la sala (milisegundos desde epoch): manda en la espera y la caducidad. */
  createdAt: number;
}

export interface SecretRecord {
  state: GameState | null;
  /** id de jugador -> hash SHA-256 de su clave. */
  keys: Record<string, string>;
}

export interface StoredRoom {
  room: RoomRecord;
  secret: SecretRecord;
}

export interface RoomPatch {
  status: RoomStatus;
  players: Player[];
  state: GameState | null;
  keys: Record<string, string>;
  isPublic: boolean;
}

export interface RoomStore {
  findById(id: string): Promise<StoredRoom | null>;
  findByCode(code: string): Promise<StoredRoom | null>;
  /** Salas públicas en espera de ese juego, de la más vieja a la más nueva. */
  findWaiting(game: GameId): Promise<StoredRoom[]>;
  create(room: Pick<RoomRecord, 'game' | 'status' | 'players' | 'isPublic' | 'createdAt'>, secret: SecretRecord): Promise<StoredRoom>;
  /** Actualiza solo si la versión guardada sigue siendo `expectedVersion`; devuelve false si cambió. */
  update(roomId: string, expectedVersion: number, patch: RoomPatch): Promise<boolean>;
  /** Borra la sala (y sus secretos). Solo se usa cuando queda vacía. */
  remove(roomId: string): Promise<void>;
  // Perfiles y ranking.
  getProfile(playerId: string): Promise<PlayerProfile | null>;
  getProfileByFriendCode(code: string): Promise<PlayerProfile | null>;
  /**
   * Crea el perfil o actualiza nombre/avatar/nivel (el código de amigo no
   * cambia una vez creado). 'keyConflict' si el perfil existe con otra clave;
   * 'codeConflict' si el código de amigo ya lo tiene otro jugador.
   */
  upsertProfile(profile: PlayerProfile): Promise<'ok' | 'keyConflict' | 'codeConflict'>;
  /**
   * Otorga los puntos de una partida. Devuelve false si esa partida ya se
   * premió: la clave es sala+versión, porque una sala se reutiliza para la
   * revancha y cada partida debe premiarse una sola vez.
   */
  awardRanking(awardKey: string, season: string, game: GameId, results: AwardResult[]): Promise<boolean>;
  awardTournament(awardKey: string, tournamentId: string, results: AwardResult[]): Promise<boolean>;
  getRanking(season: string, game: GameId | 'all', limit: number): Promise<RankingEntry[]>;
  getRankingEntry(season: string, game: GameId | 'all', playerId: string): Promise<{ entry: RankingEntry; rank: number } | null>;
  // Amigos e invitaciones.
  listFriendships(playerId: string): Promise<{
    friends: PlayerProfile[];
    pendingIn: PlayerProfile[];
    pendingOut: PlayerProfile[];
  }>;
  /** 'accepted' cuando el otro ya te había pedido amistad: se acepta sola. */
  sendFriendRequest(requesterId: string, addresseeId: string): Promise<'ok' | 'accepted' | 'exists' | 'alreadyFriends' | 'notFound'>;
  respondFriendRequest(requesterId: string, addresseeId: string, accept: boolean): Promise<'ok' | 'notFound'>;
  removeFriendship(playerId: string, friendId: string): Promise<void>;
  searchPlayers(query: string, excludeId: string): Promise<PlayerProfile[]>;
  createInvite(fromId: string, toId: string, code: string, game: GameId): Promise<void>;
  listInvites(toId: string): Promise<InviteEntry[]>;
  acceptInvite(code: string, toId: string): Promise<void>;
  /** Jugadores en salas en espera o en partida: id -> código de sala. */
  listActivePlayers(): Promise<Map<string, string>>;
  // Torneos y premios.
  ensureTournament(tournament: { id: string; game: GameId; startsAt: number; endsAt: number }): Promise<void>;
  getTournamentEntries(tournamentId: string, limit: number): Promise<TournamentEntry[]>;
  getTournamentEntry(tournamentId: string, playerId: string): Promise<{ entry: TournamentEntry; rank: number } | null>;
  /** Reclama un premio del podio. Devuelve false si ya se reclamó. */
  claimPrize(scope: 'season' | 'tournament', key: string, playerId: string, place: number, coins: number): Promise<boolean>;
}

/** Perfil público de un jugador: su identidad es su id + su clave (sin cuentas). */
export interface PlayerProfile {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  keyHash: string;
  friendCode: string;
  updatedAt: number;
}

export interface RankingEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  points: number;
  wins: number;
  losses: number;
  matches: number;
}

export interface RankedEntry extends RankingEntry {
  rank: number;
}

export interface FriendEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  online: boolean;
  /** Código de la sala donde está (en espera o jugando), o null si no está en ninguna. */
  inRoom: string | null;
}

export interface FriendRequestEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
}

export interface InviteEntry {
  from: string;
  fromName: string;
  code: string;
  game: GameId;
  createdAt: number;
}

export interface TournamentEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  points: number;
  wins: number;
  matches: number;
}

export interface TournamentStanding extends TournamentEntry {
  rank: number;
}

/** Resultado de un jugador humano en una partida terminada, para premiarla. */
export interface AwardResult {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  points: number;
  outcome: MatchOutcome;
}

interface Auth {
  playerId: string;
  key: string;
}

export type RoomRequest =
  | ({ action: 'create'; game: GameId; solo?: boolean; name: string; avatar?: string; level?: number } & Auth)
  | ({ action: 'join'; code: string; name: string; avatar?: string; level?: number } & Auth)
  | ({ action: 'quickplay'; game: GameId; name: string; avatar?: string; level?: number } & Auth)
  | ({ action: 'leave'; roomId: string } & Auth)
  | ({ action: 'abandon'; roomId: string } & Auth)
  | ({ action: 'view'; roomId: string } & Auth)
  | ({ action: 'start'; roomId: string; dealer?: number } & Auth)
  | ({ action: 'move'; roomId: string; move: unknown } & Auth)
  | ({ action: 'tick'; roomId: string; expectedVersion: number } & Auth)
  | ({ action: 'ranking'; season?: string; game?: GameId | 'all' } & Auth)
  | ({ action: 'friends_list' } & Auth)
  | ({ action: 'friend_search'; query: string } & Auth)
  | ({ action: 'friend_request'; targetId: string } & Auth)
  | ({ action: 'friend_accept'; requesterId: string } & Auth)
  | ({ action: 'friend_reject'; requesterId: string } & Auth)
  | ({ action: 'friend_remove'; friendId: string } & Auth)
  | ({ action: 'invite_friend'; friendId: string; game?: GameId } & Auth)
  | ({ action: 'tournament' } & Auth)
  | ({ action: 'tournament_claim' } & Auth)
  | ({ action: 'season_claim' } & Auth);

export interface RoomView {
  id: string;
  code: string;
  game: GameId;
  status: RoomStatus;
  players: Player[];
  version: number;
  state: GameState | null;
  isPublic: boolean;
  createdAt: number;
}

/**
 * Respuestas de las acciones sociales (ranking, amigos, torneos, premios).
 * Las acciones de sala siguen devolviendo `{ ok: true, room }` como siempre.
 */
export type SocialPayload =
  | { kind: 'ranking'; season: string; entries: RankedEntry[]; me: RankedEntry | null }
  | {
      kind: 'friends';
      myCode: string;
      friends: FriendEntry[];
      pendingIn: FriendRequestEntry[];
      pendingOut: FriendRequestEntry[];
      invites: InviteEntry[];
    }
  | {
      kind: 'friendSearch';
      players: { playerId: string; name: string; avatar?: string; level?: number; code: string }[];
    }
  | { kind: 'friendRequest'; accepted: boolean }
  | { kind: 'invite'; code: string; game: GameId }
  | {
      kind: 'tournament';
      tournament: TournamentInfo;
      next: TournamentInfo;
      entries: TournamentStanding[];
      me: TournamentStanding | null;
    }
  | { kind: 'claim'; scope: 'season' | 'tournament'; ref: string; coins: number; place: number }
  | { kind: 'ok' };

export type RoomResponse =
  | { ok: true; room: RoomView }
  | { ok: true; data: SocialPayload }
  | { ok: false; error: string };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_NAME_LENGTH = 24;
const JOIN_ATTEMPTS = 3;
const CONFLICT = 'La mesa cambió mientras jugabas. Revisa la jugada y vuelve a intentarlo.';
/** Intentos de generar un código de amigo libre antes de rendirse (colisión casi imposible: 32^6). */
const FRIEND_CODE_ATTEMPTS = 6;
const SEASON_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Cuánto espera una sala pública a que se llene antes de completarse con bots y arrancar. */
export const QUICKPLAY_WAIT_MS = 30_000;
/** Una sala pública en espera más vieja que esto ya no se ofrece en matchmaking. */
export const QUICKPLAY_STALE_MS = 5 * 60_000;

class RoomError extends Error {}

export function makeRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new RoomError('Solicitud no válida.');
  return raw as Record<string, unknown>;
}

function readAuth(req: Record<string, unknown>): Auth {
  const { playerId, key } = req;
  if (typeof playerId !== 'string' || !ID_PATTERN.test(playerId) || /^bot-/i.test(playerId)) {
    throw new RoomError('Identificador de jugador no válido.');
  }
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) throw new RoomError('Clave de jugador no válida.');
  return { playerId, key };
}

function readName(req: Record<string, unknown>): string {
  const name = typeof req.name === 'string' ? req.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw new RoomError(`El nombre debe tener entre 1 y ${MAX_NAME_LENGTH} caracteres.`);
  }
  return name;
}

/** El avatar es opcional: si falta o no es válido se ignora (el cliente muestra uno estable). */
function readAvatar(req: Record<string, unknown>): string | undefined {
  return isAvatarCode(req.avatar) ? req.avatar : undefined;
}

/**
 * El nivel es opcional: si falta o no es un entero entre 1 y 100 se ignora
 * sin rechazar nada (un cliente viejo no lo envía y su placa no muestra
 * insignia). El cliente no puede inventarse un nivel mayor que el máximo.
 */
function readLevel(req: Record<string, unknown>): number | undefined {
  const level = req.level;
  return typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL
    ? level
    : undefined;
}

/** Jugador humano tal como se guarda en la sala: nombre, avatar y nivel si son válidos. */
function buildHuman(auth: Auth, name: string, avatar: string | undefined, level: number | undefined): Player {
  return {
    id: auth.playerId,
    name,
    ...(avatar ? { avatar } : {}),
    ...(level !== undefined ? { level } : {}),
  };
}

function profileToEntry(profile: PlayerProfile): FriendRequestEntry {
  return {
    playerId: profile.playerId,
    name: profile.name,
    ...(profile.avatar ? { avatar: profile.avatar } : {}),
    ...(profile.level !== undefined ? { level: profile.level } : {}),
  };
}

function readPlayerIdField(req: Record<string, unknown>, field: string): string {
  const value = req[field];
  if (typeof value !== 'string' || !ID_PATTERN.test(value) || /^bot-/i.test(value)) {
    throw new RoomError('Jugador no válido.');
  }
  return value;
}

/** Temporada pedida ('YYYY-MM'); si falta o no es válida, la actual. */
function readSeason(req: Record<string, unknown>): string {
  const season = req.season;
  if (typeof season === 'string' && SEASON_PATTERN.test(season)) return season;
  return seasonId(new Date(Date.now()));
}

/** Juego pedido para el ranking; si falta o no es válido, 'all' (todos los modos). */
function readRankingGame(req: Record<string, unknown>): GameId | 'all' {
  const game = req.game;
  if (game === 'casino' || game === 'tresydos' || game === 'cagao' || game === 'robaito') return game;
  return 'all';
}

/**
 * Confirma que (playerId, key) corresponde al perfil guardado. Las acciones
 * sociales no entran a ninguna sala, así que esta es su autenticación.
 */
async function authenticateProfile(store: RoomStore, auth: Auth): Promise<PlayerProfile> {
  const profile = await store.getProfile(auth.playerId);
  if (!profile) throw new RoomError('Aún no tienes perfil. Crea o entra a una sala primero.');
  if (!safeEqual(profile.keyHash, await hashKey(auth.key))) {
    throw new RoomError('No pudimos verificar tu identidad.');
  }
  return profile;
}

/**
 * Antes de crear o entrar a una sala: si el id ya tiene perfil con otra
 * clave, alguien intenta secuestrar esa identidad y se rechaza.
 */
async function checkProfileKey(store: RoomStore, playerId: string, keyHash: string): Promise<void> {
  const profile = await store.getProfile(playerId);
  if (profile && !safeEqual(profile.keyHash, keyHash)) {
    throw new RoomError('Ese jugador ya existe con otra clave.');
  }
}

/** Crea el perfil (o actualiza nombre/avatar/nivel); reintenta si el código de amigo choca con otro. */
async function saveProfile(
  store: RoomStore,
  auth: Auth,
  keyHash: string,
  name: string,
  avatar: string | undefined,
  level: number | undefined,
): Promise<void> {
  for (let attempt = 0; attempt < FRIEND_CODE_ATTEMPTS; attempt++) {
    const result = await store.upsertProfile({
      playerId: auth.playerId,
      name,
      avatar,
      level,
      keyHash,
      friendCode: makeFriendCode(),
      updatedAt: Date.now(),
    });
    if (result === 'ok') return;
    if (result === 'keyConflict') throw new RoomError('Ese jugador ya existe con otra clave.');
  }
  throw new RoomError('No se pudo crear tu perfil. Inténtalo de nuevo.');
}

/**
 * Guardar el perfil nunca debe tumbar la sala que ya se creó: si falla, se
 * registra y se reintenta la próxima vez que el jugador cree o entre a una sala.
 */
async function saveProfileBestEffort(
  store: RoomStore,
  auth: Auth,
  keyHash: string,
  name: string,
  avatar: string | undefined,
  level: number | undefined,
): Promise<void> {
  try {
    await saveProfile(store, auth, keyHash, name, avatar, level);
  } catch (err) {
    console.error('No se pudo guardar el perfil del jugador', err);
  }
}

/** Algo que puede fallar sin afectar la respuesta (aceptar una invitación al entrar por código). */
async function bestEffort(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch (err) {
    console.error('Acción secundaria falló', err);
  }
}

/**
 * Otorga los puntos de una partida terminada: ranking de la temporada y, si
 * la partida es del juego del torneo vigente y terminó dentro de su ventana,
 * puntos de torneo. Solo suman los humanos, y solo si la partida tuvo al
 * menos 2 humanos: una partida en solitario contra bots no da puntos, para
 * que no se puedan farmear. Idempotente por sala+versión
 * (ver `RoomStore.awardRanking`): una revancha en la misma sala es otra
 * partida y se premia aparte, pero la misma partida nunca suma dos veces.
 */
async function awardMatchResults(
  store: RoomStore,
  room: RoomRecord,
  state: GameState,
  version: number,
  now: number,
): Promise<void> {
  const results: AwardResult[] = matchOutcomes(state)
    .filter(({ seat }) => !isBotPlayer(state.players[seat]))
    .map(({ seat, outcome }) => {
      const player = state.players[seat];
      return {
        playerId: player.id,
        name: player.name,
        avatar: player.avatar,
        level: player.level,
        points: pointsFor(room.game, outcome),
        outcome,
      };
    });
  if (results.length < 2) return;
  const awardKey = `${room.id}:${version}`;
  await store.awardRanking(awardKey, seasonId(new Date(now)), room.game, results);
  const tournament = tournamentAt(new Date(now));
  if (tournament && tournament.game === room.game) {
    await store.awardTournament(awardKey, tournament.id, results);
  }
}

/** Tras una jugada que termina la partida, premia sin tumbar la jugada si el premio falla. */
async function awardIfGameOver(store: RoomStore, room: RoomRecord, state: GameState, version: number): Promise<void> {
  if (state.phase !== 'gameOver') return;
  try {
    await awardMatchResults(store, room, state, version, Date.now());
  } catch (err) {
    console.error('No se pudieron otorgar los puntos de la partida', err);
  }
}

function readRoomId(req: Record<string, unknown>): string {
  if (typeof req.roomId !== 'string' || !UUID_PATTERN.test(req.roomId)) throw new RoomError('Esta sala ya no existe.');
  return req.roomId;
}

function toView(stored: StoredRoom, seat: number): RoomView {
  const { room, secret } = stored;
  return {
    id: room.id,
    code: room.code,
    game: room.game,
    status: room.status,
    players: room.players,
    version: room.version,
    state: secret.state ? projectState(secret.state, seat) : null,
    isPublic: room.isPublic,
    createdAt: room.createdAt,
  };
}

/** Confirma que la clave corresponde al jugador y devuelve su asiento. */
async function authenticate(stored: StoredRoom, auth: Auth): Promise<number> {
  const seat = stored.room.players.findIndex((p) => p.id === auth.playerId);
  const expected = stored.secret.keys[auth.playerId];
  if (seat === -1 || !expected) throw new RoomError('No estás en esta sala.');
  if (!safeEqual(expected, await hashKey(auth.key))) throw new RoomError('No estás en esta sala.');
  return seat;
}

async function loadById(store: RoomStore, roomId: string): Promise<StoredRoom> {
  const stored = await store.findById(roomId);
  if (!stored) throw new RoomError('Esta sala ya no existe.');
  return stored;
}

async function commit(store: RoomStore, stored: StoredRoom, patch: Partial<RoomPatch>, seat: number): Promise<RoomResponse> {
  // Se copia todo antes de guardar: el almacén podría reutilizar el mismo objeto.
  const baseRoom = { ...stored.room };
  const next: RoomPatch = {
    status: patch.status ?? baseRoom.status,
    players: patch.players ?? baseRoom.players,
    state: patch.state === undefined ? stored.secret.state : patch.state,
    keys: patch.keys ?? stored.secret.keys,
    isPublic: patch.isPublic ?? baseRoom.isPublic,
  };
  const updated = await store.update(baseRoom.id, baseRoom.version, next);
  if (!updated) return { ok: false, error: CONFLICT };
  const room: RoomRecord = { ...baseRoom, status: next.status, players: next.players, version: baseRoom.version + 1, isPublic: next.isPublic };
  return { ok: true, room: toView({ room, secret: { state: next.state, keys: next.keys } }, seat) };
}

async function create(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const name = readName(req);
  if (typeof req.game !== 'string' || !(req.game in GAMES)) throw new RoomError('Juego no válido.');
  const game = req.game as GameId;
  const keyHash = await hashKey(auth.key);
  await checkProfileKey(store, auth.playerId, keyHash);
  const avatar = readAvatar(req);
  const level = readLevel(req);
  const human = buildHuman(auth, name, avatar, level);
  // Contra bots, los bots se sientan cerca de tu nivel (±5).
  const players = req.solo === true ? createSoloPlayers(game, human, GAMES[game].soloPlayerCount, () => botLevelFor(human.level ?? 1)) : [human];
  const stored = await store.create(
    { game, status: 'waiting', players, isPublic: false, createdAt: Date.now() },
    { state: null, keys: { [auth.playerId]: keyHash } },
  );
  await saveProfileBestEffort(store, auth, keyHash, name, avatar, level);
  return { ok: true, room: toView(stored, 0) };
}

async function join(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const name = readName(req);
  const code = typeof req.code === 'string' ? req.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{3,12}$/.test(code)) throw new RoomError('No encontramos una sala con ese código.');
  const keyHash = await hashKey(auth.key);
  await checkProfileKey(store, auth.playerId, keyHash);
  const avatar = readAvatar(req);
  const level = readLevel(req);

  for (let attempt = 0; attempt < JOIN_ATTEMPTS; attempt++) {
    const stored = await store.findByCode(code);
    if (!stored) throw new RoomError('No encontramos una sala con ese código.');
    const { room, secret } = stored;
    if (room.players.some((p) => p.id === auth.playerId)) {
      const seat = await authenticate(stored, auth);
      await saveProfileBestEffort(store, auth, keyHash, name, avatar, level);
      await bestEffort(store.acceptInvite(code, auth.playerId));
      return { ok: true, room: toView(stored, seat) };
    }
    if (room.status !== 'waiting') throw new RoomError('Esa partida ya empezó.');
    if (room.players.length >= GAMES[room.game].maxPlayers) throw new RoomError('La sala está llena.');
    const players = [...room.players, buildHuman(auth, name, avatar, level)];
    const keys = { ...secret.keys, [auth.playerId]: keyHash };
    const result = await commit(store, stored, { players, keys }, players.length - 1);
    if (result.ok) {
      await saveProfileBestEffort(store, auth, keyHash, name, avatar, level);
      await bestEffort(store.acceptInvite(code, auth.playerId));
      return result;
    }
  }
  throw new RoomError('La sala cambió mientras intentabas entrar. Inténtalo de nuevo.');
}

/**
 * Matchmaking ("Jugar online"): mete al jugador en la sala pública en espera
 * más vieja de ese juego que tenga hueco, o crea una si no hay ninguna.
 * Las salas privadas (con código) y las que llevan más de QUICKPLAY_STALE_MS
 * en espera no se ofrecen. Si al entrar la sala queda llena, arranca sola.
 */
async function quickplay(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const name = readName(req);
  if (typeof req.game !== 'string' || !(req.game in GAMES)) throw new RoomError('Juego no válido.');
  const game = req.game as GameId;
  const keyHash = await hashKey(auth.key);
  await checkProfileKey(store, auth.playerId, keyHash);
  const avatar = readAvatar(req);
  const level = readLevel(req);
  const human = buildHuman(auth, name, avatar, level);
  const now = Date.now();
  const done = async (result: RoomResponse): Promise<RoomResponse> => {
    if (result.ok) await saveProfileBestEffort(store, auth, keyHash, name, avatar, level);
    return result;
  };

  for (let attempt = 0; attempt < JOIN_ATTEMPTS; attempt++) {
    const waiting = await store.findWaiting(game);
    const fresh = waiting.filter(
      (stored) =>
        stored.room.status === 'waiting' &&
        now - stored.room.createdAt <= QUICKPLAY_STALE_MS &&
        stored.room.players.length < GAMES[game].maxPlayers,
    );
    const mine = fresh.find((stored) => stored.room.players.some((p) => p.id === auth.playerId));
    if (mine) {
      const seat = await authenticate(mine, auth);
      return done((await maybeAutoStart(store, mine, seat, now)) ?? { ok: true, room: toView(mine, seat) });
    }
    const target = fresh[0];
    if (!target) {
      const stored = await store.create(
        { game, status: 'waiting', players: [human], isPublic: true, createdAt: now },
        { state: null, keys: { [auth.playerId]: keyHash } },
      );
      return done({ ok: true, room: toView(stored, 0) });
    }
    const { room, secret } = target;
    const players = [...room.players, human];
    const keys = { ...secret.keys, [auth.playerId]: keyHash };
    const result = await commit(store, target, { players, keys }, players.length - 1);
    if (result.ok) {
      const joined = await loadById(store, target.room.id);
      return done((await maybeAutoStart(store, joined, players.length - 1, now)) ?? result);
    }
  }
  throw new RoomError('No se pudo entrar a una partida. Inténtalo de nuevo.');
}

/**
 * Salir de una sala en espera. Si queda vacía se borra; si no, se quita al
 * jugador de la lista. En una partida empezada ya no se puede salir así.
 */
async function leave(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const stored = await loadById(store, readRoomId(req));
  const seat = await authenticate(stored, auth);
  const { room } = stored;
  if (room.status !== 'waiting') throw new RoomError('La partida ya empezó.');
  const players = room.players.filter((p) => p.id !== auth.playerId);
  if (players.length === 0) {
    await store.remove(room.id);
    return { ok: true, room: { ...toView(stored, seat), players: [], version: room.version + 1 } };
  }
  return commit(store, stored, { players }, seat);
}

/**
 * Abandonar una partida: vale en espera y en partida empezada.
 *
 * - En espera hace lo mismo que `leave`: quita al jugador (y borra la sala
 *   si queda vacía).
 * - En partida empezada un bot toma su asiento, con su misma mano, y la
 *   partida sigue para los demás: el estado es por asiento, así que cambiar
 *   solo el jugador de ese asiento no mueve nada. Su clave se borra, así que
 *   ya no puede volver a entrar. Si no queda ningún humano, la sala se borra
 *   (sin nadie que pida los turnos de los bots, la partida quedaría colgada).
 */
async function abandon(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const stored = await loadById(store, readRoomId(req));
  const seat = await authenticate(stored, auth);
  const { room } = stored;
  if (room.status === 'waiting') return leave(store, req);
  const withoutLeaver = room.players.filter((p) => p.id !== auth.playerId);
  if (!withoutLeaver.some((p) => !isBotPlayer(p))) {
    await store.remove(room.id);
    return { ok: true, room: { ...toView(stored, seat), players: [], version: room.version + 1 } };
  }
  // Un bot nuevo en el asiento del que sale (nombre e id sin repetir).
  // Conserva el nivel del que sale para que su placa no cambie de golpe;
  // si no tenía nivel, el bot se sienta cerca de otro humano de la mesa.
  const leaver = room.players.find((p) => p.id === auth.playerId);
  const anchor = withoutLeaver.find((p) => !isBotPlayer(p))?.level ?? 1;
  const completed = fillWithBots(room.game, withoutLeaver, withoutLeaver.length + 1, () =>
    leaver?.level !== undefined ? leaver.level : botLevelFor(anchor),
  );
  const bot = completed[completed.length - 1];
  const players = room.players.map((p) => (p.id === auth.playerId ? bot : p));
  const state = stored.secret.state ? { ...stored.secret.state, players } : null;
  const keys = { ...stored.secret.keys };
  delete keys[auth.playerId];
  return commit(store, stored, { players, state, keys }, seat);
}

/**
 * Arranque automático de una sala pública en espera. Lo dispara cualquier
 * jugador de la sala al consultarla (view/tick) o al entrar (quickplay): no
 * depende de quién sea el anfitrión. Arranca cuando se llena, o cuando pasa
 * QUICKPLAY_WAIT_MS, completando con bots hasta la menor cantidad válida.
 * Devuelve la vista actualizada si arrancó, o null si todavía hay que esperar.
 * Si otro jugador ya la arrancó (conflicto de versión), devuelve su vista.
 */
async function maybeAutoStart(
  store: RoomStore,
  stored: StoredRoom,
  seat: number,
  now: number,
): Promise<RoomResponse | null> {
  const { room } = stored;
  if (room.status !== 'waiting' || !room.isPublic) return null;
  if (!room.players.some((p) => !isBotPlayer(p))) return null;
  const full = room.players.length >= GAMES[room.game].maxPlayers;
  if (!full && now - room.createdAt < QUICKPLAY_WAIT_MS) return null;
  const target = minValidPlayerCount(room.game, room.players.length);
  // Los bots que completan la mesa se sientan cerca del nivel del primer humano.
  const anchor = room.players.find((p) => !isBotPlayer(p))?.level ?? 1;
  const players = fillWithBots(room.game, room.players, target, () => botLevelFor(anchor));
  const state = createGameState(room.game, players);
  const result = await commit(store, stored, { status: 'playing', players, state }, seat);
  if (result.ok) return result;
  const fresh = await loadById(store, room.id);
  return { ok: true, room: toView(fresh, fresh.room.players.findIndex((p) => p.id === stored.room.players[seat]?.id)) };
}

async function start(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const stored = await loadById(store, readRoomId(req));
  const seat = await authenticate(stored, auth);
  const { room, secret } = stored;
  // Anfitrión efectivo: si quien creó la sala abandonó, su asiento lo ocupa
  // un bot y el primer humano que queda hereda el papel (ver `hostSeat`).
  if (seat !== hostSeat(room.players)) throw new RoomError('Solo quien creó la sala puede empezar la partida.');
  if (room.status === 'playing' && secret.state && !isGameFinished(secret.state)) {
    throw new RoomError('La partida ya está en curso.');
  }
  if (!canStartGame(room.game, room.players.length)) {
    throw new RoomError(`Este juego necesita ${GAMES[room.game].playerCountLabel.toLowerCase()}.`);
  }
  // Contra bots el sorteo de quién reparte se hace en la pantalla; entre personas lo decide el servidor.
  const dealer =
    room.game === 'casino' &&
    room.players.some(isBotPlayer) &&
    typeof req.dealer === 'number' &&
    Number.isInteger(req.dealer) &&
    req.dealer >= 0 &&
    req.dealer < room.players.length
      ? req.dealer
      : undefined;
  const state = createGameState(room.game, room.players, dealer);
  return commit(store, stored, { status: 'playing', state }, seat);
}

async function move(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const stored = await loadById(store, readRoomId(req));
  const seat = await authenticate(stored, auth);
  const state = stored.secret.state;
  if (stored.room.status !== 'playing' || !state) throw new RoomError('La partida todavía no empieza.');
  const result = applyGameMove(state, seat, req.move);
  if ('error' in result) throw new RoomError(result.error);
  const committed = await commit(store, stored, { state: result.state }, seat);
  if (committed.ok && 'room' in committed) await awardIfGameOver(store, stored.room, result.state, committed.room.version);
  return committed;
}

async function tick(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const stored = await loadById(store, readRoomId(req));
  const seat = await authenticate(stored, auth);
  const started = await maybeAutoStart(store, stored, seat, Date.now());
  if (started) return started;
  const state = stored.secret.state;
  const unchanged: RoomResponse = { ok: true, room: toView(stored, seat) };
  if (!state || stored.room.status !== 'playing' || !stored.room.players.some(isBotPlayer)) return unchanged;
  // Si otro ya movió (la versión cambió), no se duplica el turno del bot.
  if (req.expectedVersion !== stored.room.version) return unchanged;
  const step = botStep(state);
  if (!step) return unchanged;
  if ('error' in step.result) throw new RoomError(step.result.error);
  const committed = await commit(store, stored, { state: step.result.state }, seat);
  if (committed.ok && 'room' in committed) await awardIfGameOver(store, stored.room, step.result.state, committed.room.version);
  return committed;
}

async function view(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const stored = await loadById(store, readRoomId(req));
  const seat = await authenticate(stored, auth);
  return (await maybeAutoStart(store, stored, seat, Date.now())) ?? { ok: true, room: toView(stored, seat) };
}

async function ranking(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const season = readSeason(req);
  const game = readRankingGame(req);
  const entries = await store.getRanking(season, game, 100);
  const me = await store.getRankingEntry(season, game, auth.playerId);
  return {
    ok: true,
    data: {
      kind: 'ranking',
      season,
      entries: entries.map((entry, i) => ({ ...entry, rank: i + 1 })),
      me: me ? { ...me.entry, rank: me.rank } : null,
    },
  };
}

async function friendsList(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const profile = await authenticateProfile(store, auth);
  const { friends, pendingIn, pendingOut } = await store.listFriendships(auth.playerId);
  const active = await store.listActivePlayers();
  const invites = await store.listInvites(auth.playerId);
  return {
    ok: true,
    data: {
      kind: 'friends',
      myCode: profile.friendCode,
      friends: friends.map((friend) => ({
        ...profileToEntry(friend),
        online: active.has(friend.playerId),
        inRoom: active.get(friend.playerId) ?? null,
      })),
      pendingIn: pendingIn.map(profileToEntry),
      pendingOut: pendingOut.map(profileToEntry),
      invites,
    },
  };
}

async function friendSearch(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const query = typeof req.query === 'string' ? req.query.trim() : '';
  if (query.length === 0 || query.length > MAX_NAME_LENGTH) {
    throw new RoomError('Escribe un nombre o un código para buscar.');
  }
  const players = await store.searchPlayers(query, auth.playerId);
  return {
    ok: true,
    data: {
      kind: 'friendSearch',
      players: players.map((player) => ({ ...profileToEntry(player), code: player.friendCode })),
    },
  };
}

async function friendRequest(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const targetId = readPlayerIdField(req, 'targetId');
  if (targetId === auth.playerId) throw new RoomError('No puedes agregarte a ti mismo.');
  const result = await store.sendFriendRequest(auth.playerId, targetId);
  if (result === 'notFound') throw new RoomError('No encontramos a ese jugador.');
  if (result === 'alreadyFriends') throw new RoomError('Ya son amigos.');
  if (result === 'exists') throw new RoomError('Ya le enviaste una solicitud.');
  return { ok: true, data: { kind: 'friendRequest', accepted: result === 'accepted' } };
}

async function friendRespond(store: RoomStore, req: Record<string, unknown>, accept: boolean): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const requesterId = readPlayerIdField(req, 'requesterId');
  const result = await store.respondFriendRequest(requesterId, auth.playerId, accept);
  if (result === 'notFound') throw new RoomError('No hay una solicitud pendiente de ese jugador.');
  return { ok: true, data: { kind: 'ok' } };
}

async function friendRemove(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const friendId = readPlayerIdField(req, 'friendId');
  await store.removeFriendship(auth.playerId, friendId);
  return { ok: true, data: { kind: 'ok' } };
}

/**
 * Invita a un amigo a una sala privada nueva y le deja la invitación para
 * que entre con el código. El juego se puede pedir (`game`); si no, Casino.
 */
async function inviteFriend(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const profile = await authenticateProfile(store, auth);
  const friendId = readPlayerIdField(req, 'friendId');
  const game: GameId = typeof req.game === 'string' && req.game in GAMES ? (req.game as GameId) : 'casino';
  const { friends } = await store.listFriendships(auth.playerId);
  if (!friends.some((friend) => friend.playerId === friendId)) {
    throw new RoomError('Solo puedes invitar a un amigo.');
  }
  const human: Player = {
    id: auth.playerId,
    name: profile.name,
    ...(profile.avatar ? { avatar: profile.avatar } : {}),
    ...(profile.level !== undefined ? { level: profile.level } : {}),
  };
  const stored = await store.create(
    { game, status: 'waiting', players: [human], isPublic: false, createdAt: Date.now() },
    { state: null, keys: { [auth.playerId]: profile.keyHash } },
  );
  await store.createInvite(auth.playerId, friendId, stored.room.code, game);
  return { ok: true, data: { kind: 'invite', code: stored.room.code, game } };
}

async function tournament(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const now = new Date(Date.now());
  const current = currentTournament(now);
  const next = nextTournament(now);
  await store.ensureTournament({ id: current.id, game: current.game, startsAt: current.startsAt, endsAt: current.endsAt });
  const entries = await store.getTournamentEntries(current.id, 10);
  const me = await store.getTournamentEntry(current.id, auth.playerId);
  return {
    ok: true,
    data: {
      kind: 'tournament',
      tournament: {
        id: current.id,
        game: current.game,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        status: current.status,
      },
      next: { id: next.id, game: next.game, startsAt: next.startsAt, endsAt: next.endsAt, status: next.status },
      entries: entries.map((entry, i) => ({ ...entry, rank: i + 1 })),
      me: me ? { ...me.entry, rank: me.rank } : null,
    },
  };
}

async function claimTournamentPrize(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const finished = lastFinishedTournament(new Date(Date.now()));
  const entries = await store.getTournamentEntries(finished.id, 3);
  const place = entries.findIndex((entry) => entry.playerId === auth.playerId) + 1;
  if (place === 0) throw new RoomError('No quedaste entre los 3 primeros del torneo.');
  const coins = prizeForPlace(place);
  const claimed = await store.claimPrize('tournament', finished.id, auth.playerId, place, coins);
  if (!claimed) throw new RoomError('Ya reclamaste este premio.');
  return { ok: true, data: { kind: 'claim', scope: 'tournament', ref: finished.id, coins, place } };
}

async function claimSeasonPrize(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const season = previousSeasonId(new Date(Date.now()));
  const entries = await store.getRanking(season, 'all', 3);
  const place = entries.findIndex((entry) => entry.playerId === auth.playerId) + 1;
  if (place === 0) throw new RoomError('No quedaste entre los 3 primeros de la temporada.');
  const coins = prizeForPlace(place);
  const claimed = await store.claimPrize('season', season, auth.playerId, place, coins);
  if (!claimed) throw new RoomError('Ya reclamaste este premio.');
  return { ok: true, data: { kind: 'claim', scope: 'season', ref: season, coins, place } };
}

export async function handleRequest(store: RoomStore, raw: unknown): Promise<RoomResponse> {
  try {
    const req = asRecord(raw);
    switch (req.action) {
      case 'create':
        return await create(store, req);
      case 'join':
        return await join(store, req);
      case 'quickplay':
        return await quickplay(store, req);
      case 'leave':
        return await leave(store, req);
      case 'abandon':
        return await abandon(store, req);
      case 'view':
        return await view(store, req);
      case 'start':
        return await start(store, req);
      case 'move':
        return await move(store, req);
      case 'tick':
        return await tick(store, req);
      case 'ranking':
        return await ranking(store, req);
      case 'friends_list':
        return await friendsList(store, req);
      case 'friend_search':
        return await friendSearch(store, req);
      case 'friend_request':
        return await friendRequest(store, req);
      case 'friend_accept':
        return await friendRespond(store, req, true);
      case 'friend_reject':
        return await friendRespond(store, req, false);
      case 'friend_remove':
        return await friendRemove(store, req);
      case 'invite_friend':
        return await inviteFriend(store, req);
      case 'tournament':
        return await tournament(store, req);
      case 'tournament_claim':
        return await claimTournamentPrize(store, req);
      case 'season_claim':
        return await claimSeasonPrize(store, req);
      default:
        throw new RoomError('Acción no válida.');
    }
  } catch (err) {
    if (err instanceof RoomError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: 'Error interno del servidor. Inténtalo de nuevo.' };
  }
}
