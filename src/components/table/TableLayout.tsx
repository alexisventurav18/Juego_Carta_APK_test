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
  topLeft: ReactNode;
  topCenter: ReactNode;
  topRight: ReactNode;
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
  /** Ventanas, avisos y capas que van encima de la mesa. */
  overlays?: ReactNode;
  /** Variables CSS propias de un juego (alto de cartas, etc.). */
  vars?: CSSProperties;
  /** Ancho de las columnas laterales (rivales de izquierda y derecha). */
  sideCols?: string;
  /** Alto de las tres filas: rivales de arriba, tablero y tu zona. */
  rows?: string;
  /** Color de acento del modo que se juega: tiñe el brillo detrás del tablero. */
  accent?: string;
}

/**
 * La mesa de El Cagao hecha componente: marco de madera tallada, rivales a izquierda, arriba y derecha,
 * tablero al centro y tú abajo (placa, mano y acciones). Los tres juegos usan este mismo esqueleto, así
 * se ven y se sienten igual. El marco llega a los bordes de la pantalla; el contenido respeta el notch.
 */
export default function TableLayout({
  topLeft,
  topCenter,
  topRight,
  left,
  center,
  centerRef,
  right,
  bottomLeft,
  bottomCenter,
  bottomCenterRef,
  bottomRight,
  overlays,
  vars,
  // El tablero central es lo más grande posible: las columnas laterales y las
  // filas de arriba y abajo solo ocupan lo que necesitan los rivales y tu mano,
  // para que el fondo de mesa se vea bien.
  sideCols = '16%',
  rows = '21%_minmax(0,1fr)_32%',
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
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 45%, ${accent}33 0%, transparent 65%)` }}
        />
      )}

      {/* Rejilla de la mesa: el contenido se sangra hacia dentro lo justo para esquivar el notch y las esquinas. */}
      <div
        className="absolute grid"
        style={{
          top: 'calc(var(--frame) + 4px + var(--sat))',
          right: 'calc(var(--frame) + 4px + var(--sar))',
          bottom: 'calc(var(--frame) + 4px + var(--sab))',
          left: 'calc(var(--frame) + 4px + var(--sal))',
          gridTemplateColumns: `${sideCols} minmax(0,1fr) ${sideCols}`,
          gridTemplateRows: rows.replace(/_/g, ' '),
        }}
      >
        <div className="z-30 flex items-start gap-1.5 p-1 pl-[calc(var(--corner)*0.8)]">{topLeft}</div>
        <div className="flex min-w-0 items-center justify-evenly gap-2">{topCenter}</div>
        <div className="z-30 flex items-start justify-end gap-1.5 p-1 pr-[calc(var(--corner)*0.8)]">{topRight}</div>

        <div className="min-h-0 min-w-0">{left}</div>
        <div ref={centerRef} className="relative min-h-0 min-w-0">
          {center}
        </div>
        <div className="min-h-0 min-w-0">{right}</div>

        <div className="z-30 flex items-end p-1 pl-[calc(var(--corner)*0.6)]">{bottomLeft}</div>
        <div
          ref={bottomCenterRef}
          className="relative flex min-h-0 min-w-0 items-end justify-center overflow-visible pb-[calc(var(--frame)*1.5)] pt-4"
        >
          {bottomCenter}
        </div>
        <div className="z-30 flex flex-col items-end justify-end gap-1.5 p-1 pr-[calc(var(--corner)*0.6)]">
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
