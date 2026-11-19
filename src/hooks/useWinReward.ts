import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@/games';
import { awardMatch, humanOutcome, matchFingerprint } from '@/lib/economy';

/**
 * Recompensa la victoria de la partida que se está mostrando, una sola vez.
 *
 * Se engancha en la mesa de cada juego (sirve igual sin conexión y en línea):
 * cuando la partida llega a `gameOver` y el jugador ganó o empató, paga las
 * monedas y devuelve la cantidad para mostrarla en la celebración. Si perdió,
 * reinicia su racha sin pagar. La huella de la partida evita pagar dos veces
 * la misma victoria aunque la vista se actualice varias veces.
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
    setReward(awardMatch(key, state.game, outcome));
  }, [state, seat]);

  return reward;
}
