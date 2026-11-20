import { useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { BarChart3, BookOpen, Bot, Coins, DoorOpen, Gift, Globe, GraduationCap, Maximize2, Minimize2, Pencil, RefreshCw, Settings, ShoppingBag, Spade, Target, Users, VolumeX, X, Zap } from 'lucide-react';
import { GAMES } from '@/games';
import type { GameId, Player } from '@/games/shared';
import { createRoom, joinRoom, leaveRoom, quickplayRoom } from '@/lib/rooms';
import { getMyAvatar, getPlayerId, getStoredName, hasChosenAvatar, resetPlayerIdentity, storeAvatar, storeName } from '@/lib/identity';
import { isDailyAvailableNow, useEconomy } from '@/lib/economy';
import { unclaimedCompleted } from '@/lib/missions';
import { useFullscreen } from '@/lib/platform';
import { useMuted } from '@/lib/soundPrefs';
import { useGameSounds } from '@/hooks/useGameSounds';
import Avatar from './avatar/Avatar';
import AvatarEditor from './avatar/AvatarEditor';
import { useOptions } from './options/OptionsProvider';
import Tutorial from './tutorial/Tutorial';
import Store from './Store';
import MissionsModal from './MissionsModal';
import DailyWheel from './DailyWheel';
import ProfileModal from './ProfileModal';
import { WoodFrame } from './cagao/CardAssets';
import GameCards from './GameCards';
import type { OfflineSetup } from './OfflineBotGame';

interface LobbyProps {
  initialJoinCode?: string;
  onEnter: (roomId: string) => void;
  onStartOffline: (setup: OfflineSetup) => void;
}

const GAME_ORDER: GameId[] = ['casino', 'tresydos', 'cagao', 'robaito'];

/** Medidas del marco del menú: más finas que las de la mesa para dejar sitio a las tarjetas. */
const FRAME_VARS = {
  '--frame': 'clamp(8px, 2.2dvh, 18px)',
  '--corner': 'clamp(22px, 6dvh, 44px)',
  '--medal': 'clamp(20px, 5dvh, 38px)',
} as CSSProperties;

/** Cantidad de bots que se pueden elegir: solo las mesas que el juego permite (el Casino, 2 o 4 jugadores). */
function botOptions(game: GameId): number[] {
  return GAMES[game].playerCounts.map((count) => count - 1);
}

function botCaption(game: GameId, bots: number): string {
  if (game === 'casino') return bots === 3 ? 'Dos equipos de dos: tú y un bot contra dos bots.' : 'Uno contra uno.';
  return `${bots + 1} jugadores en la mesa, contándote a ti.`;
}

/** Última partida sin conexión: el botón "Jugar rápido" la repite sin configurar nada. */
const LAST_OFFLINE_KEY = 'cartas-dominicanas:last-offline';

interface LastOffline {
  game: GameId;
  playerCount: number;
}

function readLastOffline(): LastOffline | null {
  try {
    const raw = localStorage.getItem(LAST_OFFLINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastOffline>;
    if (parsed.game && parsed.playerCount && GAMES[parsed.game]) {
      return { game: parsed.game, playerCount: parsed.playerCount };
    }
  } catch {
    // Sin almacenamiento: no hay última partida, se juega con los valores por defecto.
  }
  return null;
}

function storeLastOffline(setup: LastOffline): void {
  try {
    localStorage.setItem(LAST_OFFLINE_KEY, JSON.stringify(setup));
  } catch {
    // Sin almacenamiento: la partida arranca igual, solo no se recuerda.
  }
}

const BTN = 'flex min-h-[clamp(36px,10dvh,46px)] touch-manipulation items-center justify-center gap-1.5 rounded-lg px-[clamp(8px,1.6dvw,18px)] text-[clamp(13px,2.8dvh,14px)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';
const ICON_BTN = 'wood-chip grid h-[clamp(32px,9dvh,40px)] w-[clamp(32px,9dvh,40px)] shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95';

export default function Lobby({ initialJoinCode, onEnter, onStartOffline }: LobbyProps) {
  const [name, setName] = useState(getStoredName);
  // La última partida sin conexión: el lobby abre en ese juego y "Jugar rápido" la repite.
  const [lastOffline, setLastOffline] = useState<LastOffline | null>(readLastOffline);
  const [game, setGame] = useState<GameId>(() => readLastOffline()?.game ?? 'casino');
  const [code, setCode] = useState(initialJoinCode ?? '');
  const [panel, setPanel] = useState<'rules' | 'join' | null>(initialJoinCode ? 'join' : null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Rueda diaria: se abre sola la primera vez que se entra cada día; si se
  // cierra sin girar, queda el botón del regalo hasta reclamarla.
  const [dailyWheelOpen, setDailyWheelOpen] = useState(isDailyAvailableNow);
  const economy = useEconomy();
  const dailyAvailable = isDailyAvailableNow() && !dailyWheelOpen;
  const missionsReady = unclaimedCompleted(economy.missions);
  const [avatar, setAvatar] = useState(getMyAvatar);
  const [avatarChosen, setAvatarChosen] = useState(hasChosenAvatar);
  const [busy, setBusy] = useState<'create' | 'join' | 'quickplay' | null>(null);
  // Marca de la búsqueda en curso: si cambia, la búsqueda se canceló y su
  // resultado (llegue tarde o no) se descarta en lugar de entrar a la sala.
  const searchRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  // Cantidad de bots elegida para jugar sin conexión, por juego (si no se tocó, la recomendada).
  // Al abrir, se recupera la de la última partida jugada.
  const [botCounts, setBotCounts] = useState<Partial<Record<GameId, number>>>(() =>
    lastOffline ? { [lastOffline.game]: lastOffline.playerCount - 1 } : {},
  );
  const { muted } = useMuted();
  const options = useOptions();
  const fullscreen = useFullscreen();
  const { playSound } = useGameSounds();

  const info = GAMES[game];
  const trimmedName = name.trim();
  const bots = botCounts[game] ?? info.soloPlayerCount - 1;
  const botChoices = botOptions(game);

  const selectGame = (id: GameId) => {
    if (id !== game) playSound('cardSlide');
    setGame(id);
    setError(null);
  };

  const run = async (kind: 'create' | 'join' | 'quickplay', action: (player: Player) => Promise<string>) => {
    if (!trimmedName) {
      setError('Escribe tu nombre para continuar.');
      setPanel(kind === 'join' ? 'join' : null);
      return;
    }
    const token = ++searchRef.current;
    setBusy(kind);
    setError(null);
    storeName(trimmedName);
    try {
      const roomId = await action({ id: getPlayerId(), name: trimmedName, avatar });
      if (token !== searchRef.current) {
        // Se canceló mientras se buscaba: la sala quedó creada con tu asiento,
        // se libera para no dejarla ocupada y te quedas en el menú.
        void leaveRoom(roomId).catch(() => undefined);
        return;
      }
      onEnter(roomId);
    } catch (err) {
      if (token !== searchRef.current) return;
      setError(err instanceof Error ? err.message : 'Algo salió mal. Inténtalo de nuevo.');
      setPanel(kind === 'join' ? 'join' : null);
    } finally {
      if (token === searchRef.current) setBusy(null);
    }
  };

  /** Cancela la búsqueda en curso (crear, unirse o "Jugar online") y vuelve al menú. */
  const cancelSearch = () => {
    searchRef.current += 1;
    setBusy(null);
    setError(null);
  };

  const handleCreate = () => run('create', async (player) => (await createRoom(game, player)).id);

  /** Matchmaking: busca una sala pública de este juego o crea una; si no se llena, se completa con bots. */
  const handleQuickplay = () => run('quickplay', async (player) => (await quickplayRoom(game, player)).id);

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
    setAvatar(getMyAvatar());
    setAvatarChosen(false);
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
    const setup = { game, playerName: trimmedName, playerCount: bots + 1 };
    storeLastOffline({ game: setup.game, playerCount: setup.playerCount });
    setLastOffline({ game: setup.game, playerCount: setup.playerCount });
    onStartOffline(setup);
  };

  /** Un toque: repite la última partida sin conexión (mismo juego y mismos bots). */
  const quickPlay = () => {
    if (!lastOffline) return;
    if (!trimmedName) {
      setError('Escribe tu nombre para continuar.');
      return;
    }
    setError(null);
    storeName(trimmedName);
    onStartOffline({ game: lastOffline.game, playerName: trimmedName, playerCount: lastOffline.playerCount });
  };

  return (
    <div className="wood-stage lobby-stage fixed inset-0 overflow-hidden" style={FRAME_VARS}>
      {/* Marco a sangre: llega a los bordes físicos de la pantalla; solo el contenido esquiva el notch. */}
      <WoodFrame />
      <div className="absolute" style={{ top: 'var(--sat)', right: 'var(--sar)', bottom: 'var(--sab)', left: 'var(--sal)' }}>
        {/* El relleno lateral también mira el ancho: en vertical el marco (que
            escala con la altura) se comería media pantalla. */}
        <div className="absolute inset-[calc(var(--frame)+4px)] flex flex-col gap-[1.6dvh] px-[clamp(8px,4vw,calc(var(--corner)*0.9))] pb-[calc(var(--corner)*0.25)] pt-[calc(var(--corner)*0.2)]">
          {/* Barra superior: perfil, título y ajustes. En pantallas angostas el
              título ocupa su propia fila arriba; en horizontal corto la barra
              derecha colapsa a solo iconos para no apretarlo nunca. */}
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <div className="wood-block flex min-w-0 max-w-[34%] items-center gap-2 rounded-xl py-1 pl-1 pr-2">
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                aria-label="Editar mi avatar"
                title="Editar mi avatar"
                className="relative shrink-0 touch-manipulation rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 active:scale-95"
              >
                <Avatar code={avatar} className="h-[clamp(28px,8dvh,38px)] w-[clamp(28px,8dvh,38px)] border-2 border-amber-900/70" />
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-1 ring-amber-950/60 ${
                    avatarChosen ? 'bg-amber-200 text-amber-950' : 'animate-pulse bg-amber-400 text-amber-950'
                  }`}
                >
                  <Pencil className="h-2.5 w-2.5" />
                </span>
              </button>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                className="min-w-0 flex-1 bg-transparent text-[clamp(13px,3dvh,15px)] font-bold text-amber-50 placeholder:text-amber-100/45 focus:outline-none"
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

            {/* Título con espacio reservado: flex-1 en horizontal, fila propia
                en vertical; nunca se parte ni se solapa con los controles. */}
            <div className="order-first flex min-w-0 basis-full flex-col items-center text-center leading-none min-[640px]:order-none min-[640px]:basis-auto min-[640px]:flex-1">
              <h1 className="flex w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap text-[clamp(15px,4.6dvh,28px)] font-extrabold uppercase tracking-[0.12em] text-amber-50 max-[640px]:text-[20px]">
                <Spade className="h-[1em] w-[1em] shrink-0 text-amber-300" aria-hidden />
                <span className="min-w-0 truncate">Cartas Dominicanas</span>
              </h1>
              <p className="mt-1 text-[12px] text-amber-100/70 [@media(max-height:500px)]:hidden">
                Elige tu juego y a la mesa
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              {dailyAvailable && (
                <button
                  type="button"
                  onClick={() => setDailyWheelOpen(true)}
                  aria-label="Girar la rueda diaria"
                  title="Rueda diaria: gira y gana monedas"
                  className="btn-gold relative flex min-h-[clamp(32px,9dvh,40px)] shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 text-[clamp(13px,2.8dvh,14px)] font-extrabold transition-transform active:scale-95"
                >
                  <Gift className="h-4 w-4 shrink-0 animate-pulse" aria-hidden />
                  <span className="hidden min-[760px]:inline [@media(max-height:500px)]:hidden">Rueda</span>
                </button>
              )}
              <button type="button" onClick={() => setProfileOpen(true)} aria-label="Mi perfil y estadísticas" title="Mi perfil" className={ICON_BTN}>
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setStoreOpen(true)}
                aria-label={`Tienda, tienes ${economy.coins} monedas`}
                title="Tienda: dorsos, mesas y fondos"
                className="flex min-h-[clamp(32px,9dvh,40px)] shrink-0 touch-manipulation items-center gap-1.5 rounded-lg bg-amber-400/20 px-3 text-[clamp(13px,2.8dvh,14px)] font-extrabold text-amber-300 ring-1 ring-amber-300/60 transition-transform active:scale-95"
              >
                <Coins className="h-4 w-4 shrink-0" aria-hidden />
                {economy.coins}
              </button>
              <button
                type="button"
                onClick={() => setStoreOpen(true)}
                aria-label="Abrir la tienda"
                title="Tienda"
                className="btn-wood flex min-h-[clamp(32px,9dvh,40px)] shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 text-[clamp(13px,2.8dvh,14px)] font-bold transition-transform active:scale-95"
              >
                <ShoppingBag className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span className="max-[760px]:hidden [@media(max-height:500px)]:hidden">Tienda</span>
              </button>
              <button
                type="button"
                onClick={() => setMissionsOpen(true)}
                aria-label={
                  missionsReady > 0
                    ? `Misiones, tienes ${missionsReady} ${missionsReady === 1 ? 'misión lista' : 'misiones listas'} para reclamar`
                    : 'Misiones diarias y semanales'
                }
                title="Misiones diarias y semanales"
                className="btn-wood relative flex min-h-[clamp(32px,9dvh,40px)] shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 text-[clamp(13px,2.8dvh,14px)] font-bold transition-transform active:scale-95"
              >
                <Target className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span className="max-[760px]:hidden [@media(max-height:500px)]:hidden">Misiones</span>
                {missionsReady > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-extrabold text-amber-950 ring-2 ring-amber-950/60">
                    {missionsReady}
                  </span>
                )}
              </button>
              {lastOffline && (
                <button
                  type="button"
                  onClick={quickPlay}
                  title={`Jugar rápido: ${GAMES[lastOffline.game].name} contra ${lastOffline.playerCount - 1} ${lastOffline.playerCount - 1 === 1 ? 'bot' : 'bots'}`}
                  className="btn-gold flex min-h-[clamp(32px,9dvh,40px)] shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 text-[clamp(13px,2.8dvh,14px)] font-extrabold transition-transform active:scale-95"
                >
                  <Zap className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-[760px]:hidden [@media(max-height:500px)]:hidden">Jugar rápido</span>
                </button>
              )}
              <button type="button" onClick={() => setPanel('rules')} aria-label={`Reglas de ${info.name}`} title="Reglas" className={ICON_BTN}>
                <BookOpen className="h-4 w-4" />
              </button>
              <button type="button" onClick={options.open} aria-label="Opciones" title="Opciones" className={`${ICON_BTN} relative`}>
                <Settings className="h-4 w-4" />
                {muted && (
                  <span aria-hidden className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-rose-600 text-white ring-1 ring-rose-200/70">
                    <VolumeX className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
              {fullscreen.supported && (
                <button
                  type="button"
                  onClick={fullscreen.toggle}
                  aria-label={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  title={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  className={`${ICON_BTN} max-[560px]:hidden`}
                >
                  {fullscreen.active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </header>

          {/* Los modos de juego, lado a lado y todos a la vista */}
          <GameCards games={GAME_ORDER} selected={game} onSelect={selectGame} />

          {/* Configuración de la partida: cuántos bots y el tutorial */}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-[clamp(8px,2dvw,20px)]">
            <div className="wood-block flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-1">
              <Users className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <span className="text-[clamp(13px,2.8dvh,14px)] font-bold text-amber-50">Bots</span>
              <div className="flex items-center gap-1" role="radiogroup" aria-label={`Cantidad de bots en ${info.name}`}>
                {botChoices.map((count) => {
                  const active = count === bots;
                  return (
                    <button
                      key={count}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${count} ${count === 1 ? 'bot' : 'bots'}`}
                      onClick={() => setBotCounts((current) => ({ ...current, [game]: count }))}
                      className={`grid h-[clamp(26px,7.4dvh,32px)] w-[clamp(26px,7.4dvh,32px)] touch-manipulation place-items-center rounded-lg text-[clamp(13px,3dvh,15px)] font-extrabold transition-transform active:scale-90 ${
                        active ? 'btn-gold' : 'btn-wood'
                      }`}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
              {/* La leyenda cabe entera en dos líneas: sin truncar, la tarjeta
                  del modo ya dice los jugadores pero aquí explica los equipos. */}
              <span className="hidden max-w-[19rem] text-left text-[13px] leading-snug text-amber-100/70 line-clamp-2 min-[760px]:inline [@media(max-height:340px)]:hidden">
                {botCaption(game, bots)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              aria-label={`Aprende a jugar ${info.name}`}
              className="btn-wood flex min-h-[clamp(30px,8.4dvh,38px)] touch-manipulation items-center gap-1.5 rounded-xl px-3 text-[clamp(13px,2.8dvh,14px)] font-bold transition-transform active:scale-95"
            >
              <GraduationCap className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              Aprende a jugar
            </button>
          </div>

          {/* Acciones del juego elegido: contra bots, sala en línea o unirse.
              En vertical, la acción principal ocupa su fila y las tres
              secundarias comparten la siguiente con el mismo ancho. */}
          <footer className="flex w-full shrink-0 flex-wrap items-stretch justify-center gap-[clamp(6px,1.4dvw,14px)]">
            <button type="button" onClick={startOffline} className={`${BTN} min-w-0 max-w-[22rem] basis-full btn-gold font-extrabold min-[640px]:basis-0 min-[640px]:flex-[2]`}>
              <Bot className="h-4 w-4 shrink-0" />
              <span className="truncate">Jugar {info.name} contra {bots} {bots === 1 ? 'bot' : 'bots'}</span>
            </button>
            <button type="button" onClick={handleQuickplay} disabled={busy !== null} className={`${BTN} min-w-0 max-w-[13rem] flex-1 btn-leaf font-bold`}>
              <Globe className="h-4 w-4 shrink-0 max-[640px]:hidden" />
              <span className="truncate max-[640px]:text-[12px]">{busy === 'quickplay' ? 'Buscando...' : 'Jugar online'}</span>
            </button>
            <button type="button" onClick={handleCreate} disabled={busy !== null} className={`${BTN} min-w-0 max-w-[13rem] flex-1 btn-wood font-bold`}>
              <Spade className="h-4 w-4 shrink-0 max-[640px]:hidden" />
              <span className="truncate max-[640px]:text-[12px]">{busy === 'create' ? 'Creando...' : 'Crear sala'}</span>
            </button>
            <button type="button" onClick={() => setPanel('join')} disabled={busy !== null} className={`${BTN} min-w-0 max-w-[13rem] flex-1 btn-wood font-bold`}>
              <DoorOpen className="h-4 w-4 shrink-0 max-[640px]:hidden" />
              <span className="truncate max-[640px]:text-[12px]">Unirse</span>
            </button>
          </footer>

          {/* Mientras se busca partida (crear, unirse u online) se puede cancelar y quedarse en el menú. */}
          {busy !== null && (
            <div className="flex shrink-0 justify-center">
              <button
                type="button"
                onClick={cancelSearch}
                className="btn-wood flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-lg px-4 text-[13px] font-bold transition-transform active:scale-95"
              >
                <X className="h-4 w-4 shrink-0" />
                Cancelar búsqueda
              </button>
            </div>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="pointer-events-none absolute bottom-[calc(var(--frame)+4px)] left-1/2 z-40 max-w-[80%] -translate-x-1/2 rounded-xl bg-rose-700/90 px-4 py-2 text-center text-[13px] font-medium text-rose-50 ring-1 ring-rose-300/60"
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
      {storeOpen && <Store onClose={() => setStoreOpen(false)} />}
      {missionsOpen && <MissionsModal onClose={() => setMissionsOpen(false)} />}
      {dailyWheelOpen && <DailyWheel onClose={() => setDailyWheelOpen(false)} />}
      {profileOpen && (
        <ProfileModal
          economy={economy}
          avatar={avatar}
          name={name}
          onClose={() => setProfileOpen(false)}
          onEditAvatar={() => {
            setProfileOpen(false);
            setEditorOpen(true);
          }}
        />
      )}
      {editorOpen && (
        <AvatarEditor
          initial={avatarChosen ? avatar : null}
          onClose={() => setEditorOpen(false)}
          onSave={(code) => {
            storeAvatar(code, true);
            setAvatar(code);
            setAvatarChosen(true);
            setEditorOpen(false);
          }}
        />
      )}
      {tutorialOpen && (
        <Tutorial
          game={game}
          onClose={() => setTutorialOpen(false)}
          onPlay={() => {
            setTutorialOpen(false);
            startOffline();
          }}
        />
      )}
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
