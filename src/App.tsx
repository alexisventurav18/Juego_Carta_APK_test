import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Lobby from '@/components/Lobby';
import OrientationGuard from '@/components/OrientationGuard';
import RoomView from '@/components/RoomView';
import SplashScreen from '@/components/SplashScreen';
import OfflineBotGame, { type OfflineSetup } from '@/components/OfflineBotGame';
import { OptionsProvider } from '@/components/options/OptionsProvider';
import { CARD_BACK_IMAGES } from '@/components/cagao/CardAssets';
import { getResumableRoomId, storeRoomId } from '@/lib/identity';
import { leaveRoomBestEffort } from '@/lib/rooms';
import { MENU_THEMES, TABLE_THEMES, useVisualPrefs } from '@/lib/visualPrefs';

/**
 * Red de seguridad: si una pantalla rompe al dibujarse (por ejemplo, la sala
 * en línea), la app mostraba solo el fondo marrón y había que cerrarla. Con
 * esto se ve un mensaje y un botón para volver al inicio.
 */
class ScreenErrorBoundary extends Component<
  { onReset: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Error en la pantalla del juego', error);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="wood-stage safe-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-amber-50">Algo salió mal en esta pantalla.</p>
        <button
          type="button"
          onClick={() => {
            this.setState({ hasError: false });
            this.props.onReset();
          }}
          className="btn-gold min-h-[44px] rounded-lg px-5 py-2.5 text-sm font-extrabold transition-transform active:scale-95"
        >
          Volver al inicio
        </button>
      </div>
    );
  }
}

export default function App() {
  const [inviteCode, setInviteCode] = useState<string | undefined>(() =>
    new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase().slice(0, 8) || undefined,
  );
  // Cierre definitivo: al abrir, solo se reanuda la sala si pertenece a la
  // sesión actual de la app. Si se cerró la aplicación, se empieza en el menú.
  const [roomId, setRoomId] = useState<string | null>(() => (inviteCode ? null : getResumableRoomId()));
  const [offlineGame, setOfflineGame] = useState<OfflineSetup | null>(null);
  // Pantalla de bienvenida: se muestra al abrir la app y se retira sola.
  const [booted, setBooted] = useState(false);
  const { prefs: visualPrefs } = useVisualPrefs();

  const enterRoom = (id: string) => {
    setOfflineGame(null);
    setInviteCode(undefined);
    const url = new URL(window.location.href);
    if (url.searchParams.has('join')) {
      url.searchParams.delete('join');
      window.history.replaceState(window.history.state, '', url);
    }
    storeRoomId(id);
    setRoomId(id);
  };

  const leaveRoom = () => {
    storeRoomId(null);
    setRoomId(null);
  };

  const startOffline = (setup: OfflineSetup) => {
    storeRoomId(null);
    setRoomId(null);
    setOfflineGame(setup);
  };

  // Al cerrar la aplicación (pagehide) se avisa al servidor para liberar el
  // asiento y se borra la sala guardada: al volver a abrir, el juego no
  // reaparece en la última pantalla de carga. Minimizar y volver no dispara
  // pagehide, así que la partida se conserva al cambiar de app un momento.
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  useEffect(() => {
    const handlePageHide = () => {
      const current = roomIdRef.current;
      if (!current) return;
      leaveRoomBestEffort(current);
      storeRoomId(null);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  return (
    <OptionsProvider>
      {/* El bloqueo de orientación es silencioso y puede fallar: en vertical se
          muestra el aviso "Gira tu teléfono" en lugar de una mesa cortada. */}
      <OrientationGuard />
      {!booted ? (
        <SplashScreen onDone={() => setBooted(true)} />
      ) : (
      <div
        className="contents"
        style={{
          '--card-back-image': CARD_BACK_IMAGES[visualPrefs.cardBack],
          '--table-bg-color': TABLE_THEMES.find(({ id }) => id === visualPrefs.table)?.color,
          '--table-bg-image': TABLE_THEMES.find(({ id }) => id === visualPrefs.table)?.image,
          '--menu-bg-color': MENU_THEMES.find(({ id }) => id === visualPrefs.menu)?.color,
          '--menu-bg-image': MENU_THEMES.find(({ id }) => id === visualPrefs.menu)?.image,
        } as CSSProperties}
      >
        {offlineGame ? (
          <ScreenErrorBoundary
            key={`offline-${offlineGame.game}-${offlineGame.playerCount}`}
            onReset={() => setOfflineGame(null)}
          >
            <OfflineBotGame {...offlineGame} onLeave={() => setOfflineGame(null)} />
          </ScreenErrorBoundary>
        ) : (
          <div className="wood-stage fixed inset-0 antialiased">
            {roomId ? (
              <ScreenErrorBoundary
                key={`room-${roomId}`}
                onReset={() => {
                  storeRoomId(null);
                  setRoomId(null);
                }}
              >
                <RoomView key={roomId} roomId={roomId} onLeave={leaveRoom} />
              </ScreenErrorBoundary>
            ) : (
              <Lobby initialJoinCode={inviteCode || undefined} onEnter={enterRoom} onStartOffline={startOffline} />
            )}
          </div>
        )}
      </div>
      )}
    </OptionsProvider>
  );
}
