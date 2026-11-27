import { useState } from 'react';
import { Check, Gift, Trophy, X } from 'lucide-react';
import { claimAllPendingRewards, useEconomy } from '@/lib/economy';
import { unclaimedAchievementRewards } from '@/lib/achievements';
import { unclaimedRewards } from '@/lib/missions';
import { useGameSounds } from '@/hooks/useGameSounds';

/**
 * Aviso de fin de partida, DENTRO del panel de resultados (no un toast
 * flotante): cuando la partida que acaba de terminar completó misiones o
 * desbloqueó logros, aparece esta franja con el total a cobrar y un botón
 * "Reclamar todo" que cobra misiones y logros en una sola pulsación.
 *
 * Solo se muestra si ESTA partida completó algo (`show`): si el jugador
 * ya tenía recompensas pendientes de antes, las cobra en el modal de
 * Misiones o en el de Logros, no aquí. Al reclamar, la franja se queda
 * como confirmación ("¡+N monedas reclamadas!") en vez de desaparecer.
 * Con la X se descarta sin cobrar (las recompensas siguen pendientes).
 */
export default function CompletionRow({ show }: { show: boolean }) {
  const economy = useEconomy();
  const { playSound } = useGameSounds();
  const [dismissed, setDismissed] = useState(false);
  const [claimed, setClaimed] = useState<number | null>(null);

  if (claimed !== null) {
    return (
      <div className="completion-row completion-row--claimed" role="status">
        <Check className="h-4 w-4 shrink-0" />
        <span>¡+{claimed} monedas reclamadas!</span>
      </div>
    );
  }

  const missions = unclaimedRewards(economy.missions);
  const achievements = unclaimedAchievementRewards(economy.achievements);
  const count = missions.count + achievements.count;
  const total = missions.coins + achievements.coins;
  if (!show || count === 0 || total <= 0 || dismissed) return null;

  const parts: string[] = [];
  if (missions.count > 0) parts.push(`${missions.count} ${missions.count === 1 ? 'misión' : 'misiones'}`);
  if (achievements.count > 0) parts.push(`${achievements.count} ${achievements.count === 1 ? 'logro' : 'logros'}`);

  const claim = () => {
    const result = claimAllPendingRewards();
    if (result.granted > 0) {
      playSound('coin');
      setClaimed(result.granted);
    }
  };

  return (
    <div className="completion-row" role="status">
      <Gift className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-left">
        ¡{parts.join(' y ')} {count === 1 ? 'lista' : 'listas'}! <b>+{total} monedas</b>
      </span>
      <button type="button" className="completion-row__claim" onClick={claim}>
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        Reclamar todo
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="completion-row__close"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
