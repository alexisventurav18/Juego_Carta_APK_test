import { useEffect, useRef, useState } from 'react';
import { useNotificationsOn } from '@/lib/soundPrefs';

/**
 * Aviso de instrucciones de la mesa ("Elige una carta de tu mano o arrástrala a la mesa."): se muestra solo al
 * empezar la partida y se esconde para siempre cuando termina TU primer turno. Después la mesa queda limpia.
 *
 * - `myTurn`: es tu turno ahora mismo.
 * - `roundNo`: número de ronda; si baja (revancha en la misma sala) la partida es nueva y el aviso vuelve a salir.
 * - `finished`: ya no tiene sentido enseñarlo (acabaste o la partida terminó sin que llegara tu turno).
 *
 * Devuelve `true` mientras el aviso puede mostrarse.
 */
export function useStartHint(myTurn: boolean, roundNo: number, finished = false): boolean {
  const notificationsOn = useNotificationsOn();
  const [dismissed, setDismissed] = useState(false);
  const hadTurn = useRef(false);
  const lastRound = useRef(roundNo);

  useEffect(() => {
    if (roundNo < lastRound.current) {
      hadTurn.current = false;
      setDismissed(false);
    }
    lastRound.current = roundNo;
  }, [roundNo]);

  useEffect(() => {
    if (myTurn) hadTurn.current = true;
    else if (hadTurn.current) setDismissed(true);
  }, [myTurn]);

  return notificationsOn && !dismissed && !finished;
}
