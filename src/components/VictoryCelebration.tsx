import { useEffect, useState } from 'react';
import { Coins, RotateCcw, Trophy } from 'lucide-react';
import { useGameSounds } from '@/hooks/useGameSounds';
import type { XpGain } from '@/lib/experience';
import { CONFETTI_COLORS } from '../lib/dominicanPalette';
import XpGainBar from './XpGainBar';

interface VictoryCelebrationProps {
  onContinue: () => void;
  /** Revancha inmediata (sin conexión): si se pasa, es el botón principal. */
  onRematch?: () => void;
  /** Textos opcionales: por defecto son los del Casino (partida por equipos a 21). */
  title?: string;
  message?: string;
  continueLabel?: string;
  /** Monedas ganadas por esta victoria (null si no hay recompensa que mostrar). */
  rewardCoins?: number | null;
  /** Experiencia ganada por esta victoria (null si no hay nada que animar). */
  xpGain?: XpGain | null;
}

/** Confeti con los colores de la bandera dominicana + ámbar. */
const COLORS = CONFETTI_COLORS;
const PIECE_COUNT = 70;

function makePieces() {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.6 + Math.random() * 1.8,
    size: 6 + Math.random() * 8,
    color: COLORS[i % COLORS.length],
  }));
}

export default function VictoryCelebration({
  onContinue,
  onRematch,
  title = '¡GANASTE!',
  message = 'Tu equipo se llevó la partida. Revisa el desglose de puntos.',
  continueLabel = 'Ver el desglose',
  rewardCoins = null,
  xpGain = null,
}: VictoryCelebrationProps) {
  const [pieces] = useState(makePieces);
  const { playSound } = useGameSounds();

  // Tintineo de monedas al aparecer la recompensa (la fanfarria la pone la mesa).
  useEffect(() => {
    if (rewardCoins === null || rewardCoins <= 0) return;
    const timer = window.setTimeout(() => playSound('coin'), 350);
    return () => window.clearTimeout(timer);
  }, [rewardCoins, playSound]);

  return (
    <div className="end-notice fixed inset-0 z-50 flex overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          aria-hidden="true"
          className="absolute top-0 block rounded-sm"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 0.4,
            backgroundColor: piece.color,
            animation: `confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
          }}
        />
      ))}
      <div className="relative m-auto w-full max-w-md space-y-8 text-center">
        <span
          aria-hidden
          className="end-notice-icon mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-400/20 ring-2 ring-amber-300/70 shadow-[0_0_40px_rgba(252,211,77,0.45)]"
          style={{ animation: 'victory-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms both' }}
        >
          <Trophy className="h-10 w-10 text-amber-300" />
        </span>
        <h2
          className="end-notice-title text-[clamp(2.25rem,13vw,4.5rem)] font-black tracking-tight text-amber-300 drop-shadow-[0_4px_24px_rgba(252,211,77,0.6)] "
          style={{ animation: 'victory-pop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both, victory-glow 2.4s ease-in-out 700ms infinite' }}
        >
          {title}
        </h2>
        <p className="end-notice-message text-base text-amber-50">{message}</p>
        {rewardCoins !== null && rewardCoins > 0 && (
          <p className="end-notice-reward mx-auto flex w-fit items-center gap-2 rounded-full bg-amber-400/20 px-4 py-2 text-base font-extrabold text-amber-300 ring-1 ring-amber-300/60">
            <Coins className="h-5 w-5" aria-hidden />
            +{rewardCoins} monedas
          </p>
        )}
        <XpGainBar xpGain={xpGain} />
        <div className="end-notice-actions flex flex-col items-center gap-2.5">
          {onRematch && (
            <button
              type="button"
              onClick={() => {
                playSound('click');
                onRematch();
              }}
              className="btn-gold flex min-h-[48px] items-center gap-2 rounded-lg px-8 py-3 text-base font-extrabold shadow-lg transition-transform active:scale-95"
            >
              <RotateCcw className="h-5 w-5" aria-hidden />
              Revancha
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              playSound('click');
              onContinue();
            }}
            className={`min-h-[44px] rounded-lg px-6 py-3 text-sm font-extrabold shadow-lg transition-transform active:scale-95 ${
              onRematch ? 'btn-wood font-bold' : 'btn-gold'
            }`}
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
