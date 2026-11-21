import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@/games';
import { teamOf } from '@/games/shared';
import { awardMatchWithStats, humanOutcome, matchFingerprint } from '@/lib/economy';
import type { XpGain } from '@/lib/experience';
import type { MatchStats } from '@/lib/missions';

/** Lo que se ganó con la partida: monedas y experiencia (null si no hay nada que mostrar). */
export interface WinReward {
  coins: number | null;
  xpGain: XpGain | null;
}

/**
 * Recompensa la victoria de la partida que se está mostrando, una sola vez.
 *
 * Se engancha en la mesa de cada juego (sirve igual sin conexión y en línea):
 * cuando la partida llega a `gameOver` y el jugador ganó o empató, paga las
 * monedas y la experiencia y devuelve ambas para mostrarlas en la celebración.
 * Si perdió, reinicia su racha sin pagar. La huella de la partida evita pagar
 * dos veces la misma victoria aunque la vista se actualice varias veces.
 *
 * La misma llamada registra la partida en las misiones (cartas capturadas y
 * viraos en el Casino), así que el progreso de misiones avanza sin tocar las mesas.
 */
export function useWinReward(state: GameState, seat: number): WinReward | null {
  const [reward, setReward] = useState<WinReward | null>(null);
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
    const result = awardMatchWithStats(key, state.game, outcome, matchStats(state, seat, outcome));
    setReward({ coins: result.awarded, xpGain: result.xpGain });
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
