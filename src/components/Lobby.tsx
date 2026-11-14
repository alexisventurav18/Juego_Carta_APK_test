import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { BookOpen, Bot, DoorOpen, Maximize2, Minimize2, RefreshCw, Spade, Users, Volume2, VolumeX, X } from 'lucide-react';
import { GAMES } from '@/games';
import type { GameId } from '@/games/shared';
import { createRoom, createSoloRoom, joinRoom } from '@/lib/rooms';
import { getPlayerId, getStoredName, resetPlayerIdentity, storeName } from '@/lib/identity';
import { useFullscreen } from '@/lib/platform';
import { useMuted } from '@/lib/soundPrefs';
import { useGameSounds } from '@/hooks/useGameSounds';
import { WoodFrame } from './cagao/CardAssets';
import GameCards from './GameCards';
import type { OfflineSetup } from './OfflineBotGame';

interface LobbyProps {
  onEnter: (roomId: string) => void;
  onStartOffline: (setup: OfflineSetup) => void;
}

const GAME_ORDER: GameId[] = ['casino', 'tresydos', 'cagao'];

/** Medidas del marco del menú: más finas que las de la mesa para dejar sitio a las tarjetas. */
const FRAME_VARS = {
  '--frame': 'clamp(8px, 2.2dvh, 18px)',
  '--corner': 'clamp(22px, 6dvh, 44px)',
  '--medal': 'clamp(20px, 5dvh, 38px)',
} as CSSProperties;

interface OfflineOption {
  /** Jugadores en total, contando al humano. */
  count: number;
  label: string;
}

/** Tamaños de mesa que se pueden jugar sin conexión: el Casino va por equipos; los otros, por número de bots. */
function offlineOptions(game: GameId): OfflineOption[] {
  if (game === 'casino') {
    return [
      { count: 4, label: 'En equipo' },
      { count: 2, label: '1 contra 1' },
    ];
  }
  return GAMES[game].playerCounts.map((count) => ({ count, label: `${count - 1} bot${count === 2 ? '' : 's'}` }));
}

const BTN = 'flex min-h-[clamp(36px,10dvh,46px)] touch-manipulation items-center justify-center gap-1.5 rounded-lg px-[clamp(8px,1.6dvw,18px)] text-[clamp(11px,2.8dvh,14px)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';
const ICON_BTN = 'wood-chip grid h-[clamp(32px,9dvh,40px)] w-[clamp(32px,9dvh,40px)] shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95';

export default function Lobby({ onEnter, onStartOffline }: LobbyProps) {
  const [name, setName] = useState(getStoredName);
  const [game, setGame] = useState<GameId>('casino');
  const [code, setCode] = useState('');
  const [panel, setPanel] = useState<'rules' | 'join' | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | 'solo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tamaño de mesa elegido para jugar sin conexión, por juego (si no se tocó, el recomendado).
  const [offlineCounts, setOfflineCounts] = useState<Partial<Record<GameId, number>>>({});
  const { muted, toggleMuted } = useMuted();
  const fullscreen = useFullscreen();
  const { playSound } = useGameSounds();

  const info = GAMES[game];
  const trimmedName = name.trim();
  const options = offlineOptions(game);
  const offlineCount = offlineCounts[game] ?? info.soloPlayerCount;

  const selectGame = (id: GameId) => {
    if (id !== game) playSound('cardSlide');
    setGame(id);
    setError(null);
  };

  const run = async (kind: 'create' | 'join' | 'solo', action: (player: { id: string; name: string }) => Promise<string>) => {
    if (!trimmedName) {
      setError('Escribe tu nombre para continuar.');
      setPanel(null);
      return;
    }
    setBusy(kind);
    setError(null);
    storeName(trimmedName);
    try {
      const roomId = await action({ id: getPlayerId(), name: trimmedName });
      onEnter(roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal. Inténtalo de nuevo.');
      setPanel(null);
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = () => run('create', async (player) => (await createRoom(game, player)).id);
  const handleSolo = () => run('solo', async (player) => (await createSoloRoom(game, player)).id);

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      setError('Escribe el código de la sala.');
      return;
    }
    void run('join', async (player) => (await joinRoom(code, player)).id);
  };

  const changePlayer = () => {
    resetPlayerIdentity();
    setName('');
    setCode('');
    setError(null);
  };

  const startOffline = () => {
    if (!trimmedName) {
      setError('Escribe tu nombre para continuar.');
      return;
    }
    setError(null);
    storeName(trimmedName);
    onStartOffline({ game, playerName: trimmedName, playerCount: offlineCount });
  };

  return (
    <div className="wood-stage fixed inset-0 overflow-hidden" style={FRAME_VARS}>
      {/* Caja segura: el marco y el contenido quedan dentro del notch y de las barras del sistema. */}
      <div className="absolute" style={{ top: 'var(--sat)', right: 'var(--sar)', bottom: 'var(--sab)', left: 'var(--sal)' }}>
        <WoodFrame />

        <div className="absolute inset-[calc(var(--frame)+4px)] flex flex-col gap-[1.6dvh] px-[calc(var(--corner)*0.9)] pb-[calc(var(--corner)*0.25)] pt-[calc(var(--corner)*0.2)]">
          {/* Barra superior: perfil, título y ajustes */}
          <header className="flex shrink-0 items-center justify-between gap-3">
            <div className="wood-block flex min-w-0 max-w-[34%] items-center gap-2 rounded-xl py-1 pl-1 pr-2">
              <span className="grid h-[clamp(26px,7.5dvh,34px)] w-[clamp(26px,7.5dvh,34px)] shrink-0 place-items-center rounded-full border-2 border-amber-900/70 bg-gradient-to-br from-amber-100 to-amber-300 text-sm font-extrabold text-amber-950">
                {trimmedName ? trimmedName.slice(0, 1).toUpperCase() : '?'}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                className="min-w-0 flex-1 bg-transparent text-[clamp(12px,3dvh,15px)] font-bold text-amber-50 placeholder:text-amber-100/45 focus:outline-none"
              />
              {trimmedName && (
                <button
                  type="button"
                  onClick={changePlayer}
                  aria-label="Cambiar jugador"
                  title="Cambiar jugador"
                  className="shrink-0 text-amber-300 transition hover:text-amber-200 active:scale-90"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex min-w-0 flex-col items-center text-center leading-none">
              <h1 className="flex items-center gap-2 text-[clamp(15px,4.6dvh,28px)] font-extrabold uppercase tracking-[0.12em] text-amber-50">
                <Spade className="h-[1em] w-[1em] shrink-0 text-amber-300" aria-hidden />
                Cartas Dominicanas
              </h1>
              <p className="mt-1 text-[clamp(9px,2.2dvh,12px)] text-amber-100/70 [@media(max-height:400px)]:hidden">
                Elige tu juego y a la mesa
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setPanel('rules')} aria-label={`Reglas de ${info.name}`} title="Reglas" className={ICON_BTN}>
                <BookOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleMuted}
                aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                aria-pressed={muted}
                title={muted ? 'Activar sonido' : 'Silenciar'}
                className={ICON_BTN}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              {fullscreen.supported && (
                <button
                  type="button"
                  onClick={fullscreen.toggle}
                  aria-label={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  title={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  className={ICON_BTN}
                >
                  {fullscreen.active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </header>

          {/* Los modos de juego, lado a lado y todos a la vista */}
          <GameCards games={GAME_ORDER} selected={game} onSelect={selectGame} />

          {/* Acciones del juego elegido */}
          <footer className="flex shrink-0 flex-wrap items-center justify-center gap-[clamp(6px,1.4dvw,14px)]">
            <div className="flex items-center gap-1.5" role="group" aria-label={game === 'casino' ? 'Tipo de partida' : 'Rivales'}>
              {options.map((option) => {
                const active = option.count === offlineCount;
                return (
                  <button
                    key={option.count}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setOfflineCounts((current) => ({ ...current, [game]: option.count }))}
                    className={`${BTN} font-bold ${active ? 'btn-gold' : 'btn-wood'}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={startOffline} className={`${BTN} btn-gold font-extrabold`}>
              <Bot className="h-4 w-4" />
              Jugar {info.name}
            </button>
            <button type="button" onClick={handleCreate} disabled={busy !== null} className={`${BTN} btn-leaf font-bold`}>
              <Spade className="h-4 w-4" />
              {busy === 'create' ? 'Creando...' : 'Crear sala'}
            </button>
            <button
              type="button"
              onClick={handleSolo}
              disabled={busy !== null}
              title="Sala en línea completada con bots. Requiere conexión."
              className={`${BTN} btn-wood font-bold`}
            >
              <Users className="h-4 w-4" />
              {busy === 'solo' ? 'Preparando...' : 'En línea con bots'}
            </button>
            <button type="button" onClick={() => setPanel('join')} disabled={busy !== null} className={`${BTN} btn-wood font-bold`}>
              <DoorOpen className="h-4 w-4" />
              Unirse
            </button>
          </footer>
        </div>

        {error && (
          <p
            role="alert"
            className="pointer-events-none absolute bottom-[calc(var(--frame)+4px)] left-1/2 z-40 max-w-[80%] -translate-x-1/2 rounded-xl bg-rose-700/90 px-4 py-2 text-center text-xs font-medium text-rose-50 ring-1 ring-rose-300/60"
          >
            {error}
          </p>
        )}

        {panel === 'rules' && (
          <Modal title={`Reglas de ${info.name}`} onClose={() => setPanel(null)}>
            {info.quickRules && (
              <div className="space-y-2 border-b border-amber-200/15 pb-3">
                <p className="text-sm font-extrabold text-amber-300">Lo esencial</p>
                <ul className="space-y-1.5 text-sm leading-relaxed text-amber-50/90">
                  {info.quickRules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="space-y-1.5 pt-3 text-sm leading-relaxed text-amber-100/80">
              {info.rules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-500" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Modal>
        )}

        {panel === 'join' && (
          <Modal title="Unirse a una sala" onClose={() => setPanel(null)} narrow>
            <form onSubmit={handleJoin} className="space-y-3">
              <p className="text-sm text-amber-100/80">Escribe el código que te compartieron.</p>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="ABC12"
                aria-label="Código de la sala"
                className="w-full rounded-xl bg-black/35 px-4 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-amber-50 ring-1 ring-amber-200/30 placeholder:text-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button type="submit" disabled={busy !== null} className={`${BTN} btn-gold w-full font-extrabold`}>
                <DoorOpen className="h-4 w-4" />
                {busy === 'join' ? 'Entrando...' : 'Entrar a la sala'}
              </button>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  narrow = false,
  children,
}: {
  title: string;
  onClose: () => void;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`wood-panel flex max-h-full w-full flex-col p-4 ${narrow ? 'max-w-sm' : 'max-w-2xl'}`}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-amber-50">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={ICON_BTN}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
