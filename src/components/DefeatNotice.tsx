import { HeartCrack, RotateCcw } from 'lucide-react';
import { useGameSounds } from '@/hooks/useGameSounds';

interface DefeatNoticeProps {
  onContinue: () => void;
  /** Revancha inmediata (sin conexión): si se pasa, es el botón principal. */
  onRematch?: () => void;
  /** Textos opcionales: por defecto son los del Casino (partida por equipos a 21). */
  title?: string;
  message?: string;
  continueLabel?: string;
}

export default function DefeatNotice({
  onContinue,
  onRematch,
  title = 'Perdiste la partida',
  message = 'El otro equipo llegó primero a 21. Revisa el desglose para ver dónde se decidió.',
  continueLabel = 'Ver el desglose',
}: DefeatNoticeProps) {
  const { playSound } = useGameSounds();

  return (
    <div className="end-notice fixed inset-0 z-50 flex overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-rose-950/40"
      />
      <div className="relative m-auto w-full max-w-md space-y-8 text-center">
        <span
          aria-hidden
          className="end-notice-icon mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose-500/15 ring-2 ring-rose-300/50 shadow-[0_0_40px_rgba(253,164,175,0.3)]"
          style={{ animation: 'victory-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms both' }}
        >
          <HeartCrack className="h-10 w-10 text-rose-300" />
        </span>
        <h2
          className="end-notice-title text-[clamp(2rem,11vw,3.75rem)] font-black tracking-tight text-rose-300 drop-shadow-[0_4px_24px_rgba(253,164,175,0.35)] "
          style={{ animation: 'victory-pop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both, defeat-shake 500ms ease-in-out 750ms both' }}
        >
          {title}
        </h2>
        <p className="end-notice-message text-base text-amber-50">{message}</p>
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
            className="btn-wood min-h-[44px] rounded-lg px-6 py-3 text-sm font-bold shadow-lg transition-transform active:scale-95"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
