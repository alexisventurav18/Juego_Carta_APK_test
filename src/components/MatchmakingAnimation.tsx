/**
 * Animación de emparejamiento: radar con anillos que se expanden, dos cartas
 * orbitando alrededor de una pica dorada y puntos suspensivos que laten.
 *
 * El mensaje de estado rota cada pocos segundos para que la espera se sienta
 * viva ("Buscando jugadores…", "Barajando el mazo…", "Buscando mesa…") y el
 * indicador muestra cuántos jugadores ya hay en la mesa.
 */

const STATUS_MESSAGES = [
  'Buscando jugadores',
  'Barajando el mazo',
  'Buscando mesa',
  'Repartiendo las cartas',
] as const;

/** Mensaje de estado según los segundos que lleva buscando (rota cada 5 s). */
export function matchmakingStatus(elapsedSeconds: number): string {
  const index = Math.floor(Math.max(0, elapsedSeconds) / 5) % STATUS_MESSAGES.length;
  return STATUS_MESSAGES[index];
}

interface MatchmakingAnimationProps {
  /** Jugadores ya en la sala (incluyéndote). */
  playersFound: number;
  /** Jugadores máximos de la mesa. */
  maxPlayers: number;
  /** Segundos que quedan para completar con bots (30 al entrar). */
  secondsLeft: number;
  /** Duración total de la espera, para calcular el tiempo transcurrido. */
  waitSeconds?: number;
}

export default function MatchmakingAnimation({ playersFound, maxPlayers, secondsLeft, waitSeconds = 30 }: MatchmakingAnimationProps) {
  // secondsLeft cambia cada segundo desde WaitingRoom, así que el mensaje
  // rota solo con derivarlo del tiempo transcurrido: sin estado ni temporizador.
  const status = matchmakingStatus(Math.max(0, waitSeconds - secondsLeft));

  return (
    <div className="flex flex-col items-center gap-2 text-center" role="status" aria-live="polite">
      <div className="matchmaking-radar" aria-hidden>
        <span className="matchmaking-ring" />
        <span className="matchmaking-ring matchmaking-ring--2" />
        <span className="matchmaking-ring matchmaking-ring--3" />
        <div className="matchmaking-orbit">
          <span className="matchmaking-orbit-card matchmaking-orbit-card--a text-rose-600">♥</span>
          <span className="matchmaking-orbit-card matchmaking-orbit-card--b text-slate-900">♠</span>
        </div>
        <div className="matchmaking-core">
          <span className="matchmaking-core-spade">♠</span>
        </div>
      </div>

      <p className="text-sm font-extrabold text-amber-200">
        {status}
        <span className="matchmaking-dots" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
      <p className="matchmaking-players text-xs text-amber-100/80">
        {playersFound} de {maxPlayers} jugadores en la mesa
      </p>

      {/* Progreso de la espera: se llena mientras corre la cuenta atrás. */}
      <div className="matchmaking-progress h-1.5 w-40 overflow-hidden rounded-full bg-black/50 ring-1 ring-amber-200/30" aria-hidden>
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-1000"
          style={{ width: `${Math.round(((waitSeconds - secondsLeft) / waitSeconds) * 100)}%` }}
        />
      </div>
    </div>
  );
}
