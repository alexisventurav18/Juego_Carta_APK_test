import type { RoomConnectionStatus } from './rooms';

/** Tiempo sin conexión a partir del cual se enseña el aviso (3 s). */
export const CONNECTION_ALERT_DELAY_MS = 3000;

export interface ConnectionAlert {
  /** Si el aviso está visible ahora mismo. */
  readonly visible: boolean;
  /**
   * Actualiza el aviso con el estado de conexión actual: al conectar se
   * oculta de inmediato; al desconectar se programa para dentro de
   * `delayMs`. Cada cambio de estado reinicia el conteo, así que solo una
   * desconexión de más de `delayMs` seguidos llega a mostrarse.
   */
  update(status: RoomConnectionStatus, onChange: (visible: boolean) => void): void;
  /** Cancela el temporizador pendiente (desmontaje o cambio de estado). */
  dispose(): void;
}

/**
 * Retardo del aviso de conexión, sin React para poder probarlo: RoomView lo
 * usa dentro de un useEffect (con limpieza al desmontar o al cambiar el
 * estado), así no hay avisos fantasma de una desconexión ya resuelta.
 */
export function createConnectionAlert(delayMs: number = CONNECTION_ALERT_DELAY_MS): ConnectionAlert {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;
  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return {
    get visible() {
      return visible;
    },
    update(status, onChange) {
      clearTimer();
      if (status === 'connected') {
        if (visible) {
          visible = false;
          onChange(false);
        }
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        if (!visible) {
          visible = true;
          onChange(true);
        }
      }, delayMs);
    },
    dispose() {
      clearTimer();
    },
  };
}
