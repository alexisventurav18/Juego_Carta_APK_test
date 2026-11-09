import { ArrowLeft, Trophy } from 'lucide-react';
import { TARGET_WINS, type TresYDosState } from '@/games/tresYDos';
import { DorsoUI } from './CartaUI';

interface TresYDosHudProps {
  state: TresYDosState;
  seat: number;
  /** Asiento al que le toca jugar (null mientras se reparte o entre rondas). */
  turn: number | null;
  /** Texto de estado cuando no hay turno (p. ej. "Reparto"). */
  statusText: string;
  onLeave?: () => void;
}

/**
 * Parte superior: salir, número de ronda, tus rondas ganadas, turno actual y las manos de los
 * rivales (boca abajo, escaladas por la altura disponible). En horizontal todo pasa a una fila.
 */
export default function TresYDosHud({ state, seat, turn, statusText, onLeave }: TresYDosHudProps) {
  const seats = state.players.length;
  const others = Array.from({ length: seats - 1 }, (_, i) => (seat + 1 + i) % seats);
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
        <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold leading-none text-white/90 sm:text-xs">
          Ronda {state.roundNo}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-400/20 px-2 py-1 text-[11px] font-bold leading-none text-white ring-1 ring-emerald-300/70 sm:text-xs"
          title={`Rondas ganadas: ${state.wins[seat]} de ${TARGET_WINS}`}
        >
          <Trophy className="h-3 w-3 text-amber-300" aria-hidden />
          <span className="tabular-nums">
            Tú {state.wins[seat]}/{TARGET_WINS}
          </span>
        </span>
        <span
          aria-live="polite"
          className={`max-w-[6.5rem] shrink-0 truncate rounded-full px-2 py-1 text-[10px] font-bold leading-none sm:max-w-[10rem] sm:text-xs ${
            turn === seat ? 'bg-amber-400 text-stone-900' : 'bg-white/15 text-white/90'
          }`}
        >
          {turnLabel}
        </span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 items-stretch justify-center gap-1 sm:gap-6">
        {others.map((s) => {
          const isTurn = turn === s;
          const count = state.hands[s].length;
          return (
            <div
              key={state.players[s].id}
              title={`${state.players[s].name}: ${count} cartas, ${state.wins[s]} rondas ganadas`}
              className={`flex h-full min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-0.5 transition-colors duration-200 ${
                isTurn ? 'bg-amber-400/20 ring-1 ring-amber-300' : ''
              }`}
            >
              <span className="flex max-w-full items-center gap-1 text-[10px] font-semibold leading-none text-white/90 sm:text-xs">
                {isTurn && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-300" />}
                <span className="truncate">{state.players[s].name}</span>
                <span className="flex shrink-0 items-center gap-0.5 text-amber-200">
                  <Trophy className="h-2.5 w-2.5" aria-hidden />
                  {state.wins[s]}
                </span>
              </span>
              <div className="flex min-h-0 flex-1 items-center justify-center">
                {Array.from({ length: count }, (_, i) => (
                  <DorsoUI
                    key={i}
                    // Con 5 o 6 cartas el abanico tiene que caber en el bloque del rival: miniaturas con solape fijo.
                    className={`h-full max-h-10 sm:max-h-16 [@media(max-height:480px)]:max-h-10 ${
                      i === 0 ? '' : '-ml-4 sm:-ml-7 [@media(max-height:480px)]:-ml-4'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
}
