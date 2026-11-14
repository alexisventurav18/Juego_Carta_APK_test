import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import { HAND_SIZE, nextDealerSeat, TARGET_WINS, type TresYDosMove, type TresYDosState, winningDiscardIds } from '@/games/tresYDos';
import { isBotPlayer } from '@/games/shared';
import { useGameSounds } from '@/hooks/useGameSounds';
import DealerReveal from './DealerReveal';
import DefeatNotice from './DefeatNotice';
import { DorsoUI } from './CartaUI';
import { useDealIntro } from './useDealIntro';
import VictoryCelebration from './VictoryCelebration';
import FlightLayer from './cagao/FlightLayer';
import { HandFan } from './cagao/Fans';
import PlayerSeat, { SeatPlaque } from './cagao/PlayerSeat';
import PlayingCard from './cagao/PlayingCard';
import type { Card } from './cagao/types';
import TableLayout from './table/TableLayout';
import { CORNER_CHIP, LeaveButton, TableNotices, TurnSound } from './table/chips';
import { seatLayout } from './table/seatLayout';
import { useStartHint } from './table/useStartHint';
import { TB_DROP, TB_FORM, TB_MAIN, TB_SING } from './table/styles';
import { useDealFlights } from './table/useDealFlights';
import { centerOf, useFlights } from './table/useFlights';
import { PANEL_BUTTON, PANEL_BUTTON_QUIET } from './wood/styles';

interface TresYDosTableProps {
  state: TresYDosState;
  seat: number;
  onMove: (move: TresYDosMove) => void;
  /** Botón de salir dentro de la mesa (ocupa todo el viewport). */
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

const CENTER_VARS = { '--th': 'clamp(36px, 14.5dvh, 100px)', '--rh': 'clamp(30px, 9.5dvh, 60px)' } as CSSProperties;

/**
 * Mesa de Tres y Dos. Mismo esqueleto, misma mano en abanico, mismos vuelos de cartas y mismos sonidos
 * que El Cagao. Con dedo o ratón: toca el Monte o el Pozo para robar; toca una carta y pulsa "Botar", o
 * arrástrala hasta la mesa para botarla al Pozo.
 */
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
  const [dragging, setDragging] = useState(false);
  const [dealerOpen, setDealerOpen] = useState(state.roundNo === 1 && !state.players.some(isBotPlayer));
  const [endNoticeDismissedRound, setEndNoticeDismissedRound] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const deal = useDealIntro(state.roundNo, state.players.length, HAND_SIZE, 1);
  const { flights, spawn, endFlight, registerAnchor, anchorCenter } = useFlights();
  const { playSound, isMuted, toggleMute } = useGameSounds();

  const seats = state.players.length;
  const hand = state.hands[seat];
  const playing = state.phase === 'playing';
  const myTurn = playing && state.turn === seat && !deal.dealing;
  const drawStep = myTurn && state.turnStep === 'draw';
  const discardStep = myTurn && state.turnStep === 'discard';
  // Los avisos de instrucciones salen solo al inicio de la partida (hasta que termina tu primer turno).
  const showStartHint = useStartHint(myTurn, state.roundNo, state.phase === 'gameOver');
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

  /* ------------------------- reparto, vuelos y sonidos ------------------------- */

  const tableCardAt = useCallback(() => pileTop, [pileTop]);
  useDealFlights({
    deal,
    roundKey: state.roundNo,
    seats,
    cardsPerHand: HAND_SIZE,
    deckRef,
    boardRef,
    anchorCenter,
    spawn,
    tableCardAt,
    playSound,
  });

  // Jugadas de los demás: roban del Monte o del Pozo hacia su asiento y botan una carta al Pozo.
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === state || before.roundNo !== state.roundNo) return;
    const actor = before.turn;
    if (actor === seat) return;
    const actorPoint = anchorCenter(actor);
    if (!actorPoint) return;

    if (before.turnStep === 'draw' && state.turnStep === 'discard' && state.turn === actor) {
      const fromPile = state.drawnFrom === 'discard';
      const origin = centerOf(fromPile ? pileRef.current : deckRef.current);
      if (origin) {
        spawn([
          {
            from: origin,
            to: actorPoint,
            card: fromPile ? (before.discardPile[before.discardPile.length - 1] ?? null) : null,
            heightVar: '--oh',
            durationMs: 460,
            plain: true,
          },
        ]);
        playSound('cardSlide');
      }
    }
    if (state.discardPile.length > before.discardPile.length) {
      const top = state.discardPile[state.discardPile.length - 1];
      const pile = centerOf(pileRef.current);
      if (top && pile) {
        spawn([{ from: actorPoint, to: pile, card: top, heightVar: '--ph', durationMs: 460, plain: true }]);
        playSound('cardSlide');
      }
    }
  }, [state, seat, spawn, anchorCenter, playSound]);

  // Fin de ronda o de partida: cantaron el 3 y 2.
  useEffect(() => {
    if (state.phase === 'playing') return;
    const timer = window.setTimeout(() => playSound(state.winnerSeat === seat ? 'win' : 'lose'), 450);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.roundNo, state.winnerSeat, seat, playSound]);

  /* ------------------------------ acciones ------------------------------ */

  const draw = (from: 'deckDraw' | 'discardDraw') => {
    const origin = centerOf(from === 'deckDraw' ? deckRef.current : pileRef.current);
    const mine = anchorCenter(seat);
    if (origin && mine) {
      spawn([
        {
          from: origin,
          to: mine,
          card: from === 'discardDraw' ? pileTop : null,
          heightVar: '--ch',
          durationMs: 460,
          plain: true,
        },
      ]);
    }
    playSound('cardSlide');
    onMove({ type: from === 'deckDraw' ? 'drawDeck' : 'drawDiscard' });
  };

  const discardCard = (card: Card) => {
    const pile = centerOf(pileRef.current);
    const from = centerOf(document.querySelector(`[data-hand-id="${card.id}"]`)) ?? anchorCenter(seat);
    if (pile && from) spawn([{ from, to: pile, card, heightVar: '--ch', durationMs: 440, plain: true }]);
    playSound('cardSlide');
    onMove({ type: 'discard', cardId: card.id });
    setCardId(null);
  };

  const pickCard = (card: Card): boolean => {
    if (!discardStep || card.id === forbiddenId) return false;
    setCardId((current) => (current === card.id ? null : card.id));
    return true;
  };

  const dropOnBoard = (card: Card): boolean => {
    if (!discardStep || card.id === forbiddenId) return false;
    discardCard(card);
    return true;
  };

  const hint = (() => {
    if (!playing) return '';
    if (deal.dealing) return 'Repartiendo las cartas...';
    if (drawStep) return 'Tu turno: roba una carta del Monte o del Pozo.';
    if (discardStep) {
      if (winningIds.length > 0) return '¡Tienes 3 y 2! Bota la carta sobrante para ganar.';
      if (selected) return 'Dale a "Botar Carta" o arrástrala al Pozo.';
      return 'Elige una carta de tu mano para botar al Pozo.';
    }
    return `Turno de ${state.players[state.turn].name}...`;
  })();

  const statusText = state.phase === 'gameOver' ? 'Fin' : state.phase === 'roundEnd' ? 'Fin de ronda' : deal.dealing ? 'Reparto' : '';
  const turnLabel =
    playing && !deal.dealing ? (state.turn === seat ? 'Tu turno' : state.players[state.turn].name) : statusText;

  const shownHand = useMemo(
    () => hand.filter((_, i) => deal.isHandDealt(seat, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hand, deal.dealing, deal.revealed, seat],
  );
  const dealtCount = (s: number) => state.hands[s].filter((_, i) => deal.isHandDealt(s, i)).length;
  const layout = useMemo(() => seatLayout(seats, seat), [seats, seat]);
  const selectedIds = useMemo(() => new Set(cardId ? [cardId] : []), [cardId]);
  const markedIds = useMemo(() => new Set(winningIds), [winningIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const disabledIds = useMemo(() => new Set(discardStep && forbiddenId ? [forbiddenId] : []), [discardStep, forbiddenId]);
  const mineRef = useCallback((el: HTMLDivElement | null) => registerAnchor(seat, el), [registerAnchor, seat]);

  const renderSeat = (s: number, side: 'left' | 'top' | 'right') => (
    <PlayerSeat
      key={s}
      side={side}
      seat={s}
      name={state.players[s].name}
      count={dealtCount(s)}
      isTurn={playing && !deal.dealing && state.turn === s}
      isVictim={false}
      out={false}
      pickable={false}
      onPick={() => undefined}
      registerAnchor={registerAnchor}
      tag={`${state.wins[s]} ganadas`}
    />
  );

  const emptySlot = (
    <span className="block aspect-[2.5/3.5] h-[var(--th)] rounded-lg border-2 border-dashed border-amber-100/40" />
  );

  return (
    <TableLayout
      centerRef={boardRef}
      bottomCenterRef={mineRef}
      vars={CENTER_VARS}
      topLeft={
        <>
          <LeaveButton onLeave={onLeave} />
          <span
            className={`${CORNER_CHIP} cursor-default`}
            title={`Ronda ${state.roundNo}. Rondas ganadas: ${state.wins[seat]} de ${TARGET_WINS}`}
          >
            <Trophy className="h-4 w-4 text-amber-300" aria-hidden />
            R{state.roundNo} · {state.wins[seat]}/{TARGET_WINS}
          </span>
        </>
      }
      topCenter={layout.top.map((s) => renderSeat(s, 'top'))}
      topRight={<TurnSound label={turnLabel} myTurn={myTurn} muted={isMuted} onToggleMute={toggleMute} />}
      left={layout.left !== null && renderSeat(layout.left, 'left')}
      right={layout.right !== null && renderSeat(layout.right, 'right')}
      center={
        <>
          {/* Tablero de madera en perspectiva 2.5D, igual que El Cagao */}
          <div aria-hidden className="pointer-events-none absolute inset-0 [perspective:1100px]">
            <div
              className={`cagao-board absolute inset-x-[3%] inset-y-[6%] rounded-[3.5%] [transform-origin:50%_100%] [transform:rotateX(16deg)] ${
                dragging && discardStep ? 'cagao-board-drop' : ''
              }`}
            />
          </div>

          <div className="absolute inset-x-0 top-[8%] bottom-[22%] z-10 flex items-center justify-center gap-[clamp(20px,8dvw,72px)]">
            {/* Monte */}
            <div className="flex flex-col items-center">
              <div ref={deckRef} className="relative">
                <button
                  type="button"
                  disabled={!canDrawDeck}
                  onClick={() => draw('deckDraw')}
                  aria-label={`Robar del Monte (${deckDisplayCount} cartas)`}
                  className={`relative block touch-manipulation rounded-lg transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
                    canDrawDeck ? 'card-picked !translate-y-0 ring-yellow-400' : ''
                  }`}
                >
                  {deckDisplayCount > 0 ? (
                    <span className="block rounded-lg shadow-[2px_2px_0_rgba(255,255,255,0.18),4px_4px_0_rgba(255,255,255,0.1)]">
                      <DorsoUI className="h-[var(--th)]" />
                    </span>
                  ) : (
                    emptySlot
                  )}
                </button>
                <span className="pointer-events-none absolute -right-2 -top-2 z-10 btn-gold rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none shadow sm:text-xs">
                  {deckDisplayCount}
                </span>
              </div>
              <span className="-mt-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold leading-none text-amber-100 sm:text-xs">Monte</span>
            </div>

            {/* Pozo */}
            <div className="flex flex-col items-center">
              <div ref={pileRef} className="relative">
                {pileUnder.map((c, i) => (
                  <div
                    key={c.id}
                    className={`absolute left-0 top-0 opacity-90 ${i % 2 === 0 ? '-rotate-6' : 'rotate-6'}`}
                    aria-hidden
                  >
                    <PlayingCard card={c} heightVar="--th" plain />
                  </div>
                ))}
                {pileTop && deal.isTableDealt(0) ? (
                  <button
                    type="button"
                    disabled={!canDrawDiscard}
                    onClick={() => draw('discardDraw')}
                    aria-label="Robar del Pozo"
                    className={`relative block touch-manipulation rounded-lg transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
                      canDrawDiscard ? 'card-picked !translate-y-0 ring-yellow-400' : ''
                    }`}
                  >
                    <PlayingCard card={pileTop} heightVar="--th" plain />
                  </button>
                ) : (
                  emptySlot
                )}
              </div>
              <span className="-mt-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold leading-none text-amber-100 sm:text-xs">Pozo</span>
            </div>
          </div>

          {playing && showStartHint && hint && (
            <p className="pointer-events-none absolute bottom-0 left-1/2 z-30 max-w-[96%] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-center text-[11px] font-medium leading-tight text-amber-50 ring-1 ring-white/10 sm:text-xs">
              {hint}
            </p>
          )}
        </>
      }
      bottomLeft={
        <SeatPlaque
          name={state.players[seat].name}
          count={hand.length}
          isTurn={myTurn}
          out={false}
          isMe
          tag={`${state.wins[seat]} ganadas`}
        />
      }
      bottomCenter={
        <HandFan
          cards={shownHand}
          heightVar="--ch"
          avail="min(54dvw, 600px)"
          plain
          selectedIds={selectedIds}
          markedIds={markedIds}
          disabledIds={disabledIds}
          highlightId={discardStep ? state.drawnCardId : null}
          highlightLabel="Recién tomada"
          interactive={myTurn}
          canDrag={(c) => discardStep && c.id !== forbiddenId}
          dropRef={boardRef}
          onTap={pickCard}
          onDrop={dropOnBoard}
          onDragStart={(c) => setCardId(c.id)}
          onDraggingChange={setDragging}
        />
      }
      bottomRight={
        playing ? (
          <div className="flex w-full flex-col gap-1">
            {state.turnStep === 'discard' && state.turn === seat ? (
              selectedWins && selected ? (
                <button type="button" onClick={() => discardCard(selected)} className={TB_SING}>
                  ¡Cantar 3 y 2!
                </button>
              ) : (
                <button type="button" onClick={() => selected && discardCard(selected)} disabled={!discardStep || !selected} className={TB_DROP}>
                  Botar Carta
                </button>
              )
            ) : (
              <>
                <button type="button" onClick={() => draw('deckDraw')} disabled={!canDrawDeck} className={TB_MAIN}>
                  Robar del Monte
                </button>
                <button type="button" onClick={() => draw('discardDraw')} disabled={!canDrawDiscard} className={TB_FORM}>
                  Robar del Pozo
                </button>
              </>
            )}
          </div>
        ) : null
      }
      overlays={
        <>
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

          {/* Al cantar 3 y 2 todos muestran sus 5 cartas */}
          {!playing && !deal.dealing && !showEndNotice && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-3">
              <div
                style={{ '--rh': 'clamp(30px, 9.5dvh, 60px)' } as CSSProperties}
                className="wood-panel max-h-full w-full max-w-xl space-y-2 overflow-y-auto p-3 text-center sm:p-4"
              >
                <h2 className="text-base font-extrabold sm:text-xl">
                  {state.phase === 'gameOver'
                    ? iWon
                      ? '¡Ganaste la partida!'
                      : `${winnerName} ganó la partida`
                    : iWon
                      ? '¡Cantaste 3 y 2!'
                      : `¡${winnerName} cantó 3 y 2!`}
                </h2>
                <div className="space-y-1">
                  {state.players.map((player, s) => (
                    <div
                      key={player.id}
                      className={`flex items-center gap-2 rounded-xl px-2 py-1 ${
                        s === state.winnerSeat ? 'bg-amber-400/25 ring-1 ring-amber-300' : 'bg-black/25'
                      }`}
                    >
                      <span className="flex w-24 shrink-0 items-center gap-1 text-left text-xs font-semibold sm:w-32 sm:text-sm">
                        {s === state.winnerSeat && <Trophy className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />}
                        <span className="truncate">{s === seat ? 'Tú' : player.name}</span>
                        <span className="shrink-0 text-amber-300">{state.wins[s]}</span>
                      </span>
                      <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                        {state.hands[s].map((c) => (
                          <PlayingCard key={c.id} card={c} heightVar="--rh" plain />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {state.phase === 'roundEnd' &&
                  (seat === nextDealer ? (
                    <button type="button" onClick={() => onMove({ type: 'nextRound' })} className={PANEL_BUTTON}>
                      Repartir y seguir
                    </button>
                  ) : (
                    <p className="text-xs text-amber-50/80 sm:text-sm">
                      Esperando a {state.players[nextDealer].name} para repartir...
                    </p>
                  ))}
                {state.phase === 'gameOver' && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {resultFooter}
                    {onLeave && (
                      <button type="button" onClick={onLeave} className={PANEL_BUTTON_QUIET}>
                        Salir
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <FlightLayer flights={flights} onDone={endFlight} />
          <TableNotices connection={connection} notice={notice} />
          {roomLabel && <span className="sr-only">{roomLabel}</span>}
        </>
      }
    />
  );
}
