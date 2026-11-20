import { useEffect, useRef, useState } from 'react';
import { useGameSounds } from '@/hooks/useGameSounds';
import { vibrate } from '@/lib/haptics';
import {
  DEALER_DRAW_INITIAL_MS,
  dealerDrawDelays,
  dealerDrawHighlight,
  dealerDrawSteps,
} from '@/lib/dealerDraw';
import type { Player } from '@/games/shared';
import { PANEL_BUTTON } from './wood/styles';

interface DealerRevealProps {
  players: Player[];
  dealer: number;
  onDone: () => void;
}

const CONFETTI_COLORS = ['bg-amber-400', 'bg-lime-500', 'bg-orange-400', 'bg-rose-500', 'bg-yellow-200'];
const CONFETTI_COUNT = 28;

function makeConfetti() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.9,
    duration: 2.2 + Math.random() * 1.4,
    size: 5 + Math.random() * 7,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));
}

export default function DealerReveal({ players, dealer, onDone }: DealerRevealProps) {
  const [highlight, setHighlight] = useState(-1);
  const [landed, setLanded] = useState(false);
  const [confetti] = useState(makeConfetti);
  const { playSound } = useGameSounds();
  // El sonido se guarda en un ref: si el silencio cambia a mitad del
  // sorteo, el efecto no debe reiniciar la animación desde cero.
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;

  useEffect(() => {
    const delays = dealerDrawDelays(players.length, dealer);
    const totalSteps = dealerDrawSteps(players.length, dealer);
    let step = 0;
    let timer: number;
    const advance = () => {
      step += 1;
      setHighlight(dealerDrawHighlight(players.length, step));
      playSoundRef.current('click');
      if (step >= totalSteps) {
        setLanded(true);
        playSoundRef.current('pairMatch');
        vibrate([15, 40, 25]);
        return;
      }
      // delays[k] es la pausa entre el paso k+1 y el siguiente: tras
      // completar el paso `step`, la siguiente pausa es delays[step - 1].
      timer = window.setTimeout(advance, delays[step - 1]);
      return;
    };
    timer = window.setTimeout(advance, DEALER_DRAW_INITIAL_MS);
    return () => window.clearTimeout(timer);
  }, [dealer, players.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/65 p-4 backdrop-blur-sm">
      {landed &&
        confetti.map((piece) => (
          <span
            key={piece.id}
            aria-hidden="true"
            className={`absolute top-0 block rounded-sm ${piece.color}`}
            style={{
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size * 0.4,
              animation: `confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
            }}
          />
        ))}
      <div className="wood-panel relative w-full max-w-md space-y-5 p-5 text-center sm:p-8">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-200/80">Sorteo del repartidor</p>
          <h2 className="text-2xl font-extrabold text-amber-50">
            {landed ? `${players[dealer].name} reparte` : 'Eligiendo quién reparte...'}
          </h2>
        </div>
        {/* La carta va saltando sobre la casilla señalada mientras dura el sorteo. */}
        {!landed && highlight >= 0 && (
          <div aria-hidden="true" className="relative h-9">
            <span
              className="dealer-draw-deal absolute top-0 grid h-8 w-6 place-items-center rounded-[4px] bg-amber-50 text-base leading-none text-slate-900 shadow-md ring-1 ring-amber-900/40 transition-[left] duration-300 ease-out"
              style={{ left: `calc(${highlight % 2 === 0 ? '25%' : '75%'} - 12px)` }}
            >
              ♠
            </span>
          </div>
        )}
        <ul className="grid grid-cols-2 gap-3">
          {players.map((player, i) => {
            const active = !landed && i === highlight;
            const chosen = landed && i === dealer;
            return (
              <li
                key={player.id}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition duration-150 ${
                  chosen
                    ? 'dealer-draw-winner btn-gold shadow-md'
                    : active
                      ? 'dealer-draw-active scale-[1.06] -translate-y-0.5 bg-amber-400/30 text-amber-50 ring-2 ring-amber-300'
                      : 'bg-black/30 text-amber-100/70 ring-1 ring-amber-200/20'
                }`}
              >
                {player.name}
              </li>
            );
          })}
        </ul>
        {landed && (
          <button type="button" onClick={onDone} className={`${PANEL_BUTTON} w-full`}>
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
