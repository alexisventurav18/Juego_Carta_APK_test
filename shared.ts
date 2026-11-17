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

export function teamOf(seat: number): number {
  return seat % 2;
}

export function teamName(players: Player[], team: number): string {
  return players
    .filter((_, seat) => teamOf(seat) === team)
    .map((p) => p.name)
    .join(' y ');
}
