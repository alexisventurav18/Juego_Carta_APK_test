import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { createGameState, createSoloPlayers, GAMES, isGameFinished, type GameState } from '@/games';
import { botStep, botTickDelay } from '@/games/bots';
import { applyGameMove } from '@/games/engine';
import type { CagaoMove } from '@/games/cagao';
import type { CasinoMove } from '@/games/casino';
import type { RobaitoMove } from '@/games/robaito';
import type { GameId, Player } from '@/games/shared';
import type { TresYDosMove } from '@/games/tresYDos';
import { projectState } from '@/games/view';
import { getMyAvatar } from '@/lib/identity';
import CagaoTable from './CagaoTable';
import CasinoTable from './CasinoTable';
import RobaitoTable from './robaito/RobaitoTable';
import TresYDosTable from './TresYDosTable';
import { PANEL_BUTTON } from './wood/styles';

/** Qué partida local se va a jugar: el juego, tu nombre y cuántos jugadores habrá en total (tú + bots). */
export interface OfflineSetup {
  game: GameId;
  playerName: string;
  playerCount: number;
}

interface OfflineBotGameProps extends OfflineSetup {
  onLeave: () => void;
}

const HUMAN_SEAT = 0;
const NOTICE_MS = 4000;

/**
 * Partida sin conexión contra bots. Usa el mismo motor de reglas y la misma IA que el servidor, pero todo
 * corre en este dispositivo: no hay sala, cuenta ni red. Tú siempre eres el asiento 0.
 */
export default function OfflineBotGame({ game, playerName, playerCount, onLeave }: OfflineBotGameProps) {
  const players = useMemo<Player[]>(
    () => createSoloPlayers(game, { id: 'local-human', name: playerName, avatar: getMyAvatar() }, playerCount),
    [game, playerName, playerCount],
  );
  const [state, setState] = useState<GameState>(() => createGameState(game, players));
  const [matchKey, setMatchKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Si el paso del bot falla, se reintenta con espera en lugar de dejar la partida
  // atascada: el error no cambia el estado, así que sin este contador el efecto
  // nunca volvería a correr. El contador se reinicia con cada estado nuevo.
  const [botRetries, setBotRetries] = useState(0);
  const botRetryTimerRef = useRef<number | null>(null);
  const BOT_MAX_RETRIES = 3;
  const BOT_RETRY_MS = 2500;
  // Reparto en pantalla: la mesa avisa de cuándo se está repartiendo y mientras dura ningún
  // bot juega (el humano ya lo bloquea la mesa). Sin este bloqueo el bot movía a ~1 s de
  // empezar, con el reparto aún en pantalla, y el humano no llegaba a ver sus cartas.
  const dealingRef = useRef(false);
  const [dealing, setDealing] = useState(false);
  const handleDealingChange = useCallback((value: boolean) => {
    if (dealingRef.current === value) return;
    dealingRef.current = value;
    setDealing(value);
  }, []);

  // Los bots juegan solos cuando les toca: cualquier cambio del estado reinicia la espera.
  useEffect(() => {
    setBotRetries(0);
  }, [state]);

  useEffect(() => {
    const delay = botTickDelay(state, dealing);
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      const step = botStep(state);
      if (!step) return;
      if ('error' in step.result) {
        setNotice(step.result.error);
        if (botRetries < BOT_MAX_RETRIES) {
          botRetryTimerRef.current = window.setTimeout(
            () => setBotRetries((value) => value + 1),
            BOT_RETRY_MS,
          );
        }
        return;
      }
      setState(step.result.state);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      if (botRetryTimerRef.current !== null) {
        window.clearTimeout(botRetryTimerRef.current);
        botRetryTimerRef.current = null;
      }
    };
  }, [state, botRetries, dealing]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const move = (nextMove: CasinoMove | TresYDosMove | CagaoMove | RobaitoMove) => {
    const result = applyGameMove(state, HUMAN_SEAT, nextMove);
    if ('error' in result) {
      setNotice(result.error);
      return;
    }
    setState(result.state);
  };

  const rematch = () => {
    setState(createGameState(game, players));
    setMatchKey((key) => key + 1);
    setNotice(null);
  };

  // Solo tu mano es visible: las de los bots llegan a la mesa como cartas boca abajo, igual que en línea.
  const view = projectState(state, HUMAN_SEAT);
  const tableProps = {
    seat: HUMAN_SEAT,
    onLeave,
    notice,
    roomLabel: `${GAMES[game].name} · contra bots · sin conexión`,
    onDealingChange: handleDealingChange,
    onRematch: rematch,
    resultFooter: isGameFinished(state) ? (
      <button type="button" onClick={rematch} className={PANEL_BUTTON}>
        <RotateCcw className="h-4 w-4" />
        Jugar otra partida
      </button>
    ) : undefined,
  };

  if (view.game === 'casino') {
    return <CasinoTable key={matchKey} state={view} {...tableProps} onMove={move} />;
  }
  if (view.game === 'tresydos') {
    return <TresYDosTable key={matchKey} state={view} {...tableProps} onMove={move} />;
  }
  if (view.game === 'robaito') {
    return <RobaitoTable key={matchKey} state={view} {...tableProps} onMove={move} />;
  }
  return <CagaoTable key={matchKey} state={view} {...tableProps} onMove={move} />;
}
