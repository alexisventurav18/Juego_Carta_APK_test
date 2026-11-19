import { useState, type CSSProperties } from 'react';
import Lobby from '@/components/Lobby';
import OrientationGuard from '@/components/OrientationGuard';
import RoomView from '@/components/RoomView';
import OfflineBotGame, { type OfflineSetup } from '@/components/OfflineBotGame';
import { OptionsProvider } from '@/components/options/OptionsProvider';
import { CARD_BACK_IMAGES } from '@/components/cagao/CardAssets';
import { getStoredRoomId, storeRoomId } from '@/lib/identity';
import { MENU_THEMES, TABLE_THEMES, useVisualPrefs } from '@/lib/visualPrefs';

export default function App() {
  const [inviteCode, setInviteCode] = useState<string | undefined>(() =>
    new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase().slice(0, 8) || undefined,
  );
  const [roomId, setRoomId] = useState<string | null>(() => (inviteCode ? null : getStoredRoomId()));
  const [offlineGame, setOfflineGame] = useState<OfflineSetup | null>(null);
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

  return (
    <OptionsProvider>
      {/* El bloqueo de orientación es silencioso y puede fallar: en vertical se
          muestra el aviso "Gira tu teléfono" en lugar de una mesa cortada. */}
      <OrientationGuard />
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
          <OfflineBotGame {...offlineGame} onLeave={() => setOfflineGame(null)} />
        ) : (
          <div className="wood-stage fixed inset-0 antialiased">
            {roomId ? (
              <RoomView key={roomId} roomId={roomId} onLeave={leaveRoom} />
            ) : (
              <Lobby initialJoinCode={inviteCode || undefined} onEnter={enterRoom} onStartOffline={startOffline} />
            )}
          </div>
        )}
      </div>
    </OptionsProvider>
  );
}
