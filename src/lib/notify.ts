import { useEffect, useRef } from 'react';
import { getPrefs } from './soundPrefs';

/** Pide permiso al sistema para avisar (solo en navegador/PWA; se llama al activar el interruptor). */
export async function requestNotificationPermission(): Promise<void> {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
    // Algunos WebView no soportan la API: los avisos dentro de la partida siguen funcionando.
  }
}

function notifyTurn(label: string): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification('Cartas Dominicanas', { body: label, tag: 'cartas-turno', silent: true });
  } catch {
    // Sin soporte: no pasa nada.
  }
}

/** Avisa del sistema cuando llega tu turno con la app en segundo plano (si los avisos están activados). */
export function useTurnNotification(myTurn: boolean): void {
  const previous = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !previous.current && getPrefs().notifications && document.visibilityState === 'hidden') {
      notifyTurn('¡Es tu turno!');
    }
    previous.current = myTurn;
  }, [myTurn]);
}
