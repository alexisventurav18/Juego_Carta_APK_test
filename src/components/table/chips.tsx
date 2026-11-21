import type { ReactNode } from 'react';
import { ArrowLeft, RotateCw, Settings, VolumeX } from 'lucide-react';
import { useOptions } from '@/components/options/OptionsProvider';
import { useTurnNotification } from '@/lib/notify';
import { useMuted } from '@/lib/soundPrefs';

/** Botón cuadrado de las esquinas de la mesa (salir, sonido), igual que en El Cagao. */
export const CORNER_BUTTON =
  'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/40 text-amber-50 ring-1 ring-amber-200/30 active:scale-95';

export const CORNER_CHIP =
  'flex h-10 shrink-0 items-center gap-1 rounded-lg bg-black/40 px-2 text-xs font-bold tabular-nums text-amber-50 ring-1 ring-amber-200/30 active:scale-95';

/** Botón de salir de la partida, con texto para que no pase desapercibido. En pantallas muy estrechas
    solo queda la flecha: el texto no cabe en la barra de controles sin empujar la píldora de turno. */
export function LeaveButton({ onLeave }: { onLeave?: () => void }) {
  if (!onLeave) return null;
  return (
    <button
      type="button"
      onClick={onLeave}
      aria-label="Salir de la partida"
      title="Salir de la partida"
      className="flex h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-lg bg-black/40 px-2.5 text-xs font-bold text-amber-50 ring-1 ring-amber-200/30 transition-transform active:scale-95"
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="max-[480px]:hidden">Salir</span>
    </button>
  );
}

interface TurnSoundProps {
  label: string;
  myTurn: boolean;
  /** Muestra la flecha de sentido del turno (El Cagao y Tres y Dos). */
  showFlow?: boolean;
}

/** Botón de opciones (engranaje). Si el audio está silenciado se ve una marca para recordarlo. */
export function OptionsButton({ className = CORNER_BUTTON }: { className?: string }) {
  const { open } = useOptions();
  const { muted } = useMuted();
  return (
    <button type="button" onClick={open} aria-label="Opciones" title="Opciones" className={`${className} relative`}>
      <Settings className="h-4 w-4" />
      {muted && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-rose-600 text-white ring-1 ring-rose-200/70"
        >
          <VolumeX className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
}

/** Píldora de turno (centro de la barra de controles): de quién es el turno. El botón de opciones ya no
    va aquí: vive en su propia esquina de la barra, así la píldora nunca lo empuja ni tapa nada. */
export function TurnSound({ label, myTurn, showFlow = false }: TurnSoundProps) {
  useTurnNotification(myTurn);
  return (
    <>
      {myTurn && <span aria-hidden className="turn-screen-glow" />}
      {/* Ancho fijo y texto recortado: el rótulo cambia ("Tu turno", un nombre, "Fin de ronda") y sin
          ancho fijo el engranaje de opciones se mueve a cada cambio de turno. */}
      <span
        aria-live="polite"
        className={`w-[7.5rem] shrink-0 truncate rounded-full px-2.5 py-1.5 text-center text-[13px] font-bold leading-none ${
          myTurn
            ? 'turn-chip-myturn bg-amber-400 text-stone-900'
            : 'bg-black/40 text-amber-50 ring-1 ring-amber-200/30'
        }`}
      >
        {label}
      </span>
      {showFlow && (
        <span
          title="El turno pasa al siguiente jugador, a tu izquierda"
          // En pantallas muy estrechas (<480 px) se oculta: la barra de controles no cabe con el
          // chip de ronda + la píldora + el flujo + Salir + engranaje (en retrato el flujo se
          // montaba sobre el engranaje y la ficha de ronda sobre Salir). El sentido del turno
          // sigue siendo evidente por la píldora y el brillo del asiento.
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/40 text-amber-200 ring-1 ring-amber-200/30 max-[480px]:hidden"
        >
          <RotateCw className="turn-flow h-4 w-4" aria-hidden />
        </span>
      )}
    </>
  );
}

/** Avisos de conexión y error, iguales en todas las mesas. */
export function TableNotices({
  connection,
  notice,
  onRetry,
}: {
  connection?: 'connected' | 'connecting' | 'offline';
  notice?: string | null;
  onRetry?: () => void;
}): ReactNode {
  return (
    <>
      {(connection === 'offline' || connection === 'connecting') && (
        <div
          role="status"
          className="absolute inset-x-3 top-1 z-50 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full bg-amber-500 px-3 py-1 text-center text-[11px] font-semibold text-stone-900 shadow-lg"
        >
          <span>{connection === 'offline' ? 'Sin conexión. Reintentando...' : 'Conectando al servidor...'}</span>
          {connection === 'offline' && onRetry && (
            <button type="button" onClick={onRetry} className="rounded-full bg-black/15 px-2 py-1 font-extrabold underline">
              Reintentar
            </button>
          )}
        </div>
      )}
      {notice && (
        <p
          role="alert"
          className="pointer-events-none absolute inset-x-3 top-8 z-50 mx-auto max-w-md rounded-xl bg-rose-600 px-3 py-2 text-center text-xs font-medium text-white shadow-lg"
        >
          {notice}
        </p>
      )}
    </>
  );
}
