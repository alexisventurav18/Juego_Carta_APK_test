import type { RefObject } from 'react';
import { ArrowLeft, Layers, Lock, Sparkles } from 'lucide-react';
import { CASINO_TARGET, type CasinoState, closingNeeds } from '@/games/casino';
import { teamName, teamOf } from '@/games/shared';
import { DorsoUI } from './CartaUI';

interface CasinoHudProps {
  state: CasinoState;
  seat: number;
  /** Asiento al que le toca jugar (null mientras se reparte o entre rondas). */
  turn: number | null;
  /** Texto de estado cuando no hay turno (p. ej. "Reparto"). */
  statusText: string;
  deckCount: number;
  deckRef: RefObject<HTMLDivElement>;
  capturedTotal: number;
  onOpenCaptured: () => void;
  onLeave?: () => void;
}

/**
 * Parte superior: marcador a 21, turno actual, mazo, cartas capturadas y las manos de los rivales
 * (boca abajo, escaladas por la altura disponible). En horizontal todo pasa a una sola fila.
 */
export default function CasinoHud({
  state,
  seat,
  turn,
  statusText,
  deckCount,
  deckRef,
  capturedTotal,
  onOpenCaptured,
  onLeave,
}: CasinoHudProps) {
  const myTeam = teamOf(seat);
  const others = state.players.map((_, i) => (seat + 1 + i) % state.players.length).filter((s) => s !== seat);
  const turnLabel = turn === null ? statusText : turn === seat ? 'Tu turno' : state.players[turn].name;

  return (
    <header className="mx-auto flex h-full w-full max-w-5xl flex-col gap-1 px-2 pt-1 landscape:flex-row landscape:items-stretch landscape:gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            aria-label="Salir de la partida"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-white active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {([0, 1] as const).map((team) => {
          const mine = team === myTeam;
          const needs = closingNeeds(state.scores[team]);
          const progress = Math.min(100, (state.scores[team] / CASINO_TARGET) * 100);
          return (
            <div
              key={team}
              title={teamName(state.players, team)}
              className={`flex min-w-0 flex-1 flex-col rounded-lg px-1.5 py-0.5 landscape:w-24 landscape:flex-none sm:landscape:w-28 ${
                mine ? 'bg-emerald-400/20 ring-1 ring-emerald-300/70' : 'bg-white/10'
              }`}
            >
              <span className="flex items-center justify-between gap-1 text-[10px] font-semibold leading-tight text-white/80">
                <span className="flex min-w-0 items-center gap-0.5 truncate">
                  {needs && <Lock className="h-2.5 w-2.5 shrink-0 text-amber-300" aria-label="Cierre obligatorio" />}
                  <span className="truncate">{mine ? 'Nosotros' : 'Ellos'}</span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-amber-200">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {state.viraos[team]}
                </span>
              </span>
              <span className="flex items-baseline gap-0.5 leading-none">
                <span className="text-sm font-bold tabular-nums text-white sm:text-base">{state.scores[team]}</span>
                <span className="text-[10px] text-white/60">/{CASINO_TARGET}</span>
              </span>
              <span className="mt-0.5 h-0.5 overflow-hidden rounded-full bg-white/15">
                <span
                  className="block h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </div>
          );
        })}
        <span
          aria-live="polite"
          className={`max-w-[5.5rem] shrink-0 truncate rounded-full px-2 py-1 text-[10px] font-bold leading-none sm:max-w-[9rem] sm:text-xs ${
            turn === seat ? 'bg-amber-400 text-stone-900' : 'bg-white/15 text-white/90'
          }`}
        >
          {turnLabel}
        </span>
        <button
          type="button"
          onClick={onOpenCaptured}
          aria-label={`Cartas capturadas: ${capturedTotal}`}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/10 px-1.5 text-xs font-bold tabular-nums text-white active:scale-95"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {capturedTotal}
        </button>
        <div ref={deckRef} className="relative shrink-0" title={`Mazo: ${deckCount} cartas`}>
          <DorsoUI className="h-8" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-white drop-shadow">
            {deckCount}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 items-stretch justify-center gap-1 sm:gap-6">
        {others.map((s) => {
          const isTurn = turn === s;
          const mate = teamOf(s) === myTeam;
          const count = state.hands[s].length;
          return (
            <div
              key={state.players[s].id}
              title={`${state.players[s].name}: ${count} ${count === 1 ? 'carta' : 'cartas'}`}
              className={`flex h-full min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-0.5 transition-colors duration-200 ${
                isTurn ? 'bg-amber-400/20 ring-1 ring-amber-300' : ''
              }`}
            >
              <span
                className={`flex max-w-full items-center gap-1 text-[10px] font-semibold leading-none sm:text-xs ${
                  mate ? 'text-emerald-200' : 'text-white/90'
                }`}
              >
                {isTurn && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-300" />}
                <span className="truncate">{state.players[s].name}</span>
              </span>
              <div className="flex min-h-0 flex-1 items-center justify-center">
                {Array.from({ length: count }, (_, i) => (
                  <DorsoUI key={i} className={`h-full max-h-20 ${i === 0 ? '' : '-ml-[3.2dvh]'}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
}
