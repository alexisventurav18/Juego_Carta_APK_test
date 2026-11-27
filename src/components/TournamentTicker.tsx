import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { tickerLoopSeconds } from '@/lib/tournament';

/**
 * Aviso del torneo como marquesina fina entre el encabezado y las tarjetas.
 *
 * Se muestra una sola vez por cada entrada al menú (cada montaje del Lobby):
 * el texto se desplaza en horizontal hasta leerse entero y a los ~10 s se
 * oculta sola con una transición suave, devolviendo su espacio a las
 * tarjetas. Al tocarla se abre el modal del torneo. Sin la píldora de
 * abajo, este aviso es la única entrada al torneo desde el menú.
 *
 * Sin movimiento (`prefers-reduced-motion`): el texto se queda quieto y
 * desaparece al cabo de los mismos segundos (la regla global de movimiento
 * reducido anula la animación y la transición).
 */
const HIDE_DELAY_MS = 1500;

export default function TournamentTicker({ text, onOpen }: { text: string; onOpen: () => void }) {
  const [visible, setVisible] = useState(true);
  const [gone, setGone] = useState(false);
  // La duración se fija al montar: la cuenta atrás del texto puede cambiar
  // sin reiniciar el aviso.
  const loopRef = useRef(tickerLoopSeconds(text));

  useEffect(() => {
    const hide = window.setTimeout(() => setVisible(false), loopRef.current * 1000 + HIDE_DELAY_MS);
    return () => window.clearTimeout(hide);
  }, []);

  useEffect(() => {
    if (visible) return;
    const unmount = window.setTimeout(() => setGone(true), 600);
    return () => window.clearTimeout(unmount);
  }, [visible]);

  if (gone) return null;
  return (
    <div
      className="shrink-0 overflow-hidden transition-[height,opacity] duration-500 ease-in-out"
      style={{ height: visible ? 28 : 0, opacity: visible ? 1 : 0 }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Aviso del torneo: ${text}. Tocar para ver el torneo.`}
        className="btn-wood flex h-[28px] w-full touch-manipulation items-center overflow-hidden rounded-full px-3 text-[12px] font-bold text-amber-200 transition-transform active:scale-[0.99]"
      >
        <span
          aria-hidden
          className="ticker-track flex shrink-0 items-center whitespace-nowrap"
          style={{ animationDuration: `${loopRef.current}s` }}
        >
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center gap-1.5 pr-8">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
              {text}
            </span>
          ))}
        </span>
      </button>
    </div>
  );
}
