import { type CSSProperties } from 'react';
import { isAmericanSuit, isRedSuit, rankLabel } from '@/games/cards';
import { CAGAO_CARD_ID } from '@/games/cagao';
import { cardBackClass, cardFaceClass } from '@/lib/card3d';
import { CagaoFaceArt, CARD_BACK_URL, FaceCrest, SuitIcon } from './CardAssets';
import type { Card } from './types';

interface PlayingCardProps {
  /** Carta a mostrar. Sin carta (o con `faceDown`) se ve el reverso de cacao. */
  card?: Card;
  faceDown?: boolean;
  /** Nombre de la variable CSS con el alto de la carta (p. ej. "--ch"). El ancho sale de la proporción 5:7. */
  heightVar: string;
  /** Casino y Tres y Dos: el A♠ es un As normal, sin la ilustración de El Cagao. */
  plain?: boolean;
  /** Giro 3D de reparto al montar la carta (por defecto sí). Los dorsos no giran nunca. */
  deal?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Carta con la proporción de póker (2.5 : 3.5). Todo su tamaño sale de una sola variable CSS de alto,
 * así el texto, los palos y los adornos escalan con la pantalla sin tamaños fijos en px.
 */
export default function PlayingCard({ card, faceDown, heightVar, plain = false, deal = true, className = '', style }: PlayingCardProps) {
  const base: CSSProperties = {
    '--card-h': `var(${heightVar})`,
    height: 'var(--card-h)',
    ...style,
  } as CSSProperties;

  if (!card || faceDown) {
    return (
      <div
        className={`aspect-[2.5/3.5] shrink-0 rounded-[calc(var(--card-h)*0.07)] bg-[#2a160a] bg-cover bg-center bg-no-repeat ${cardBackClass()} ring-1 ring-black/40 ${className}`}
        style={{ ...base, backgroundImage: `var(--card-back-image, ${CARD_BACK_URL})` }}
      />
    );
  }

  const red = isAmericanSuit(card.suit) && isRedSuit(card.suit);
  const label = rankLabel(card);
  const isFigure = card.rank >= 11 && card.rank <= 13;
  const isCagao = !plain && card.id === CAGAO_CARD_ID;
  // La cara toma los colores del tema de baraja equipado (App.tsx inyecta
  // --card-face-*); sin tema, la cara crema de siempre. El rango y el palo
  // nunca se tocan: solo cambian fondo, marco, tintas y brillo central.
  const faceStyle: CSSProperties = {
    ...base,
    background: 'var(--card-face-bg, #f7ecce)',
    color: red ? 'var(--card-face-red, #b3202a)' : 'var(--card-face-ink, #1d1b2e)',
  };

  return (
    <div
      className={`relative aspect-[2.5/3.5] shrink-0 overflow-hidden rounded-[calc(var(--card-h)*0.07)] ${cardFaceClass(deal)} ring-1 ring-black/35 ${className}`}
      style={faceStyle}
      role="img"
      aria-label={isCagao ? 'As de picas, El Cagao' : `${label} de ${card.suit}`}
    >
      {/* Marco interior y brillo central del tema: decoración pura, detrás
          del rango, el palo y la figura. Con el tema por defecto el marco es
          transparente y el brillo es el crema de siempre. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[3%] rounded-[calc(var(--card-h)*0.05)] border-solid"
        style={{ borderColor: 'var(--card-face-frame, transparent)', borderWidth: 'calc(var(--card-h) * 0.02)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, var(--card-face-accent, #f1e0b3) 0%, transparent 62%)',
          opacity: 0.3,
        }}
      />
      {isCagao ? (
        <CagaoFaceArt className="absolute inset-0 h-full w-full" />
      ) : (
        <>
          <span className="absolute left-[8%] top-[4%] flex flex-col items-center leading-none">
            <span className="font-serif font-extrabold" style={{ fontSize: 'calc(var(--card-h) * 0.17)' }}>
              {label}
            </span>
            <SuitIcon suit={card.suit} className="mt-[6%] h-[calc(var(--card-h)*0.13)] w-[calc(var(--card-h)*0.13)]" />
          </span>
          <span className="absolute bottom-[4%] right-[8%] flex rotate-180 flex-col items-center leading-none">
            <span className="font-serif font-extrabold" style={{ fontSize: 'calc(var(--card-h) * 0.17)' }}>
              {label}
            </span>
            <SuitIcon suit={card.suit} className="mt-[6%] h-[calc(var(--card-h)*0.13)] w-[calc(var(--card-h)*0.13)]" />
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            {isFigure ? (
              <span className="relative flex h-[62%] w-[56%] flex-col items-center justify-between">
                <FaceCrest rank={card.rank} className="h-[74%] w-full" />
                <SuitIcon suit={card.suit} className="h-[26%] w-[40%]" />
              </span>
            ) : (
              <SuitIcon suit={card.suit} className="h-[40%] w-[44%]" />
            )}
          </span>
        </>
      )}
    </div>
  );
}
