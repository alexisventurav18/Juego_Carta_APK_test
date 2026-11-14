import { useCallback, useRef, useState } from 'react';
import type { Flight } from '../cagao/FlightLayer';
import type { Point } from '../cagao/types';

export function centerOf(el: Element | null | undefined): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Cartas que vuelan por la mesa (reparto, robos, jugadas, capturas). Es la misma maquinaria de El Cagao,
 * compartida por los tres juegos: asientos registrados como anclas y vuelos que corren con WAAPI.
 */
export function useFlights() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const anchors = useRef(new Map<number, HTMLElement>());
  const flightSeq = useRef(0);

  const registerAnchor = useCallback((seat: number, el: HTMLElement | null) => {
    if (el) anchors.current.set(seat, el);
    else anchors.current.delete(seat);
  }, []);

  const anchorCenter = useCallback((seat: number): Point | null => centerOf(anchors.current.get(seat)), []);

  const spawn = useCallback((items: Omit<Flight, 'id'>[]) => {
    if (prefersReducedMotion() || items.length === 0) return;
    setFlights((current) => [...current, ...items.map((item) => ({ ...item, id: ++flightSeq.current }))]);
  }, []);

  const endFlight = useCallback((id: number) => {
    setFlights((current) => current.filter((f) => f.id !== id));
  }, []);

  return { flights, spawn, endFlight, registerAnchor, anchorCenter };
}
