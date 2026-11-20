import { useEffect, useRef, useState } from 'react';
import { Coins, Gift, Sparkles, X } from 'lucide-react';
import { claimDailyPrize, DAILY_WHEEL_PRIZES, rollDailyPrize } from '@/lib/economy';
import { useGameSounds } from '@/hooks/useGameSounds';
import { vibrate } from '@/lib/haptics';

/** Colores de los segmentos, en el mismo orden que DAILY_WHEEL_PRIZES. */
const SEGMENT_COLORS = ['#b45309', '#15803d', '#1d4ed8', '#7c3aed', '#b91c1c'];

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
      <div className="wood-panel relative w-full max-w-sm space-y-5 p-5 text-center">
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
          <p className="flex items-center justify-center gap-2 text-lg font-extrabold text-amber-50">
            <Gift className="h-5 w-5 text-amber-300" aria-hidden />
            Rueda diaria
          </p>
          <p className="mt-1 text-sm text-amber-100/80">Gira y llévate monedas. Vuelve mañana por otra.</p>
        </div>

        <div className="relative mx-auto h-64 w-64">
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
            {DAILY_WHEEL_PRIZES.map((prizeItem, i) => (
              <span
                key={prizeItem.amount}
                aria-hidden
                className="absolute left-1/2 top-1/2 text-sm font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                style={{
                  transform: `translate(-50%, -50%) rotate(${i * step + step / 2}deg) translateY(-92px)`,
                }}
              >
                {prizeItem.label}
              </span>
            ))}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-950 ring-2 ring-amber-300/70"
            >
              <Sparkles className="h-7 w-7 text-amber-300" />
            </span>
          </div>
        </div>

        {granted !== null ? (
          <div className="space-y-3">
            <p className="text-xl font-extrabold text-amber-300">¡Te ganaste +{granted} monedas!</p>
            <button
              type="button"
              onClick={onClose}
              className="btn-gold min-h-[44px] w-full rounded-lg px-6 py-3 text-sm font-extrabold transition-transform active:scale-95"
            >
              A jugar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            className="btn-gold flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-extrabold transition-transform active:scale-95 disabled:opacity-60"
          >
            <Coins className="h-5 w-5" aria-hidden />
            {spinning ? 'Girando...' : 'Girar la rueda'}
          </button>
        )}
      </div>
    </div>
  );
}
