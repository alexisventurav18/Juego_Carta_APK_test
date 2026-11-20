import type { CSSProperties, ReactNode } from 'react';
import { Check } from 'lucide-react';
import Avatar from '../avatar/Avatar';
import { OpponentFan } from './Fans';
import type { TeamColor } from '../table/teamColors';
import type { SeatSide } from './types';

interface SeatPlaqueProps {
  name: string;
  /** Código del avatar que se muestra como foto de perfil. */
  avatar: string;
  isTurn: boolean;
  /** Le están robando a este jugador ahora. */
  isVictim?: boolean;
  /** Se quedó sin cartas: se salvó. */
  out: boolean;
  isMe?: boolean;
  /** Versión baja para barras superiores apretadas (Casino y Tres y Dos). */
  compact?: boolean;
  /** Etiqueta pequeña bajo el nombre (p. ej. "2 ganadas"). */
  tag?: string;
  /** Color del equipo del jugador (solo en partidas por equipos): aro en la placa y en el avatar. */
  team?: TeamColor;
  /** Cartas en el paquete (El Robaíto): se dibuja un mini mazo con el contador centrado dentro. */
  packetCount?: number;
}

/**
 * Mini mazo de cartas con el contador centrado dentro: el paquete de El Robaíto. Las dos cartas de
 * atrás asoman por arriba a la derecha para que se lea como un mazo apilado, no como una carta sola.
 */
function PacketIcon({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${count} en paquete`}
      title={`${count} en paquete`}
      className={`relative inline-flex shrink-0 items-center justify-center ${compact ? 'h-[18px] w-[14px]' : 'h-[21px] w-[17px]'}`}
    >
      <span aria-hidden className="absolute inset-0 translate-x-[2px] -translate-y-[2px] rounded-[2px] bg-amber-100/50" />
      <span aria-hidden className="absolute inset-0 translate-x-[1px] -translate-y-[1px] rounded-[2px] bg-amber-100/75" />
      <span
        className={`absolute inset-0 flex items-center justify-center rounded-[2px] bg-amber-50 font-extrabold tabular-nums leading-none text-stone-900 ring-1 ring-amber-900/50 ${
          compact ? 'text-[9px]' : 'text-[11px]'
        }`}
      >
        {count}
      </span>
    </span>
  );
}

/** Placa de madera con el avatar. Cuando es su turno se ilumina en dorado. */
export function SeatPlaque({ name, avatar, isTurn, isVictim, out, isMe, compact = false, tag, team, packetCount }: SeatPlaqueProps) {
  const plaqueStyle: CSSProperties | undefined = team
    ? { boxShadow: `inset 0 0 0 2px ${team.main}, inset 0 -4px 8px rgb(0 0 0 / 0.45), 0 3px 8px rgb(0 0 0 / 0.5)` }
    : undefined;
  // La sub-línea solo existe si hay algo que mostrar: sin equipo, sin etiqueta y sin paquete, la
  // placa queda solo con avatar + nombre. Las cartas en mano no se muestran: ya se ven en el
  // abanico de cada jugador.
  const hasSubLine = out || team !== undefined || tag !== undefined || packetCount !== undefined;
  return (
    <div
      style={plaqueStyle}
      className={`relative min-w-0 max-w-full ${compact ? 'rounded-lg px-1 py-0.5' : 'rounded-xl px-1.5 py-1'} wood-block ${
        out ? 'opacity-70' : ''
      }`}
    >
      {isTurn && <span aria-hidden className="turn-glow pointer-events-none absolute -inset-1 rounded-2xl" />}
      {/*
        El brillo de turno va fuera de este envoltorio: el envoltorio recorta
        (overflow-hidden) para que ningún texto pinte fuera de la placa, y el
        brillo debe quedar fuera de ese recorte para seguir viéndose alrededor.
      */}
      <div className={`flex min-w-0 items-center overflow-hidden ${compact ? 'gap-1' : 'gap-1.5'}`}>
        <Avatar
          code={avatar}
          className={`relative ${compact ? 'h-[clamp(18px,4.6dvh,26px)] w-[clamp(18px,4.6dvh,26px)]' : 'h-[clamp(22px,7dvh,40px)] w-[clamp(22px,7dvh,40px)]'} shrink-0 border-2 ${
            isTurn ? 'border-yellow-300' : isVictim ? 'border-rose-300' : 'border-amber-900/70'
          }`}
          style={team && !isTurn && !isVictim ? { borderColor: team.main } : undefined}
        />
        <span className="relative min-w-0 leading-tight">
          <span className={`block truncate font-bold text-amber-50 ${compact ? 'text-[clamp(9px,2.1dvh,12px)]' : 'text-[clamp(10px,2.8dvh,14px)]'}`}>{isMe ? 'Tú' : name}</span>
          {/*
            La sub-línea se puede partir en dos líneas y solo existe si hay algo que mostrar. En vez
            de texto con las cartas en mano (ya se ven en el abanico), el paquete se dibuja como un
            mini mazo con el contador dentro.
          */}
          {hasSubLine && (
            <span className={`flex min-w-0 flex-wrap items-center gap-x-1 font-semibold leading-tight text-amber-200 ${compact ? 'text-[clamp(8px,1.9dvh,10px)]' : 'text-[clamp(9px,2.4dvh,12px)]'}`}>
              {out ? (
                <>
                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                  <span>Salvó</span>
                </>
              ) : (
                <>
                  {team && (
                    <span
                      className="shrink-0 rounded px-1 text-[0.85em] font-extrabold leading-snug"
                      style={{ backgroundColor: team.main, color: team.ink }}
                    >
                      {team.label}
                    </span>
                  )}
                  {tag !== undefined && <span className="min-w-0">{tag}</span>}
                  {packetCount !== undefined && <PacketIcon count={packetCount} compact={compact} />}
                </>
              )}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

interface PlayerSeatProps {
  side: Exclude<SeatSide, 'bottom'>;
  seat: number;
  name: string;
  avatar: string;
  count: number;
  isTurn: boolean;
  isVictim: boolean;
  out: boolean;
  /** Te toca robarle a este jugador. */
  pickable: boolean;
  onPick: (seat: number, index: number) => void;
  registerAnchor: (seat: number, el: HTMLElement | null) => void;
  /** Etiqueta pequeña bajo el nombre (p. ej. "Pareja"). */
  tag?: string;
  /** Color del equipo del jugador (partidas por equipos). */
  team?: TeamColor;
  /** Cartas en el paquete (El Robaíto): mini mazo con contador en la placa. */
  packetCount?: number;
  children?: ReactNode;
}

const ROTATION: Record<PlayerSeatProps['side'], number> = { top: 180, left: 90, right: -90 };

/**
 * Un rival sentado a la izquierda, arriba o a la derecha: su placa y sus cartas boca abajo en abanico
 * cerrado apuntando al centro de la mesa.
 */
export default function PlayerSeat({
  side,
  seat,
  name,
  avatar,
  count,
  isTurn,
  isVictim,
  out,
  pickable,
  onPick,
  registerAnchor,
  tag,
  team,
  packetCount,
}: PlayerSeatProps) {
  const vertical = side !== 'top';
  const fan =
    count > 0 ? (
      <OpponentFan
        count={count}
        heightVar="--oh"
        avail={vertical ? 'min(21dvh, 160px)' : 'min(var(--top-avail, 28dvw), 300px)'}
        rotation={ROTATION[side]}
        active={pickable}
        label={name}
        onPick={(index) => onPick(seat, index)}
        containerRef={(el) => registerAnchor(seat, el)}
      />
    ) : (
      <span ref={(el) => registerAnchor(seat, el)} aria-hidden className="block h-[var(--oh)] w-[var(--oh)]" />
    );

  if (!vertical) {
    return (
      <div className="flex min-w-0 items-center justify-center gap-2">
        <SeatPlaque name={name} avatar={avatar} isTurn={isTurn} isVictim={isVictim} out={out} tag={tag} team={team} packetCount={packetCount} />
        <div className="flex h-[calc(var(--oh)+14px)] min-w-0 items-center justify-center px-2">{fan}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-1">
      <SeatPlaque name={name} avatar={avatar} isTurn={isTurn} isVictim={isVictim} out={out} tag={tag} team={team} packetCount={packetCount} />
      {/* El abanico se gira 90°: la caja reserva su largo como alto y el alto de carta como ancho. */}
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: 'calc(var(--oh) + 16px)', height: 'min(24dvh, 175px)' }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{fan}</div>
      </div>
    </div>
  );
}
