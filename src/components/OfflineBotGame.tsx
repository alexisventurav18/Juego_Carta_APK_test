import { useEffect, useMemo, useState } from 'react';
import { applyGameMove } from '@/games/engine';
import { botStep, botTickDelay } from '@/games/bots';
import { createSoloPlayers } from '@/games';
import { createCasinoGame, type CasinoMove, type CasinoState } from '@/games/casino';
import type { Player } from '@/games/shared';
import CasinoTable from './CasinoTable';

export type OfflineBotMode = 'team' | 'solo';

interface OfflineBotGameProps {
  playerName: string;
  mode: OfflineBotMode;
  onLeave: () => void;
}

/** Casino local: usa el mismo motor y la misma IA, pero no depende de Supabase. */
export default function OfflineBotGame({ playerName, mode, onLeave }: OfflineBotGameProps) {
  const players = useMemo<Player[]>(
    () => createSoloPlayers('casino', { id: 'local-human', name: playerName }, mode === 'solo' ? 2 : 4),
    [mode, playerName],
  );
  const [state, setState] = useState<CasinoState>(() => createCasinoGame(players, 0));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const delay = botTickDelay(state);
    if (delay === null || busy) return;
    const timer = window.setTimeout(() => {
      const step = botStep(state);
      if (!step || 'error' in step.result) return;
      setState(step.result.state as CasinoState);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [busy, state]);

  const move = (nextMove: CasinoMove) => {
    if (busy) return;
    setBusy(true);
    const result = applyGameMove(state, 0, nextMove);
    if ('state' in result) setState(result.state as CasinoState);
    setBusy(false);
  };

  return (
    <div className={busy ? 'pointer-events-none opacity-80 transition' : 'transition'}>
      <CasinoTable
        state={state}
        seat={0}
        onMove={move}
        onLeave={onLeave}
        roomLabel={`Casino · ${mode === 'solo' ? '1 contra 1' : 'equipos'} · partida local sin conexión`}
      />
    </div>
  );
}
