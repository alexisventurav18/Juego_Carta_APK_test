import { isBotPlayer, type Player } from '../games/shared';

/**
 * Nombres de los jugadores humanos que fueron sustituidos por un bot entre
 * dos fotos de la sala. En `abandon` el bot cae en el mismo asiento del que
 * sale, así que basta comparar asiento a asiento: un asiento que era humano
 * y ahora es bot es un abandono. No detecta nada en la primera carga
 * (prev null) ni cuando solo se añaden bots al final (matchmaking) o un
 * jugador sale de una sala en espera (los demás se recorren, pero siguen
 * siendo humanos).
 */
export function detectAbandonedPlayers(prev: Player[] | null, next: Player[]): string[] {
  if (!prev) return [];
  const names: string[] = [];
  for (let seat = 0; seat < next.length; seat++) {
    const before = prev[seat];
    const after = next[seat];
    if (before && after && !isBotPlayer(before) && isBotPlayer(after)) names.push(before.name);
  }
  return names;
}

/** Texto del aviso de abandono, con uno o varios nombres. */
export function abandonNoticeText(names: string[]): string {
  if (names.length === 1) return `${names[0]} abandonó la partida. Un bot ocupa su lugar.`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(', ');
  return `${rest} y ${last} abandonaron la partida. Un bot ocupa el lugar de cada uno.`;
}
