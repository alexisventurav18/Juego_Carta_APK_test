import { useEffect, useRef } from 'react';
import { LogOut, X } from 'lucide-react';

/**
 * Diálogo genérico de confirmación, con el mismo estilo visual que
 * BuyConfirmDialog (panel de madera, botones madera/dorado, Escape y tocar
 * fuera cancelan). La confirmación solo se ejecuta al pulsar el botón de
 * confirmar; «Cancelar», Escape o tocar fuera no hacen nada más.
 *
 * Solo usa imports relativos y de librerías, para que las pruebas puedan
 * importarlo (el runner no resuelve el alias `@/`).
 */
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Mientras está ocupado los dos botones se desactivan y el de confirmar muestra `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  busy = false,
  busyLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Momento en que se abrió el diálogo: el segundo toque de un doble toque
  // que lo abrió caería sobre el fondo y lo cerraría de inmediato; se
  // ignoran los toques fuera durante los primeros 350 ms.
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      onClick={() => {
        if (Date.now() - mountedAtRef.current > 350) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="wood-panel w-full max-w-xs p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="confirm-dialog-title" className="flex items-center gap-2 text-base font-extrabold text-amber-50">
            <LogOut className="h-5 w-5 text-amber-300" aria-hidden />
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={cancelLabel}
            className="wood-chip grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[13px] text-amber-100/85">{message}</p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className="btn-wood min-h-[44px] flex-1 touch-manipulation rounded-lg px-2 text-[13px] font-extrabold transition-transform active:scale-95 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn-gold min-h-[44px] flex-1 touch-manipulation rounded-lg px-2 text-[13px] font-extrabold transition-transform active:scale-95 disabled:opacity-60"
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
