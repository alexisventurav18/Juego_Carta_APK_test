import type { ReactNode } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';

/** Botón cuadrado de las esquinas de la mesa (salir, sonido), igual que en El Cagao. */
export const CORNER_BUTTON =
  'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/40 text-amber-50 ring-1 ring-amber-200/30 active:scale-95';

export const CORNER_CHIP =
  'flex h-10 shrink-0 items-center gap-1 rounded-lg bg-black/40 px-2 text-xs font-bold tabular-nums text-amber-50 ring-1 ring-amber-200/30 active:scale-95';

export function LeaveButton({ onLeave }: { onLeave?: () => void }) {
  if (!onLeave) return null;
  return (
    <button type="button" onClick={onLeave} aria-label="Salir de la partida" className={CORNER_BUTTON}>
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

interface TurnSoundProps {
  label: string;
  myTurn: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

/** Esquina superior derecha: de quién es el turno y el interruptor de sonido. */
export function TurnSound({ label, myTurn, muted, onToggleMute }: TurnSoundProps) {
  return (
    <>
      <span
        aria-live="polite"
        className={`max-w-[7rem] truncate rounded-full px-2.5 py-1.5 text-[11px] font-bold leading-none ${
          myTurn ? 'bg-amber-400 text-stone-900' : 'bg-black/40 text-amber-50 ring-1 ring-amber-200/30'
        }`}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        aria-pressed={muted}
        className={CORNER_BUTTON}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </>
  );
}

/** Avisos de conexión y error, iguales en todas las mesas. */
export function TableNotices({
  connection,
  notice,
}: {
  connection?: 'connected' | 'connecting' | 'offline';
  notice?: string | null;
}): ReactNode {
  return (
    <>
      {(connection === 'offline' || connection === 'connecting') && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-3 top-1 z-50 mx-auto max-w-sm rounded-full bg-amber-500 px-3 py-1 text-center text-[11px] font-semibold text-stone-900 shadow-lg"
        >
          {connection === 'offline' ? 'Sin conexión. Reintentando...' : 'Conectando al servidor...'}
        </p>
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
