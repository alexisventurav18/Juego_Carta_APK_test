import { type Card, isAmericanSuit, isRedSuit, rankLabel, suitSymbol } from '@/games/cards';

export type CartaUISize = 'mano' | 'mesa';

interface CartaUIProps {
  card: Card;
  size: CartaUISize;
  /** Carta o grupo elegido por el jugador: se eleva y se resalta. */
  isSelected?: boolean;
  /** El jugador puede usar esta carta ahora mismo (se marca con un aro suave). */
  isPlayable?: boolean;
  /** No es el turno del jugador o la acción no está permitida. */
  isDisabled?: boolean;
  onClick?: () => void;
}

/** Alturas relativas al viewport (sin tamaños fijos en px) y proporción de carta de póker. */
export const CARTA_ALTURA: Record<CartaUISize, string> = {
  // --mano-h / --mano-h-sm los baja la mano cuando hay muchas cartas (El Cagao).
  mano: 'h-[var(--mano-h,15dvh)] sm:h-[var(--mano-h-sm,18dvh)] max-h-40',
  // --mesa-h / --mesa-h-sm los baja la mesa cuando hay muchos grupos para que todo siga visible.
  mesa: 'h-[var(--mesa-h,12dvh)] sm:h-[var(--mesa-h-sm,15dvh)] max-h-36',
};

/** El palo central escala con la carta, con tope para pantallas grandes. */
const PALO_CENTRAL: Record<CartaUISize, string> = {
  mano: 'text-[clamp(1rem,5.6dvh,3.5rem)] sm:text-[clamp(1.25rem,6.5dvh,3.75rem)] [@media(max-height:480px)]:text-[clamp(1rem,5.6dvh,3.5rem)]',
  mesa: 'text-[clamp(0.9rem,calc(var(--mesa-h,12dvh)*0.38),3rem)] sm:text-[clamp(0.9rem,calc(var(--mesa-h-sm,15dvh)*0.36),3.25rem)]',
};

const ESTADO_SELECCIONADA = '-translate-y-3 ring-2 ring-yellow-400 shadow-lg';

export default function CartaUI({
  card,
  size,
  isSelected = false,
  isPlayable = false,
  isDisabled = false,
  onClick,
}: CartaUIProps) {
  const esRoja = isAmericanSuit(card.suit) && isRedSuit(card.suit);
  const etiqueta = rankLabel(card);

  const cara = (
    <div
      className={`relative flex aspect-[2.5/3.5] flex-col justify-between overflow-hidden rounded-lg border border-stone-200 bg-white p-1 text-left shadow-sm sm:p-1.5 [@media(max-height:480px)]:p-1 ${
        CARTA_ALTURA[size]
      } ${esRoja ? 'text-rose-600' : 'text-stone-800'}`}
    >
      <span className="text-xs font-bold leading-none sm:text-base md:text-lg [@media(max-height:480px)]:text-xs">{etiqueta}</span>
      <div className="flex flex-1 items-center justify-center">
        {isAmericanSuit(card.suit) && (
          <span className={`leading-none ${PALO_CENTRAL[size]}`}>{suitSymbol(card.suit)}</span>
        )}
      </div>
      <span className="self-end rotate-180 text-xs font-bold leading-none sm:text-base md:text-lg [@media(max-height:480px)]:text-xs">{etiqueta}</span>
    </div>
  );

  const estado = isSelected
    ? ESTADO_SELECCIONADA
    : isPlayable
      ? 'ring-1 ring-emerald-300/80'
      : '';
  const base = `shrink-0 rounded-lg transition-transform duration-150 ${estado}`;

  if (!onClick) return <div className={base}>{cara}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={isSelected}
      className={`${base} touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
        isDisabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      {cara}
    </button>
  );
}

/** Dorso de carta con la misma proporción. `className` define su altura (por defecto, la de la mesa). */
export function DorsoUI({ className = CARTA_ALTURA.mesa }: { className?: string }) {
  return (
    <div
      className={`aspect-[2.5/3.5] shrink-0 rounded-lg border-2 border-emerald-200/60 bg-emerald-700 shadow-sm ${className}`}
      style={{
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 10px)',
      }}
    />
  );
}
