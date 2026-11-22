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
              active ? '-translate-y-1 scale-[1.02] ring-2 ring-amber-300' : 'opacity-90 hover:-translate-y-0.5 hover:opacity-100'
            }`}
          >
            {active && <span aria-hidden className="turn-glow pointer-events-none absolute -inset-1 rounded-[1.25rem]" />}
            {/* El arte llena su panel (las imágenes son cuadradas 512×512):
                antes, con la imagen contenida en un panel más alto que ancho,
                quedaban bandas oscuras arriba y abajo. En pantallas altas la
                tarjeta ya no se estira: su altura la manda el ancho (aspect
                3/4) y el arte ocupa todo lo que sobra, sin tope. */}
            <span
              aria-hidden
              className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/30 ring-1 ring-amber-200/20"
            >
              <img src={MODE_ART[id]} alt="" className="h-full w-full rounded-lg object-cover drop-shadow-md" />
            </span>
            <span className="relative whitespace-nowrap text-[clamp(15px,4.2dvh,24px)] font-extrabold leading-none text-amber-50 max-[640px]:text-[15px]">{info.name}</span>
            <span className="relative line-clamp-2 text-[12px] leading-snug text-amber-100/85 min-[1100px]:text-[13px] [@media(max-height:340px)]:hidden">
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
