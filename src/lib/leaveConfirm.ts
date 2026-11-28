/**
 * Textos del diálogo de confirmación al salir de una sala. Es puro (sin
 * imports) para que las pruebas lo importen directamente y para que el
 * harness pueda renderizar cada variante sin montar una sala.
 *
 * Regla: TODA salida de una sala pasa por este diálogo. Cancelar no hace
 * nada: ni sale, ni dispara anuncios, ni toca el servidor.
 */
export type LeaveConfirmKind = 'waiting' | 'online' | 'offline';

export interface LeaveConfirmContent {
  title: string;
  message: string;
  confirmLabel: string;
}

export function leaveConfirmContent(kind: LeaveConfirmKind, finished: boolean): LeaveConfirmContent {
  if (kind === 'waiting') {
    return {
      title: '¿Salir de la sala?',
      message: 'Se liberará tu asiento y saldrás de la sala.',
      confirmLabel: 'Salir',
    };
  }
  if (kind === 'online') {
    return finished
      ? {
          title: '¿Salir de la sala?',
          message: 'Saldrás de la sala y volverás al menú.',
          confirmLabel: 'Salir',
        }
      : {
          title: '¿Salir de la partida?',
          message: 'Un bot tomará tu lugar y la partida seguirá sin ti. No podrás volver a esta partida.',
          confirmLabel: 'Salir de la partida',
        };
  }
  return finished
    ? {
        title: '¿Salir de la partida?',
        message: 'Saldrás de la partida y volverás al menú.',
        confirmLabel: 'Salir',
      }
    : {
        title: '¿Salir de la partida?',
        message: 'Saldrás de la partida. Tu progreso en esta partida se perderá.',
        confirmLabel: 'Salir',
      };
}
