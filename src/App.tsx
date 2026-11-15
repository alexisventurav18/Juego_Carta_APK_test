import { useState } from 'react';
import Lobby from '@/components/Lobby';
import RoomView from '@/components/RoomView';
import OfflineBotGame, { type OfflineSetup } from '@/components/OfflineBotGame';
import { OptionsProvider } from '@/components/options/OptionsProvider';
import { getStoredRoomId, storeRoomId } from '@/lib/identity';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(getStoredRoomId);
  const [offlineGame, setOfflineGame] = useState<OfflineSetup | null>(null);

  const enterRoom = (id: string) => {
    setOfflineGame(null);
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
            <Lobby onEnter={enterRoom} onStartOffline={startOffline} />
          )}
        </div>
      )}
    </OptionsProvider>
  );
}
