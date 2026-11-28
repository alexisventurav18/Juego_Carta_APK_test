import { useState } from 'react';
import {
  CalendarDays,
  Check,
  Coins,
  Crown,
  Flame,
  Gift,
  Layers,
  Skull,
  Sparkles,
  Spade,
  Star,
  Target,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  achievementProgress,
  isAchievementClaimed,
  isAchievementUnlocked,
  streakBonusForDay,
  unclaimedAchievementRewards,
  type AchievementDef,
  type AchievementIcon,
  type AchievementSnapshot,
} from '@/lib/achievements';
import { claimAllMissionRewards, claimMissionReward, useEconomy } from '@/lib/economy';
import {
  claimAllAchievementRewards,
  claimAchievementReward,
  todayKey,
} from '@/lib/economy';
import { levelFromXp } from '@/lib/experience';
import {
  isMissionComplete,
  missionDef,
  timeUntilReset,
  unclaimedRewards,
  type MissionPeriod,
  type MissionProgress,
} from '@/lib/missions';
import { useGameSounds } from '@/hooks/useGameSounds';

export type ProgressTab = 'missions' | 'achievements';

const MISSION_SECTIONS: { period: MissionPeriod; title: string; hint: string }[] = [
  { period: 'daily', title: 'Diarias', hint: 'Se renuevan cada día' },
  { period: 'weekly', title: 'Semanales', hint: 'Se renuevan cada lunes' },
];

const ACHIEVEMENT_ICONS: Record<AchievementIcon, LucideIcon> = {
  trophy: Trophy,
  spade: Spade,
  skull: Skull,
  zap: Zap,
  flame: Flame,
  crown: Crown,
  layers: Layers,
  star: Star,
  target: Target,
  coins: Coins,
  sparkles: Sparkles,
  calendar: CalendarDays,
};

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

function MissionsTab() {
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
    <>
      {/* Resumen corto (el conteo de pendientes ya va en la insignia de la
          pestaña y en el botón): en horizontal corto se oculta para que la
          lista gane alto. */}
      <p className="mb-2 shrink-0 text-xs leading-snug text-amber-100/70 [@media(max-height:500px)]:hidden">
        Completa misiones jugando y reclama monedas para la Tienda.
      </p>
      <button
        type="button"
        onClick={claimAll}
        disabled={pending.count === 0}
        className="btn-gold mb-2 flex min-h-[34px] w-full shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-extrabold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:500px)]:mb-1 [@media(max-height:500px)]:min-h-[30px]"
      >
        <Gift className="h-4 w-4 shrink-0" aria-hidden />
        {pending.count === 0 ? 'Reclamar todo' : `Reclamar todo · +${pending.coins} monedas`}
      </button>
      {claimedAll !== null && (
        <p className="mb-3 shrink-0 rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/50" role="status">
          ¡Reclamaste {claimedAll.granted} monedas de {claimedAll.count} {claimedAll.count === 1 ? 'misión' : 'misiones'}!
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {MISSION_SECTIONS.map(({ period, title, hint }) => {
          const list = period === 'daily' ? economy.missions.daily : economy.missions.weekly;
          return (
            <section key={period} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-amber-50">{title}</h3>
                <span className="text-xs text-amber-100/60">
                  {hint} · en {timeUntilReset(period)}
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
    </>
  );
}

function AchievementRow({ def, snap }: { def: AchievementDef; snap: AchievementSnapshot }) {
  const economy = useEconomy();
  const { playSound } = useGameSounds();
  const [claimedToast, setClaimedToast] = useState<number | null>(null);
  const unlocked = isAchievementUnlocked(economy.achievements, def.id);
  const claimed = isAchievementClaimed(economy.achievements, def.id);
  const { current, target } = achievementProgress(def, economy.achievements, snap);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const Icon = ACHIEVEMENT_ICONS[def.icon];

  const claim = () => {
    const granted = claimAchievementReward(def.id);
    if (granted > 0) {
      playSound('coin');
      setClaimedToast(granted);
      window.setTimeout(() => setClaimedToast(null), 4000);
    }
  };

  return (
    <li
      className={`rounded-xl p-3 ring-1 ${
        unlocked ? 'bg-amber-400/10 ring-amber-300/40' : 'bg-black/25 ring-amber-100/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ${
              unlocked
                ? 'bg-amber-400/20 text-amber-300 ring-amber-300/50'
                : 'bg-black/30 text-amber-100/40 ring-amber-100/10'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-amber-50">{def.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-amber-100/70">{def.description}</p>
          </div>
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
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={`${def.title}: ${current} de ${target}`}
        >
          <div
            className={`h-full rounded-full transition-all ${unlocked ? 'bg-amber-300' : 'bg-emerald-400'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-bold text-amber-100/80">
          {current}/{target}
        </span>
        {claimed ? (
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-extrabold text-emerald-300 ring-1 ring-emerald-300/50">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Reclamado
          </span>
        ) : (
          <button
            type="button"
            onClick={claim}
            disabled={!unlocked}
            className={`shrink-0 touch-manipulation rounded-lg px-3 py-1.5 text-xs font-extrabold transition-transform active:scale-95 ${
              unlocked
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

function AchievementsTab() {
  const economy = useEconomy();
  const { playSound } = useGameSounds();
  const [claimedAll, setClaimedAll] = useState<{ granted: number; count: number } | null>(null);
  const pending = unclaimedAchievementRewards(economy.achievements);
  const streakDays = economy.dailyStreak.days;
  // Los modos ganados hoy solo cuentan si son de hoy (al cambiar de día se reinician).
  const modesWonToday =
    economy.achievements.modesWonToday.date === todayKey()
      ? economy.achievements.modesWonToday.games
      : [];
  const snap: AchievementSnapshot = {
    winsByGame: economy.winsByGame,
    gamesPlayed: economy.gamesPlayed,
    bestStreak: economy.bestStreak,
    level: levelFromXp(economy.xp).level,
    modesWonToday,
    casinoCapturesThisMatch: 0,
    robaitoCardsThisMatch: 0,
    robaitoWon: false,
    wheelStreakDays: streakDays,
  };

  const claimAll = () => {
    const result = claimAllAchievementRewards();
    if (result.granted > 0) {
      playSound('coin');
      setClaimedAll(result);
      window.setTimeout(() => setClaimedAll(null), 4000);
    }
  };

  return (
    <>
      {/* Racha compacta: una sola línea de descripción (con line-clamp-1 por
          seguridad en pantallas angostas) para que la lista de logros tenga
          sitio y desplace. */}
      <div className="mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-orange-500/15 p-2 ring-1 ring-orange-300/40">
        <Flame className="h-5 w-5 shrink-0 text-orange-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-orange-100">
            Racha diaria: {streakDays} {streakDays === 1 ? 'día' : 'días'}
          </p>
          <p className="line-clamp-1 text-xs leading-snug text-orange-100/70">
            {streakDays === 0
              ? 'Gira la rueda hoy para empezar tu racha (+50 extra el primer día).'
              : `Gira mañana y suma +${streakBonusForDay(streakDays + 1)} extra; si saltas un día, vuelve a 1.`}
          </p>
        </div>
      </div>
      <p className="mb-2 shrink-0 text-xs leading-snug text-amber-100/70 [@media(max-height:500px)]:hidden">
        Desbloquea logros jugando; cada uno se cobra una sola vez.
      </p>
      <button
        type="button"
        onClick={claimAll}
        disabled={pending.count === 0}
        className="btn-gold mb-2 flex min-h-[34px] w-full shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-extrabold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:500px)]:mb-1 [@media(max-height:500px)]:min-h-[30px]"
      >
        <Gift className="h-4 w-4 shrink-0" aria-hidden />
        {pending.count === 0 ? 'Reclamar todo' : `Reclamar todo · +${pending.coins} monedas`}
      </button>
      {claimedAll !== null && (
        <p
          className="mb-3 shrink-0 rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/50"
          role="status"
        >
          ¡Reclamaste {claimedAll.granted} monedas de {claimedAll.count} {claimedAll.count === 1 ? 'logro' : 'logros'}!
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {ACHIEVEMENTS.map((def) => (
            <AchievementRow key={def.id} def={def} snap={snap} />
          ))}
        </ul>
      </div>
    </>
  );
}

export default function MissionsAchievementsModal({
  onClose,
  initialTab = 'missions',
}: {
  onClose: () => void;
  initialTab?: ProgressTab;
}) {
  const economy = useEconomy();
  const [tab, setTab] = useState<ProgressTab>(initialTab);
  // Pendientes de reclamar por apartado: cada pestaña lleva su propia insignia.
  const missionsReady = unclaimedRewards(economy.missions).count;
  const achievementsPending = unclaimedAchievementRewards(economy.achievements);
  const unlockedCount = economy.achievements.unlocked.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
      role="dialog"
      aria-label="Misiones y logros"
      onClick={onClose}
    >
      {/* Altura fija (h-full del overlay): sin ella el panel solo tenía
          max-h y la lista flex-1 no tenía una altura definida contra la que
          desplazarse. Con h-full la lista siempre tiene su hueco y hace
          scroll dentro del modal. */}
      <div
        className="wood-panel flex h-full max-h-full w-full max-w-2xl flex-col overflow-hidden p-4 [@media(max-height:500px)]:p-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3 [@media(max-height:500px)]:mb-1">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-extrabold text-amber-50">
            {tab === 'missions' ? (
              <>
                <Target className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                Misiones
              </>
            ) : (
              <>
                <Trophy className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                Logros
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-extrabold text-amber-300 ring-1 ring-amber-300/60">
                  {unlockedCount}/{ACHIEVEMENTS.length}
                </span>
              </>
            )}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/60">
              <Coins className="h-4 w-4" aria-hidden />
              {economy.coins} monedas
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar misiones y logros"
              className="wood-chip grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95 [@media(max-height:500px)]:h-8 [@media(max-height:500px)]:w-8"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mb-2 grid shrink-0 grid-cols-2 gap-2 [@media(max-height:500px)]:mb-1" role="tablist" aria-label="Apartados de progreso">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'missions'}
            onClick={() => setTab('missions')}
            className={`flex min-h-[36px] touch-manipulation items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition-transform active:scale-[0.98] [@media(max-height:500px)]:min-h-[32px] ${
              tab === 'missions'
                ? 'btn-gold'
                : 'bg-black/30 text-amber-100/70 ring-1 ring-amber-100/15'
            }`}
          >
            <Target className="h-4 w-4 shrink-0" aria-hidden />
            Misiones
            {missionsReady > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-amber-950 ring-1 ring-amber-950/40">
                {missionsReady}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'achievements'}
            onClick={() => setTab('achievements')}
            className={`flex min-h-[36px] touch-manipulation items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition-transform active:scale-[0.98] [@media(max-height:500px)]:min-h-[32px] ${
              tab === 'achievements'
                ? 'btn-gold'
                : 'bg-black/30 text-amber-100/70 ring-1 ring-amber-100/15'
            }`}
          >
            <Trophy className="h-4 w-4 shrink-0" aria-hidden />
            Logros
            <span className="text-xs font-extrabold tabular-nums opacity-80">
              {unlockedCount}/{ACHIEVEMENTS.length}
            </span>
            {achievementsPending.count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-amber-950 ring-1 ring-amber-950/40">
                {achievementsPending.count}
              </span>
            )}
          </button>
        </div>
        {tab === 'missions' ? <MissionsTab /> : <AchievementsTab />}
      </div>
    </div>
  );
}
