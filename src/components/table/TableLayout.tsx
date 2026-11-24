import { useEffect, type CSSProperties, type ReactNode, type Ref } from 'react';
import { WoodFrame } from '../cagao/CardAssets';
import AmbientParticles from '../AmbientParticles';

/** Medidas de la mesa: todo sale de la altura de pantalla (dvh), así escala en cualquier resolución. */
const BASE_VARS = {
  '--frame': 'clamp(10px, 2.6dvh, 24px)',
  '--corner': 'clamp(28px, 9dvh, 60px)',
  '--medal': 'clamp(26px, 8dvh, 56px)',
  // Alto de cartas: tu mano, las de los rivales y las de la pila central.
  // El tope es una variable (--ch-max...) para que el CSS de escritorio
  // grande pueda subirlo sin tocar el estilo inline (ver index.css).
  '--ch': 'clamp(58px, 23.5dvh, var(--ch-max, 157px))',
  '--oh': 'clamp(34px, 12.3dvh, var(--oh-max, 83px))',
  '--ph': 'clamp(45px, 17.9dvh, var(--ph-max, 108px))',
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
  /** Pista de la partida o aviso de la última jugada: flota sobre la franja inferior del tablero,
      sin carril propio; si no hay pista, no se dibuja nada. */
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
 * estado | opciones) y la fila de rivales de arriba ocupan todo el ancho, cada una en su fila; el
 * tablero y tu mano quedan en sus filas de siempre. La pista ya no tiene carril propio: flota sobre
 * la franja inferior del tablero (ver abajo), que está vacía en los 4 modos, así el tablero gana
 * esos 24 px. Antes la fila superior era una sola fila de tres celdas estrechas (16-17% los lados)
 * donde Salir, la ficha de mazo, los paneles de puntos, los abanicos, las placas y la píldora de
 * turno se peleaban el mismo hueco: la ficha de mazo quedaba bajo el panel "Nosotros", la píldora
 * "Tu turno" tapaba el panel "Ellos" y las placas de arriba se encogían hasta perder el nombre.
 * Con cada carril a todo lo ancho, cada elemento tiene su hueco reservado y nada se superpone en
 * ningún tamaño.
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
      className="table-stage fixed inset-0 z-30 touch-none select-none overflow-hidden overscroll-none bg-[#2a160a] bg-[radial-gradient(ellipse_at_50%_35%,#4a2a12,#1e0e05_75%)] text-amber-50"
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

      {/* Partículas ambientales del modo: capa decorativa, sin interacción,
          por debajo de la rejilla de la mesa. */}
      {accent && <AmbientParticles accent={accent} />}

      {/* Rejilla de la mesa: el contenido se sangra hacia dentro lo justo para esquivar el notch y las esquinas.
          Filas: controles | rivales de arriba | tablero | tu zona. Las dos primeras van a todo lo ancho;
          el tablero y tu zona usan las tres columnas de siempre. La pista no tiene fila: flota sobre la
          franja inferior del tablero (ver el centro), que está vacía en los 4 modos. */}
      <div
        className="table-grid absolute grid"
        style={{
          // El marco no deja hueco: el fieltro crece 4 px de alto y 4 px de ancho en todas las
          // pantallas. La madera mide --frame y las esquinas se esquivan con el relleno de las
          // filas, no con este hueco (antes era +2 px).
          top: 'calc(var(--frame) + 0px + var(--sat))',
          right: 'calc(var(--frame) + 0px + var(--sar))',
          bottom: 'calc(var(--frame) + 0px + var(--sab))',
          left: 'calc(var(--frame) + 0px + var(--sal))',
          gridTemplateColumns: `${sideCols} minmax(0,1fr) ${sideCols}`,
          // La fila de tu zona es el 30%: con cartas más altas necesita su hueco, y lo que
          // sobra es tablero. En pantallas cortas el CSS la baja al 26% (ver index.css) y en
          // escritorio al 28%: el abanico cabe porque su celda recortó el relleno superior
          // e inferior y porque los botones de El Cagao se achican en pantallas cortas.
          gridTemplateRows: 'auto auto minmax(0,1fr) 30%',
        }}
      >
        {/* Barra de controles: acciones a la izquierda, estado centrado, opciones a la derecha. Los grupos
            laterales son flex-1 para que el del centro quede de verdad centrado y el engranaje no se mueva
            nunca con los cambios de turno. En pantallas muy estrechas el relleno de las esquinas se achica. */}
        <div className="table-controls-row col-span-3 z-30 flex items-center gap-2 px-1 pl-[calc(var(--corner)*0.8)] pr-[calc(var(--corner)*0.8)] max-[480px]:px-1">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">{controlsLeft}</div>
          <div className="flex shrink-0 items-center justify-center gap-1.5">{controlsCenter}</div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{controlsRight}</div>
        </div>

        {/* Rivales de arriba: su propio carril a todo lo ancho. Si en una pantalla muy estrecha no caben
            en una línea, se parten en dos antes que montarse unos sobre otros. La altura mínima (ver
            .table-top-row en index.css, solo en pantallas cortas) iguala la fila superior en los 4
            modos: sin ella, el paquete de El Robaíto (con su etiqueta) y las placas apiladas de El
            Cagao con 6 jugadores hacen la fila más alta y el tablero de esos modos queda más bajo
            que el de Casino y Tres y Dos. */}
        <div className="table-top-row col-span-3 z-20 flex min-w-0 flex-wrap items-center justify-center gap-x-[clamp(8px,2dvw,20px)] gap-y-1 px-1 pt-1">
          {topSeats}
        </div>

        <div className="min-h-0 min-w-0">{left}</div>
        <div ref={centerRef} className="relative min-h-0 min-w-0">
          {center}
          {/* La pista flota sobre la franja inferior del tablero, sin carril propio: el tablero
              gana los 24 px de la fila que ocupaba. La franja está vacía en los 4 modos: en Casino
              y El Robaíto las cartas no bajan del 24% inferior (ver bottom-[24%] en sus mesas), en
              Tres y Dos el contenido va centrado con el 22% libre abajo y en El Cagao la pila va
              centrada con más de 10 px de margen. La píldora mide ~20 px (py-0.5) y va a 16 px del
              borde (bottom-4): el hueco entre la pila de El Cagao (que termina ~39 px arriba del
              borde) y una carta elegida de la mano (que se eleva 18 px y queda ~13 px arriba del
              borde) es de solo ~26 px, así que la píldora cabe con ~3 px de margen por cada lado.
              Solo se dibuja UN elemento de pista: en El Cagao y El Robaíto el aviso de la última
              jugada tiene precedencia sobre la pista inicial (ver sus mesas); con los dos a la vez
              la píldora se partía en dos líneas (40 px) y no cabía en el hueco. Es
              pointer-events-none: no tapa toques ni arrastres del tablero. Antes la pista tenía su
              propio carril entre el tablero y la mano para que no tapara nada; ese carril ya no
              existe y la igualdad entre modos ya no depende de que la pista se esconda o no. */}
          {hint && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-2">{hint}</div>
          )}
        </div>
        <div className="min-h-0 min-w-0">{right}</div>

        <div className="z-30 flex items-end p-1 pl-[calc(var(--corner)*0.75)]">{bottomLeft}</div>
        <div
          ref={bottomCenterRef}
          className="relative flex min-h-0 min-w-0 items-end justify-center overflow-visible pb-[calc(var(--frame)*0.5)] pt-1"
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
