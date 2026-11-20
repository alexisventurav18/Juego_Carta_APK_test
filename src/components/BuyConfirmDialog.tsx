import { useEffect, useRef } from 'react';
import { Coins, ShoppingBag, X } from 'lucide-react';

/**
 * Diálogo de confirmación de compra, compartido por la Tienda y por
 * Opciones: mismo texto y mismos botones en los dos sitios. La compra solo
 * se ejecuta al pulsar «Comprar y equipar»; «Cancelar», Escape o tocar
 * fuera del panel la descartan sin gastar nada.
 *
 * Solo usa imports relativos y de librerías, para que las pruebas puedan
 * importarlo (el runner no resuelve el alias `@/`).
 */
interface BuyConfirmDialogProps {
  itemLabel: string;
  price: number;
  coins: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BuyConfirmDialog({
  itemLabel,
  price,
  coins,
  onConfirm,
  onCancel,
}: BuyConfirmDialogProps) {
  // Momento en que se abrió el diálogo: el segundo toque de un doble toque
  // que lo abrió caería sobre el fondo y lo cerraría de inmediato; se
  // ignoran los toques fuera durante los primeros 350 ms.
  const mountedAtRef = useRef(Date.now());
  const short = price - coins;
  const canAfford = short <= 0;

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
        aria-labelledby="buy-confirm-title"
        className="wood-panel w-full max-w-xs p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="buy-confirm-title" className="flex items-center gap-2 text-base font-extrabold text-amber-50">
            <ShoppingBag className="h-5 w-5 text-amber-300" aria-hidden />
            Confirmar compra
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar la compra"
            className="wood-chip grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[13px] text-amber-100/85">
          ¿Comprar «{itemLabel}» por {price === 0 ? 'gratis' : `${price} monedas`}?
        </p>
        <p className="mt-1 flex items-center gap-1 text-[13px] font-bold text-amber-300">
          <Coins className="h-4 w-4" aria-hidden />
          Tienes {coins} monedas{canAfford ? ` · te quedarían ${coins - price}` : ''}
        </p>
        {!canAfford && (
          <p
            role="alert"
            className="mt-2 rounded-lg bg-rose-500/20 px-2 py-1.5 text-[13px] font-bold text-rose-200 ring-1 ring-rose-300/40"
          >
            Te faltan {short} monedas para «{itemLabel}».
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="btn-wood min-h-[44px] flex-1 touch-manipulation rounded-lg px-2 text-[13px] font-extrabold transition-transform active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canAfford}
            className="btn-gold min-h-[44px] flex-1 touch-manipulation rounded-lg px-2 text-[13px] font-extrabold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Comprar y equipar
          </button>
        </div>
      </div>
    </div>
  );
}
