import { useState } from 'react';
import { BarChart3, Check, Coins, Copy, Flame, KeyRound, Pencil, Star, Trophy, X } from 'lucide-react';
import { GAMES } from '@/games';
import type { GameId } from '@/games/shared';
import type { EconomyState } from '@/lib/economy';
import { levelFromXp, MAX_LEVEL } from '@/lib/experience';
import { getIdentityForRecovery, getSyncStatus } from '@/lib/progress';
import { encodeRecoveryCode } from '@/lib/recoveryCode';
import Avatar from './avatar/Avatar';

const GAME_ORDER: GameId[] = ['casino', 'tresydos', 'cagao', 'robaito'];

interface ProfileModalProps {
  economy: EconomyState;
  avatar: string;
  name: string;
  onClose: () => void;
  onEditAvatar: () => void;
}

export default function ProfileModal({ economy, avatar, name, onClose, onEditAvatar }: ProfileModalProps) {
  const winRate = economy.gamesPlayed > 0 ? Math.round((economy.wins / economy.gamesPlayed) * 100) : null;
  const maxWins = Math.max(1, ...GAME_ORDER.map((game) => economy.winsByGame[game]));
  const level = levelFromXp(economy.xp);
  const isMaxLevel = level.level >= MAX_LEVEL;
  const [copied, setCopied] = useState(false);
  // El código de respaldo codifica la identidad (id + clave secreta): se
  // genera al abrir el perfil y siempre se puede volver a mostrar.
  const identity = getIdentityForRecovery();
  const recoveryCode = encodeRecoveryCode(identity.playerId, identity.key);
  const sync = getSyncStatus();

  async function copyCode(): Promise<void> {
    if (!recoveryCode) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(recoveryCode);
      } else {
        throw new Error('sin portapapeles');
      }
    } catch {
      const area = document.createElement('textarea');
      area.value = recoveryCode;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Mi perfil"
    >
      <div className="profile-panel wood-panel relative m-auto w-full max-w-sm space-y-5 p-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="wood-chip absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg transition-transform active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="profile-header flex items-center gap-3">
          <Avatar code={avatar} className="profile-avatar h-16 w-16 border-2 border-amber-900/70" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-extrabold text-amber-50">
              <BarChart3 className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
              <span className="truncate">{name.trim() || 'Jugador'}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-amber-300">
              <Coins className="h-4 w-4" aria-hidden />
              {economy.coins} monedas
            </p>
          </div>
          <button
            type="button"
            onClick={onEditAvatar}
            className="btn-wood ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Avatar
          </button>
        </div>

        <div className="profile-level space-y-2 rounded-xl bg-black/25 px-3 py-3 ring-1 ring-amber-200/15">
          <p className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-base font-extrabold text-amber-50">
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" aria-hidden />
              Nivel {level.level}
            </span>
            <span className="text-sm font-extrabold text-sky-300">
              {isMaxLevel ? `${economy.xp} XP` : `${level.xpIntoLevel} / ${level.xpNeeded} XP`}
            </span>
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-black/35 ring-1 ring-amber-200/15">
            <div
              className={`h-full rounded-full ${
                isMaxLevel ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-gradient-to-r from-[#7FB5D5] to-[#0EA5B7]'
              }`}
              style={{ width: `${isMaxLevel ? 100 : (level.xpIntoLevel / level.xpNeeded) * 100}%` }}
            />
          </div>
          <p className="text-xs font-bold text-amber-100/70">
            {isMaxLevel
              ? 'Nivel máximo: ya lo tienes todo.'
              : `Faltan ${level.xpNeeded - level.xpIntoLevel} XP para el nivel ${level.level + 1}`}
          </p>
        </div>

        <div className="profile-stats grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/25 px-2 py-3 ring-1 ring-amber-200/15">
            <p className="flex items-center justify-center gap-1 text-xl font-extrabold text-amber-50">
              <Trophy className="h-4 w-4 text-amber-300" aria-hidden />
              {economy.wins}
            </p>
            <p className="mt-0.5 text-xs text-amber-100/70">Victorias</p>
          </div>
          <div className="rounded-xl bg-black/25 px-2 py-3 ring-1 ring-amber-200/15">
            <p className="text-xl font-extrabold text-amber-50">
              {winRate === null ? '—' : `${winRate}%`}
            </p>
            <p className="mt-0.5 text-xs text-amber-100/70">
              {economy.gamesPlayed} {economy.gamesPlayed === 1 ? 'partida' : 'partidas'}
            </p>
          </div>
          <div className="rounded-xl bg-black/25 px-2 py-3 ring-1 ring-amber-200/15">
            <p className="flex items-center justify-center gap-1 text-xl font-extrabold text-amber-50">
              <Flame className="h-4 w-4 text-orange-400" aria-hidden />
              {economy.streak}
            </p>
            <p className="mt-0.5 text-xs text-amber-100/70">Racha · mejor {economy.bestStreak}</p>
          </div>
        </div>

        <div className="profile-modes space-y-2.5">
          <p className="text-sm font-extrabold text-amber-300">Victorias por juego</p>
          {GAME_ORDER.map((game) => {
            const wins = economy.winsByGame[game];
            return (
              <div key={game} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-sm font-bold text-amber-50">{GAMES[game].name}</span>
                <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-black/35 ring-1 ring-amber-200/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-500"
                    style={{ width: `${Math.max(wins > 0 ? 6 : 0, (wins / maxWins) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-extrabold text-amber-300">{wins}</span>
              </div>
            );
          })}
          {economy.gamesPlayed === 0 && (
            <p className="text-sm text-amber-100/70">Todavía no has terminado una partida. ¡A la mesa!</p>
          )}
        </div>

        {/* Código de respaldo (B): recupera monedas, XP y cosméticos en otro teléfono. */}
        <div className="profile-backup space-y-2 rounded-xl bg-black/25 px-3 py-3 ring-1 ring-amber-200/15">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-amber-300">
            <KeyRound className="h-4 w-4" aria-hidden />
            Código de respaldo
          </p>
          <p className="text-xs leading-relaxed text-amber-100/70">
            Con este código recuperas tus monedas, XP y cosméticos en otro teléfono. Guárdalo como una
            contraseña: quien lo tenga puede entrar como tú. No lo compartas.
          </p>
          {recoveryCode ? (
            <>
              <p className="break-all rounded-lg bg-black/40 px-2.5 py-2 font-mono text-[12px] leading-relaxed tracking-wide text-amber-50 ring-1 ring-amber-200/15">
                {recoveryCode}
              </p>
              <button
                type="button"
                onClick={copyCode}
                className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95"
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? 'Copiado' : 'Copiar código'}
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-100/70">No se pudo generar el código en este momento.</p>
          )}
          <p className="text-xs font-bold text-amber-100/70">
            {sync.hasConflict
              ? `Hay una copia más reciente en la nube (${formatSyncDate(sync.conflictAt)}). Usa «Recuperar mi progreso» en el menú para verla.`
              : sync.lastSyncedAt
                ? `Último respaldo: ${formatSyncDate(sync.lastSyncedAt)}.`
                : 'Aún no hay respaldo en la nube: se sube solo cuando ganas o compras algo.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatSyncDate(timestamp: number | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
