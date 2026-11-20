import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { captureOptions, type CaptureOptions, robaitoKind, type RobaitoKind, type RobaitoMove, type RobaitoState } from '@/games/robaito';
import type { Card } from '@/components/cagao/types';
import { seatLayout } from '@/components/table/seatLayout';
import { useGameSounds } from './useGameSounds';

interface Options {
  state: RobaitoState;
  seat: number;
  onMove: (move: RobaitoMove) => void;
}

/**
 * Lógica de la mesa de El Robaíto para la interfaz: qué carta está elegida, qué se llevaría, qué cartas
 * de tu mano capturan, y los sonidos de cada jugada. No dibuja nada.
 */
export function useRobaitoGame({ state, seat, onMove }: Options) {
  const { playSound } = useGameSounds();
  const [cardId, setCardId] = useState<string | null>(null);

  const hand = state.hands[seat];
  const playing = state.phase === 'playing';
  const myTurn = playing && state.turn === seat;
  const gameOver = state.phase === 'gameOver';
  const iWon = state.winnerSeats.includes(seat);
  const tie = state.winnerSeats.length > 1;
  const event = state.lastEvent;
  const layout = useMemo(() => seatLayout(state.players.length, seat), [state.players.length, seat]);

  const selected = hand.find((c) => c.id === cardId) ?? null;

  /** Qué se llevaría cada carta de tu mano si la juegas ahora (solo en tu turno). */
  const optionsByCard = useMemo(() => {
    const map = new Map<string, CaptureOptions>();
    if (!myTurn) return map;
    for (const card of hand) map.set(card.id, captureOptions(state, seat, card));
    return map;
  }, [myTurn, hand, state, seat]);

  const selectedOptions: CaptureOptions | null = selected ? (optionsByCard.get(selected.id) ?? null) : null;
  const selectedKind: RobaitoKind | null = selectedOptions ? robaitoKind(selectedOptions) : null;

  /** Cartas que roban un paquete (aro dorado) y cartas que levantan de la mesa (aro verde). */
  const stealIds = useMemo(
    () => new Set([...optionsByCard].filter(([, o]) => o.steals.length > 0).map(([id]) => id)),
    [optionsByCard],
  );
  const liftIds = useMemo(
    () => new Set([...optionsByCard].filter(([, o]) => o.steals.length === 0 && o.table.length > 0).map(([id]) => id)),
    [optionsByCard],
  );

  // Cada turno nuevo empieza sin carta elegida.
  useEffect(() => {
    setCardId(null);
  }, [state.turn, state.dealNo, state.lastEvent?.seq]);

  const play = useCallback(
    (card: Card) => {
      if (!myTurn) return;
      onMove({ type: 'play', cardId: card.id });
      setCardId(null);
    },
    [myTurn, onMove],
  );

  /** Tocar elige la carta; tocar la que ya está elegida la juega. */
  const tapCard = useCallback(
    (card: Card): boolean => {
      if (!myTurn) return false;
      if (cardId === card.id) {
        play(card);
        return true;
      }
      setCardId(card.id);
      return true;
    },
    [myTurn, cardId, play],
  );

  /* ------------------------------ sonidos ------------------------------ */

  const lastSeq = useRef(event?.seq ?? 0);
  useEffect(() => {
    if (!event || event.seq === lastSeq.current) return;
    lastSeq.current = event.seq;
    playSound(event.kind === 'steal' ? 'steal' : event.kind === 'capture' ? 'pairMatch' : 'cardSlide');
    if (event.redeal) {
      const timer = window.setTimeout(() => playSound('cardShuffle'), 650);
      return () => window.clearTimeout(timer);
    }
  }, [event, playSound]);

  // Fin de la partida: victoria (o empate) o derrota.
  useEffect(() => {
    if (!gameOver) return;
    const timer = window.setTimeout(() => playSound(iWon ? 'win' : 'lose'), 500);
    return () => window.clearTimeout(timer);
  }, [gameOver, iWon, playSound]);

  // Aviso de turno: suena solo cuando el turno pasa a ser tuyo (no al montar la mesa).
  const wasMyTurn = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasMyTurn.current === false && myTurn) playSound('turn');
    wasMyTurn.current = myTurn;
  }, [myTurn, playSound]);

  return {
    hand,
    playing,
    myTurn,
    gameOver,
    iWon,
    tie,
    event,
    layout,
    selected,
    selectedOptions,
    selectedKind,
    stealIds,
    liftIds,
    optionsByCard,
    setCardId,
    play,
    tapCard,
  };
}
