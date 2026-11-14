import type { SeatLayout } from '@/components/cagao/types';

/** Reparte a los rivales alrededor de la mesa: el siguiente en el orden de juego queda a tu izquierda. */
export function seatLayout(total: number, me: number): SeatLayout {
  const others = Array.from({ length: total - 1 }, (_, i) => (me + 1 + i) % total);
  if (others.length <= 1) return { left: null, top: others, right: null };
  if (others.length === 2) return { left: others[0], top: [], right: others[1] };
  return { left: others[0], top: others.slice(1, -1), right: others[others.length - 1] };
}
