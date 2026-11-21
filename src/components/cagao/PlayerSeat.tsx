import type { CSSProperties, ReactNode } from 'react';
import { Check, Star } from 'lucide-react';
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
  /** Nivel de experiencia (1-100): estrella + número junto al nombre. Sin nivel no hay insignia. */
  level?: number;
}

/**
 * Mini mazo de cartas con el contador centrado dentro: el paquete de El Robaíto. Las dos cartas de
 * atrás asoman por arriba a la derecha para que se lea como un mazo apilado, no como una carta sola.
 * El icono cabe dentro de la altura de la sub-línea (sin estirarla ni asomar por debajo de la placa):
 * antes medía 21 px en una línea de 12 px y el contador parecía colgar fuera de la placa.
 */
function PacketIcon({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${count} en paquete`}
      title={`${count} en paquete`}
      className={`relative inline-flex shrink-0 items-center justify-center ${compact ? 'h-[14px] w-[11px]' : 'h-[16px] w-[13px]'}`}
    >
      <span aria-hidden className="absolute inset-0 translate-x-[1px] -translate-y-[1px] rounded-[2px] bg-amber-100/50" />
      <span aria-hidden className="absolute inset-0 translate-x-[0.5px] -translate-y-[0.5px] rounded-[2px] bg-amber-100/75" />
      <span
        className={`absolute inset-0 flex items-center justify-center rounded-[2px] bg-amber-50 font-extrabold tabular-nums leading-none text-stone-900 ring-1 ring-amber-900/50 ${
          compact ? 'text-[8px]' : 'text-[10px]'
        }`}
      >
        {count}
      </span>
    </span>
  );
}

/** Insignia de nivel: estrella + número, compacta para caber junto al nombre sin empujar nada fuera.
    El número tiene ancho fijo para dos cifras: al subir de nivel 9 a 10 la placa no crece. */
function LevelBadge({ level, compact = false }: { level: number; compact?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`Nivel ${level}`}
      title={`Nivel ${level}`}
      className={`flex shrink-0 items-center gap-0.5 rounded-full bg-sky-400/20 px-1 py-px font-extrabold leading-none text-sky-200 ring-1 ring-sky-300/50 ${
        compact ? 'text-[9px]' : 'text-xs'
      }`}
    >
      <Star className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} shrink-0 fill-sky-200`} aria-hidden />
      <span className="inline-block w-[2ch] text-center tabular-nums">{level}</span>
    </span>
  );
}

/** Placa de madera con el avatar. Cuando es su turno se ilumina en dorado. */
export function SeatPlaque({ name, avatar, isTurn, isVictim, out, isMe, compact = false, tag, team, packetCount, level }: SeatPlaqueProps) {
  const plaqueStyle: CSSProperties | undefined = team
    ? { boxShadow: `inset 0 0 0 2px ${team.main}, inset 0 -4px 8px rgb(0 0 0 / 0.45), 0 3px 8px rgb(0 0 0 / 0.5)` }
    : undefined;
  // La placa tiene tamaño fijo: el nombre ocupa siempre 10 caracteres (se recorta lo que sobre),
  // la insignia de nivel ya tiene ancho fijo, y la sub-línea existe siempre — cuando no hay nada
  // que mostrar queda un hueco invisible de la misma altura. Sin esto, la placa crecía y se
  // encogía con el nombre, con el nivel 9→10, con "Salvó" al salir alguien y con la etiqueta, y
  // todo lo de alrededor (abanico, fichas de puntaje, píldora de turno) se movía con ella.
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
          {/* El nombre tiene ancho fijo y se recorta: la insignia no se mueve y la placa no cambia
              de ancho con el nombre. */}
          <span className="flex min-w-0 items-center gap-1">
            <span className={`w-[10ch] min-w-0 truncate font-bold text-amber-50 ${compact ? 'text-[clamp(9px,2.1dvh,12px)]' : 'text-[clamp(10px,2.8dvh,14px)]'}`}>{isMe ? 'Tú' : name}</span>
            {level !== undefined && <LevelBadge level={level} compact={compact} />}
          </span>
          {/*
            La sub-línea siempre ocupa su fila (una sola línea, sin partirse): si no hay nada que
            mostrar, un hueco invisible reserva la altura. En vez de texto con las cartas en mano
            (ya se ven en el abanico), el paquete se dibuja como un mini mazo con el contador dentro.
          */}
          <span className={`flex min-w-0 items-center gap-x-1 font-semibold leading-tight text-amber-200 ${compact ? 'text-[clamp(8px,1.9dvh,10px)]' : 'text-[clamp(9px,2.4dvh,12px)]'}`}>
            {out ? (
              <>
                <Check className="h-3 w-3 shrink-0" aria-hidden />
                <span>Salvó</span>
              </>
            ) : hasSubLine ? (
              <>
                {team && (
                  <span
                    className="shrink-0 rounded px-1 text-[0.85em] font-extrabold leading-snug"
                    style={{ backgroundColor: team.main, color: team.ink }}
                  >
                    {team.label}
                  </span>
                )}
                {tag !== undefined && <span className="min-w-0 max-w-[9ch] truncate">{tag}</span>}
                {packetCount !== undefined && <PacketIcon count={packetCount} compact={compact} />}
              </>
            ) : (
              <span aria-hidden className="invisible">Salvó</span>
            )}
          </span>
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
  /** Nivel de experiencia del jugador (se muestra como insignia en la placa). */
  level?: number;
  /** Tres rivales arriba (El Cagao con 6 jugadores): placa compacta encima del abanico, en vez de al
      lado, para que los tres asientos quepan sin recortar los nombres. */
  stacked?: boolean;
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
  level,
  stacked = false,
}: PlayerSeatProps) {
  const vertical = side !== 'top';
  const fan =
    count > 0 ? (
      <OpponentFan
        count={count}
        heightVar="--oh"
        avail={vertical ? 'min(16dvh, 120px)' : 'min(var(--top-avail, 14dvw), 110px)'}
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
    if (stacked) {
      // Tres rivales arriba: la placa compacta va encima del abanico. En fila, tres placas con su
      // abanico no caben en la fila de arriba sin recortar los nombres hasta perderlos; apilados,
      // cada asiento ocupa lo que mide su placa y los tres caben en cualquier ancho.
      return (
        <div className="flex min-w-0 flex-col items-center justify-center gap-1">
          <SeatPlaque name={name} avatar={avatar} isTurn={isTurn} isVictim={isVictim} out={out} tag={tag} team={team} packetCount={packetCount} level={level} compact />
          <div className="flex h-[calc(var(--oh)+14px)] w-[min(var(--top-avail,14dvw),110px)] min-w-0 shrink-0 items-center justify-center px-2">{fan}</div>
        </div>
      );
    }
    return (
      <div className="flex min-w-0 items-center justify-center gap-2">
        <SeatPlaque name={name} avatar={avatar} isTurn={isTurn} isVictim={isVictim} out={out} tag={tag} team={team} packetCount={packetCount} level={level} />
        {/* El abanico tiene ancho fijo (su tope): si no, al jugarse cartas se estrecha y empuja la
            placa y lo que haya al lado en la fila de arriba. El tope es el ancho real del abanico
            (unas 110 px con la mano llena): antes reservaba más del doble y ese hueco vacío
            empujaba la placa contra la ficha de mazo. */}
        <div className="flex h-[calc(var(--oh)+14px)] w-[min(var(--top-avail,14dvw),110px)] min-w-0 shrink-0 items-center justify-center px-2">{fan}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-1">
      <SeatPlaque name={name} avatar={avatar} isTurn={isTurn} isVictim={isVictim} out={out} tag={tag} team={team} packetCount={packetCount} level={level} />
      {/* El abanico se gira 90°: la caja reserva su largo como alto y el alto de carta como ancho.
          El largo es 16dvh (máx. 120 px): con 24dvh el asiento de los costados era más alto que la
          fila del tablero en horizontal corto y la placa se montaba sobre la fila de arriba. */}
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: 'calc(var(--oh) + 16px)', height: 'min(16dvh, 120px)' }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{fan}</div>
      </div>
    </div>
  );
}
