import { useEffect, useRef, type RefObject } from 'react';
import type { Card, Point } from '../cagao/types';
import type { Flight } from '../cagao/FlightLayer';
import type { SoundEffect } from '@/hooks/useGameSounds';
import { centerOf } from './useFlights';
import type { useDealIntro } from '../useDealIntro';

interface Options {
  deal: ReturnType<typeof useDealIntro>;
  roundKey: number;
  seats: number;
  cardsPerHand: number;
  deckRef: RefObject<HTMLElement | null>;
  boardRef: RefObject<HTMLElement | null>;
  anchorCenter: (seat: number) => Point | null;
  spawn: (items: Omit<Flight, 'id'>[]) => void;
  /** Carta de la mesa que se reparte en esa posición (null si es oculta). */
  tableCardAt: (index: number) => Card | null;
  playSound: (effect: SoundEffect) => void;
}

/**
 * El reparto de El Cagao para Casino y Tres y Dos: se baraja (con su sonido) y cada carta sale del mazo
 * volando hacia el asiento que la recibe, o hacia el tablero si es una carta de la mesa.
 */
export function useDealFlights({
  deal,
  roundKey,
  seats,
  cardsPerHand,
  deckRef,
  boardRef,
  anchorCenter,
  spawn,
  tableCardAt,
  playSound,
}: Options) {
  const lastShuffle = useRef(-1);
  const lastStep = useRef('');

  useEffect(() => {
    if (!deal.dealing || deal.shuffleFrame !== 0 || lastShuffle.current === roundKey) return;
    lastShuffle.current = roundKey;
    playSound('cardShuffle');
  }, [deal.dealing, deal.shuffleFrame, roundKey, playSound]);

  useEffect(() => {
    if (!deal.dealing || deal.shuffling) return;
    const step = deal.revealed;
    const key = `${roundKey}:${step}`;
    if (step >= deal.dealSteps || lastStep.current === key) return;
    lastStep.current = key;

    const handSteps = seats * cardsPerHand;
    const from = centerOf(deckRef.current);
    const toTable = step >= handSteps;
    const to = toTable ? centerOf(boardRef.current) : anchorCenter(step % seats);
    playSound('cardSlide');
    if (!from || !to) return;
    const tableCard = toTable ? tableCardAt(step - handSteps) : null;
    spawn([
      {
        from,
        to,
        card: tableCard,
        heightVar: toTable ? '--ph' : '--oh',
        durationMs: 300,
        plain: true,
      },
    ]);
  }, [deal.dealing, deal.shuffling, deal.revealed, deal.dealSteps, roundKey, seats, cardsPerHand, deckRef, boardRef, anchorCenter, spawn, tableCardAt, playSound]);
}
