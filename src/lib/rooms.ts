import type { GameState } from '@/games';
import type { GameId, Player } from '@/games/shared';
import { serverErrorMessage } from './functionsError';
import { getPlayerId, getPlayerKey } from './identity';
import { isValidChatPayload, ROOM_CHAT_EVENT, type RoomChatMessage } from './roomChat';
import { isValidRematchInvite, ROOM_REMATCH_INVITE_EVENT, type RematchInvite } from './roomRematch';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase';

export type RoomStatus = 'waiting' | 'playing';

/** Sala tal como la ve este jugador: `state` trae su mano y, de los demás, solo cuántas cartas tienen. */
export interface RoomRow {
  id: string;
  code: string;
  game: GameId;
  status: RoomStatus;
  players: Player[];
  state: GameState | null;
  version: number;
  /** True si es una sala de matchmaking ("Jugar online"). */
  isPublic: boolean;
  /** Cuándo se creó la sala (milisegundos desde epoch): manda en la cuenta atrás de la espera. */
  createdAt: number;
}

export type RoomConnectionStatus = 'connecting' | 'connected' | 'offline';

const FUNCTION_NAME = 'rooms';
const SERVER_UNREACHABLE =
  'No se pudo contactar con el servidor de partidas. Revisa tu conexión e inténtalo de nuevo.';

interface ServerResponse {
  ok: boolean;
  room?: RoomRow;
  error?: string;
}

/**
 * Llamada genérica a la Edge Function: añade `playerId` y `key`, preserva el
 * mensaje del servidor cuando rechaza y solo usa el genérico de "sin conexión"
 * si no hay ninguno (p. ej. fallo de red). Devuelve la respuesta tal cual.
 *
 * Si la clave local ya no vale (se rotó al restaurar la cuenta en otro
 * teléfono) y hay sesión de cuenta, se restaura en silencio UNA vez y se
 * reintenta la llamada. Así el teléfono viejo no queda bloqueado.
 */
export async function callRaw<T>(body: Record<string, unknown>): Promise<T> {
  return callWithRepair(() => callRawDirect<T>(body), tryAccountRepair);
}

/**
 * Orquesta un intento con UNA auto-reparación: si el intento falla con un
 * error de identidad y la reparación tiene éxito, se reintenta una sola
 * vez. Si la reparación falla o el reintento vuelve a fallar, sale el
 * error del último intento. Pura e inyectable para poder probarla sin red.
 */
export async function callWithRepair<T>(attempt: () => Promise<T>, repair: () => Promise<boolean>): Promise<T> {
  try {
    return await attempt();
  } catch (err) {
    if (err instanceof Error && isIdentityError(err.message) && (await repair())) {
      return attempt();
    }
    throw err;
  }
}

/**
 * Errores que significan "esta clave ya no es la del jugador": la clave se
 * rotó al restaurar la cuenta en otro teléfono (o el perfil cambió).
 * `readAuth` rechaza el formato; `authenticateProfile` y `checkProfileKey`
 * rechazan el hash; `authenticate` (salas) rechaza la clave de la sala.
 */
const IDENTITY_ERRORS = new Set([
  'Clave de jugador no válida.',
  'No pudimos verificar tu identidad.',
  'Ese jugador ya existe con otra clave.',
  'No estás en esta sala.',
]);

export function isIdentityError(message: string): boolean {
  return IDENTITY_ERRORS.has(message);
}

/** Restaura la identidad desde la cuenta (si hay sesión); false si no se pudo, sin lanzar. */
async function tryAccountRepair(): Promise<boolean> {
  try {
    // Import dinámico: `account.ts` importa este módulo; así no hay ciclo estático.
    const { restoreFromAccount } = await import('./account');
    return await restoreFromAccount();
  } catch {
    return false;
  }
}

/**
 * La misma llamada que `callRaw` pero SIN auto-reparación: para las acciones
 * de cuenta (`link_account`, `restore_account`...), que no deben reintentarse
 * con otra identidad si la clave falla.
 */
export async function callRawDirect<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { ...body, playerId: getPlayerId(), key: getPlayerKey() },
  });
  if (error) {
    // El servidor suele explicar el rechazo (sala llena, sala inexistente...): se
    // muestra ese mensaje y solo se usa el genérico de "sin conexión" si no hay
    // ninguno (p. ej. fallo de red).
    throw new Error((await serverErrorMessage(error)) ?? SERVER_UNREACHABLE);
  }
  const response = data as (T & { ok?: boolean; error?: string; data?: T }) | null;
  if (!response?.ok) throw new Error(response?.error ?? 'Respuesta inesperada del servidor.');
  // Las acciones de datos (ranking, amigos, torneo, premios) vienen envueltas
  // en { ok, data }: quien llama espera la carga pelada, no el sobre. Si se
  // devolviera el sobre, el modal leería data.friends sobre undefined y la
  // app quedaría en blanco al abrir Amigos (o el Ranking). Las acciones de
  // sala ({ ok, room }) no traen `data` y pasan tal cual.
  return response.data ?? response;
}

/** Todas las operaciones pasan por la Edge Function: el navegador no lee ni escribe las partidas directamente. */
async function call(body: Record<string, unknown>): Promise<RoomRow> {
  const response = await callRaw<ServerResponse>(body);
  if (!response.room) throw new Error('Respuesta inesperada del servidor.');
  return response.room;
}

export function createRoom(game: GameId, player: Player): Promise<RoomRow> {
  return call({ action: 'create', game, name: player.name, avatar: player.avatar, level: player.level });
}

export function createSoloRoom(game: GameId, player: Player): Promise<RoomRow> {
  return call({ action: 'create', game, solo: true, name: player.name, avatar: player.avatar, level: player.level });
}

export function joinRoom(code: string, player: Player): Promise<RoomRow> {
  return call({ action: 'join', code, name: player.name, avatar: player.avatar, level: player.level });
}

/** Matchmaking: entra en una sala pública en espera de ese juego o crea una. */
export function quickplayRoom(game: GameId, player: Player): Promise<RoomRow> {
  return call({ action: 'quickplay', game, name: player.name, avatar: player.avatar, level: player.level });
}

/** Salir de una sala en espera (si queda vacía, se borra). */
export function leaveRoom(roomId: string): Promise<RoomRow> {
  return call({ action: 'leave', roomId });
}

/**
 * Abandonar una partida ya empezada: un bot toma tu asiento (con tu mano) y
 * la partida sigue para los demás; si no queda ningún humano, la sala se
 * borra. Salir de una sala en espera sigue usando `leaveRoom`.
 */
export function abandonRoom(roomId: string): Promise<RoomRow> {
  return call({ action: 'abandon', roomId });
}

/**
 * Aviso de salida al cerrar la app: intenta liberar el asiento aunque la
 * página se esté cerrando (`keepalive`), sin esperar respuesta. Se usa la
 * acción `abandon`, que vale tanto en espera como en partida empezada. Si
 * no llega a enviarse, el cierre definitivo local (no reanudar la sala) ya
 * impide volver a esa pantalla de carga.
 */
export function leaveRoomBestEffort(roomId: string): void {
  try {
    void fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'abandon', roomId, playerId: getPlayerId(), key: getPlayerKey() }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Cierre de la app: no hay nada más que hacer.
  }
}

export function fetchRoom(roomId: string): Promise<RoomRow> {
  return call({ action: 'view', roomId });
}

/**
 * Pedir la revancha de una partida online terminada: el servidor crea una
 * sala nueva con el mismo juego (o devuelve la que ya se creó para esta
 * partida) y el cliente avisa a los demás por Broadcast (ver
 * `sendRematchInvite`). La sala nueva es pública y arranca sola a los ~30 s
 * completando con bots a los que no se unieron.
 */
export function requestRematch(roomId: string): Promise<RoomRow> {
  return call({ action: 'rematch', roomId });
}

/** Empieza (o repite) la partida. `dealer` solo se usa en Casino contra bots, tras el sorteo en pantalla. */
export function requestStart(roomId: string, dealer?: number): Promise<RoomRow> {
  return call({ action: 'start', roomId, dealer });
}

export function sendMove(roomId: string, move: unknown): Promise<RoomRow> {
  return call({ action: 'move', roomId, move });
}

/** Pide al servidor una jugada automática de los bots (solo si la versión sigue siendo la que ve el cliente). */
export function botTick(roomId: string, expectedVersion: number): Promise<RoomRow> {
  return call({ action: 'tick', roomId, expectedVersion });
}

export interface RoomSubscription {
  /** Deja de escuchar la sala (Realtime + canal). */
  unsubscribe: () => void;
  /** Envía un mensaje de chat por Broadcast a los demás jugadores de la sala. */
  sendChat: (msg: RoomChatMessage) => void;
  /** Avisa a los demás de la sala terminada que hay una revancha (Broadcast; el remitente no la recibe). */
  sendRematchInvite: (invite: RematchInvite) => Promise<void>;
}

/**
 * Avisa cuando la sala cambia. La sala pública no contiene cartas, así que el aviso solo trae la versión;
 * quien lo recibe pide su vista actualizada al servidor.
 *
 * El mismo canal `room:<id>` lleva también el chat de texto por Broadcast
 * (evento 'chat'): los mensajes llegan por `onChat` ya validados contra el
 * catálogo cerrado (ver `isValidChatPayload`); el remitente no recibe su
 * propio Broadcast, así que quien envía muestra su mensaje en local.
 * La invitación a la revancha viaja por el mismo canal (evento
 * 'rematch_invite') y llega por `onRematchInvite` ya validada.
 */
export function subscribeToRoom(
  roomId: string,
  onVersion: (version: number) => void,
  onStatus?: (status: RoomConnectionStatus) => void,
  onChat?: (msg: RoomChatMessage) => void,
  onRematchInvite?: (invite: RematchInvite) => void,
): RoomSubscription {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => onVersion((payload.new as { version: number }).version),
    )
    .on('broadcast', { event: ROOM_CHAT_EVENT }, ({ payload }) => {
      // Solo mensajes del catálogo cerrado: cualquier otra cosa se descarta en silencio.
      if (isValidChatPayload(payload)) onChat?.(payload);
    })
    .on('broadcast', { event: ROOM_REMATCH_INVITE_EVENT }, ({ payload }) => {
      // Solo invitaciones con forma válida: cualquier otra cosa se descarta en silencio.
      if (isValidRematchInvite(payload)) onRematchInvite?.(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus?.('connected');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus?.('offline');
      else onStatus?.('connecting');
    });
  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
    sendChat: (msg) => {
      void channel.send({ type: 'broadcast', event: ROOM_CHAT_EVENT, payload: msg });
    },
    sendRematchInvite: async (invite) => {
      await channel.send({ type: 'broadcast', event: ROOM_REMATCH_INVITE_EVENT, payload: invite });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Ranking, amigos y torneos                                           */
/*                                                                     */
/* Los puntos los pone el servidor al terminar cada partida (victoria = */
/* puntos del modo, empate la mitad, derrota 0); el cliente solo pide  */
/* y muestra. Las temporadas y los torneos también los define el       */
/* servidor: aquí no se calcula ninguna rotación ni clasificación.     */
/* ------------------------------------------------------------------ */

/** Una fila del ranking o de un torneo: puntos y balance del jugador. */
export interface RankingEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  points: number;
  wins: number;
  losses: number;
  matches: number;
  /** Puesto en la tabla, cuando el servidor lo incluye. */
  rank?: number;
}

export interface RankingBoard {
  /** Temporada que muestra la tabla (p. ej. "2026-11"). */
  season: string;
  entries: RankingEntry[];
  /** Mi fila (con mi puesto), o null si aún no tengo puntos. */
  me: RankingEntry | null;
}

/**
 * Tabla de clasificación. `game` filtra por modo; sin él (o 'all') es la
 * tabla general. `season` pide una temporada concreta; sin ella, la actual.
 */
export function rankingBoard(season?: string, game?: GameId | 'all'): Promise<RankingBoard> {
  const body: Record<string, unknown> = { action: 'ranking' };
  if (season) body.season = season;
  if (game && game !== 'all') body.game = game;
  return callRaw<RankingBoard>(body);
}

/** Un amigo de la lista: nivel, avatar y si está en línea o en partida. */
export interface FriendEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  online: boolean;
  inRoom: boolean;
}

/** Una solicitud de amistad (entrante o saliente). */
export interface FriendRequestEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
}

/** Una invitación a una sala privada, enviada por un amigo. */
export interface FriendInvite {
  from: string;
  fromName: string;
  code: string;
  game: GameId;
  createdAt: number;
}

export interface FriendsListData {
  /** Mi código de amigo, para compartirlo. */
  myCode: string;
  friends: FriendEntry[];
  pendingIn: FriendRequestEntry[];
  pendingOut: FriendRequestEntry[];
  invites: FriendInvite[];
}

/** Lista de amigos, solicitudes pendientes e invitaciones recibidas. */
export async function friendsList(): Promise<FriendsListData> {
  const list = await callRaw<FriendsListData>({ action: 'friends_list' });
  return normalizeFriendsList(list);
}

/** La lista nunca llega rota al modal: sin arrays no hay `.length` que rompa. */
function normalizeFriendsList(list: FriendsListData): FriendsListData {
  const entries = (rows: unknown): FriendEntry[] =>
    (Array.isArray(rows) ? rows : []).filter(
      (row): row is FriendEntry =>
        !!row && typeof (row as FriendEntry).playerId === 'string',
    );
  const requests = (rows: unknown): FriendRequestEntry[] =>
    (Array.isArray(rows) ? rows : []).filter(
      (row): row is FriendRequestEntry =>
        !!row && typeof (row as FriendRequestEntry).playerId === 'string',
    );
  return {
    myCode: typeof list?.myCode === 'string' ? list.myCode : '',
    friends: entries(list?.friends).map((friend) => {
      // El servidor manda el código de sala en `inRoom` (o null): el modal
      // solo necesita saber si está en partida o no.
      const rawInRoom = (friend as unknown as Record<string, unknown>).inRoom;
      return {
        ...friend,
        name: friend.name || 'Jugador',
        online: friend.online === true,
        inRoom: rawInRoom === true || typeof rawInRoom === 'string',
      };
    }),
    pendingIn: requests(list?.pendingIn).map((request) => ({ ...request, name: request.name || 'Jugador' })),
    pendingOut: requests(list?.pendingOut).map((request) => ({ ...request, name: request.name || 'Jugador' })),
    invites: (Array.isArray(list?.invites) ? list.invites : []).filter(
      (invite): invite is FriendInvite =>
        !!invite && typeof invite.code === 'string' && typeof invite.fromName === 'string',
    ),
  };
}

/** Un jugador encontrado por nombre o por código de amigo. */
export interface FriendSearchResult {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  /** Su código de amigo. */
  code: string;
}

export interface FriendSearchResponse {
  players: FriendSearchResult[];
}

/** Busca jugadores por nombre o por código de amigo. */
export async function friendSearch(query: string): Promise<FriendSearchResponse> {
  const res = await callRaw<FriendSearchResponse>({ action: 'friend_search', query });
  return {
    players: (Array.isArray(res?.players) ? res.players : []).filter(
      (player): player is FriendSearchResult =>
        !!player && typeof player.playerId === 'string',
    ),
  };
}

/** Envía una solicitud de amistad. */
export function friendRequest(targetId: string): Promise<{ ok: boolean }> {
  return callRaw<{ ok: boolean }>({ action: 'friend_request', targetId });
}

/** Acepta una solicitud de amistad entrante. */
export function friendAccept(requesterId: string): Promise<{ ok: boolean }> {
  return callRaw<{ ok: boolean }>({ action: 'friend_accept', requesterId });
}

/** Rechaza una solicitud de amistad entrante. */
export function friendReject(requesterId: string): Promise<{ ok: boolean }> {
  return callRaw<{ ok: boolean }>({ action: 'friend_reject', requesterId });
}

/** Elimina a un amigo de la lista. */
export function friendRemove(friendId: string): Promise<{ ok: boolean }> {
  return callRaw<{ ok: boolean }>({ action: 'friend_remove', friendId });
}

/**
 * Invita a un amigo a una sala privada: el servidor crea la sala y devuelve
 * su código y el modo. Quien invita entra a esa sala y espera; el amigo
 * recibe la invitación y se une con el mismo código.
 */
export function inviteFriend(friendId: string): Promise<{ ok: boolean; code: string; game: GameId }> {
  return callRaw<{ ok: boolean; code: string; game: GameId }>({ action: 'invite_friend', friendId });
}

export type TournamentStatus = 'upcoming' | 'active' | 'ended';

/** Una fila del torneo en curso (top 10). */
export interface TournamentEntry {
  playerId: string;
  name: string;
  avatar?: string;
  level?: number;
  points: number;
  wins: number;
  matches: number;
  rank?: number;
}

export interface TournamentData {
  /** El torneo próximo, activo o recién terminado; null si no hay ninguno. */
  tournament: {
    id: string;
    game: GameId;
    startsAt: number;
    endsAt: number;
    status: TournamentStatus;
  } | null;
  entries: TournamentEntry[];
  /** Mi fila (con mi puesto), o null si no estoy participando. */
  me: TournamentEntry | null;
}

/** El torneo del momento: modo, fechas, top 10 y mi posición. */
export function tournamentInfo(): Promise<TournamentData> {
  return callRaw<TournamentData>({ action: 'tournament' });
}

/** Premio reclamado: monedas y puesto conseguido. */
export interface PrizeClaim {
  coins: number;
  place: number;
  season?: string;
}

/**
 * Reclama el premio del torneo terminado. Si no hay premio pendiente, el
 * servidor lo rechaza y el error se muestra tal cual.
 */
export function tournamentClaim(): Promise<PrizeClaim> {
  return callRaw<PrizeClaim>({ action: 'tournament_claim' });
}

/** Reclama el premio de la temporada pasada, si quedé en el podio. */
export function seasonClaim(): Promise<PrizeClaim> {
  return callRaw<PrizeClaim>({ action: 'season_claim' });
}
