import type { GameState } from '@/games';
import type { GameId, Player } from '@/games/shared';
import { serverErrorMessage } from './functionsError';
import { getPlayerId, getPlayerKey } from './identity';
import { isValidChatPayload, ROOM_CHAT_EVENT, type RoomChatMessage } from './roomChat';
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

/** Todas las operaciones pasan por la Edge Function: el navegador no lee ni escribe las partidas directamente. */
async function call(body: Record<string, unknown>): Promise<RoomRow> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { ...body, playerId: getPlayerId(), key: getPlayerKey() },
  });
  if (error) {
    // El servidor suele explicar el rechazo (sala llena, sala inexistente...): se
    // muestra ese mensaje y solo se usa el genérico de "sin conexión" si no hay
    // ninguno (p. ej. fallo de red).
    throw new Error((await serverErrorMessage(error)) ?? SERVER_UNREACHABLE);
  }
  const response = data as ServerResponse | null;
  if (!response?.ok || !response.room) throw new Error(response?.error ?? 'Respuesta inesperada del servidor.');
  return response.room;
}

export function createRoom(game: GameId, player: Player): Promise<RoomRow> {
  return call({ action: 'create', game, name: player.name, avatar: player.avatar });
}

export function createSoloRoom(game: GameId, player: Player): Promise<RoomRow> {
  return call({ action: 'create', game, solo: true, name: player.name, avatar: player.avatar });
}

export function joinRoom(code: string, player: Player): Promise<RoomRow> {
  return call({ action: 'join', code, name: player.name, avatar: player.avatar });
}

/** Matchmaking: entra en una sala pública en espera de ese juego o crea una. */
export function quickplayRoom(game: GameId, player: Player): Promise<RoomRow> {
  return call({ action: 'quickplay', game, name: player.name, avatar: player.avatar });
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
}

/**
 * Avisa cuando la sala cambia. La sala pública no contiene cartas, así que el aviso solo trae la versión;
 * quien lo recibe pide su vista actualizada al servidor.
 *
 * El mismo canal `room:<id>` lleva también el chat de texto por Broadcast
 * (evento 'chat'): los mensajes llegan por `onChat` ya validados contra el
 * catálogo cerrado (ver `isValidChatPayload`); el remitente no recibe su
 * propio Broadcast, así que quien envía muestra su mensaje en local.
 */
export function subscribeToRoom(
  roomId: string,
  onVersion: (version: number) => void,
  onStatus?: (status: RoomConnectionStatus) => void,
  onChat?: (msg: RoomChatMessage) => void,
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
  };
}
