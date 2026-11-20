export type GameId = 'casino' | 'tresydos' | 'cagao' | 'robaito';

export interface Player {
  id: string;
  name: string;
  /** Código del avatar (ver avatar.ts). Opcional: quien no lo envía recibe uno estable según su id. */
  avatar?: string;
}

export interface ScoreLine {
  label: string;
  detail?: string;
  points: number;
  /** La línea se muestra pero no suma (p. ej. la regla de cierre del Casino). */
  muted?: boolean;
}

export type MoveResult<S> = { state: S } | { error: string };

export function isBotPlayer(player: Player): boolean {
  return player.id.startsWith('bot-');
}

/**
 * Asiento del anfitrión efectivo: quien creó la sala (asiento 0) mientras
 * siga siendo humano. Si abandonó y un bot ocupa su asiento, el primer
 * humano que queda hereda el papel (empezar la partida y jugar otra), para
 * que la sala no se quede sin nadie que pueda arrancar. Sin humanos, 0.
 */
export function hostSeat(players: Player[]): number {
  const firstHuman = players.findIndex((p) => !isBotPlayer(p));
  return firstHuman === -1 ? 0 : firstHuman;
}

export function teamOf(seat: number): number {
  return seat % 2;
}

export function teamName(players: Player[], team: number): string {
  return players
    .filter((_, seat) => teamOf(seat) === team)
    .map((p) => p.name)
    .join(' y ');
}
