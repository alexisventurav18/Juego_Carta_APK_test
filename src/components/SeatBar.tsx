import { type Player, teamOf } from '@/games/shared';

export interface SeatTeamStats {
  label: string;
  score: number;
  goal: number;
  captured: number;
  viraos: number;
}

interface SeatBarProps {
  players: Player[];
  mySeat: number;
  turn: number | null;
  handCounts: number[];
  variant?: 'default' | 'arena';
  /** Estadísticas por asiento (las del equipo de ese asiento). En `arena` se muestran una sola vez por equipo. */
  teamStats?: SeatTeamStats[];
}

function HandIcon() {
  return (
    <svg className="casino-seat-icon" viewBox="0 0 10 14" aria-hidden>
      <rect x="1" y="1" width="8" height="12" rx="1.7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 5l4 4M3 8l4 4M3 3l4 4" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
    </svg>
  );
}

function PileIcon() {
  return (
    <svg className="casino-seat-icon" viewBox="0 0 12 14" aria-hidden>
      <rect x="3" y="1" width="8" height="10" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
      <rect x="1" y="3" width="8" height="10" rx="1.6" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="casino-seat-icon casino-seat-icon-spark" viewBox="0 0 12 12" aria-hidden>
      <path d="M6 0l1.5 4.5L12 6 7.5 7.5 6 12 4.5 7.5 0 6l4.5-1.5z" fill="currentColor" />
    </svg>
  );
}

export default function SeatBar({ players, mySeat, turn, handCounts, variant = 'default', teamStats }: SeatBarProps) {
  if (variant === 'arena') {
    return <ArenaSeats players={players} mySeat={mySeat} turn={turn} handCounts={handCounts} teamStats={teamStats} />;
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
      {players.map((player, seat) => {
        const isMe = seat === mySeat;
        const isTurn = seat === turn;
        const handCount = handCounts[seat] ?? 0;
        const handLabel = `${handCount} ${handCount === 1 ? 'carta' : 'cartas'} en mano`;
        return (
          <div
            key={player.id}
            className={`flex min-w-0 flex-col rounded-xl border px-2 py-2 transition duration-300 sm:min-w-[9rem] sm:flex-none sm:rounded-2xl sm:px-4 sm:py-2.5 ${
              isTurn
                ? 'border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-300/60'
                : 'border-stone-200 bg-white'
            }`}
          >
            <span className="flex items-center justify-between gap-1 text-xs font-semibold text-stone-900 sm:gap-2 sm:text-sm">
              <span className="min-w-0 truncate">{player.name}</span>
              {isMe && (
                <span className="shrink-0 rounded-full bg-emerald-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white sm:px-2 sm:text-[10px]">
                  Tú
                </span>
              )}
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-1 text-[10px] text-stone-500 sm:mt-1 sm:gap-2 sm:text-xs">
              <span className="truncate">Mano</span>
              <span
                className="inline-flex min-h-6 shrink-0 items-center gap-0.5 rounded-full bg-stone-100 px-1.5 py-0.5 font-semibold tabular-nums text-stone-700 sm:gap-1 sm:px-2 sm:py-1"
                aria-label={handLabel}
                title={handLabel}
              >
                <span aria-hidden>🂠</span>
                {handCount}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Casino: una única tarjeta por jugador. El nombre aparece una sola vez y el turno se
 * comunica con color, icono y animación en el avatar (sin texto extra que ocupe altura).
 * Los puntos, cartas capturadas y viraos son del equipo, así que se muestran solo en la
 * tarjeta del primer jugador de cada equipo; el compañero comparte el color del avatar.
 */
function ArenaSeats({
  players,
  mySeat,
  turn,
  handCounts,
  teamStats,
}: Pick<SeatBarProps, 'players' | 'mySeat' | 'turn' | 'handCounts' | 'teamStats'>) {
  return (
    <div className="casino-seat-grid">
      {players.map((player, seat) => {
        const isMe = seat === mySeat;
        const isTurn = seat === turn;
        const handCount = handCounts[seat] ?? 0;
        const handLabel = `${handCount} ${handCount === 1 ? 'carta' : 'cartas'} en mano`;
        const team = teamOf(seat);
        const firstOfTeam = players.findIndex((_, other) => teamOf(other) === team) === seat;
        const stats = firstOfTeam ? teamStats?.[seat] : undefined;
        return (
          <div
            key={player.id}
            className={`casino-seat-card casino-seat-team-${team === 0 ? 'a' : 'b'}${isTurn ? ' is-turn' : ''}`}
            aria-current={isTurn ? 'true' : undefined}
          >
            {isMe && <span className="casino-seat-me">Tú</span>}
            <span className="casino-seat-avatar" aria-hidden>
              {player.name.trim().slice(0, 1).toUpperCase()}
              {isTurn && <span className="casino-seat-turn" />}
            </span>
            <span className="casino-seat-head">
              <span className="casino-seat-name">{player.name}</span>
              <span className="casino-seat-hand" aria-label={handLabel} title={handLabel}>
                <HandIcon />
                {handCount}
              </span>
            </span>
            {isTurn && <span className="sr-only">Turno actual</span>}
            {stats && (
              <span
                className="casino-seat-stats"
                aria-label={`${stats.label}: ${stats.score} puntos, ${stats.captured} cartas capturadas, ${stats.viraos} viraos`}
              >
                <span className="casino-seat-stat casino-seat-stat-score" title="Puntos">
                  {stats.score}
                  <small>/{stats.goal}</small>
                </span>
                <span className="casino-seat-stat casino-seat-stat-captured" title="Cartas capturadas">
                  <PileIcon />
                  {stats.captured}
                </span>
                <span className="casino-seat-stat casino-seat-stat-virao" title="Viraos">
                  <SparkIcon />
                  {stats.viraos}
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
