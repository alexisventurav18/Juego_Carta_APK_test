import { useEffect, useState } from 'react';
import { cagaoDealIntroMs, DEAL_STEP_MS, dealIntroMs, SHUFFLE_TICK_MS, SHUFFLE_TICKS } from '../games/dealTiming';

const CARDS_PER_HAND = 4;
const CARDS_ON_TABLE = 4;

/**
 * Animación de barajar y repartir. Por defecto es la del Casino; el 3 y 2 reparte 5 y pone 1 en el Pozo.
 *
 * `enabled` pausa el reparto (por ejemplo, mientras está abierto el sorteo del repartidor): con el
 * reparto en pausa `dealing` sigue siendo true, así que nadie puede jugar hasta que se vea repartir.
 */
export function useDealIntro(
  roundKey: number,
  seats: number,
  cardsPerHand = CARDS_PER_HAND,
  cardsOnTable = CARDS_ON_TABLE,
  enabled = true,
) {
  const dealSteps = seats * cardsPerHand + cardsOnTable;
  const totalTicks = SHUFFLE_TICKS + dealSteps;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick(0);
  }, [roundKey]);

  useEffect(() => {
    if (!enabled || tick > totalTicks) return;
    const delay = tick < SHUFFLE_TICKS ? SHUFFLE_TICK_MS : DEAL_STEP_MS;
    const id = window.setTimeout(() => setTick((t) => t + 1), delay);
    return () => window.clearTimeout(id);
  }, [tick, totalTicks, enabled]);

  const shuffling = tick < SHUFFLE_TICKS;
  const dealing = tick <= totalTicks;
  const revealed = Math.max(0, tick - SHUFFLE_TICKS);
  const handSteps = seats * cardsPerHand;

  let dealingTo: number | 'table' | null = null;
  if (dealing && !shuffling) {
    dealingTo = revealed < handSteps ? revealed % seats : 'table';
  }

  return {
    dealing,
    shuffling,
    shuffleFrame: tick,
    revealed,
    dealSteps,
    dealingTo,
    isHandDealt: (seat: number, index: number) => !dealing || index * seats + seat < revealed,
    isTableDealt: (index: number) => !dealing || handSteps + index < revealed,
  };
}

/**
 * Intro de reparto de El Cagao. No hacen falta 49 vuelos individuales: se baraja y la mano de
 * cada jugador aparece de golpe al llegar su oleada (una por asiento), con el mazo visible en
 * el centro y el nombre de a quién se le está repartiendo. Dura lo mismo que dice
 * `cagaoDealIntroMs` (ese es el bloqueo que ven los bots).
 */
export function useCagaoDealIntro(roundKey: number, seats: number, enabled = true) {
  const totalTicks = SHUFFLE_TICKS + seats;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick(0);
  }, [roundKey]);

  useEffect(() => {
    if (!enabled || tick > totalTicks) return;
    const delay = tick < SHUFFLE_TICKS ? SHUFFLE_TICK_MS : DEAL_STEP_MS;
    const id = window.setTimeout(() => setTick((t) => t + 1), delay);
    return () => window.clearTimeout(id);
  }, [tick, totalTicks, enabled]);

  const shuffling = tick < SHUFFLE_TICKS;
  const dealing = tick <= totalTicks;
  /** Asientos cuya mano ya apareció. */
  const revealedSeats = Math.max(0, tick - SHUFFLE_TICKS);
  const dealingTo = dealing && !shuffling && revealedSeats < seats ? revealedSeats : null;

  return {
    dealing,
    shuffling,
    shuffleFrame: tick,
    revealedSeats,
    dealingTo,
    /** Duración total del reparto, para pruebas y para el bloqueo de los bots. */
    totalMs: cagaoDealIntroMs(seats),
    isSeatDealt: (seat: number) => !dealing || seat < revealedSeats,
  };
}

/** Duración total del reparto de `useDealIntro`, para pruebas y para el bloqueo de los bots. */
export function dealIntroTotalMs(seats: number, cardsPerHand: number, cardsOnTable: number): number {
  return dealIntroMs(seats, cardsPerHand, cardsOnTable);
}
