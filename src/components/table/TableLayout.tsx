import { useEffect, type CSSProperties, type ReactNode, type Ref } from 'react';
import { WoodFrame } from '../cagao/CardAssets';

/** Medidas de la mesa: todo sale de la altura de pantalla (dvh), así escala en cualquier resolución. */
const BASE_VARS = {
  '--frame': 'clamp(10px, 2.6dvh, 24px)',
  '--corner': 'clamp(28px, 9dvh, 60px)',
  '--medal': 'clamp(26px, 8dvh, 56px)',
  // Alto de cartas: tu mano, las de los rivales y las de la pila central.
  '--ch': 'clamp(52px, 21dvh, 140px)',
  '--oh': 'clamp(30px, 11dvh, 74px)',
  '--ph': 'clamp(40px, 16dvh, 96px)',
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
}

/**
 * La mesa de El Cagao hecha componente: marco de madera tallada, rivales a izquierda, arriba y derecha,
 * tablero al centro y tú abajo (placa, mano y acciones). Los tres juegos usan este mismo esqueleto, así
 * se ven y se sienten igual. Respeta el notch y las barras del sistema en los cuatro lados.
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
  sideCols = '19%',
  rows = '24%_minmax(0,1fr)_36%',
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
      className="fixed inset-0 z-30 h-[100dvh] w-[100dvw] touch-none select-none overflow-hidden overscroll-none bg-[#2a160a] bg-[radial-gradient(ellipse_at_50%_35%,#4a2a12,#1e0e05_75%)] text-amber-50"
      style={{ ...BASE_VARS, ...vars }}
    >
      {/* Caja segura: el marco y la rejilla quedan dentro del notch y de las barras del sistema. */}
      <div
        className="absolute"
        style={{ top: 'var(--sat)', right: 'var(--sar)', bottom: 'var(--sab)', left: 'var(--sal)' }}
      >
        <WoodFrame />

        {/* Rejilla de la mesa */}
        <div
          className="absolute inset-[calc(var(--frame)+4px)] grid"
          style={{
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

        {overlays}
      </div>
    </div>
  );
}
