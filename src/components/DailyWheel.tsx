import { useEffect, useRef, useState } from 'react';
import { Coins, Gift, Sparkles, X } from 'lucide-react';
import { claimDailyPrize, DAILY_WHEEL_PRIZES, rollDailyPrize } from '@/lib/economy';
import { DOMINICAN_PALETTE, WHEEL_COLORS } from '../lib/dominicanPalette';
import { useGameSounds } from '@/hooks/useGameSounds';
import { vibrate } from '@/lib/haptics';

/** Colores de los segmentos, en el mismo orden que DAILY_WHEEL_PRIZES: bandera + ámbar, en ciclo. */
const SEGMENT_COLORS = WHEEL_COLORS;

/** Vueltas completas antes de frenar en el premio. */
const FULL_SPINS = 5;
/** Duración del giro, en milisegundos. */
const SPIN_MS = 2900;

function wheelBackground(): string {
  const step = 360 / DAILY_WHEEL_PRIZES.length;
  const stops = DAILY_WHEEL_PRIZES.map(
    (prize, i) => `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${i * step}deg ${(i + 1) * step}deg`,
  );
  return `conic-gradient(${stops.join(', ')})`;
}

export default function DailyWheel({ onClose }: { onClose: () => void }) {
  const { playSound } = useGameSounds();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<number | null>(null);
  const [granted, setGranted] = useState<number | null>(null);
  const grantedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const spin = () => {
    if (spinning || prize !== null) return;
    const amount = rollDailyPrize();
    const index = DAILY_WHEEL_PRIZES.findIndex((p) => p.amount === amount);
    const step = 360 / DAILY_WHEEL_PRIZES.length;
    // El centro del segmento elegido debe quedar bajo el puntero (arriba):
    // se gira vueltas completas más lo que falta para llevar su centro a 0°.
    const center = index * step + step / 2;
    const jitter = (Math.random() - 0.5) * (step - 24);
    const target = FULL_SPINS * 360 + (360 - center) + jitter;
    setPrize(amount);
    setSpinning(true);
    playSound('cardShuffle');
    setRotation(target);
    timersRef.current.push(
      window.setTimeout(() => {
        setSpinning(false);
        if (!grantedRef.current) {
          grantedRef.current = true;
          const coins = claimDailyPrize(amount);
          setGranted(coins);
          playSound('coin');
          vibrate([20, 40, 30]);
        }
      }, SPIN_MS + 120),
    );
  };

  const step = 360 / DAILY_WHEEL_PRIZES.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Rueda diaria"
    >
      {/* El panel nunca desborda la pantalla: la rueda se dimensiona con la
          medida menor entre ancho y alto, y el scroll interno solo queda como
          red de seguridad para pantallas muy bajas. */}
      <div className="wood-panel relative max-h-[94dvh] w-full max-w-sm space-y-3 overflow-y-auto p-4 text-center [@media(max-height:500px)]:space-y-2 [@media(max-height:500px)]:p-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          disabled={spinning}
          className="wood-chip absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
        <div>
          <p className="flex items-center justify-center gap-2 text-[clamp(1rem,3.6dvh,1.125rem)] font-extrabold text-amber-50">
            <Gift className="h-[clamp(1rem,3.6dvh,1.25rem)] w-[clamp(1rem,3.6dvh,1.25rem)] text-amber-300" aria-hidden />
            Rueda diaria
          </p>
          <p className="mt-0.5 text-[clamp(0.75rem,2.8dvh,0.875rem)] text-amber-100/80">Gira y llévate monedas. Vuelve mañana por otra.</p>
        </div>

        {/* La rueda mide lo que quepa: el menor entre el ancho y el alto
            disponible, para que se integre igual en vertical y en horizontal. */}
        <div className="relative mx-auto size-[min(62vw,44dvh)]">
          {/* Puntero fijo arriba */}
          <div
            aria-hidden
            className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 border-x-[10px] border-t-[16px] border-x-transparent border-t-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          />
          <div
            className="relative h-full w-full overflow-hidden rounded-full ring-4 ring-amber-300/70 shadow-[0_0_36px_rgba(252,211,77,0.35)]"
            style={{
              background: wheelBackground(),
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.08, 1)` : undefined,
            }}
          >
            {/* Cada etiqueta va en un envoltorio de tamaño completo que rota
                hasta el centro de su segmento; la etiqueta se asienta arriba
                por porcentaje (~10%), así su radio sigue al tamaño de la
                rueda en vez de depender de píxeles fijos. */}
            {DAILY_WHEEL_PRIZES.map((prizeItem, i) => (
              <span
                key={prizeItem.amount}
                aria-hidden
                className="absolute inset-0"
                style={{ transform: `rotate(${i * step + step / 2}deg)` }}
              >
                {/* La etiqueta es blanca, salvo en el segmento blanco de la
                    bandera, donde va en azul bandera para que se lea. */}
                <span
                  className="absolute left-1/2 top-[10%] -translate-x-1/2 whitespace-nowrap text-[clamp(0.65rem,3dvh,0.875rem)] font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                  style={{
                    color:
                      SEGMENT_COLORS[i % SEGMENT_COLORS.length] === DOMINICAN_PALETTE.blanco
                        ? DOMINICAN_PALETTE.azulBandera
                        : '#ffffff',
                  }}
                >
                  {prizeItem.label}
                </span>
              </span>
            ))}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 grid size-[clamp(2.5rem,11dvh,4rem)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-950 ring-2 ring-amber-300/70"
            >
              <Sparkles className="size-[clamp(1.25rem,5.5dvh,1.75rem)] text-amber-300" />
            </span>
          </div>
        </div>

        {granted !== null ? (
          <div className="space-y-2">
            <p className="text-[clamp(1.05rem,4dvh,1.25rem)] font-extrabold text-amber-300">¡Te ganaste +{granted} monedas!</p>
            <button
              type="button"
              onClick={onClose}
              className="btn-gold min-h-[clamp(40px,9dvh,44px)] w-full rounded-lg px-6 py-2.5 text-sm font-extrabold transition-transform active:scale-95"
            >
              A jugar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            className="btn-gold flex min-h-[clamp(40px,9dvh,48px)] w-full touch-manipulation items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-[clamp(0.875rem,3.2dvh,1rem)] font-extrabold transition-transform active:scale-95 disabled:opacity-60"
          >
            <Coins className="h-5 w-5" aria-hidden />
            {spinning ? 'Girando...' : 'Girar la rueda'}
          </button>
        )}
      </div>
    </div>
  );
}
