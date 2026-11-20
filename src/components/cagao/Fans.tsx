import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { fanMargin, fanPose } from './fanLayout';
import { DRAG_THRESHOLD, resolveActivation, wantsDrag } from './fanTouch';
import PlayingCard from './PlayingCard';
import type { Card, Point } from './types';

const LIFT = 'translate3d(0,-18px,0) scale(1.06)';
const LIFT_TWIN = 'translate3d(0,-9px,0) scale(1.03)';

interface HandFanProps {
  cards: Card[];
  heightVar: string;
  /** Largo máximo del abanico (longitud CSS). */
  avail: string;
  /** Casino y Tres y Dos: el A♠ es un As normal, sin la ilustración de El Cagao. */
  plain?: boolean;
  /** Cartas marcadas con aro dorado (en El Cagao, las que tienen pareja). */
  markedIds?: Set<string>;
  /** Cartas que se pueden usar ahora mismo (aro verde suave). */
  playableIds?: Set<string>;
  /** Cartas de puntos del Casino (10♦, 2♠ y ases): aro dorado permanente. */
  pointCardIds?: Set<string>;
  /** Cartas elegidas: se quedan elevadas con aro amarillo. */
  selectedIds?: Set<string>;
  /** Cartas que no se pueden tocar ahora (se atenúan). */
  disabledIds?: Set<string>;
  /** Pareja de una carta (se eleva un poco al pasar sobre la otra). */
  twinOf?: (cardId: string) => Card | null;
  /** Carta que acabas de robar. */
  highlightId?: string | null;
  highlightLabel?: string;
  /** Se pueden tocar y arrastrar cartas ahora. */
  interactive: boolean;
  /** Si esta carta se puede arrastrar hacia la mesa. */
  canDrag: (card: Card) => boolean;
  /** Zona de la mesa donde se sueltan las cartas arrastradas. */
  dropRef: RefObject<HTMLElement>;
  /** Toque (o clic) en una carta. Devuelve false si no se pudo: la carta se sacude. */
  onTap: (card: Card) => boolean | void;
  /** Carta soltada sobre la mesa, con el punto exacto de la suelta. Devuelve true si se aceptó. */
  onDrop: (card: Card, point: Point) => boolean | void;
  /** Se empezó a arrastrar esta carta. */
  onDragStart?: (card: Card) => void;
  onDraggingChange: (dragging: boolean) => void;
  containerRef?: (el: HTMLDivElement | null) => void;
}

interface Press {
  id: string;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  dragging: boolean;
  layer: HTMLElement;
  raf: number | null;
}

/**
 * Tu mano en abanico, igual en los tres juegos. Pointer Events: ratón y táctil por igual.
 * - Pasar el ratón o deslizar el dedo sobre una carta la eleva (y su pareja, si hay, se eleva un poco).
 * - Tocar o hacer clic activa la carta (en El Cagao baja el par; en Casino y Tres y Dos la elige).
 * - Un toque casi quieto activa la carta que se pulsó, no la que quedó bajo el dedo al soltar: las zonas
 *   de toque se solapan y una deriva de pocos píxeles no debe activar la vecina. Solo un deslizamiento
 *   de verdad activa la carta que quedó bajo el dedo.
 * - Arrastrar una carta hasta la mesa la juega; si la sueltas fuera, vuelve a su sitio.
 * Solo se animan `transform` y `opacity`; mientras arrastras, la posición se escribe directo en el DOM
 * (sin re-render por cada movimiento).
 */
export function HandFan({
  cards,
  heightVar,
  avail,
  plain = false,
  markedIds,
  playableIds,
  pointCardIds,
  selectedIds,
  disabledIds,
  twinOf,
  highlightId = null,
  highlightLabel = 'Recién robada',
  interactive,
  canDrag,
  dropRef,
  onTap,
  onDrop,
  onDragStart,
  onDraggingChange,
  containerRef,
}: HandFanProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  /** Carta que se está pulsando: su zona de toque sube por encima de las vecinas mientras el gesto siga
      siendo un toque (así el dedo no "pierde" la carta al derivar unos píxeles); al deslizar o soltar, baja. */
  const [pressId, setPressId] = useState<string | null>(null);
  const [wiggleId, setWiggleId] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  const n = cards.length;
  const hoverTwinId = hoverId && twinOf ? (twinOf(hoverId)?.id ?? null) : null;

  const idUnder = (x: number, y: number): string | null =>
    document.elementFromPoint(x, y)?.closest('[data-hand-id]')?.getAttribute('data-hand-id') ?? null;

  const wiggle = (id: string) => {
    setWiggleId(id);
    window.setTimeout(() => setWiggleId((current) => (current === id ? null : current)), 320);
  };

  const activate = (card: Card) => {
    if (!interactive || disabledIds?.has(card.id)) return;
    if (onTap(card) === false) wiggle(card.id);
  };

  const draggable = (card: Card) => interactive && !disabledIds?.has(card.id) && canDrag(card);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, card: Card) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const layer = e.currentTarget.querySelector<HTMLElement>('[data-drag-layer]');
    if (!layer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { id: card.id, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, dragging: false, layer, raf: null };
    setHoverId(card.id);
    setPressId(card.id);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>, card: Card) => {
    const p = press.current;
    if (!p || p.id !== card.id) return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    // En cuanto el dedo se mueve más del umbral ya no es un toque: la zona de la carta pulsada vuelve a
    // su sitio para que el deslizamiento vea la carta real que hay bajo el dedo.
    if (pressId !== null && Math.hypot(dx, dy) > DRAG_THRESHOLD) setPressId(null);
    if (!p.dragging) {
      // Con el ratón cualquier movimiento arrastra. Con el dedo, subir hacia la mesa arrastra; moverse de
      // lado desliza por las cartas para elegir (así no se confunden los dos gestos).
      if (draggable(card) && wantsDrag(dx, dy, e.pointerType)) {
        p.dragging = true;
        setDragId(card.id);
        onDraggingChange(true);
        onDragStart?.(card);
      } else if (e.pointerType !== 'mouse') {
        // Con el dedo, deslizar sobre las cartas va elevando la que tocas.
        const id = idUnder(e.clientX, e.clientY);
        if (id && id !== hoverId) setHoverId(id);
      }
    }
    if (p.dragging) {
      p.dx = dx;
      p.dy = dy;
      if (p.raf === null) {
        p.raf = requestAnimationFrame(() => {
          p.raf = null;
          p.layer.style.transition = 'none';
          p.layer.style.transform = `translate3d(${p.dx}px,${p.dy}px,0) scale(1.12)`;
        });
      }
    }
  };

  const finish = (e: PointerEvent<HTMLDivElement>, card: Card, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.id !== card.id) return;
    press.current = null;
    setPressId(null);
    if (p.raf !== null) cancelAnimationFrame(p.raf);

    if (p.dragging) {
      let accepted = false;
      if (!cancelled) {
        const zone = dropRef.current?.getBoundingClientRect();
        const inside =
          zone && e.clientX >= zone.left && e.clientX <= zone.right && e.clientY >= zone.top && e.clientY <= zone.bottom;
        if (inside) accepted = onDrop(card, { x: e.clientX, y: e.clientY }) !== false;
      }
      // Vuelve a su sitio (si la jugada se aceptó, la carta desaparece y esto no se nota).
      p.layer.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      p.layer.style.transform = '';
      if (!accepted && !cancelled) wiggle(card.id);
      setDragId(null);
      onDraggingChange(false);
    } else if (!cancelled) {
      // Un toque casi quieto activa LA CARTA QUE SE PULSÓ: en el abanico las zonas de toque se solapan y
      // cada carta visible es una franja estrecha, así que una deriva de pocos píxeles al soltar no debe
      // acabar activando la vecina. Solo un deslizamiento de verdad activa la carta que quedó bajo el dedo.
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      const targetId = resolveActivation(moved, e.pointerType, card.id, idUnder(e.clientX, e.clientY));
      if (targetId !== null) activate(cards.find((c) => c.id === targetId) ?? card);
    }
    if (e.pointerType !== 'mouse') setHoverId(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, card: Card) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(card);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative isolate flex touch-none items-end justify-center"
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && !press.current) setHoverId(null);
      }}
    >
      {cards.map((card, i) => {
        const pose = fanPose(i, n, heightVar);
        const dragging = dragId === card.id;
        const selected = selectedIds?.has(card.id) ?? false;
        const lifted = hoverId === card.id || dragging || selected;
        const twinLifted = !lifted && hoverTwinId === card.id;
        const marked = interactive && (markedIds?.has(card.id) ?? false);
        const playable = interactive && (playableIds?.has(card.id) ?? false);
        const isPointCard = pointCardIds?.has(card.id) ?? false;
        // Carta jugable (puede capturar o levantar): se levanta un poco y se ilumina
        // siempre, no solo al pasar el dedo. Las demás no se atenúan: en Casino y
        // Robaíto también se pueden dejar en la mesa o usar para formar.
        const playableLift = playable && !lifted && !twinLifted;
        const dimmed = disabledIds?.has(card.id) ?? false;
        const poseStyle = {
          transform: `translateY(${pose.drop}) rotate(${pose.rotate}deg)`,
          transformOrigin: '50% 130%',
        };
        const ring = selected
          ? 'ring-[3px] ring-yellow-300'
          : marked
            ? twinLifted || lifted
              ? 'ring-[3px] ring-amber-300'
              : 'ring-2 ring-amber-300/80'
            : playable
              ? 'ring-2 ring-lime-300/80'
              : '';
        return (
          <div
            key={card.id}
            data-hand-id={card.id}
            className="pointer-events-none relative"
            style={{ marginLeft: i === 0 ? 0 : fanMargin(n, heightVar, avail) }}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse' && !press.current) setHoverId(card.id);
            }}
            onPointerDown={(e) => onPointerDown(e, card)}
            onPointerMove={(e) => onPointerMove(e, card)}
            onPointerUp={(e) => finish(e, card, false)}
            onPointerCancel={(e) => finish(e, card, true)}
          >
            {/* Zona de toque: se queda quieta (con la inclinación del abanico) aunque la carta se eleve,
                así el dedo o el ratón no "pierden" la carta al subirla. Mientras se pulsa, su zona sube por
                encima de las vecinas para que ninguna la tape durante el gesto. */}
            <div
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${marked ? 'Bajar el par con ' : ''}carta ${i + 1} de ${n}`}
              className="pointer-events-auto absolute inset-0 cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              style={{ ...poseStyle, zIndex: pressId === card.id ? 5000 : 1000 + i }}
              onKeyDown={(e) => onKeyDown(e, card)}
            />
            {/* La carta que se ve: se eleva con transform y pasa por encima de sus vecinas. */}
            <div
              data-hand-lift
              className="pointer-events-none relative will-change-transform"
              style={{
                zIndex: lifted ? 300 : twinLifted || playableLift ? 200 : i + 1,
                transform: lifted ? LIFT : twinLifted || playableLift ? LIFT_TWIN : 'translate3d(0,0,0)',
                transition: 'transform 150ms ease-out',
              }}
            >
              <div data-drag-layer className="will-change-transform">
                <div style={poseStyle}>
                  <div
                    className={`${wiggleId === card.id ? 'card-wiggle ' : ''}relative rounded-[calc(var(${heightVar})*0.07)] transition-shadow ${ring} ${
                      highlightId === card.id && !selected ? 'ring-[3px] ring-yellow-300' : ''
                    } ${dimmed ? 'opacity-60' : ''} ${playable && !selected ? 'brightness-110 saturate-110' : ''} ${isPointCard ? 'point-card-ring' : ''}`}
                  >
                    <PlayingCard card={card} heightVar={heightVar} plain={plain} />
                    {highlightId === card.id && (
                      <span className="pointer-events-none absolute -top-3 right-0 z-20 whitespace-nowrap rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-stone-900 shadow">
                        {highlightLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface OpponentFanProps {
  count: number;
  heightVar: string;
  avail: string;
  /** Giro del abanico entero para que las cartas apunten al centro de la mesa. */
  rotation: number;
  /** Te toca robarle a este jugador: el abanico brilla y sus cartas se pueden jalar. */
  active: boolean;
  label: string;
  onPick: (index: number) => void;
  containerRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Cartas boca abajo de un rival. Cuando te toca robarle, el abanico late en dorado; pasar el ratón o
 * deslizar el dedo sube la carta hacia el centro, y soltar/tocar la jala a tu mano.
 */
export function OpponentFan({ count, heightVar, avail, rotation, active, label, onPick, containerRef }: OpponentFanProps) {
  const [hover, setHover] = useState<number | null>(null);
  // Solo cuenta como jalar si el toque empezó sobre el abanico (no si llegas arrastrando desde fuera).
  const armed = useRef(false);

  const indexUnder = (x: number, y: number): number | null => {
    const raw = document.elementFromPoint(x, y)?.closest('[data-opp-index]')?.getAttribute('data-opp-index');
    return raw === null || raw === undefined ? null : Number(raw);
  };

  return (
    <div
      ref={containerRef}
      className={`relative isolate flex items-end justify-center ${active ? 'cursor-pointer touch-none' : 'pointer-events-none'}`}
      style={{ transform: `rotate(${rotation}deg)` }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          setHover(null);
          armed.current = false;
        }
      }}
      onPointerCancel={() => {
        armed.current = false;
        setHover(null);
      }}
      onPointerDown={(e) => {
        if (!active) return;
        armed.current = true;
        setHover(indexUnder(e.clientX, e.clientY));
      }}
      onPointerMove={(e) => {
        if (!active) return;
        if (e.pointerType === 'mouse' || e.buttons > 0 || e.pressure > 0) setHover(indexUnder(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        if (!active || !armed.current) return;
        armed.current = false;
        const index = indexUnder(e.clientX, e.clientY);
        if (e.pointerType !== 'mouse') setHover(null);
        if (index !== null) onPick(index);
      }}
    >
      {active && <span aria-hidden className="gold-glow pointer-events-none absolute -inset-[48%] rounded-full" />}
      {Array.from({ length: count }, (_, i) => {
        const pose = fanPose(i, count, heightVar, 18);
        const lifted = active && hover === i;
        const poseStyle = {
          transform: `translateY(${pose.drop}) rotate(${pose.rotate}deg)`,
          transformOrigin: '50% 130%',
        };
        return (
          <div
            key={i}
            className="pointer-events-none relative"
            style={{ marginLeft: i === 0 ? 0 : fanMargin(count, heightVar, avail, 0.6) }}
          >
            {/* Zona de toque fija: la carta se eleva, pero lo que se toca no se mueve. */}
            <button
              type="button"
              tabIndex={active ? 0 : -1}
              data-opp-index={i}
              aria-label={`Jalar la carta ${i + 1} de ${count} de ${label}`}
              onClick={(e) => {
                // El clic de teclado (detail 0) también jala; el ratón y el dedo ya lo hacen al soltar.
                if (active && e.detail === 0) onPick(i);
              }}
              className={`absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
                active ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
              style={{ ...poseStyle, zIndex: 1000 + i }}
            />
            <div
              data-opp-lift
              className="pointer-events-none relative will-change-transform"
              style={{
                zIndex: lifted ? 100 : i + 1,
                transform: lifted ? 'translate3d(0,-14px,0) scale(1.06)' : 'translate3d(0,0,0)',
                transition: 'transform 150ms ease-out',
              }}
            >
              <div style={poseStyle}>
                <PlayingCard faceDown heightVar={heightVar} className={lifted ? 'ring-2 ring-yellow-300' : ''} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
