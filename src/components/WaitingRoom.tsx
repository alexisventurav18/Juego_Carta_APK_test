import { useState } from 'react';
import { Check, Copy, Play, Users } from 'lucide-react';
import { canStartGame, GAMES } from '@/games';
import type { Player } from '@/games/shared';
import type { RoomRow } from '@/lib/rooms';
import Avatar from './avatar/Avatar';
import { resolveAvatarCode } from './avatar/resolve';

interface WaitingRoomProps {
  room: RoomRow;
  myId: string;
  busy: boolean;
  onStart: () => void;
}

export default function WaitingRoom({ room, myId, busy, onStart }: WaitingRoomProps) {
  const isHost = room.players[0]?.id === myId;
  const info = GAMES[room.game];
  const canStart = canStartGame(room.game, room.players.length);
  const slots = Math.max(info.maxPlayers - room.players.length, 0);
  const [copied, setCopied] = useState(false);
  // Las salas de 4 o más jugadores muestran la lista en dos columnas para ahorrar altura en móvil.
  const twoColumns = info.maxPlayers >= 4;

  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(room.code);
      } else {
        const input = document.createElement('textarea');
        input.value = room.code;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-2 min-[600px]:grid-cols-[1fr_1.2fr] sm:gap-5">
      <div className="flex flex-col gap-2 self-start wood-panel p-3 sm:gap-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-200 sm:text-sm">Sala de {info.name}</p>
          <p className="text-xs text-amber-100/85 sm:text-sm">Comparte este código con tus amigos para que entren.</p>
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[clamp(1.5rem,8vw,2.25rem)] font-semibold tracking-[0.2em] text-amber-300 sm:tracking-[0.3em]">{room.code}</p>
          <button
            type="button"
            onClick={copyCode}
            className="btn-wood inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-transform active:scale-95 sm:min-h-[44px] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
          >
            {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            {copied ? 'Código copiado' : 'Copiar código'}
          </button>
        </div>
      </div>

      <div className="wood-panel space-y-2 p-3 sm:space-y-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-amber-50 sm:text-lg">Jugadores</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-100/70 sm:text-sm">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {room.players.length} de {info.maxPlayers}
          </span>
        </div>

        <ul className={`grid gap-1 ${twoColumns ? 'grid-cols-2' : ''}`}>
          {room.players.map((player, index) => (
            <PlayerRow key={player.id} player={player} index={index} isMe={player.id === myId} compact={twoColumns} />
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <li
              key={`empty-${i}`}
              className="flex min-h-[44px] items-center rounded-xl border border-dashed border-amber-200/30 px-3 py-1.5 text-sm text-amber-100/50"
            >
              Esperando jugador...
            </li>
          ))}
        </ul>

        <p className="text-[11px] leading-tight text-amber-100/70 sm:text-sm">
          {canStart
            ? 'Ya hay suficientes jugadores. Cuando estén listos, empiecen.'
            : `Para empezar se necesitan ${info.playerCountLabel.toLowerCase()}.`}
        </p>

        {isHost ? (
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || busy}
            className="btn-gold flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[44px] sm:px-4 sm:py-3 sm:text-sm"
          >
            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {busy ? 'Repartiendo...' : 'Empezar partida'}
          </button>
        ) : (
          <p className="rounded-xl bg-black/30 px-3 py-2 text-center text-xs text-amber-100/80 sm:px-4 sm:py-3 sm:text-sm">
            Esperando a que {room.players[0]?.name} empiece la partida.
          </p>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player, index, isMe, compact }: { player: Player; index: number; isMe: boolean; compact: boolean }) {
  return (
    <li className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1 ring-1 ring-amber-200/15 sm:min-h-[44px] sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-1.5">
      <Avatar code={resolveAvatarCode(player, isMe)} className="h-7 w-7 shrink-0 border-2 border-amber-900/70 sm:h-8 sm:w-8" />
      <span className="min-w-0 flex-1 truncate text-xs font-bold text-amber-50 sm:text-sm">{player.name}</span>
      {index === 0 && !compact && <span className="shrink-0 rounded-md bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold text-amber-200 sm:px-1.5 sm:text-[10px]">Anfitrión</span>}
      {isMe && <span className="shrink-0 text-[10px] font-bold text-lime-400 sm:text-xs">Tú</span>}
    </li>
  );
}
