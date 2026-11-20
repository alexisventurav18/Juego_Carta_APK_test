import { BarChart3, Coins, Flame, Pencil, Trophy, X } from 'lucide-react';
import { GAMES } from '@/games';
import type { GameId } from '@/games/shared';
import type { EconomyState } from '@/lib/economy';
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Mi perfil"
    >
      <div className="wood-panel relative w-full max-w-sm space-y-5 p-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="wood-chip absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg transition-transform active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <Avatar code={avatar} className="h-16 w-16 border-2 border-amber-900/70" />
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

        <div className="grid grid-cols-3 gap-2 text-center">
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

        <div className="space-y-2.5">
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
      </div>
    </div>
  );
}
