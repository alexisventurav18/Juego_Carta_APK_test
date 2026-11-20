import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@/games';
import { teamOf } from '@/games/shared';
import { awardMatchWithStats, humanOutcome, matchFingerprint } from '@/lib/economy';
import type { MatchStats } from '@/lib/missions';

/**
 * Recompensa la victoria de la partida que se está mostrando, una sola vez.
 *
 * Se engancha en la mesa de cada juego (sirve igual sin conexión y en línea):
 * cuando la partida llega a `gameOver` y el jugador ganó o empató, paga las
 * monedas y devuelve la cantidad para mostrarla en la celebración. Si perdió,
 * reinicia su racha sin pagar. La huella de la partida evita pagar dos veces
 * la misma victoria aunque la vista se actualice varias veces.
 *
 * La misma llamada registra la partida en las misiones (cartas capturadas y
 * viraos en el Casino), así que el progreso de misiones avanza sin tocar las mesas.
 */
export function useWinReward(state: GameState, seat: number): number | null {
  const [reward, setReward] = useState<number | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.phase !== 'gameOver') {
      lastKeyRef.current = null;
      setReward(null);
      return;
    }
    const outcome = humanOutcome(state, seat);
    if (outcome === null) return;
    const key = matchFingerprint(state);
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setReward(awardMatchWithStats(key, state.game, outcome, matchStats(state, seat, outcome)).awarded);
  }, [state, seat]);

  return reward;
}

/** Estadísticas de la partida para las misiones: capturas y viraos del equipo del jugador en el Casino. */
function matchStats(state: GameState, seat: number, outcome: 'win' | 'tie' | 'loss'): MatchStats {
  if (state.game !== 'casino') return { game: state.game, outcome };
  const team = teamOf(seat);
  const capturedCards = state.captured[team].reduce((total, group) => total + group.cards.length, 0);
  return {
    game: 'casino',
    outcome,
    capturedCards,
    viraos: state.viraos[team],
  };
}
