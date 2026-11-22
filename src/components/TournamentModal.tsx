import { useEffect, useState } from 'react';
import { Coins, Gift, Loader2, Play, Star, Trophy, X } from 'lucide-react';
import { GAMES } from '@/games';
import type { GameId } from '@/games/shared';
import { claimPrize } from '@/lib/economy';
import { getPlayerId } from '@/lib/identity';
import { tournamentClaim, tournamentInfo, type TournamentData, type TournamentEntry } from '@/lib/rooms';
import { formatCountdown, TOURNAMENT_PRIZES } from '@/lib/tournament';
import { useGameSounds } from '@/hooks/useGameSounds';
import Avatar from './avatar/Avatar';

/**
 * Torneo del fin de semana: un modo, carrera de puntos (cada victoria suma
 * los puntos del modo), top 10, mi posición y el reclamo del premio del
 * podio. "Jugar torneo" entra al matchmaking de ese modo: cada partida que
 * juegue durante el torneo suma puntos.
 */
export default function TournamentModal({
  onClose,
  onPlayTournament,
}: {
  onClose: () => void;
  /** Lanza el matchmaking ("Jugar online") en el modo del torneo. */
  onPlayTournament: (game: GameId) => void;
}) {
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{ coins: number; place: number } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { playSound } = useGameSounds();
  const myId = getPlayerId();

  useEffect(() => {
    let cancelled = false;
    void tournamentInfo()
      .then((info) => {
        if (!cancelled) setData(info);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el torneo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // La cuenta atrás se mueve cada segundo mientras el modal está abierto.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const tournament = data?.tournament ?? null;
  const myRank =
    data?.me?.rank ??
    (data && data.me ? data.entries.findIndex((entry) => entry.playerId === data.me?.playerId) + 1 || null : null);
  const canClaim = tournament?.status === 'ended' && myRank !== null && myRank >= 1 && myRank <= 3;

  const claim = () => {
    if (claiming || claimed || !tournament) return;
    setClaiming(true);
    setClaimError(null);
    void tournamentClaim()
      .then((result) => {
        // Las monedas solo se suman si el servidor confirmó el premio, y la
        // clave del torneo impide pagar dos veces la misma respuesta.
        const granted = claimPrize(`tournament:${tournament.id}`, result.coins);
        setClaimed({ coins: granted > 0 ? granted : result.coins, place: result.place });
        if (granted > 0) playSound('coin');
      })
      .catch((err) => {
        setClaimError(err instanceof Error ? err.message : 'No se pudo reclamar el premio.');
      })
      .finally(() => setClaiming(false));
  };

  const countdownTarget =
    tournament?.status === 'upcoming' ? tournament.startsAt : tournament?.endsAt;
  const countdownLabel =
    tournament?.status === 'upcoming'
      ? 'Empieza en'
      : tournament?.status === 'active'
        ? 'Termina en'
        : 'Terminado';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
      role="dialog"
      aria-label="Torneo"
      onClick={onClose}
    >
      <div
        className="wood-panel flex max-h-full w-full max-w-2xl flex-col overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-extrabold text-amber-50">
            <Trophy className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <span className="truncate">Torneo</span>
            {tournament && (
              <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-extrabold text-amber-300 ring-1 ring-amber-300/50">
                {GAMES[tournament.game].name}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el torneo"
            className="wood-chip grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-amber-100/70">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando el torneo…
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm font-bold text-rose-200" role="alert">
              {error}
            </p>
          ) : !tournament ? (
            <p className="py-8 text-center text-sm text-amber-100/70">
              No hay torneo en este momento. Vuelve el fin de semana.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-black/25 px-3 py-3 text-center ring-1 ring-amber-100/10">
                <p className="text-xs font-bold text-amber-100/70">{countdownLabel}</p>
                <p className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-amber-50">
                  {countdownTarget ? formatCountdown(countdownTarget - now) : '—'}
                </p>
                <p className="mt-1 text-xs leading-snug text-amber-100/70">
                  Cada victoria en {GAMES[tournament.game].name} suma puntos de torneo. Juega todo lo
                  que quieras mientras dure.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {TOURNAMENT_PRIZES.map((coins, index) => (
                  <span
                    key={coins}
                    className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-extrabold text-amber-300 ring-1 ring-amber-300/60"
                  >
                    <Trophy className="h-3.5 w-3.5" aria-hidden />
                    {index + 1}º: {coins} monedas
                  </span>
                ))}
              </div>

              {claimed ? (
                <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/50" role="status">
                  ¡Puesto {claimed.place} del torneo! +{claimed.coins} monedas.
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {tournament.status !== 'ended' && (
                    <button
                      type="button"
                      onClick={() => onPlayTournament(tournament.game)}
                      className="btn-gold flex touch-manipulation items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-extrabold transition-transform active:scale-95"
                    >
                      <Play className="h-4 w-4" aria-hidden />
                      Jugar torneo
                    </button>
                  )}
                  {canClaim && (
                    <button
                      type="button"
                      onClick={claim}
                      disabled={claiming}
                      className="btn-gold flex touch-manipulation items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-extrabold transition-transform active:scale-95 disabled:opacity-60"
                    >
                      <Gift className="h-4 w-4" aria-hidden />
                      {claiming ? 'Reclamando…' : 'Reclamar premio'}
                    </button>
                  )}
                </div>
              )}
              {claimError && (
                <p className="rounded-xl bg-rose-700/40 px-3 py-2 text-center text-xs font-bold text-rose-100 ring-1 ring-rose-300/40" role="alert">
                  {claimError}
                </p>
              )}

              <section>
                <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-amber-50">
                  Clasificación
                </h3>
                {data.entries.length === 0 ? (
                  <p className="py-3 text-center text-sm text-amber-100/70">
                    Nadie ha sumado puntos todavía. ¡Sé el primero!
                  </p>
                ) : (
                  <ol className="space-y-1.5">
                    {data.entries.map((entry, index) => (
                      <TournamentRow key={entry.playerId} entry={entry} rank={entry.rank ?? index + 1} isMe={entry.playerId === myId} />
                    ))}
                    {data.me && !data.entries.some((entry) => entry.playerId === data.me?.playerId) && (
                      <li className="mt-2">
                        <p className="mb-1 text-center text-xs font-bold text-amber-100/60">
                          {myRank ? `Tu puesto: #${myRank}` : 'Aún no has sumado puntos'}
                        </p>
                        <TournamentRow entry={data.me} rank={myRank ?? 0} isMe />
                      </li>
                    )}
                  </ol>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentRow({ entry, rank, isMe }: { entry: TournamentEntry; rank: number; isMe: boolean }) {
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
          {entry.wins}V · {entry.matches} partidas
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-amber-300">
        <Coins className="h-3.5 w-3.5" aria-hidden />
        {entry.points}
      </span>
    </li>
  );
}
