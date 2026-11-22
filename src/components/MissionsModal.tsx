import { useState } from 'react';
import { Check, Coins, Gift, Target, X } from 'lucide-react';
import { claimAllMissionRewards, claimMissionReward, useEconomy } from '@/lib/economy';
import {
  isMissionComplete,
  missionDef,
  timeUntilReset,
  unclaimedRewards,
  type MissionPeriod,
  type MissionProgress,
} from '@/lib/missions';
import { useGameSounds } from '@/hooks/useGameSounds';

const SECTIONS: { period: MissionPeriod; title: string; hint: string }[] = [
  { period: 'daily', title: 'Diarias', hint: 'Se renuevan cada día' },
  { period: 'weekly', title: 'Semanales', hint: 'Se renuevan cada lunes' },
];

function MissionRow({ progress, period }: { progress: MissionProgress; period: MissionPeriod }) {
  const def = missionDef(progress.id);
  const { playSound } = useGameSounds();
  const [claimedToast, setClaimedToast] = useState<number | null>(null);
  if (!def) return null;
  const done = isMissionComplete(progress);
  const shown = Math.min(progress.progress, def.target);
  const percent = Math.min(100, Math.round((progress.progress / def.target) * 100));

  const claim = () => {
    const granted = claimMissionReward(period, progress.id);
    if (granted > 0) {
      playSound('coin');
      setClaimedToast(granted);
      window.setTimeout(() => setClaimedToast(null), 4000);
    }
  };

  return (
    <li className="rounded-xl bg-black/25 p-3 ring-1 ring-amber-100/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-amber-50">{def.title}</p>
          <p className="mt-0.5 text-xs leading-snug text-amber-100/70">{def.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-extrabold text-amber-300 ring-1 ring-amber-300/60">
          <Coins className="h-3.5 w-3.5" aria-hidden />
          +{def.reward}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <div
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/40"
          role="progressbar"
          aria-valuenow={shown}
          aria-valuemin={0}
          aria-valuemax={def.target}
          aria-label={`${def.title}: ${shown} de ${def.target}`}
        >
          <div
            className={`h-full rounded-full transition-all ${done ? 'bg-amber-300' : 'bg-emerald-400'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-bold text-amber-100/80">
          {shown}/{def.target}
        </span>
        {progress.claimed ? (
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-extrabold text-emerald-300 ring-1 ring-emerald-300/50">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Reclamada
          </span>
        ) : (
          <button
            type="button"
            onClick={claim}
            disabled={!done}
            className={`shrink-0 touch-manipulation rounded-lg px-3 py-1.5 text-xs font-extrabold transition-transform active:scale-95 ${
              done
                ? 'btn-gold'
                : 'cursor-not-allowed bg-black/30 text-amber-100/40 ring-1 ring-amber-100/10'
            }`}
          >
            Reclamar
          </button>
        )}
      </div>
      {claimedToast !== null && (
        <p className="mt-2 text-xs font-extrabold text-amber-300" role="status">
          ¡+{claimedToast} monedas!
        </p>
      )}
    </li>
  );
}

export default function MissionsModal({ onClose }: { onClose: () => void }) {
  const economy = useEconomy();
  const { playSound } = useGameSounds();
  const [claimedAll, setClaimedAll] = useState<{ granted: number; count: number } | null>(null);
  // Lo pendiente de reclamar (diarias + semanales): el botón se apaga cuando no hay nada.
  const pending = unclaimedRewards(economy.missions);

  const claimAll = () => {
    const result = claimAllMissionRewards();
    if (result.granted > 0) {
      playSound('coin');
      setClaimedAll(result);
      window.setTimeout(() => setClaimedAll(null), 4000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
      role="dialog"
      aria-label="Misiones diarias y semanales"
      onClick={onClose}
    >
      <div
        className="wood-panel flex max-h-full w-full max-w-2xl flex-col overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-amber-50">
            <Target className="h-5 w-5 text-amber-300" aria-hidden />
            Misiones
          </h2>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1.5 text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/60">
              <Coins className="h-4 w-4" aria-hidden />
              {economy.coins} monedas
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar las misiones"
              className="wood-chip grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mb-3 shrink-0 text-xs leading-snug text-amber-100/70">
          Completa misiones jugando y reclama monedas para la Tienda. El progreso se guarda en este
          dispositivo.
        </p>
        <button
          type="button"
          onClick={claimAll}
          disabled={pending.count === 0}
          className="btn-gold mb-3 flex min-h-[40px] w-full shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Gift className="h-4 w-4 shrink-0" aria-hidden />
          {pending.count === 0
            ? 'Reclamar todo'
            : `Reclamar todo · +${pending.coins} monedas (${pending.count} ${pending.count === 1 ? 'misión' : 'misiones'})`}
        </button>
        {claimedAll !== null && (
          <p className="mb-3 shrink-0 rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/50" role="status">
            ¡Reclamaste {claimedAll.granted} monedas de {claimedAll.count} {claimedAll.count === 1 ? 'misión' : 'misiones'}!
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {SECTIONS.map(({ period, title, hint }) => {
            const list = period === 'daily' ? economy.missions.daily : economy.missions.weekly;
            return (
              <section key={period} className="mb-4 last:mb-0">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-extrabold uppercase tracking-wide text-amber-50">{title}</h3>
                  <span className="text-xs text-amber-100/60">
                    {hint} · se renuevan en {timeUntilReset(period)}
                  </span>
                </div>
                <ul className="space-y-2">
                  {list.map((progress) => (
                    <MissionRow key={progress.id} progress={progress} period={period} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
