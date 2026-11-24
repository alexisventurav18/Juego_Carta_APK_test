import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import Lobby from '@/components/Lobby';
import OrientationGuard from '@/components/OrientationGuard';
import RoomView from '@/components/RoomView';
import SplashScreen from '@/components/SplashScreen';
import OfflineBotGame, { type OfflineSetup } from '@/components/OfflineBotGame';
import { OptionsProvider } from '@/components/options/OptionsProvider';
import { CARD_BACK_IMAGES } from '@/components/cagao/CardAssets';
import { cardFaceTheme } from '@/lib/cardThemes';
import { getResumableRoomId, storeRoomId } from '@/lib/identity';
import { setMusicTheme } from '@/lib/music';
import { themeForGame } from '@/lib/musicThemes';
import { leaveRoomBestEffort } from '@/lib/rooms';
import { restoreCloudProgressIfFresh } from '@/lib/progress';
import { MENU_THEMES, TABLE_THEMES, useVisualPrefs } from '@/lib/visualPrefs';

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
  // Cara de la carta (boca arriba) del dorso equipado: mismo tema delante y detrás.
  const faceTheme = cardFaceTheme(visualPrefs.cardBack);

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

  /** Volver al menú desde el seguro de errores: no queda ni sala guardada ni
      partida en curso, así que el menú se dibuja limpio. */
  const resetToMenu = () => {
    storeRoomId(null);
    setRoomId(null);
    setOfflineGame(null);
    setInviteCode(undefined);
  };

  const startOffline = (setup: OfflineSetup) => {
    storeRoomId(null);
    setRoomId(null);
    setOfflineGame(setup);
  };

  // Música de fondo: cada modo tiene su tema y el menú el suyo. Al entrar en una sala en línea el tema
  // lo pone RoomView con el juego de la sala; al salir de la partida se vuelve al tema del menú.
  useEffect(() => {
    if (offlineGame) setMusicTheme(themeForGame(offlineGame.game));
    else if (!roomId) setMusicTheme('lobby');
  }, [offlineGame, roomId]);

  // Respaldo en la nube (A): al arrancar, si este teléfono no tiene
  // economía local, se baja la copia de la nube (si la hay). Es
  // best-effort y silencioso: sin conexión o sin copia, el juego sigue
  // normal con una economía nueva.
  useEffect(() => {
    void restoreCloudProgressIfFresh().catch(() => undefined);
  }, []);

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
      {/* Red de seguridad raíz: si el menú (o un modal sin su propio
          boundary) rompe al dibujarse, se ve el mensaje en vez de la
          pantalla en blanco. La sala y la partida offline tienen además
          su propio boundary, que atrapa el error antes que este. */}
      <ErrorBoundary onReset={resetToMenu}>
      {!booted ? (
        <SplashScreen onDone={() => setBooted(true)} />
      ) : (
      <div
        className="contents"
        style={{
          '--card-back-image': CARD_BACK_IMAGES[visualPrefs.cardBack],
          // La cara de la carta (boca arriba) toma los colores del dorso
          // equipado: mismo tema en el reverso y en el frente.
          '--card-face-bg': faceTheme.bg,
          '--card-face-frame': faceTheme.frame,
          '--card-face-red': faceTheme.red,
          '--card-face-ink': faceTheme.ink,
          '--card-face-accent': faceTheme.accent,
          '--card-face-crest-a': faceTheme.crestA,
          '--card-face-crest-b': faceTheme.crestB,
          '--table-bg-color': TABLE_THEMES.find(({ id }) => id === visualPrefs.table)?.color,
          '--table-bg-image': TABLE_THEMES.find(({ id }) => id === visualPrefs.table)?.image,
          '--menu-bg-color': MENU_THEMES.find(({ id }) => id === visualPrefs.menu)?.color,
          '--menu-bg-image': MENU_THEMES.find(({ id }) => id === visualPrefs.menu)?.image,
        } as CSSProperties}
      >
        {offlineGame ? (
          <ErrorBoundary
            key={`offline-${offlineGame.game}-${offlineGame.playerCount}`}
            onReset={() => setOfflineGame(null)}
          >
            <OfflineBotGame {...offlineGame} onLeave={() => setOfflineGame(null)} />
          </ErrorBoundary>
        ) : (
          <div className="wood-stage fixed inset-0 antialiased">
            {roomId ? (
              <ErrorBoundary
                key={`room-${roomId}`}
                onReset={() => {
                  // El asiento se libera en el servidor (un bot lo toma): sin
                  // esto la sala quedaría ocupada aunque la pantalla ya no
                  // exista. Es el mismo aviso best-effort del cierre de app.
                  leaveRoomBestEffort(roomId);
                  resetToMenu();
                }}
              >
                <RoomView key={roomId} roomId={roomId} onLeave={leaveRoom} />
              </ErrorBoundary>
            ) : (
              <Lobby initialJoinCode={inviteCode || undefined} onEnter={enterRoom} onStartOffline={startOffline} />
            )}
          </div>
        )}
      </div>
      )}
      </ErrorBoundary>
    </OptionsProvider>
  );
}
