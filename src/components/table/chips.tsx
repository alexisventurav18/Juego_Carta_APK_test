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

/** Botón de salir de la partida, con texto para que no pase desapercibido. */
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
      Salir
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

/** Esquina superior derecha: de quién es el turno y el botón de opciones. */
export function TurnSound({ label, myTurn, showFlow = false }: TurnSoundProps) {
  useTurnNotification(myTurn);
  return (
    <>
      {myTurn && <span aria-hidden className="turn-screen-glow" />}
      <span
        aria-live="polite"
        className={`max-w-[7rem] truncate rounded-full px-2.5 py-1.5 text-[13px] font-bold leading-none ${
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
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/40 text-amber-200 ring-1 ring-amber-200/30"
        >
          <RotateCw className="turn-flow h-4 w-4" aria-hidden />
        </span>
      )}
      <OptionsButton />
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
