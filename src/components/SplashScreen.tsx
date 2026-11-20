import { useEffect, useRef, useState } from 'react';
import { SPLASH_DURATION_MS, splashStep } from '@/lib/splash';

/**
 * Pantalla de bienvenida: cartas que se reparten en abanico sobre la mesa de
 * madera, título del juego y barra de progreso con el paso de carga actual.
 *
 * Se muestra al abrir la app mientras se inician los recursos (el lobby ya
 * está montado detrás en cuanto termina) y se retira sola al cumplir la
 * duración mínima. El temporizador es JS, no el final de la animación CSS,
 * así que con "reducir movimiento" activado también desaparece a tiempo.
 */

const FAN_CARDS = [
  { rank: 'A', suit: '♠', red: false, x: '-64px', rot: '-16deg' },
  { rank: 'K', suit: '♥', red: true, x: '-32px', rot: '-8deg' },
  { rank: 'Q', suit: '♦', red: true, x: '0px', rot: '0deg' },
  { rank: 'J', suit: '♣', red: false, x: '32px', rot: '8deg' },
  { rank: '10', suit: '♠', red: false, x: '64px', rot: '16deg' },
] as const;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(100, Math.round((elapsed / SPLASH_DURATION_MS) * 100)));
      if (elapsed >= SPLASH_DURATION_MS && !doneRef.current) {
        doneRef.current = true;
        window.clearInterval(timer);
        onDone();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando Cartas Dominicanas"
      className="splash-screen wood-stage fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 overflow-hidden px-6"
    >
      {/* Mazo que baraja detrás del abanico: tres dorsos que se cruzan. */}
      <div className="splash-deck relative h-28 w-40" aria-hidden>
        <div className="splash-deck-card splash-deck-card--1" />
        <div className="splash-deck-card splash-deck-card--2" />
        <div className="splash-deck-card splash-deck-card--3" />
      </div>

      {/* Abanico de cartas repartidas. */}
      <div className="splash-fan relative flex h-36 items-end justify-center" aria-hidden>
        {FAN_CARDS.map((card, index) => (
          <div
            key={`${card.rank}${card.suit}`}
            className="splash-card"
            style={
              {
                '--fan-x': card.x,
                '--fan-rot': card.rot,
                animationDelay: `${0.15 + index * 0.13}s, ${1.1 + index * 0.08}s`,
              } as React.CSSProperties
            }
          >
            <span className={`splash-card-rank ${card.red ? 'text-rose-600' : 'text-slate-900'}`}>{card.rank}</span>
            <span className={`splash-card-suit ${card.red ? 'text-rose-600' : 'text-slate-900'}`}>{card.suit}</span>
            <span className={`splash-card-rank splash-card-rank--bottom ${card.red ? 'text-rose-600' : 'text-slate-900'}`}>
              {card.rank}
            </span>
          </div>
        ))}
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-extrabold uppercase tracking-[0.14em] text-amber-50 sm:text-4xl">
          Cartas <span className="text-amber-300">Dominicanas</span>
        </h1>
        <p className="mt-2 text-sm font-bold text-amber-100/70">Casino · Tres y Dos · El Cagao · El Robaíto</p>
      </div>

      {/* Progreso de carga. */}
      <div className="w-full max-w-xs">
        <div
          className="h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-amber-200/30"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-100" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-center text-sm font-bold text-amber-200">
          {splashStep(progress)} <span className="text-amber-100/60">{progress}%</span>
        </p>
      </div>
    </div>
  );
}
