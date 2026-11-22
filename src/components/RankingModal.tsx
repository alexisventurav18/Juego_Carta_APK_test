import { useEffect, useState } from 'react';
import { Coins, Gift, Loader2, Star, Trophy, X } from 'lucide-react';
import type { GameId } from '@/games/shared';
import { claimPrize, WIN_REWARDS } from '@/lib/economy';
import { getPlayerId } from '@/lib/identity';
import { rankingBoard, seasonClaim, type RankingBoard, type RankingEntry } from '@/lib/rooms';
import { RANKING_TABS } from '@/lib/tournament';
import { useGameSounds } from '@/hooks/useGameSounds';
import Avatar from './avatar/Avatar';

/**
 * Tabla de clasificación: top 100 de la temporada, general o por modo, con
 * mi fila destacada y el reclamo del premio de la temporada pasada. El
 * servidor pone los puntos (victoria = puntos del modo, empate la mitad,
 * derrota 0); aquí solo se piden y se muestran.
 */
export default function RankingModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<GameId | 'all'>('all');
  const [board, setBoard] = useState<RankingBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{ coins: number; place: number } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { playSound } = useGameSounds();
  const myId = getPlayerId();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void rankingBoard(undefined, tab)
      .then((data) => {
        if (!cancelled) setBoard(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el ranking.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const claim = () => {
    if (claiming || claimed) return;
    setClaiming(true);
    setClaimError(null);
    void seasonClaim()
      .then((result) => {
        // Las monedas solo se suman si el servidor confirmó el premio, y la
        // clave de la temporada impide pagar dos veces la misma respuesta.
        const granted = claimPrize(`season:${result.season ?? board?.season ?? 'pasada'}`, result.coins);
        setClaimed({ coins: granted > 0 ? granted : result.coins, place: result.place });
        if (granted > 0) playSound('coin');
      })
      .catch((err) => {
        setClaimError(err instanceof Error ? err.message : 'No se pudo reclamar el premio.');
      })
      .finally(() => setClaiming(false));
  };

  const myRank =
    board?.me?.rank ??
    (board && board.me ? board.entries.findIndex((entry) => entry.playerId === board.me?.playerId) + 1 || null : null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
      role="dialog"
      aria-label="Ranking"
      onClick={onClose}
    >
      <div
        className="wood-panel flex max-h-full w-full max-w-2xl flex-col overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-extrabold text-amber-50">
            <Trophy className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <span className="truncate">Ranking</span>
            {board && <span className="shrink-0 text-xs font-bold text-amber-100/60">· {board.season}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el ranking"
            className="wood-chip grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5" role="tablist" aria-label="Ranking por modo">
          {RANKING_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`touch-manipulation rounded-full px-3 py-1.5 text-xs font-extrabold transition-transform active:scale-95 ${
                tab === id ? 'btn-gold' : 'btn-wood'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {claimed ? (
          <p className="mb-3 shrink-0 rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/50" role="status">
            ¡Puesto {claimed.place} de la temporada pasada! +{claimed.coins} monedas.
          </p>
        ) : (
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-snug text-amber-100/70">
              Victoria: Casino {WIN_REWARDS.casino} · Tres y Dos {WIN_REWARDS.tresydos} · Robaíto{' '}
              {WIN_REWARDS.robaito} · Cagao {WIN_REWARDS.cagao} puntos (empate, la mitad).
            </p>
            <button
              type="button"
              onClick={claim}
              disabled={claiming}
              className="btn-gold flex shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-transform active:scale-95 disabled:opacity-60"
            >
              <Gift className="h-3.5 w-3.5" aria-hidden />
              {claiming ? 'Reclamando…' : 'Reclamar premio de temporada'}
            </button>
          </div>
        )}
        {claimError && (
          <p className="mb-3 shrink-0 rounded-xl bg-rose-700/40 px-3 py-2 text-center text-xs font-bold text-rose-100 ring-1 ring-rose-300/40" role="alert">
            {claimError}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-amber-100/70">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando el ranking…
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm font-bold text-rose-200" role="alert">
              {error}
            </p>
          ) : !board || board.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-amber-100/70">
              Aún no hay puntos esta temporada. ¡Gana una partida y estrena la tabla!
            </p>
          ) : (
            <ol className="space-y-1.5">
              {board.entries.map((entry, index) => (
                <RankingRow key={entry.playerId} entry={entry} rank={entry.rank ?? index + 1} isMe={entry.playerId === myId} />
              ))}
              {board.me && !board.entries.some((entry) => entry.playerId === board.me?.playerId) && (
                <li className="mt-2">
                  <p className="mb-1 text-center text-xs font-bold text-amber-100/60">
                    {myRank ? `Tu puesto: #${myRank}` : 'Estás fuera del top 100'}
                  </p>
                  <RankingRow entry={board.me} rank={myRank ?? 0} isMe />
                </li>
              )}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function RankingRow({ entry, rank, isMe }: { entry: RankingEntry; rank: number; isMe: boolean }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ring-1 ${
        isMe ? 'bg-amber-400/15 ring-amber-300/60' : 'bg-black/25 ring-amber-100/10'
      }`}
    >
      <span className={`w-8 shrink-0 text-center text-sm font-extrabold ${rank <= 3 ? 'text-amber-300' : 'text-amber-100/70'}`}>
        {rank > 0 ? `#${rank}` : '—'}
      </span>
      {entry.avatar ? (
        <Avatar code={entry.avatar} className="h-8 w-8 shrink-0 border border-amber-900/70" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400/20 text-sm font-extrabold text-amber-300">
          {(entry.name || '?').charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-extrabold text-amber-50">{entry.name}</span>
          {entry.level !== undefined && (
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-extrabold text-sky-300">
              <Star className="h-3 w-3 fill-sky-300" aria-hidden />
              {entry.level}
            </span>
          )}
          {isMe && (
            <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-950">
              Tú
            </span>
          )}
        </span>
        <span className="block text-[11px] font-bold text-amber-100/60">
          {entry.wins}V · {entry.losses}D · {entry.matches} partidas
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-amber-300">
        <Coins className="h-3.5 w-3.5" aria-hidden />
        {entry.points}
      </span>
    </li>
  );
}
