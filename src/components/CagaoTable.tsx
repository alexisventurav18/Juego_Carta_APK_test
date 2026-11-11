import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Shuffle, Skull, X } from 'lucide-react';
import { rankLabel, shuffle } from '@/games/cards';
import { type CagaoEvent, type CagaoMove, type CagaoState, drawFromSeat } from '@/games/cagao';
import { isBotPlayer } from '@/games/shared';
import CagaoHud from './CagaoHud';
import CartaUI, { DorsoUI } from './CartaUI';
import DealerReveal from './DealerReveal';
import DefeatNotice from './DefeatNotice';
import VictoryCelebration from './VictoryCelebration';

interface CagaoTableProps {
  state: CagaoState;
  seat: number;
  onMove: (move: CagaoMove) => void;
  /** Botón de salir dentro de la barra superior (la pantalla ocupa todo el viewport). */
  onLeave?: () => void;
  /** Texto de la sala o partida, visible en la hoja de pares. */
  roomLabel?: string;
  connection?: 'connected' | 'connecting' | 'offline';
  /** Aviso de error o información pasajera. */
  notice?: string | null;
  /** Contenido extra del resultado (p. ej. el botón "Jugar otra partida"). */
  resultFooter?: ReactNode;
}

/** Alto de las cartas boca abajo del rival: más cartas, más chicas, para que todas quepan sin scroll. */
function victimSizes(count: number): CSSProperties {
  const [h, hSm] =
    count <= 6
      ? ['12dvh', '15dvh']
      : count <= 10
        ? ['10dvh', '12dvh']
        : count <= 16
          ? ['8.5dvh', '10dvh']
          : count <= 22
            ? ['7.5dvh', '8.5dvh']
            : ['6.5dvh', '7.5dvh'];
  return {
    '--mesa-h': `max(36px, min(${h}, 15vw))`,
    '--mesa-h-sm': `max(36px, ${hSm})`,
  } as CSSProperties;
}

/** Alto de las cartas de tu mano, que se solapan en una fila según cuántas tengas. */
function handSizes(count: number): CSSProperties {
  const [h, hSm] =
    count <= 8
      ? ['15dvh', '18dvh']
      : count <= 14
        ? ['12dvh', '15dvh']
        : count <= 20
          ? ['10dvh', '13dvh']
          : ['8dvh', '11dvh'];
  const base = `max(40px, ${h})`;
  const sm = `max(40px, ${hSm})`;
  return {
    '--mano-h': base,
    '--mano-h-sm': sm,
    '--fan-h': base,
    '--fan-h-sm': sm,
    '--fan-n': Math.max(count, 2),
  } as CSSProperties;
}

export default function CagaoTable({
  state,
  seat,
  onMove,
  onLeave,
  roomLabel,
  connection,
  notice,
  resultFooter,
}: CagaoTableProps) {
  const [dealerOpen, setDealerOpen] = useState(state.roundNo === 1 && !state.players.some(isBotPlayer));
  const [endNoticeDismissed, setEndNoticeDismissed] = useState(false);
  const [pairsOpen, setPairsOpen] = useState(false);
  // Orden de tu mano en pantalla. "Mezclar" lo cambia solo aquí; el servidor baraja la real.
  const [order, setOrder] = useState<string[]>([]);

  const playing = state.phase === 'playing';
  const hand = state.hands[seat];
  const myTurn = playing && state.turn === seat;
  const victim = playing ? drawFromSeat(state) : -1;
  const victimCount = victim >= 0 ? state.hands[victim].length : 0;
  const iAmOut = playing && hand.length === 0;
  const iLost = state.loserSeat === seat;
  const loserName = state.loserSeat !== null ? state.players[state.loserSeat].name : '';
  const event = state.lastEvent;
  const myNewCardId = event && event.by === seat && !event.pair ? event.drawnCardId : null;
  const showEndNotice = state.phase === 'gameOver' && !endNoticeDismissed;

  const shownHand = [...hand].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  });

  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, []);

  const hint = (() => {
    if (!playing) return '';
    if (iAmOut) return '¡Te salvaste! Mira cómo termina la partida.';
    if (myTurn) return `Tu turno: jala una carta de ${state.players[victim].name}. ¡A ciegas!`;
    if (victim === seat) return `${state.players[state.turn].name} te está robando una carta.`;
    return `${state.players[state.turn].name} le está robando a ${state.players[victim].name}...`;
  })();
  const hintMobile = playing && !myTurn && !iAmOut ? 'Esperando jugada...' : hint;
  const statusText = state.phase === 'gameOver' ? 'Fin' : '';

  const who = (s: number) => (s === seat ? 'Tú' : state.players[s].name);
  const outNames = (e: CagaoEvent) => e.outSeats.map((s) => (s === seat ? 'tú' : state.players[s].name));

  return (
    <div className="fixed inset-0 z-30 flex h-dvh w-screen touch-manipulation select-none flex-col justify-between overflow-hidden overscroll-none bg-gradient-to-b from-emerald-950 via-teal-900 to-emerald-950 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white">
      {dealerOpen && (
        <DealerReveal players={state.players} dealer={state.dealer} onDone={() => setDealerOpen(false)} />
      )}
      {showEndNotice &&
        (iLost ? (
          <DefeatNotice
            title="¡Eres El Cagao!"
            message="Te quedaste con el A♠ y no pudiste emparejarlo. ¡Pide la revancha!"
            continueLabel="Continuar"
            onContinue={() => setEndNoticeDismissed(true)}
          />
        ) : (
          <VictoryCelebration
            title="¡TE SALVASTE!"
            message={`${loserName} se quedó con El Cagao.`}
            continueLabel="Continuar"
            onContinue={() => setEndNoticeDismissed(true)}
          />
        ))}

      {/* 1. HUD: pares bajados, turno y rivales */}
      <div className="h-[16dvh] shrink-0">
        <CagaoHud
          state={state}
          seat={seat}
          turn={playing ? state.turn : null}
          statusText={statusText}
          onOpenPairs={() => setPairsOpen(true)}
          onLeave={onLeave}
        />
      </div>

      {/* 2. Mesa: aviso de la última jugada y las cartas boca abajo del rival al que le robas */}
      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden p-2">
        {event && playing && (
          <div
            key={event.seq}
            style={{ '--mesa-h': '8dvh', '--mesa-h-sm': '10dvh' } as CSSProperties}
            className={`animate-combo-label flex max-w-full shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-center text-xs ring-1 sm:text-sm ${
              event.cagao
                ? 'bg-rose-500/30 font-bold text-rose-50 ring-rose-300'
                : event.pair
                  ? 'bg-amber-400/20 font-semibold text-amber-50 ring-amber-300/70'
                  : 'bg-black/25 text-white/90 ring-white/15'
            }`}
            role="status"
          >
            {event.cagao && <Skull className="h-4 w-4 shrink-0 text-rose-200" aria-hidden />}
            <span>
              {event.cagao
                ? event.by === seat
                  ? `¡Robaste El Cagao (A♠) de ${who(event.from)}!`
                  : event.from === seat
                    ? `¡${who(event.by)} te quitó El Cagao!`
                    : `¡${who(event.by)} le robó El Cagao a ${who(event.from)}!`
                : event.pair
                  ? event.by === seat
                    ? `Robaste a ${who(event.from)} y bajaste par de ${rankLabel(event.pair[0])}.`
                    : event.from === seat
                      ? `${who(event.by)} te robó y bajó par de ${rankLabel(event.pair[0])}.`
                      : `${who(event.by)} bajó par de ${rankLabel(event.pair[0])}.`
                  : event.by === seat
                    ? `Le robaste una carta a ${who(event.from)}.`
                    : event.from === seat
                      ? `${who(event.by)} te robó una carta.`
                      : `${who(event.by)} le robó una carta a ${who(event.from)}.`}
              {event.outSeats.length > 0 && ` ${outNames(event).join(' y ')} se salvó.`}
            </span>
            {event.pair && (
              <span className="flex shrink-0 items-center">
                <CartaUI card={event.pair[0]} size="mesa" />
                <span className="-ml-[3.4dvh]">
                  <CartaUI card={event.pair[1]} size="mesa" />
                </span>
              </span>
            )}
          </div>
        )}

        {playing ? (
          <div className="flex min-h-0 w-full max-w-3xl flex-col items-center justify-center gap-1.5">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-100/80 sm:text-xs">
              {myTurn
                ? `Cartas de ${state.players[victim].name}`
                : victim === seat
                  ? 'Tus cartas'
                  : `Cartas de ${state.players[victim].name}`}
            </p>
            <div
              style={victimSizes(victimCount)}
              className="flex max-h-full flex-wrap items-center justify-center gap-1.5 sm:gap-2"
            >
              {Array.from({ length: victimCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!myTurn}
                  onClick={() => onMove({ type: 'draw', index: i })}
                  aria-label={`Jalar la carta ${i + 1} de ${victimCount} de ${state.players[victim].name}`}
                  className={`touch-manipulation rounded-lg transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
                    myTurn ? 'ring-1 ring-yellow-400/70 active:-translate-y-2 active:ring-2 active:ring-yellow-300' : 'opacity-80'
                  }`}
                >
                  <DorsoUI />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col gap-1">
            {state.finishOrder.map((s, i) => (
              <div key={s} className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-0.5 text-xs sm:px-3 sm:py-1 sm:text-sm">
                <span className="w-5 shrink-0 font-bold tabular-nums text-amber-200">{i + 1}º</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{who(s)}</span>
                <span className="flex shrink-0 items-center gap-1 text-emerald-200">
                  <Check className="h-3 w-3" aria-hidden />
                  Se salvó
                </span>
              </div>
            ))}
            {state.loserSeat !== null && (
              <div
                style={{ '--mesa-h': 'min(9dvh, 13vw)', '--mesa-h-sm': '9dvh' } as CSSProperties}
                className="flex items-center gap-2 rounded-xl bg-rose-500/25 px-2 py-1 ring-1 ring-rose-300 sm:px-3"
              >
                <Skull className="h-4 w-4 shrink-0 text-rose-200" aria-hidden />
                <span className="min-w-0 flex-1 text-xs font-bold sm:text-sm">
                  <span className="block truncate">{who(state.loserSeat)}</span>
                  <span className="block text-rose-100">El Cagao</span>
                </span>
                {state.hands[state.loserSeat].map((c) => (
                  <CartaUI key={c.id} card={c} size="mesa" />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. Zona del jugador: pista, mezclar y tu mano (o el resultado) */}
      <section className="mx-auto flex h-[28dvh] w-full max-w-5xl shrink-0 flex-col justify-end pb-2 sm:h-[30dvh]">
        {playing ? (
          <>
            <p className="px-3 pb-1 text-center text-[11px] leading-tight text-emerald-50/90 sm:text-sm [@media(max-height:480px)]:hidden">
              <span className="sm:hidden">{hintMobile}</span>
              <span className="hidden sm:inline">{hint}</span>
            </p>
            <div className="flex w-full items-stretch justify-center gap-1 px-2 pb-1.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setOrder(shuffle(hand.map((c) => c.id)))}
                disabled={hand.length < 2}
                className="flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 sm:max-w-xs sm:flex-none sm:px-6 sm:text-sm"
              >
                <Shuffle className="h-4 w-4" aria-hidden />
                Mezclar mano
              </button>
            </div>
            {iAmOut ? (
              <p className="flex min-h-[15dvh] items-center justify-center gap-2 px-4 pt-3 text-center text-sm font-bold text-emerald-200">
                <Check className="h-4 w-4" aria-hidden />
                Sin cartas: ¡te salvaste!
              </p>
            ) : (
              <div style={handSizes(hand.length)} className="fan flex items-end justify-center px-2 pt-3">
                {shownHand.map((c) => (
                  <div key={c.id} className="relative">
                    <CartaUI card={c} size="mano" isSelected={c.id === myNewCardId} />
                    {c.id === myNewCardId && (
                      <span className="pointer-events-none absolute -top-3 right-0 z-20 whitespace-nowrap rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-stone-900 shadow">
                        Recién robada
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-end gap-2 px-4 text-center">
            <h2 className="text-base font-bold sm:text-xl">
              {iLost ? '¡Te quedaste con El Cagao!' : `${loserName} se quedó con El Cagao`}
            </h2>
            <p className="text-xs text-emerald-50/90 sm:text-sm">
              {iLost ? 'El A♠ no tiene pareja. La próxima te toca salvarte.' : 'Te salvaste: ya no tienes cartas.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {resultFooter}
              {onLeave && (
                <button
                  type="button"
                  onClick={onLeave}
                  className="min-h-[44px] rounded-lg bg-stone-200 px-6 py-2 text-xs font-bold text-stone-900 transition-transform active:scale-95 sm:text-sm"
                >
                  Salir
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {pairsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-stone-950/60 sm:items-center"
          onClick={() => setPairsOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Pares bajados"
            className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 text-stone-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Pares bajados: {state.pairs.length}</h2>
                {roomLabel && <p className="text-xs text-stone-500">{roomLabel}</p>}
              </div>
              <button
                type="button"
                onClick={() => setPairsOpen(false)}
                aria-label="Cerrar"
                className="grid h-10 w-10 place-items-center rounded-lg bg-stone-100 text-stone-700 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {state.players.map((player, s) => {
                const mine = state.pairs.filter((p) => p.seat === s);
                return (
                  <div key={player.id}>
                    <p className="mb-1 text-xs font-semibold text-stone-700">
                      {s === seat ? 'Tú' : player.name} · {mine.length} {mine.length === 1 ? 'par' : 'pares'}
                    </p>
                    <div
                      style={{ '--mesa-h': '8dvh', '--mesa-h-sm': '9dvh' } as CSSProperties}
                      className="flex flex-wrap gap-x-3 gap-y-1.5"
                    >
                      {mine.map((p) => (
                        <span key={p.cards[0].id} className="flex items-center">
                          <CartaUI card={p.cards[0]} size="mesa" />
                          <span className="-ml-[3.4dvh]">
                            <CartaUI card={p.cards[1]} size="mesa" />
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(connection === 'offline' || connection === 'connecting') && (
        <p
          role="status"
          className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.25rem)] z-50 mx-auto max-w-sm rounded-full bg-amber-500 px-3 py-1 text-center text-[11px] font-semibold text-stone-900 shadow-lg"
        >
          {connection === 'offline' ? 'Sin conexión. Reintentando...' : 'Conectando al servidor...'}
        </p>
      )}
      {notice && (
        <p
          role="alert"
          className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+2rem)] z-50 mx-auto max-w-md rounded-xl bg-rose-600 px-3 py-2 text-center text-xs font-medium text-white shadow-lg"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
