import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@/games';
import { teamOf } from '@/games/shared';
import type { AchievementDef } from '@/lib/achievements';
import { awardMatchWithStats, humanOutcome, matchFingerprint } from '@/lib/economy';
import type { XpGain } from '@/lib/experience';
import type { MatchStats, MissionDef } from '@/lib/missions';

/**
 * Lo que se ganó con la partida: monedas y experiencia (null si no hay nada
 * que mostrar), más las misiones completadas y los logros desbloqueados con
 * ella (ambos aún sin reclamar: el aviso de resultados cobra los dos).
 */
export interface WinReward {
  coins: number | null;
  xpGain: XpGain | null;
  completed: MissionDef[];
  achievements: AchievementDef[];
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
 * viraos en el Casino) y evalúa los logros, así que el progreso de ambos
 * avanza sin tocar las mesas: el aviso de resultados solo los muestra y cobra.
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
    setReward({
      coins: result.awarded,
      xpGain: result.xpGain,
      completed: result.completed,
      achievements: result.achievements,
    });
  }, [state, seat]);

  return reward;
}

/** Estadísticas de la partida para las misiones y los logros: capturas y viraos del equipo del jugador en el Casino, y cartas del paquete propio en El Robaíto. */
function matchStats(state: GameState, seat: number, outcome: 'win' | 'tie' | 'loss'): MatchStats {
  if (state.game === 'robaito') {
    // El Robaíto guarda un paquete por jugador: el tamaño del propio al
    // terminar es lo que pide el logro "El Robaíto mayor" (30+ cartas).
    const piles = (state as { piles?: unknown[][] }).piles;
    return {
      game: 'robaito',
      outcome,
      robaitoCards: Array.isArray(piles) ? (piles[seat]?.length ?? 0) : 0,
    };
  }
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
