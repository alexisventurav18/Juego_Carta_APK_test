import { Users } from 'lucide-react';
import { GAMES } from '@/games';
import type { GameId } from '@/games/shared';
import { publicAsset } from '@/lib/publicAsset';

interface GameCardsProps {
  games: GameId[];
  selected: GameId;
  onSelect: (id: GameId) => void;
}

const MODE_ART: Record<GameId, string> = {
  casino: publicAsset('images/modos/casino.webp'),
  tresydos: publicAsset('images/modos/tres-y-dos.webp'),
  cagao: publicAsset('images/modos/cagao.webp'),
  robaito: publicAsset('images/modos/robaito.webp'),
};

/**
 * Los modos de juego como tarjetas de madera lado a lado, todas visibles a la vez (sin scroll).
 * Se elige tocando o con el ratón; la tarjeta elegida se enciende en dorado.
 */
export default function GameCards({ games, selected, onSelect }: GameCardsProps) {
  return (
    <div
      role="listbox"
      aria-label="Juegos"
      aria-orientation="horizontal"
      className="grid min-h-0 w-full flex-1 auto-rows-fr grid-cols-2 items-stretch justify-center gap-[clamp(8px,2dvw,22px)] min-[640px]:flex min-[640px]:flex-row [@media(min-width:640px)_and_(min-height:600px)]:items-center"
    >
      {games.map((id) => {
        const info = GAMES[id];
        const active = id === selected;
        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(id)}
            className={`wood-block relative flex min-h-0 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-[1.2dvh] rounded-2xl p-[clamp(6px,1.8dvh,16px)] text-center transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 min-[640px]:max-w-[340px] min-[1500px]:max-w-[400px] max-[640px]:gap-1.5 max-[640px]:p-2 [@media(min-width:640px)_and_(min-height:600px)]:aspect-[3/4] ${
              // La tarjeta activa NO se levanta ni se escala: el translate+scale
              // la dejaba 3 px más alta y su nombre 4 px más arriba que las
              // demás (la alineación de baselines se rompía). La marca el
              // anillo dorado + el resplandor (turn-glow).
              active ? 'ring-2 ring-amber-300' : 'opacity-90 hover:-translate-y-0.5 hover:opacity-100'
            }`}
          >
            {active && <span aria-hidden className="turn-glow pointer-events-none absolute -inset-1 rounded-[1.25rem]" />}
            {/* El arte se ve ENTERO fuera del escritorio (object-contain): en
                horizontal corto el panel es ancho y bajo (163×37 px a 819x378)
                y con cover solo se veía la franja central del arte cuadrado
                (un 23% de su altura). En pantallas anchas y altas la tarjeta
                tiene aspect 3/4 y el panel es casi cuadrado: ahí vuelve el
                cover, que llena el panel recortando apenas un 7% del ancho. */}
            <span
              aria-hidden
              className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/30 ring-1 ring-amber-200/20"
            >
              <img
                src={MODE_ART[id]}
                alt=""
                className="h-full w-full rounded-lg object-contain drop-shadow-md [@media(min-width:640px)_and_(min-height:600px)]:object-cover"
              />
            </span>
            <span className="relative whitespace-nowrap text-[clamp(15px,4.2dvh,24px)] font-extrabold leading-none text-amber-50 max-[640px]:text-[15px]">{info.name}</span>
            {/* La descripción reserva siempre 2 líneas (min-h 2.75em = 2 ×
                leading-snug): "Tres y Dos" cabe en 1 línea a este ancho y
                sin reserva su tarjeta quedaba con el arte 17 px más alto y
                el nombre ~20 px más bajo que las demás. */}
            <span className="relative min-h-[2.75em] line-clamp-2 text-[12px] leading-snug text-amber-100/85 min-[1100px]:text-[13px] [@media(max-height:340px)]:hidden">
              {info.tagline}
            </span>
            <span className="relative inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-bold text-amber-300">
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              {info.playerCountLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
