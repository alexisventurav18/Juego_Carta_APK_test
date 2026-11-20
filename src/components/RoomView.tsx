import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { canStartGame, GAMES, isGameFinished } from '@/games';
import type { CasinoMove } from '@/games/casino';
import type { TresYDosMove } from '@/games/tresYDos';
import type { CagaoMove } from '@/games/cagao';
import type { RobaitoMove } from '@/games/robaito';
import { botTickDelay } from '@/games/bots';
import { isBotPlayer } from '@/games/shared';
import { getPlayerId } from '@/lib/identity';
import { botTick, fetchRoom, leaveRoom, requestStart, type RoomConnectionStatus, type RoomRow, type RoomSubscription, sendMove, subscribeToRoom } from '@/lib/rooms';
import { CHAT_TOAST_MS, isAllowedChatSender, type RoomChatMessage } from '@/lib/roomChat';
import RoomChat from './RoomChat';
import { OptionsButton } from './table/chips';
import WaitingRoom from './WaitingRoom';
import CasinoTable from './CasinoTable';
import TresYDosTable from './TresYDosTable';
import CagaoTable from './CagaoTable';
import RobaitoTable from './robaito/RobaitoTable';
import CoinToss from './CoinToss';

interface RoomViewProps {
  roomId: string;
  onLeave: () => void;
}

// Errores tras los cuales no tiene sentido seguir en la sala.
const FATAL_MESSAGES = ['Esta sala ya no existe.', 'No estás en esta sala.'];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Algo salió mal. Inténtalo de nuevo.';
}

export default function RoomView({ roomId, onLeave }: RoomViewProps) {
  const [playerId] = useState(getPlayerId);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coinOpen, setCoinOpen] = useState(false);
  const [connection, setConnection] = useState<RoomConnectionStatus>('connecting');
  const [retryToken, setRetryToken] = useState(0);
  const versionRef = useRef(-1);
  // Reintentos del turno del bot: si el tick falla (p. ej. un error transitorio del
  // servidor) se reintenta con espera en lugar de depender del sondeo de 15 s.
  const [botRetries, setBotRetries] = useState(0);
  const botVersionRef = useRef(-1);
  const botRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BOT_TICK_MAX_RETRIES = 3;
  const BOT_TICK_RETRY_MS = 2500;
  // Chat de texto de la sala: aviso temporal con el último mensaje, y el
  // envío por Broadcast (el remitente no recibe su propio mensaje).
  const [chatToast, setChatToast] = useState<RoomChatMessage | null>(null);
  const chatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef<RoomRow | null>(null);
  const subscriptionRef = useRef<RoomSubscription | null>(null);

  const retryConnection = () => {
    setConnection('connecting');
    setRetryToken((value) => value + 1);
  };

  const acceptRow = useCallback((row: RoomRow) => {
    setRoom((prev) => {
      const next = !prev || row.version >= prev.version ? row : prev;
      versionRef.current = next.version;
      return next;
    });
  }, []);

  /** Muestra un mensaje de chat como aviso temporal (~4 s). El nombre que se ve es el de la sala, no el que traiga el mensaje. */
  const showChatMessage = useCallback((msg: RoomChatMessage) => {
    const sender = roomRef.current?.players.find((player) => player.id === msg.fromId);
    setChatToast({ ...msg, fromName: sender?.name ?? msg.fromName });
    if (chatTimerRef.current !== null) clearTimeout(chatTimerRef.current);
    chatTimerRef.current = setTimeout(() => setChatToast(null), CHAT_TOAST_MS);
  }, []);

  /** Envía un mensaje de chat y muestra el eco local (el remitente no recibe su propio Broadcast). */
  const sendChatMessage = useCallback(
    (msg: RoomChatMessage) => {
      subscriptionRef.current?.sendChat(msg);
      showChatMessage(msg);
    },
    [showChatMessage],
  );

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      setConnection('connecting');
      fetchRoom(roomId)
        .then((row) => {
          if (!active) return;
          setLoadError(null);
          setConnection('connected');
          acceptRow(row);
        })
        .catch((err: unknown) => {
          if (!active) return;
          const message = errorMessage(err);
          setConnection('offline');
          if (FATAL_MESSAGES.includes(message) || versionRef.current === -1) setLoadError(message);
          else setNotice(message);
        });
    };

    refresh();
    const subscription = subscribeToRoom(
      roomId,
      (version) => {
        if (version > versionRef.current) refresh();
      },
      setConnection,
      (msg) => {
        // Solo mensajes de un jugador humano de esta sala; el resto se descarta.
        if (!isAllowedChatSender(msg, roomRef.current?.players ?? [])) return;
        showChatMessage(msg);
      },
    );
    subscriptionRef.current = subscription;
    const refreshTimer = window.setInterval(refresh, 15000);
    const handleOffline = () => setConnection('offline');
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', handleOffline);
    return () => {
      active = false;
      subscription.unsubscribe();
      subscriptionRef.current = null;
      if (chatTimerRef.current !== null) clearTimeout(chatTimerRef.current);
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', handleOffline);
    };
  }, [roomId, acceptRow, retryToken, showChatMessage]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // En una sala pública en espera, el servidor arranca la partida sola cuando
  // se llena o pasan ~30 s: se consulta cada 5 s para no perderse el arranque.
  useEffect(() => {
    if (!room || room.status !== 'waiting' || !room.isPublic) return undefined;
    const timer = window.setInterval(() => {
      fetchRoom(room.id)
        .then((row) => {
          setConnection('connected');
          acceptRow(row);
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [room, acceptRow]);

  // El primer humano de la sala pide al servidor las jugadas de los bots; el servidor es quien las calcula.
  // Si el tick falla, se reintenta hasta 3 veces con 2,5 s de espera; el contador se
  // reinicia cuando la versión de la sala cambia (es decir, cuando alguien jugó).
  useEffect(() => {
    if (!room?.state || !room.players.some(isBotPlayer)) return;
    if (room.players.find((p) => !isBotPlayer(p))?.id !== playerId) return;
    if (room.version !== botVersionRef.current) {
      botVersionRef.current = room.version;
      if (botRetries !== 0) setBotRetries(0);
      return;
    }
    const delay = botTickDelay(room.state);
    if (delay === null) return;
    const timer = setTimeout(() => {
      botTick(room.id, room.version)
        .then((row) => {
          setBotRetries(0);
          acceptRow(row);
        })
        .catch((err: unknown) => {
          setNotice(errorMessage(err));
          if (botRetries < BOT_TICK_MAX_RETRIES) {
            botRetryTimerRef.current = setTimeout(() => setBotRetries((value) => value + 1), BOT_TICK_RETRY_MS);
          }
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      if (botRetryTimerRef.current !== null) {
        clearTimeout(botRetryTimerRef.current);
        botRetryTimerRef.current = null;
      }
    };
  }, [room, playerId, acceptRow, botRetries]);

  if (loadError) {
    return (
      <StatusMessage
        message={loadError}
        onRetry={() => {
          versionRef.current = -1;
          setRoom(null);
          setLoadError(null);
          retryConnection();
        }}
        onLeave={onLeave}
      />
    );
  }
  if (!room) {
    return (
      <div className="wood-stage safe-screen flex items-center justify-center">
        <p className="text-center text-sm text-amber-100/80">Cargando sala...</p>
      </div>
    );
  }

  const seat = room.players.findIndex((p) => p.id === playerId);
  if (seat === -1) {
    return <StatusMessage message="No estás en esta sala." onLeave={onLeave} />;
  }

  const run = async (action: () => Promise<RoomRow>) => {
    setSaving(true);
    try {
      acceptRow(await action());
    } catch (err) {
      setNotice(errorMessage(err));
      fetchRoom(roomId).then(acceptRow).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  const startGame = () => {
    if (!canStartGame(room.game, room.players.length)) {
      setNotice(`Este juego necesita ${GAMES[room.game].playerCountLabel.toLowerCase()}.`);
      return;
    }
    if (room.game === 'casino' && room.players.some(isBotPlayer)) {
      setCoinOpen(true);
      return;
    }
    void run(() => requestStart(room.id));
  };

  /** Salir de una sala en espera: se avisa al servidor para liberar el asiento (y borrarla si queda vacía). */
  const leaveWaitingRoom = useCallback(() => {
    if (!room || room.status !== 'waiting') {
      onLeave();
      return;
    }
    leaveRoom(room.id)
      .catch(() => undefined)
      .finally(() => onLeave());
  }, [room, onLeave]);

  const startSoloGame = (humanWonToss: boolean) => {
    setCoinOpen(false);
    const dealer = humanWonToss ? room.players.findIndex(isBotPlayer) : seat;
    void run(() => requestStart(room.id, dealer));
  };

  const state = room.state;
  const info = GAMES[room.game];

  // El chat solo tiene sentido con otro humano en la mesa: contra bots no hay con quién hablar.
  const hasOtherHuman = room.players.some((player) => player.id !== playerId && !isBotPlayer(player));
  const myName = room.players.find((player) => player.id === playerId)?.name ?? '';

  // Los juegos ocupan toda la pantalla: sale, estado de conexión y avisos van dentro de su barra superior.
  if (state !== null && room.status !== 'waiting') {
    const tableProps = {
      seat,
      onLeave,
      roomLabel: `${info.name} · Sala ${room.code}`,
      connection,
      onRetry: retryConnection,
      notice,
      resultFooter:
        isGameFinished(state) && seat === 0 ? (
          <button
            type="button"
            onClick={startGame}
            className="btn-gold inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2 text-sm font-extrabold active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Jugar otra partida
          </button>
        ) : undefined,
    };
    return (
      <div className={`transition ${saving ? 'pointer-events-none opacity-80' : ''}`}>
        {state.game === 'casino' ? (
          <CasinoTable
            state={state}
            {...tableProps}
            onMove={(move: CasinoMove) => void run(() => sendMove(room.id, move))}
          />
        ) : state.game === 'tresydos' ? (
          <TresYDosTable
            state={state}
            {...tableProps}
            onMove={(move: TresYDosMove) => void run(() => sendMove(room.id, move))}
          />
        ) : state.game === 'robaito' ? (
          <RobaitoTable
            state={state}
            {...tableProps}
            onMove={(move: RobaitoMove) => void run(() => sendMove(room.id, move))}
          />
        ) : (
          <CagaoTable
            state={state}
            {...tableProps}
            onMove={(move: CagaoMove) => void run(() => sendMove(room.id, move))}
          />
        )}
        {/* Chat de texto: vive aquí, en la rama que envuelve las 4 mesas, así
            funciona igual en Casino, Tres y Dos, El Cagao y El Robaíto. */}
        {hasOtherHuman && <RoomChat toast={chatToast} myId={playerId} myName={myName} onSend={sendChatMessage} />}
      </div>
    );
  }

  return (
    <div className="wood-stage safe-screen overflow-y-auto room-waiting-screen">
      <div className="room-waiting-content mx-auto w-full max-w-6xl px-3 py-2 sm:px-6 sm:py-5">
      <header className="room-waiting-header mb-2 flex items-center justify-between gap-2 sm:mb-6 sm:gap-4">
        <button
          type="button"
          onClick={leaveWaitingRoom}
          className="wood-chip inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-transform active:scale-95 sm:gap-2 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Salir de la sala
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold text-amber-200/80">{info.name}</p>
            <p className="font-mono text-base font-semibold tracking-[0.3em] text-amber-50 sm:text-lg">{room.code}</p>
          </div>
          <OptionsButton />
        </div>
      </header>

      <div
        role="status"
        aria-live="polite"
        className={`room-waiting-connection mb-2 flex items-center justify-center gap-2 rounded-xl px-3 py-1 text-[10px] font-medium sm:mb-4 sm:px-4 sm:py-2 sm:text-xs ${
          connection === 'connected'
            ? 'bg-lime-600/25 text-lime-200 ring-1 ring-lime-400/40'
            : connection === 'offline'
              ? 'bg-rose-700/40 text-rose-100 ring-1 ring-rose-300/40'
              : 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-300/40'
        }`}
      >
        {connection === 'connected' && <Wifi className="h-3.5 w-3.5" />}
        {connection === 'offline' && <WifiOff className="h-3.5 w-3.5" />}
        {connection === 'connecting' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
        {connection === 'connected' ? 'Conectado al servidor' : connection === 'offline' ? 'Sin conexión. Reintentando...' : 'Conectando al servidor...'}
        {connection === 'offline' && (
          <button type="button" onClick={retryConnection} className="ml-2 rounded-md bg-black/25 px-2 py-1 font-bold text-amber-50 underline">
            Reintentar
          </button>
        )}
      </div>

      {notice && (
        <p role="alert" className="mb-5 rounded-xl bg-rose-700/80 px-4 py-3 text-center text-sm font-medium text-rose-50 ring-1 ring-rose-300/60">
          {notice}
        </p>
      )}

      {coinOpen && <CoinToss onDone={startSoloGame} />}

      <WaitingRoom room={room} myId={playerId} busy={saving} onStart={startGame} matchmaking={room.isPublic} onLeave={leaveWaitingRoom} />
    </div>
    </div>
  );
}

function StatusMessage({ message, onRetry, onLeave }: { message: string; onRetry?: () => void; onLeave: () => void }) {
  return (
    <div className="wood-stage safe-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="max-w-md text-amber-50">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn-gold min-h-[44px] rounded-lg px-5 py-2.5 text-sm font-extrabold transition-transform active:scale-95"
          >
            Reintentar
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="btn-wood min-h-[44px] rounded-lg px-5 py-2.5 text-sm font-bold transition-transform active:scale-95"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
