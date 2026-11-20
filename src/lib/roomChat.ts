import { isBotPlayer, type Player } from '../games/shared';

/**
 * Chat de texto en salas online: solo emojis y mensajes predeterminados.
 * No hay texto libre: así no hay insultos, no hay spam de teclado y no hace
 * falta moderación. Viaja por Supabase Realtime Broadcast en el mismo canal
 * `room:<id>` que ya usa la sala (ver `subscribeToRoom`).
 */

export const CHAT_EMOJIS = ['😂', '👍', '👏', '😮', '🔥', '🎉', '😢', '🤔'] as const;
export type ChatEmoji = (typeof CHAT_EMOJIS)[number];

export const QUICK_MESSAGES = [
  '¡Buena jugada!',
  '¡Qué suerte!',
  '¡Ay, mi madre!',
  '¡Esa no!',
  '¡Vamos, dale!',
  '¡Te toca!',
  '¡Otra vez!',
  '¡Qué vaina!',
  '¡Jajaja!',
  '¡Buena suerte!',
] as const;
export type QuickMessage = (typeof QUICK_MESSAGES)[number];

/** Nombre del evento de Broadcast dentro del canal de la sala. */
export const ROOM_CHAT_EVENT = 'chat';

/** Tiempo mínimo entre dos mensajes propios (anti-spam). */
export const CHAT_COOLDOWN_MS = 3000;

/** Tiempo que se muestra cada aviso de chat en la mesa. */
export const CHAT_TOAST_MS = 4000;

/** Los nombres de jugador en el servidor tienen como máximo 24 caracteres. */
const MAX_NAME_LENGTH = 24;

export interface RoomChatMessage {
  kind: 'emoji' | 'quick';
  emoji?: string;
  text?: string;
  fromId: string;
  fromName: string;
  /** Cuándo se envió (milisegundos desde epoch). */
  at: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Valida en RECEPCIÓN un mensaje que llega por Broadcast. Solo pasa lo que
 * está en el catálogo cerrado: el emoji tiene que ser uno de CHAT_EMOJIS o el
 * texto tiene que ser exactamente uno de QUICK_MESSAGES. Todo lo demás
 * (texto libre, emojis fuera del catálogo, kind inválido, remitente vacío)
 * se descarta en silencio, así ni un cliente modificado puede inyectar texto.
 */
export function isValidChatPayload(raw: unknown): raw is RoomChatMessage {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
  const msg = raw as Record<string, unknown>;
  if (msg.kind === 'emoji') {
    if (typeof msg.emoji !== 'string' || !(CHAT_EMOJIS as readonly string[]).includes(msg.emoji)) return false;
    if (msg.text !== undefined) return false;
  } else if (msg.kind === 'quick') {
    if (typeof msg.text !== 'string' || !(QUICK_MESSAGES as readonly string[]).includes(msg.text)) return false;
    if (msg.emoji !== undefined) return false;
  } else {
    return false;
  }
  if (!isNonEmptyString(msg.fromId) || !isNonEmptyString(msg.fromName)) return false;
  if (msg.fromName.trim().length > MAX_NAME_LENGTH) return false;
  if (typeof msg.at !== 'number' || !Number.isFinite(msg.at) || msg.at <= 0) return false;
  return true;
}

/** Milisegundos que faltan para poder enviar otro mensaje (0 si ya se puede). */
export function chatCooldownRemainingMs(lastSentAt: number | null, now: number = Date.now()): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, lastSentAt + CHAT_COOLDOWN_MS - now);
}

/** True si ya pasó el tiempo de espera desde el último mensaje propio. */
export function canSendChat(lastSentAt: number | null, now: number = Date.now()): boolean {
  return chatCooldownRemainingMs(lastSentAt, now) === 0;
}

/** True si el mensaje viene de un jugador humano que está en la sala. */
export function isAllowedChatSender(msg: RoomChatMessage, players: Player[]): boolean {
  const sender = players.find((player) => player.id === msg.fromId);
  return sender !== undefined && !isBotPlayer(sender);
}

/** Texto del aviso en la mesa: "Nombre: 😂" o "Nombre: ¡Buena jugada!". */
export function chatToastText(msg: RoomChatMessage): string {
  const content = msg.kind === 'emoji' ? msg.emoji : msg.text;
  return `${msg.fromName}: ${content ?? ''}`;
}
