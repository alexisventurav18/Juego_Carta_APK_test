import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import { HAND_SIZE, nextDealerSeat, TARGET_WINS, type TresYDosMove, type TresYDosState, winningDiscardIds } from '@/games/tresYDos';
import { isBotPlayer } from '@/games/shared';
import CartaUI, { CARTA_ALTURA, DorsoUI } from './CartaUI';
import DealerReveal from './DealerReveal';
import DealFlight from './DealFlight';
import DefeatNotice from './DefeatNotice';
import TresYDosHud from './TresYDosHud';
import { useDealIntro } from './useDealIntro';
import VictoryCelebration from './VictoryCelebration';

interface TresYDosTableProps {
  state: TresYDosState;
  seat: number;
  onMove: (move: TresYDosMove) => void;
  /** Botón de salir dentro de la barra superior (la pantalla ocupa todo el viewport). */
  onLeave?: () => void;
  /** Texto de la sala o partida. */
  roomLabel?: string;
  connection?: 'connected' | 'connecting' | 'offline';
  /** Aviso de error o información pasajera. */
  notice?: string | null;
  /** Contenido extra del panel de resultados (p. ej. el botón "Jugar otra partida"). */
  resultFooter?: ReactNode;
}

/** Cartas visibles bajo la de arriba del Pozo, para dar sensación de pila. */
const PILE_UNDER = 2;

export default function TresYDosTable({
  state,
  seat,
  onMove,
  onLeave,
  roomLabel,
  connection,
  notice,
  resultFooter,
}: TresYDosTableProps) {
  const [cardId, setCardId] = useState<string | null>(null);
  const [dealerOpen, setDealerOpen] = useState(state.roundNo === 1 && !state.players.some(isBotPlayer));
  const [endNoticeDismissedRound, setEndNoticeDismissedRound] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const deal = useDealIntro(state.roundNo, state.players.length, HAND_SIZE, 1);

  const seats = state.players.length;
  const hand = state.hands[seat];
  const playing = state.phase === 'playing';
  const myTurn = playing && state.turn === seat && !deal.dealing;
  const drawStep = myTurn && state.turnStep === 'draw';
  const discardStep = myTurn && state.turnStep === 'discard';
  const forbiddenId = state.drawnFrom === 'discard' ? state.drawnCardId : null;
  const winningIds = discardStep ? winningDiscardIds(hand, forbiddenId) : [];
  const selected = hand.find((c) => c.id === cardId) ?? null;
  const selectedWins = selected !== null && winningIds.includes(selected.id);
  const pileTop = state.discardPile[state.discardPile.length - 1] ?? null;
  const pileUnder = state.discardPile.slice(Math.max(0, state.discardPile.length - 1 - PILE_UNDER), -1);
  const deckDisplayCount = deal.dealing
    ? state.deck.length + Math.max(0, deal.dealSteps - Math.min(deal.revealed, deal.dealSteps))
    : state.deck.length;
  const canDrawDeck = drawStep && (state.deck.length > 0 || state.discardPile.length > 1);
  const canDrawDiscard = drawStep && pileTop !== null;

  const nextDealer = nextDealerSeat(state);
  const winnerName = state.winnerSeat !== null ? state.players[state.winnerSeat].name : '';
  const iWon = state.winnerSeat === seat;
  const showEndNotice = state.phase === 'gameOver' && endNoticeDismissedRound !== state.roundNo;

  // Cada paso o turno nuevo empieza sin carta elegida.
  useEffect(() => {
    setCardId(null);
  }, [state.turn, state.turnStep, state.roundNo]);

  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, []);

  const hint = (() => {
    if (!playing) return '';
    if (deal.dealing) return 'Repartiendo las cartas...';
    if (drawStep) return 'Tu turno: roba una carta del Monte o del Pozo.';
    if (discardStep) {
      if (winningIds.length > 0) return '¡Tienes 3 y 2! Bota la carta sobrante para ganar.';
      if (selected) return 'Dale a "Botar Carta" para soltarla en el Pozo.';
      return 'Elige una carta de tu mano para botar al Pozo.';
    }
    return `Turno de ${state.players[state.turn].name}...`;
  })();
  // En móvil el jugador activo ya se ve resaltado arriba: la pista no repite su nombre.
  const hintMobile = playing && !deal.dealing && !myTurn ? 'Esperando jugada...' : hint;

  const statusText = state.phase === 'gameOver' ? 'Fin' : state.phase === 'roundEnd' ? 'Fin de ronda' : deal.dealing ? 'Reparto' : '';

  const draw = (from: 'deckDraw' | 'discardDraw') => {
    onMove({ type: from === 'deckDraw' ? 'drawDeck' : 'drawDiscard' });
  };
  const discard = () => {
    if (!selected) return;
    onMove({ type: 'discard', cardId: selected.id });
    setCardId(null);
  };
  const pickCard = (id: string) => {
    if (!discardStep || id === forbiddenId) return;
    setCardId((current) => (current === id ? null : id));
  };

  const handGap =
    hand.length >= HAND_SIZE
      ? '-ml-[4.3dvh] first:ml-0 sm:-ml-[2.5dvh] sm:first:ml-0'
      : 'ml-1.5 first:ml-0 sm:ml-2 sm:first:ml-0';
  const actionBase =
    'min-h-[44px] min-w-0 flex-1 touch-manipulation rounded-lg px-1 py-2 text-[11px] font-bold leading-tight transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 min-[380px]:text-xs sm:flex-none sm:px-6 sm:text-sm';
  const actionMain = `${actionBase} bg-emerald-500 text-white`;
  const actionForm = `${actionBase} bg-sky-500 text-white`;
  const actionDrop = `${actionBase} bg-stone-200 text-stone-900`;
  const actionSing = `${actionBase} animate-pulse bg-amber-400 text-stone-900 ring-2 ring-yellow-200`;

  // Al terminar la ronda se muestran las 5 cartas de cada jugador: se achican según cuántos son.
  const revealVars = (
    seats >= 4
      ? { '--mesa-h': 'min(7dvh, 15vw)', '--mesa-h-sm': '8dvh' }
      : seats === 3
        ? { '--mesa-h': 'min(8dvh, 15vw)', '--mesa-h-sm': '10dvh' }
        : { '--mesa-h': 'min(9dvh, 15vw)', '--mesa-h-sm': '13dvh' }
  ) as CSSProperties;

  return (
    <div className="fixed inset-0 z-30 flex h-dvh w-screen touch-manipulation select-none flex-col justify-between overflow-hidden overscroll-none bg-gradient-to-b from-emerald-950 via-teal-900 to-emerald-950 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white">
      {dealerOpen && (
        <DealerReveal players={state.players} dealer={state.dealer} onDone={() => setDealerOpen(false)} />
      )}
      {showEndNotice &&
        (iWon ? (
          <VictoryCelebration
            title="¡CANTASTE!"
            message={`Llegaste a ${TARGET_WINS} rondas ganadas y te llevaste la partida.`}
            continueLabel="Continuar"
            onContinue={() => setEndNoticeDismissedRound(state.roundNo)}
          />
        ) : (
          <DefeatNotice
            message={`${winnerName} llegó primero a ${TARGET_WINS} rondas ganadas.`}
            continueLabel="Continuar"
            onContinue={() => setEndNoticeDismissedRound(state.roundNo)}
          />
        ))}

      {/* 1. HUD: ronda, turno y manos de los rivales */}
      <div className="h-[16dvh] shrink-0">
        <TresYDosHud
          state={state}
          seat={seat}
          turn={playing && !deal.dealing ? state.turn : null}
          statusText={statusText}
          onLeave={onLeave}
        />
      </div>

      {/* 2. Mesa: el Monte y el Pozo (o las manos reveladas al cantar 3 y 2) */}
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        {playing || deal.dealing ? (
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <div className="flex flex-col items-center gap-1.5">
              <div ref={deckRef} className="relative">
                <button
                  type="button"
                  disabled={!canDrawDeck}
                  onClick={() => draw('deckDraw')}
                  aria-label={`Robar del Monte (${deckDisplayCount} cartas)`}
                  className={`relative block touch-manipulation rounded-lg transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
                    canDrawDeck ? 'shadow-lg ring-2 ring-yellow-400' : ''
                  }`}
                >
                  {deckDisplayCount > 0 ? (
                    <span className="block rounded-lg shadow-[2px_2px_0_rgba(255,255,255,0.18),4px_4px_0_rgba(255,255,255,0.1)]">
                      <DorsoUI />
                    </span>
                  ) : (
                    <span className={`block aspect-[2.5/3.5] rounded-lg border-2 border-dashed border-white/30 ${CARTA_ALTURA.mesa}`} />
                  )}
                </button>
                <span className="pointer-events-none absolute -right-2 -top-2 z-10 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-black shadow sm:text-xs">
                  {deckDisplayCount}
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/80 sm:text-xs">Monte</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="relative">
                {pileUnder.map((c, i) => (
                  <div
                    key={c.id}
                    className={`absolute left-0 top-0 opacity-90 ${i % 2 === 0 ? '-rotate-6' : 'rotate-6'}`}
                    aria-hidden
                  >
                    <CartaUI card={c} size="mesa" />
                  </div>
                ))}
                {pileTop && deal.isTableDealt(0) ? (
                  <DealFlight origin={deckRef} animate={deal.dealing}>
                    <div className={`relative rounded-lg ${canDrawDiscard ? 'shadow-lg ring-2 ring-yellow-400' : ''}`}>
                      <CartaUI
                        card={pileTop}
                        size="mesa"
                        onClick={canDrawDiscard ? () => draw('discardDraw') : undefined}
                      />
                    </div>
                  </DealFlight>
                ) : (
                  <span className={`block aspect-[2.5/3.5] rounded-lg border-2 border-dashed border-white/30 ${CARTA_ALTURA.mesa}`} />
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/80 sm:text-xs">Pozo</span>
            </div>
          </div>
        ) : (
          <div
            style={revealVars}
            className="flex max-h-full w-full max-w-3xl flex-col items-center justify-center gap-2 sm:gap-3"
          >
            {state.players.map((player, s) => (
              <div
                key={player.id}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1 ${
                  s === state.winnerSeat ? 'bg-amber-400/20 ring-1 ring-amber-300' : ''
                }`}
              >
                <span className="flex w-20 shrink-0 items-center gap-1 text-xs font-semibold sm:w-32 sm:text-sm">
                  {s === state.winnerSeat && <Trophy className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />}
                  <span className="truncate">{s === seat ? 'Tú' : player.name}</span>
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                  {state.hands[s].map((c) => (
                    <CartaUI key={c.id} card={c} size="mesa" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 3. Zona del jugador: acciones arriba y mano abajo (o el resultado de la ronda) */}
      <section className="mx-auto flex h-[28dvh] w-full max-w-5xl shrink-0 flex-col justify-end pb-2 sm:h-[30dvh]">
        {playing ? (
          <>
            <p className="px-3 pb-1 text-center text-[11px] leading-tight text-emerald-50/90 sm:text-sm [@media(max-height:480px)]:hidden">
              <span className="sm:hidden">{hintMobile}</span>
              <span className="hidden sm:inline">{hint}</span>
            </p>
            <div className="flex w-full items-stretch gap-1 px-2 pb-1.5 sm:justify-center sm:gap-3">
              {state.turnStep === 'discard' && state.turn === seat ? (
                selectedWins ? (
                  <button type="button" onClick={discard} className={actionSing}>
                    ¡Cantar 3 y 2!
                  </button>
                ) : (
                  <button type="button" onClick={discard} disabled={!discardStep || !selected} className={actionDrop}>
                    Botar Carta
                  </button>
                )
              ) : (
                <>
                  <button type="button" onClick={() => draw('deckDraw')} disabled={!canDrawDeck} className={actionMain}>
                    Robar del Monte
                  </button>
                  <button type="button" onClick={() => draw('discardDraw')} disabled={!canDrawDiscard} className={actionForm}>
                    Robar del Pozo
                  </button>
                </>
              )}
            </div>
            <div className="flex items-end justify-center px-2 pt-3">
              {hand.map((c, i) => {
                const justTaken = discardStep && c.id === forbiddenId;
                return (
                  <div key={c.id} className={`relative ${handGap}`}>
                    {deal.isHandDealt(seat, i) ? (
                      <DealFlight origin={deckRef} animate={deal.dealing}>
                        <CartaUI
                          card={c}
                          size="mano"
                          isSelected={c.id === cardId}
                          isPlayable={winningIds.includes(c.id)}
                          isDisabled={!discardStep || justTaken}
                          onClick={() => pickCard(c.id)}
                        />
                      </DealFlight>
                    ) : (
                      <DorsoUI className={CARTA_ALTURA.mano} />
                    )}
                    {justTaken && (
                      <span className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-stone-900 shadow">
                        Recién tomada
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-end gap-2 px-4 text-center">
            <h2 className="text-base font-bold sm:text-xl">
              {state.phase === 'gameOver'
                ? iWon
                  ? '¡Ganaste la partida!'
                  : `${winnerName} ganó la partida`
                : iWon
                  ? '¡Cantaste 3 y 2!'
                  : `¡${winnerName} cantó 3 y 2!`}
            </h2>
            <p className="text-xs text-emerald-50/90 sm:text-sm">
              {state.players.map((p, s) => `${s === seat ? 'Tú' : p.name} ${state.wins[s]}`).join(' · ')}
            </p>
            {state.phase === 'roundEnd' &&
              (seat === nextDealer ? (
                <button
                  type="button"
                  onClick={() => onMove({ type: 'nextRound' })}
                  className={`${actionMain} flex-none px-6`}
                >
                  Repartir y seguir
                </button>
              ) : (
                <p className="text-xs text-emerald-50/80 sm:text-sm">
                  Esperando a {state.players[nextDealer].name} para repartir...
                </p>
              ))}
            {state.phase === 'gameOver' && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {resultFooter}
                {onLeave && (
                  <button type="button" onClick={onLeave} className={`${actionDrop} flex-none px-6`}>
                    Salir
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

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
      {roomLabel && <span className="sr-only">{roomLabel}</span>}
    </div>
  );
}
