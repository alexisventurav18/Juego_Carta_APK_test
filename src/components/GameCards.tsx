import type { CSSProperties } from 'react';
import { Users } from 'lucide-react';
import { GAMES } from '@/games';
import type { Card } from '@/games/cards';
import type { GameId } from '@/games/shared';
import PlayingCard from './cagao/PlayingCard';

interface GameCardsProps {
  games: GameId[];
  selected: GameId;
  onSelect: (id: GameId) => void;
}

const card = (id: string, suit: Card['suit'], rank: number): Card => ({ id, suit, rank });

/** Tres cartas de muestra por juego: las que mejor lo resumen. */
const PREVIEW: Record<GameId, { cards: Card[]; plain: boolean }> = {
  // Las tres cartas que más puntos dan en el Casino: el As, el 10 de diamantes y el 2 de picas.
  casino: { cards: [card('p-c1', 'corazones', 1), card('p-c2', 'diamantes', 10), card('p-c3', 'picas', 2)], plain: true },
  // Una tercia y un par es el 3 y 2: aquí, dos reyes y un 8.
  tresydos: { cards: [card('p-t1', 'picas', 13), card('p-t2', 'corazones', 13), card('p-t3', 'treboles', 8)], plain: true },
  // El A♠ es El Cagao, junto a dos cartas que ya tienen pareja en juego.
  cagao: { cards: [card('p-g1', 'corazones', 7), card('picas-1', 'picas', 1), card('p-g3', 'treboles', 7)], plain: false },
  // Un 9 que roba el paquete de otro 9: la carta jugada va encima de lo que se llevó.
  robaito: { cards: [card('p-r1', 'treboles', 9), card('p-r2', 'corazones', 9), card('p-r3', 'picas', 9)], plain: true },
};

const FAN_TILT = [-9, 0, 9];

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
        const preview = PREVIEW[id];
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
              className="relative flex min-h-0 w-full flex-1 items-center justify-center rounded-xl bg-black/30 ring-1 ring-amber-200/20"
              style={{ '--lobby-card-h': 'clamp(36px, 15dvh, 104px)' } as CSSProperties}
            >
              {preview.cards.map((c, i) => (
                <span
                  key={c.id}
                  className={`block ${i === 0 ? '' : '-ml-[calc(var(--lobby-card-h)*0.3)]'}`}
                  style={{ transform: `rotate(${FAN_TILT[i]}deg) translateY(${i === 1 ? -5 : 0}px)`, zIndex: i === 1 ? 2 : 1 }}
                >
                  <PlayingCard card={c} heightVar="--lobby-card-h" plain={preview.plain} />
                </span>
              ))}
            </span>
            <span className="relative text-[clamp(15px,4.2dvh,24px)] font-extrabold leading-none text-amber-50">{info.name}</span>
            <span className="relative line-clamp-2 text-[clamp(10px,2.5dvh,13px)] leading-snug text-amber-100/85 [@media(max-height:340px)]:hidden">
              {info.tagline}
            </span>
            <span className="relative inline-flex items-center gap-1 text-[clamp(10px,2.4dvh,12px)] font-bold text-amber-300">
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              {info.playerCountLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
