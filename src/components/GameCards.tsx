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
      className="flex min-h-0 w-full flex-1 items-stretch justify-center gap-[clamp(8px,2dvw,22px)]"
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
            className={`wood-block relative flex min-h-0 min-w-0 max-w-[340px] flex-1 touch-manipulation flex-col items-center gap-[1.2dvh] rounded-2xl p-[clamp(6px,1.8dvh,16px)] text-center transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
              active ? '-translate-y-1 scale-[1.02] ring-2 ring-amber-300' : 'opacity-90 hover:-translate-y-0.5 hover:opacity-100'
            }`}
          >
            {active && <span aria-hidden className="turn-glow pointer-events-none absolute -inset-1 rounded-[1.25rem]" />}
            <span
              aria-hidden
              className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/30 ring-1 ring-amber-200/20"
            >
              <img src={MODE_ART[id]} alt="" className="h-[92%] max-w-full rounded-lg object-contain drop-shadow-md" />
            </span>
            <span className="relative text-[clamp(15px,4.2dvh,24px)] font-extrabold leading-none text-amber-50">{info.name}</span>
            <span className="relative line-clamp-2 text-[13px] leading-snug text-amber-100/85 [@media(max-height:340px)]:hidden">
              {info.tagline}
            </span>
            <span className="relative inline-flex items-center gap-1 text-[13px] font-bold text-amber-300">
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              {info.playerCountLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
