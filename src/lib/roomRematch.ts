import { GAMES } from '../games';
import { isBotPlayer, type GameId, type Player } from '../games/shared';

/**
 * Invitación a la revancha online: quien pide la revancha avisa a los demás
 * humanos de la partida terminada por Supabase Realtime Broadcast, en el
 * mismo canal `room:<id>` que ya usa la sala (ver `subscribeToRoom`).
 * Quien la recibe entra a la sala nueva con un toque, sin escribir código.
 */

/** Nombre del evento de Broadcast dentro del canal de la sala terminada. */
export const ROOM_REMATCH_INVITE_EVENT = 'rematch_invite';

/** Cuánto dura visible el aviso de revancha: la sala nueva arranca sola a los ~30 s. */
export const REMATCH_INVITE_MS = 40_000;

export interface RematchInvite {
  /** Código de la sala nueva (como los códigos de sala). */
  code: string;
  game: GameId;
  fromId: string;
  fromName: string;
  /** Cuándo se envió (milisegundos desde epoch). */
  at: number;
}

/** Los códigos de sala que crea el servidor: 5 caracteres, mismo patrón que acepta `join`. */
const CODE_PATTERN = /^[A-Z0-9]{3,12}$/;

/** Los nombres de jugador en el servidor tienen como máximo 24 caracteres. */
const MAX_NAME_LENGTH = 24;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Valida en RECEPCIÓN una invitación a la revancha que llega por Broadcast.
 * Solo pasa lo que tiene forma de invitación real: código de sala, juego
 * válido, remitente humano y nombre dentro del límite. Todo lo demás se
 * descarta en silencio, así ni un cliente modificado puede inyectar avisos.
 */
export function isValidRematchInvite(raw: unknown): raw is RematchInvite {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
  const invite = raw as Record<string, unknown>;
  if (typeof invite.code !== 'string' || !CODE_PATTERN.test(invite.code)) return false;
  if (typeof invite.game !== 'string' || !(invite.game in GAMES)) return false;
  if (!isNonEmptyString(invite.fromId) || /^bot-/i.test(invite.fromId)) return false;
  if (!isNonEmptyString(invite.fromName) || invite.fromName.trim().length > MAX_NAME_LENGTH) return false;
  if (typeof invite.at !== 'number' || !Number.isFinite(invite.at) || invite.at <= 0) return false;
  return true;
}

/** True si la invitación viene de un jugador humano que está en la sala terminada. */
export function isAllowedRematchSender(invite: RematchInvite, players: Player[]): boolean {
  const sender = players.find((player) => player.id === invite.fromId);
  return sender !== undefined && !isBotPlayer(sender);
}
