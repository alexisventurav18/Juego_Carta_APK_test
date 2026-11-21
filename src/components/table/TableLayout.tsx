import { useEffect, type CSSProperties, type ReactNode, type Ref } from 'react';
import { WoodFrame } from '../cagao/CardAssets';

/** Medidas de la mesa: todo sale de la altura de pantalla (dvh), así escala en cualquier resolución. */
const BASE_VARS = {
  '--frame': 'clamp(10px, 2.6dvh, 24px)',
  '--corner': 'clamp(28px, 9dvh, 60px)',
  '--medal': 'clamp(26px, 8dvh, 56px)',
  // Alto de cartas: tu mano, las de los rivales y las de la pila central.
  '--ch': 'clamp(58px, 23.5dvh, 157px)',
  '--oh': 'clamp(34px, 12.3dvh, 83px)',
  '--ph': 'clamp(45px, 17.9dvh, 108px)',
} as CSSProperties;

interface TableLayoutProps {
  /** Acciones de la barra de controles (Salir y botones propios del modo). */
  controlsLeft: ReactNode;
  /** Estado de la barra de controles (ficha de mazo/ronda + píldora de turno). */
  controlsCenter: ReactNode;
  /** Opciones (engranaje), fijo en su esquina derecha. */
  controlsRight: ReactNode;
  /** Rivales de arriba, con su abanico y su placa (en Casino, flanqueados por los paneles de puntos). */
  topSeats: ReactNode;
  left: ReactNode;
  center: ReactNode;
  /** Celda central (el tablero): zona donde se sueltan las cartas arrastradas. */
  centerRef?: Ref<HTMLDivElement>;
  right: ReactNode;
  bottomLeft: ReactNode;
  bottomCenter: ReactNode;
  /** Celda de tu mano: ancla de los vuelos que llegan a ti o salen de ti. */
  bottomCenterRef?: Ref<HTMLDivElement>;
  bottomRight: ReactNode;
  /** Pista de la partida: su propio carril entre el tablero y la mano; si no hay pista, se colapsa. */
  hint?: ReactNode;
  /** Ventanas, avisos y capas que van encima de la mesa. */
  overlays?: ReactNode;
  /** Variables CSS propias de un juego (alto de cartas, etc.). */
  vars?: CSSProperties;
  /** Ancho de las columnas laterales (rivales de izquierda y derecha). */
  sideCols?: string;
  /** Color de acento del modo que se juega: tiñe el brillo detrás del tablero. */
  accent?: string;
}

/**
 * La mesa de El Cagao hecha componente: marco de madera tallada, rivales a izquierda, arriba y derecha,
 * tablero al centro y tú abajo (placa, mano y acciones). Los tres juegos usan este mismo esqueleto, así
 * se ven y se sienten igual. El marco llega a los bordes de la pantalla; el contenido respeta el notch.
 *
 * La rejilla tiene un carril por cosa y nada se monta sobre nada: la barra de controles (acciones |
 * estado | opciones) y la fila de rivales de arriba ocupan todo el ancho, cada una en su fila; la pista
 * tiene su propio carril entre el tablero y la mano (antes iba pegada al borde inferior del tablero y
 * lo tapaba); el tablero y tu mano quedan en sus filas de siempre. Antes la fila superior era una sola
 * fila de tres celdas estrechas (16-17% los lados) donde Salir, la ficha de mazo, los paneles de puntos,
 * los abanicos, las placas y la píldora de turno se peleaban el mismo hueco: la ficha de mazo quedaba
 * bajo el panel "Nosotros", la píldora "Tu turno" tapaba el panel "Ellos" y las placas de arriba se
 * encogían hasta perder el nombre. Con cada carril a todo lo ancho, cada elemento tiene su hueco
 * reservado y nada se superpone en ningún tamaño.
 */
export default function TableLayout({
  controlsLeft,
  controlsCenter,
  controlsRight,
  topSeats,
  left,
  center,
  centerRef,
  right,
  bottomLeft,
  bottomCenter,
  bottomCenterRef,
  bottomRight,
  hint,
  overlays,
  vars,
  // El tablero central es lo más grande posible: las columnas laterales solo ocupan lo que necesitan
  // los rivales de los costados y tu zona, para que el fondo de mesa se vea bien.
  sideCols = '16%',
  accent,
}: TableLayoutProps) {
  // La mesa ocupa toda la pantalla: se bloquea el scroll de la página mientras está abierta.
  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 touch-none select-none overflow-hidden overscroll-none bg-[#2a160a] bg-[radial-gradient(ellipse_at_50%_35%,#4a2a12,#1e0e05_75%)] text-amber-50"
      style={{ ...BASE_VARS, ...vars }}
    >
      {/* Marco a sangre: la madera llega hasta los bordes físicos de la pantalla (sin franjas negras). */}
      <WoodFrame />

      {/* Brillo del modo que se juega: un halo suave con el color del juego detrás del tablero. */}
      {accent && (
        <div
          aria-hidden
          className="table-halo-breathe pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 45%, ${accent}33 0%, transparent 65%)` }}
        />
      )}

      {/* Rejilla de la mesa: el contenido se sangra hacia dentro lo justo para esquivar el notch y las esquinas.
          Filas: controles | rivales de arriba | tablero | pista | tu zona. Las dos primeras y la pista van a
          todo lo ancho; el tablero y tu zona usan las tres columnas de siempre. */}
      <div
        className="absolute grid"
        style={{
          top: 'calc(var(--frame) + 4px + var(--sat))',
          right: 'calc(var(--frame) + 4px + var(--sar))',
          bottom: 'calc(var(--frame) + 4px + var(--sab))',
          left: 'calc(var(--frame) + 4px + var(--sal))',
          gridTemplateColumns: `${sideCols} minmax(0,1fr) ${sideCols}`,
          gridTemplateRows: 'auto auto minmax(0,1fr) auto 32%',
        }}
      >
        {/* Barra de controles: acciones a la izquierda, estado centrado, opciones a la derecha. Los grupos
            laterales son flex-1 para que el del centro quede de verdad centrado y el engranaje no se mueva
            nunca con los cambios de turno. En pantallas muy estrechas el relleno de las esquinas se achica. */}
        <div className="col-span-3 z-30 flex items-center gap-2 px-1 pl-[calc(var(--corner)*0.8)] pr-[calc(var(--corner)*0.8)] max-[480px]:px-1">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">{controlsLeft}</div>
          <div className="flex shrink-0 items-center justify-center gap-1.5">{controlsCenter}</div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{controlsRight}</div>
        </div>

        {/* Rivales de arriba: su propio carril a todo lo ancho. Si en una pantalla muy estrecha no caben
            en una línea, se parten en dos antes que montarse unos sobre otros. */}
        <div className="col-span-3 z-20 flex min-w-0 flex-wrap items-center justify-center gap-x-[clamp(8px,2dvw,20px)] gap-y-1 px-1 pt-1">
          {topSeats}
        </div>

        <div className="min-h-0 min-w-0">{left}</div>
        <div ref={centerRef} className="relative min-h-0 min-w-0">
          {center}
        </div>
        <div className="min-h-0 min-w-0">{right}</div>

        {/* Carril de la pista: entre el tablero y la mano, nunca sobre el tablero. Cuando no hay pista el
            carril se colapsa y el tablero crece (la pista solo se muestra al empezar la partida). También
            vive aquí el aviso de la última jugada: antes iba pegado arriba del tablero y tapaba la parte
            superior del mazo y su contador. */}
        {hint ? (
          <div className="col-span-3 z-20 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2">{hint}</div>
        ) : (
          <div className="col-span-3" aria-hidden />
        )}

        <div className="z-30 flex items-end p-1 pl-[calc(var(--corner)*0.75)]">{bottomLeft}</div>
        <div
          ref={bottomCenterRef}
          className="relative flex min-h-0 min-w-0 items-end justify-center overflow-visible pb-[calc(var(--frame)*1.5)] pt-4"
        >
          {bottomCenter}
        </div>
        <div className="z-30 flex flex-col items-end justify-end gap-1.5 p-1 pr-[calc(var(--corner)*0.75)]">
          {bottomRight}
        </div>
      </div>

      {/* Ventanas y avisos: dentro de la zona segura para que el notch nunca los tape. */}
      <div
        className="pointer-events-none absolute"
        style={{ top: 'var(--sat)', right: 'var(--sar)', bottom: 'var(--sab)', left: 'var(--sal)' }}
      >
        <div className="pointer-events-auto contents">{overlays}</div>
      </div>
    </div>
  );
}
