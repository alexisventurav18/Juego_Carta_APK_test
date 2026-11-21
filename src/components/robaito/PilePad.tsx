import type { Card } from '@/games/cards';
import PlayingCard from '../cagao/PlayingCard';

interface PilePadProps {
  /** Paquete del jugador: la cima es la última carta. Las de abajo pueden llegar ocultas. */
  pile: Card[];
  name: string;
  /** Si la carta elegida le robaría este paquete: brilla en dorado. */
  targeted?: boolean;
  /** Es mi paquete. */
  mine?: boolean;
  /** Ancla para los vuelos de cartas que llegan o salen del paquete. */
  registerRef?: (el: HTMLDivElement | null) => void;
}

const MAX_LAYERS = 3;

/**
 * El paquete de un jugador, boca arriba junto a él: se ve la última carta que entró (la cima) y un
 * contador con todas las que tiene. Las capas de atrás solo dan sensación de grosor.
 */
export default function PilePad({ pile, name, targeted = false, mine = false, registerRef }: PilePadProps) {
  const top = pile[pile.length - 1] ?? null;
  const layers = Math.min(Math.max(pile.length - 1, 0), MAX_LAYERS);

  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5" role="group" aria-label={`Paquete de ${mine ? 'ti' : name}: ${pile.length} cartas`}>
      <div ref={registerRef} className="relative" style={{ paddingRight: layers * 3, paddingBottom: layers * 3 }}>
        {targeted && <span aria-hidden className="gold-glow pointer-events-none absolute -inset-[30%] rounded-full" />}
        {top ? (
          <>
            {Array.from({ length: layers }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute left-0 top-0 block"
                style={{ transform: `translate(${(layers - i) * 3}px, ${(layers - i) * 3}px)` }}
              >
                <PlayingCard faceDown heightVar="--sh" />
              </span>
            ))}
            <span
              key={top.id}
              className={`pile-land relative block rounded-[calc(var(--sh)*0.07)] ${targeted ? 'ring-[3px] ring-yellow-300' : ''}`}
            >
              <PlayingCard card={top} heightVar="--sh" plain />
              {/* El contador va DENTRO de la carta (esquina superior derecha): antes colgaba fuera
                  (-right-2 -top-2) y se montaba sobre la placa o la píldora de turno de al lado. */}
              <span className="pointer-events-none absolute right-1 top-1 z-10 btn-gold min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-none tabular-nums shadow sm:text-xs">
                {pile.length}
              </span>
            </span>
          </>
        ) : (
          <span
            className="relative block rounded-md border-2 border-dashed border-amber-100/40"
            style={{ height: 'var(--sh)', aspectRatio: '2.5/3.5' }}
          >
            <span className="pointer-events-none absolute right-1 top-1 z-10 btn-gold min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-none tabular-nums shadow sm:text-xs">
              {pile.length}
            </span>
          </span>
        )}
      </div>
      {/* La etiqueta tiene su propia línea reservada bajo la carta (nunca pegada a ella ni recortada
          por ella). Sin límite de ancho: "Tu paquete" tiene 10 caracteres y antes se veía "Tu pa...".
          El tope es para nombres largos: la etiqueta no empuja el asiento de al lado. */}
      <span className="max-w-24 truncate whitespace-nowrap rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-bold leading-none text-amber-100 sm:text-[11px]">
        {mine ? 'Tu paquete' : name}
      </span>
    </div>
  );
}
