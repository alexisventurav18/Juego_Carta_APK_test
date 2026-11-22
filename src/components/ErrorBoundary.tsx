import { Component, type ReactNode } from 'react';

/**
 * Seguro contra pantallas en blanco: si un componente rompe al dibujarse
 * (como pasó con Amigos, que leía `data.friends` sobre undefined), sin esto
 * React desmonta todo y la app queda en blanco. El boundary atrapa el error,
 * lo registra y muestra una pantalla amable con salida.
 *
 * Dos variantes de fallback:
 * - Pantalla completa (por defecto): para la raíz, la sala o la partida
 *   offline. Ofrece "Reintentar" (volver a dibujar la pantalla) y
 *   "Volver al menú" (limpia el estado roto y vuelve al menú).
 * - Compacta (`compact`): aviso pequeño para la capa de modales del menú.
 *   Un modal roto no debe tumbar el menú: solo se cierra la ventana y se
 *   sigue jugando. Por eso no ofrece "Reintentar" (volvería a romper).
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Limpia el estado roto y vuelve al menú (o cierra los modales). */
  onReset: () => void;
  /** Si es false, el fallback no ofrece "Reintentar". Por defecto true. */
  showRetry?: boolean;
  /** Fallback compacto para la capa de modales. Por defecto false. */
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export function ErrorFallback({
  onRetry,
  onReset,
  showRetry = true,
  compact = false,
}: {
  onRetry: () => void;
  onReset: () => void;
  showRetry?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        role="alert"
        className="fixed bottom-[calc(var(--frame,8px)+4px)] left-1/2 z-50 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2 rounded-xl bg-rose-700/95 px-4 py-3 text-center ring-1 ring-rose-300/60"
      >
        <p className="text-[13px] font-bold text-rose-50">Esa ventana tuvo un problema y se cerró.</p>
        <button
          type="button"
          onClick={onReset}
          className="btn-gold flex min-h-[36px] touch-manipulation items-center rounded-lg px-4 text-[13px] font-extrabold transition-transform active:scale-95"
        >
          Entendido
        </button>
      </div>
    );
  }
  return (
    <div className="wood-stage safe-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xl font-extrabold text-amber-50">Algo salió mal</p>
      <p className="max-w-md text-sm leading-relaxed text-amber-100/80">
        La pantalla tuvo un problema y no se pudo mostrar. Inténtalo de nuevo o vuelve al menú.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {showRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn-wood flex min-h-[44px] touch-manipulation items-center rounded-lg px-5 py-2.5 text-sm font-bold transition-transform active:scale-95"
          >
            Reintentar
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="btn-gold flex min-h-[44px] touch-manipulation items-center rounded-lg px-5 py-2.5 text-sm font-extrabold transition-transform active:scale-95"
        >
          Volver al menú
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // No hay servicio de reporte de errores en el proyecto: la consola es
    // el registro (igual que el resto de la app).
    console.error('Error en la pantalla del juego', error, info);
  }

  /** Volver a dibujar la pantalla tal como está (para errores pasajeros). */
  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  /** Limpiar el estado roto y volver al menú (o cerrar los modales). */
  handleReset = (): void => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <ErrorFallback
        onRetry={this.handleRetry}
        onReset={this.handleReset}
        showRetry={this.props.showRetry ?? true}
        compact={this.props.compact ?? false}
      />
    );
  }
}
