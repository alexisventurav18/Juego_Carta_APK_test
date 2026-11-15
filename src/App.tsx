import { useState } from 'react';
import Lobby from '@/components/Lobby';
import RoomView from '@/components/RoomView';
import OfflineBotGame, { type OfflineSetup } from '@/components/OfflineBotGame';
import { OptionsProvider } from '@/components/options/OptionsProvider';
import { getStoredRoomId, storeRoomId } from '@/lib/identity';

export default function App() {
  const [inviteCode, setInviteCode] = useState<string | undefined>(() =>
    new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase().slice(0, 8) || undefined,
  );
  const [roomId, setRoomId] = useState<string | null>(() => (inviteCode ? null : getStoredRoomId()));
  const [offlineGame, setOfflineGame] = useState<OfflineSetup | null>(null);

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
    </OptionsProvider>
  );
}
