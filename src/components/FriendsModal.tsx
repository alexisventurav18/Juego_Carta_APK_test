import { useEffect, useState, type FormEvent } from 'react';
import { Check, Clock, DoorOpen, Loader2, Search, Send, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { GAMES } from '@/games';
import type { GameId } from '@/games/shared';
import {
  friendAccept,
  friendReject,
  friendRemove,
  friendRequest,
  friendSearch,
  friendsList,
  inviteFriend,
  type FriendEntry,
  type FriendRequestEntry,
  type FriendsListData,
  type FriendSearchResult,
} from '@/lib/rooms';
import Avatar from './avatar/Avatar';

/**
 * Amigos: buscar por nombre o código, solicitudes entrantes y salientes,
 * lista de amigos (nivel, en línea, en partida) con invitación directa a una
 * sala privada eligiendo el modo de juego, e invitaciones recibidas para
 * unirse a la sala del amigo.
 */

/** Modos que se ofrecen al invitar a un amigo a jugar, en el orden del menú. */
const INVITE_GAMES: GameId[] = ['casino', 'tresydos', 'cagao', 'robaito'];
export default function FriendsModal({
  onClose,
  onJoinRoom,
}: {
  onClose: () => void;
  /** Entra a una sala por su código (una invitación recibida o una que yo envié). */
  onJoinRoom: (code: string) => void;
}) {
  const [data, setData] = useState<FriendsListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Amigo al que se le está eligiendo el modo para invitarlo a jugar.
  const [inviteFor, setInviteFor] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    void friendsList()
      .then((list) => setData(list))
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de amigos.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /** Ejecuta una acción de amistad y vuelve a cargar la lista. */
  const act = (key: string, action: () => Promise<unknown>, doneNotice?: string) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    void action()
      .then(() => {
        if (doneNotice) setNotice(doneNotice);
        load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Algo salió mal. Inténtalo de nuevo.'))
      .finally(() => setBusy(null));
  };

  const search = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term || searching) return;
    setSearching(true);
    setError(null);
    void friendSearch(term)
      .then((res) => setResults(res.players))
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo buscar.'))
      .finally(() => setSearching(false));
  };

  const invite = (friend: FriendEntry, game: GameId) => {
    if (busy) return;
    setBusy(`invite:${friend.playerId}`);
    setError(null);
    void inviteFriend(friend.playerId, game)
      .then((res) => {
        // La sala privada ya está creada en ese modo: entro a esperar y mi amigo se une con el mismo código.
        onJoinRoom(res.code);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo invitar.');
        setBusy(null);
      });
  };

  const pendingCount = (data?.pendingIn.length ?? 0) + (data?.invites.length ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
      role="dialog"
      aria-label="Amigos"
      onClick={onClose}
    >
      <div
        className="wood-panel flex max-h-full w-full max-w-2xl flex-col overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-extrabold text-amber-50">
            <Users className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <span className="truncate">Amigos</span>
            {pendingCount > 0 && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-extrabold text-amber-950">
                {pendingCount}
              </span>
            )}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {data && data.myCode && (
              <span className="rounded-lg bg-black/30 px-2.5 py-1.5 text-xs font-extrabold text-amber-300 ring-1 ring-amber-300/40" title="Tu código de amigo: compártelo para que te añadan">
                Mi código: <span className="font-mono tracking-widest">{data.myCode}</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar amigos"
              className="wood-chip grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-amber-100/70">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando amigos…
            </p>
          ) : error && !data ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-center text-sm font-bold text-rose-200" role="alert">
                {error}
              </p>
              <button
                type="button"
                onClick={load}
                className="btn-gold flex touch-manipulation items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-extrabold transition-transform active:scale-95"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <p className="rounded-xl bg-rose-700/40 px-3 py-2 text-center text-xs font-bold text-rose-100 ring-1 ring-rose-300/40" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-xl bg-emerald-600/25 px-3 py-2 text-center text-xs font-extrabold text-emerald-200 ring-1 ring-emerald-300/40" role="status">
                  {notice}
                </p>
              )}

              {/* La búsqueda va primera: es la forma de añadir amigos sin estar en una sala. */}
              <section>
                <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-amber-50">
                  Buscar amigos
                </h3>
                <form onSubmit={search} className="flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value.slice(0, 24))}
                    placeholder="Nombre o código de amigo"
                    aria-label="Buscar por nombre o código de amigo"
                    className="min-w-0 flex-1 rounded-xl bg-black/35 px-3 py-2.5 text-sm font-bold text-amber-50 ring-1 ring-amber-200/30 placeholder:text-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    type="submit"
                    disabled={searching || !query.trim()}
                    className="btn-gold flex shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-extrabold transition-transform active:scale-95 disabled:opacity-60"
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden />
                    {searching ? 'Buscando…' : 'Buscar'}
                  </button>
                </form>
                {results !== null && (
                  <div className="mt-2">
                    {results.length === 0 ? (
                      <p className="py-3 text-center text-sm text-amber-100/70">Nadie con ese nombre o código.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {results.map((player) => {
                          const alreadyFriend = data?.friends.some((f) => f.playerId === player.playerId);
                          const requested = data?.pendingOut.some((p) => p.playerId === player.playerId);
                          return (
                            <li key={player.playerId} className="flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2 ring-1 ring-amber-100/10">
                              <PlayerAvatar code={player.avatar} name={player.name} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-extrabold text-amber-50">{player.name}</span>
                                <span className="block text-[11px] font-bold text-amber-100/60">
                                  Nivel {player.level ?? 1} · código {player.code}
                                </span>
                              </span>
                              {alreadyFriend ? (
                                <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold text-emerald-300">
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                  Amigo
                                </span>
                              ) : requested ? (
                                <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold text-amber-100/60">
                                  <Clock className="h-3.5 w-3.5" aria-hidden />
                                  Pendiente
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => act(`request:${player.playerId}`, () => friendRequest(player.playerId), `Solicitud enviada a ${player.name}.`)}
                                  className="btn-wood flex shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-transform active:scale-95 disabled:opacity-60"
                                >
                                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                                  Enviar solicitud
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </section>

              {data && data.invites.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-amber-50">
                    Invitaciones a salas
                  </h3>
                  <ul className="space-y-1.5">
                    {data.invites.map((invite) => (
                      <li key={`${invite.from}:${invite.code}`} className="flex items-center gap-2 rounded-xl bg-amber-400/10 px-2.5 py-2 ring-1 ring-amber-300/40">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-extrabold text-amber-50">
                            {invite.fromName} te invita a jugar
                          </span>
                          <span className="block text-[11px] font-bold text-amber-100/60">
                            Sala {invite.code}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onJoinRoom(invite.code)}
                          className="btn-gold flex shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-transform active:scale-95"
                        >
                          <DoorOpen className="h-3.5 w-3.5" aria-hidden />
                          Unirse
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {data && data.pendingIn.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-amber-50">
                    Solicitudes entrantes
                  </h3>
                  <ul className="space-y-1.5">
                    {data.pendingIn.map((request) => (
                      <RequestRow
                        key={request.playerId}
                        request={request}
                        busy={busy}
                        onAccept={() => act(`accept:${request.playerId}`, () => friendAccept(request.playerId), `${request.name} ahora es tu amigo.`)}
                        onReject={() => act(`reject:${request.playerId}`, () => friendReject(request.playerId))}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {data && data.pendingOut.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-amber-50">
                    Solicitudes enviadas
                  </h3>
                  <ul className="space-y-1.5">
                    {data.pendingOut.map((request) => (
                      <li key={request.playerId} className="flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2 ring-1 ring-amber-100/10">
                        <PlayerAvatar code={request.avatar} name={request.name} />
                        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-amber-50">{request.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold text-amber-100/60">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          Pendiente
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-amber-50">
                  Mis amigos {data ? `(${data.friends.length})` : ''}
                </h3>
                {!data || data.friends.length === 0 ? (
                  <p className="py-3 text-center text-sm text-amber-100/70">
                    Todavía no tienes amigos. Busca por nombre o código y envía una solicitud.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.friends.map((friend) => (
                      <li key={friend.playerId} className="rounded-xl bg-black/25 px-2.5 py-2 ring-1 ring-amber-100/10">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar code={friend.avatar} name={friend.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-extrabold text-amber-50">{friend.name}</span>
                            <span className="block text-[11px] font-bold text-amber-100/60">
                              Nivel {friend.level ?? 1} ·{' '}
                              {friend.inRoom ? (
                                <span className="text-amber-300">en partida</span>
                              ) : friend.online ? (
                                <span className="text-emerald-300">en línea</span>
                              ) : (
                                'sin conexión'
                              )}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={busy !== null}
                            aria-expanded={inviteFor === friend.playerId}
                            onClick={() => setInviteFor(inviteFor === friend.playerId ? null : friend.playerId)}
                            className="btn-gold flex shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition-transform active:scale-95 disabled:opacity-60"
                          >
                            <Send className="h-3.5 w-3.5" aria-hidden />
                            Invitar
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => act(`remove:${friend.playerId}`, () => friendRemove(friend.playerId), `${friend.name} ya no está en tu lista.`)}
                            aria-label={`Eliminar a ${friend.name}`}
                            title={`Eliminar a ${friend.name}`}
                            className="grid h-8 w-8 shrink-0 touch-manipulation place-items-center rounded-lg text-amber-100/50 transition hover:text-rose-300 active:scale-90 disabled:opacity-60"
                          >
                            <UserMinus className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        {inviteFor === friend.playerId && (
                          <div className="mt-2 border-t border-amber-100/10 pt-2">
                            <p className="mb-1.5 text-[11px] font-bold text-amber-100/70">
                              ¿A qué quieres jugar con {friend.name}?
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {INVITE_GAMES.map((game) => (
                                <button
                                  key={game}
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => invite(friend, game)}
                                  className="btn-gold touch-manipulation rounded-lg px-3 py-2 text-xs font-extrabold transition-transform active:scale-95 disabled:opacity-60"
                                >
                                  {GAMES[game].name}
                                </button>
                              ))}
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => setInviteFor(null)}
                                className="btn-wood touch-manipulation rounded-lg px-3 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-60"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerAvatar({ code, name }: { code?: string; name: string }) {
  if (code) return <Avatar code={code} className="h-8 w-8 shrink-0 border border-amber-900/70" />;
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400/20 text-sm font-extrabold text-amber-300">
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function RequestRow({
  request,
  busy,
  onAccept,
  onReject,
}: {
  request: FriendRequestEntry;
  busy: string | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2 ring-1 ring-amber-100/10">
      <PlayerAvatar code={request.avatar} name={request.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-amber-50">{request.name}</span>
        <span className="block text-[11px] font-bold text-amber-100/60">Nivel {request.level ?? 1}</span>
      </span>
      <button
        type="button"
        disabled={busy !== null}
        onClick={onAccept}
        className="btn-gold flex shrink-0 touch-manipulation items-center gap-1 rounded-lg px-3 py-2 text-xs font-extrabold transition-transform active:scale-95 disabled:opacity-60"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Aceptar
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={onReject}
        aria-label={`Rechazar solicitud de ${request.name}`}
        className="btn-wood grid h-8 w-8 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95 disabled:opacity-60"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
