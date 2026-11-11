import { ArrowLeft, Check, Layers } from 'lucide-react';
import { type CagaoState, drawFromSeat } from '@/games/cagao';
import { DorsoUI } from './CartaUI';

interface CagaoHudProps {
  state: CagaoState;
  seat: number;
  /** Asiento al que le toca robar (null cuando la partida terminó). */
  turn: number | null;
  /** Texto de estado cuando no hay turno (p. ej. "Fin"). */
  statusText: string;
  onOpenPairs: () => void;
  onLeave?: () => void;
}

/** Cartas boca abajo que se dibujan por rival según cuántos rivales hay; el total siempre va en la insignia ×N. */
function maxBacks(opponents: number): number {
  return opponents >= 5 ? 1 : opponents === 4 ? 2 : opponents === 3 ? 4 : 5;
}

/**
 * Parte superior: salir, pares bajados, turno actual y los rivales. El que está robando se marca
 * en ámbar y al que le están robando, en rosa. Quien ya se salvó queda atenuado con una marca.
 */
export default function CagaoHud({ state, seat, turn, statusText, onOpenPairs, onLeave }: CagaoHudProps) {
  const seats = state.players.length;
  const others = Array.from({ length: seats - 1 }, (_, i) => (seat + 1 + i) % seats);
  const victim = turn === null ? -1 : drawFromSeat(state);
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
        <button
          type="button"
          onClick={onOpenPairs}
          aria-label={`Pares bajados: ${state.pairs.length}`}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 text-xs font-bold tabular-nums text-white active:scale-95"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {state.pairs.length}
        </button>
        <span
          aria-live="polite"
          className={`max-w-[7rem] shrink-0 truncate rounded-full px-2 py-1 text-[10px] font-bold leading-none sm:max-w-[10rem] sm:text-xs ${
            turn === seat ? 'bg-amber-400 text-stone-900' : 'bg-white/15 text-white/90'
          }`}
        >
          {turnLabel}
        </span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 items-stretch justify-center gap-1 sm:gap-4">
        {others.map((s) => {
          const count = state.hands[s].length;
          const out = count === 0;
          const drawing = turn === s;
          const beingRobbed = victim === s;
          return (
            <div
              key={state.players[s].id}
              title={out ? `${state.players[s].name} se salvó` : `${state.players[s].name}: ${count} cartas`}
              className={`flex h-full min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-0.5 transition-colors duration-200 ${
                drawing
                  ? 'bg-amber-400/20 ring-1 ring-amber-300'
                  : beingRobbed
                    ? 'bg-rose-400/20 ring-1 ring-rose-300'
                    : ''
              } ${out ? 'opacity-60' : ''}`}
            >
              <span className="flex max-w-full items-center gap-1 text-[10px] font-semibold leading-none text-white/90 sm:text-xs">
                {drawing && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-300" />}
                <span className="truncate">{state.players[s].name}</span>
              </span>
              {out ? (
                <span className="flex flex-1 items-center gap-1 text-[10px] font-bold text-emerald-200 sm:text-xs">
                  <Check className="h-3 w-3" aria-hidden />
                  Salvó
                </span>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  {Array.from({ length: Math.min(count, maxBacks(others.length)) }, (_, i) => (
                    <DorsoUI
                      key={i}
                      className={`h-full max-h-10 sm:max-h-14 [@media(max-height:480px)]:max-h-10 ${
                        i === 0 ? '' : '-ml-4 sm:-ml-6 [@media(max-height:480px)]:-ml-4'
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-[10px] font-bold tabular-nums text-white/80 sm:text-xs">×{count}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}
