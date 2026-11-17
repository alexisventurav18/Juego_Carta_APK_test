import { avatarFromSeed, decodeAvatar } from '@/games/avatar';
import type { Player } from '@/games/shared';
import { getMyAvatar } from '@/lib/identity';

/**
 * Código de avatar que se muestra para un jugador: el que envió; si no hay (servidor sin actualizar) y es el
 * jugador local, el suyo guardado; y si no, uno estable calculado desde su id (siempre el mismo para todos).
 */
export function resolveAvatarCode(player: Pick<Player, 'id' | 'avatar'>, isMe = false): string {
  if (decodeAvatar(player.avatar)) return player.avatar as string;
  return isMe ? getMyAvatar() : avatarFromSeed(player.id);
}
