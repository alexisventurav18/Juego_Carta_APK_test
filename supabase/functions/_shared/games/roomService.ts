import { isAvatarCode } from './avatar.ts';
import { botStep } from './bots.ts';
import { randomInt } from './cards.ts';
import { applyGameMove } from './engine.ts';
import { canStartGame, createGameState, createSoloPlayers, fillWithBots, GAMES, type GameState, isGameFinished, minValidPlayerCount } from './index.ts';
import { type GameId, isBotPlayer, type Player } from './shared.ts';
import { projectState } from './view.ts';

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
}

interface Auth {
  playerId: string;
  key: string;
}

export type RoomRequest =
  | ({ action: 'create'; game: GameId; solo?: boolean; name: string; avatar?: string } & Auth)
  | ({ action: 'join'; code: string; name: string; avatar?: string } & Auth)
  | ({ action: 'quickplay'; game: GameId; name: string; avatar?: string } & Auth)
  | ({ action: 'leave'; roomId: string } & Auth)
  | ({ action: 'view'; roomId: string } & Auth)
  | ({ action: 'start'; roomId: string; dealer?: number } & Auth)
  | ({ action: 'move'; roomId: string; move: unknown } & Auth)
  | ({ action: 'tick'; roomId: string; expectedVersion: number } & Auth);

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

export type RoomResponse = { ok: true; room: RoomView } | { ok: false; error: string };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_NAME_LENGTH = 24;
const JOIN_ATTEMPTS = 3;
const HOST_SEAT = 0;

const CONFLICT = 'La mesa cambió mientras jugabas. Revisa la jugada y vuelve a intentarlo.';

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
  const avatar = readAvatar(req);
  const human: Player = avatar ? { id: auth.playerId, name, avatar } : { id: auth.playerId, name };
  const players = req.solo === true ? createSoloPlayers(game, human) : [human];
  const stored = await store.create(
    { game, status: 'waiting', players, isPublic: false, createdAt: Date.now() },
    { state: null, keys: { [auth.playerId]: await hashKey(auth.key) } },
  );
  return { ok: true, room: toView(stored, 0) };
}

async function join(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const name = readName(req);
  const code = typeof req.code === 'string' ? req.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{3,12}$/.test(code)) throw new RoomError('No encontramos una sala con ese código.');

  for (let attempt = 0; attempt < JOIN_ATTEMPTS; attempt++) {
    const stored = await store.findByCode(code);
    if (!stored) throw new RoomError('No encontramos una sala con ese código.');
    const { room, secret } = stored;
    if (room.players.some((p) => p.id === auth.playerId)) {
      return { ok: true, room: toView(stored, await authenticate(stored, auth)) };
    }
    if (room.status !== 'waiting') throw new RoomError('Esa partida ya empezó.');
    if (room.players.length >= GAMES[room.game].maxPlayers) throw new RoomError('La sala está llena.');
    const avatar = readAvatar(req);
    const players = [...room.players, avatar ? { id: auth.playerId, name, avatar } : { id: auth.playerId, name }];
    const keys = { ...secret.keys, [auth.playerId]: await hashKey(auth.key) };
    const result = await commit(store, stored, { players, keys }, players.length - 1);
    if (result.ok) return result;
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
  const avatar = readAvatar(req);
  const now = Date.now();

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
      return (await maybeAutoStart(store, mine, seat, now)) ?? { ok: true, room: toView(mine, seat) };
    }
    const target = fresh[0];
    if (!target) {
      const human: Player = avatar ? { id: auth.playerId, name, avatar } : { id: auth.playerId, name };
      const stored = await store.create(
        { game, status: 'waiting', players: [human], isPublic: true, createdAt: now },
        { state: null, keys: { [auth.playerId]: await hashKey(auth.key) } },
      );
      return { ok: true, room: toView(stored, 0) };
    }
    const { room, secret } = target;
    const players = [...room.players, avatar ? { id: auth.playerId, name, avatar } : { id: auth.playerId, name }];
    const keys = { ...secret.keys, [auth.playerId]: await hashKey(auth.key) };
    const result = await commit(store, target, { players, keys }, players.length - 1);
    if (result.ok) {
      const joined = await loadById(store, target.room.id);
      return (await maybeAutoStart(store, joined, players.length - 1, now)) ?? result;
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
  const players = fillWithBots(room.game, room.players, target);
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
  if (seat !== HOST_SEAT) throw new RoomError('Solo quien creó la sala puede empezar la partida.');
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
  return commit(store, stored, { state: result.state }, seat);
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
  return commit(store, stored, { state: step.result.state }, seat);
}

async function view(store: RoomStore, req: Record<string, unknown>): Promise<RoomResponse> {
  const auth = readAuth(req);
  const stored = await loadById(store, readRoomId(req));
  const seat = await authenticate(stored, auth);
  return (await maybeAutoStart(store, stored, seat, Date.now())) ?? { ok: true, room: toView(stored, seat) };
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
      case 'view':
        return await view(store, req);
      case 'start':
        return await start(store, req);
      case 'move':
        return await move(store, req);
      case 'tick':
        return await tick(store, req);
      default:
        throw new RoomError('Acción no válida.');
    }
  } catch (err) {
    if (err instanceof RoomError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: 'Error interno del servidor. Inténtalo de nuevo.' };
  }
}
