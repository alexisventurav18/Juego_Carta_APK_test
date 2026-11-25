import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { resolveAvatarCode } from '../avatar/resolve';
import { Check, Layers, Shuffle, Skull, X } from 'lucide-react';
import { rankLabel } from '@/games/cards';
import { CAGAO_CARD_ID, type CagaoMove, type CagaoState } from '@/games/cagao';
import { isBotPlayer } from '@/games/shared';
import { useElCagaoGame } from '@/hooks/useElCagaoGame';
import { useWinReward } from '@/hooks/useWinReward';
import { GAME_ENVIRONMENTS } from '@/lib/visualPrefs';
import { useCagaoDealIntro } from '../useDealIntro';
import DealerReveal from '../DealerReveal';
import DefeatNotice from '../DefeatNotice';
import VictoryCelebration from '../VictoryCelebration';
import FlightLayer, { type Flight } from './FlightLayer';
import TableLayout from '../table/TableLayout';
import { useStartHint } from '../table/useStartHint';
import { CORNER_CHIP, LeaveButton, OptionsButton, TableNotices, TurnSound } from '../table/chips';
import { centerOf, useFlights } from '../table/useFlights';
import { HandFan } from './Fans';
import PlayerSeat, { SeatPlaque } from './PlayerSeat';
import PlayingCard from './PlayingCard';
import type { Card } from './types';

export interface GameTableProps {
  state: CagaoState;
  seat: number;
  onMove: (move: CagaoMove) => void;
  /** Botón de salir dentro de la mesa (ocupa todo el viewport). */
  onLeave?: () => void;
  /** Texto de la sala o partida, visible en la hoja de pares. */
  roomLabel?: string;
  connection?: 'connected' | 'connecting' | 'offline';
  onRetry?: () => void;
  /** Aviso de error o información pasajera. */
  notice?: string | null;
  /** Contenido extra del resultado (p. ej. el botón "Jugar otra partida"). */
  resultFooter?: ReactNode;
  /** Revancha inmediata en la pantalla de fin de partida (online y sin conexión). */
  onRematch?: () => void;
  /**
   * Aviso de cuándo se está repartiendo en pantalla: mientras el reparto está activo nadie
   * juega (ni el humano, que ya lo bloquea la mesa, ni los bots, que esperan a que termine).
   */
  onDealingChange?: (dealing: boolean) => void;
}

/** Giro estable (±14°) a partir del id de la carta, para que la pila de pares se vea natural. */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 29) - 14;
}

export default function GameTable({
  state,
  seat,
  onMove,
  onLeave,
  roomLabel,
  connection,
  onRetry,
  notice,
  resultFooter,
  onRematch,
  onDealingChange,
}: GameTableProps) {
  const game = useElCagaoGame({ state, seat, onMove });
  const { event } = game;
  const winReward = useWinReward(state, seat);
  const [dealerOpen, setDealerOpen] = useState(state.roundNo === 1 && !state.players.some(isBotPlayer));
  // Intro de reparto (El Cagao no tenía): se baraja y la mano de cada jugador aparece en su
  // oleada, con el mazo visible en el centro. Empieza al cerrarse el sorteo del repartidor, y
  // mientras dura nadie juega: ni el humano ni los bots.
  const deal = useCagaoDealIntro(state.roundNo, state.players.length, !dealerOpen);
  useEffect(() => {
    onDealingChange?.(deal.dealing);
  }, [deal.dealing, onDealingChange]);
  /** Tu turno, pero nunca mientras se reparte. */
  const myTurn = game.myTurn && !deal.dealing;
  const [endNoticeDismissed, setEndNoticeDismissed] = useState(false);
  const [pairsOpen, setPairsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { flights, spawn, endFlight, registerAnchor, anchorCenter } = useFlights();

  const boardRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const lastEventSeq = useRef(event?.seq ?? 0);
  const lastPairCount = useRef(state.pairs.length);

  const names = state.players.map((p, s) => (s === seat ? 'Tú' : p.name));
  const loserName = state.loserSeat !== null ? state.players[state.loserSeat].name : '';

  // Cada robo: una carta boca abajo vuela del rival a quien la jaló; si hace par, el par va a la pila.
  useEffect(() => {
    if (!event || event.seq === lastEventSeq.current) return;
    lastEventSeq.current = event.seq;
    const from = anchorCenter(event.from) ?? centerOf(handRef.current);
    const to = anchorCenter(event.by) ?? centerOf(handRef.current);
    const pile = centerOf(pileRef.current);
    const items: Omit<Flight, 'id'>[] = [];
    if (from && to) {
      items.push({ from, to, card: null, heightVar: '--oh', durationMs: 520 });
    }
    if (event.pair && to && pile) {
      event.pair.forEach((card, i) =>
        items.push({
          from: to,
          to: { x: pile.x + (i ? 10 : -10), y: pile.y },
          card,
          heightVar: '--ph',
          delayMs: 520 + i * 70,
          durationMs: 480,
          endRotate: i ? 8 : -8,
        }),
      );
    }
    if (items.length > 0) spawn(items);
  }, [event, spawn, anchorCenter]);

  // Pares que bajan los rivales en la fase inicial: vuelan de su asiento al centro.
  useEffect(() => {
    const before = lastPairCount.current;
    lastPairCount.current = state.pairs.length;
    if (state.pairs.length <= before) return;
    const pile = centerOf(pileRef.current);
    if (!pile) return;
    const fresh = state.pairs.slice(before).filter((p) => p.seat !== seat).slice(0, 4);
    const items: Omit<Flight, 'id'>[] = [];
    fresh.forEach((pair, k) => {
      const from = anchorCenter(pair.seat);
      if (!from) return;
      pair.cards.forEach((card, i) =>
        items.push({
          from,
          to: { x: pile.x + (i ? 10 : -10), y: pile.y },
          card,
          heightVar: '--ph',
          delayMs: k * 140 + i * 60,
          durationMs: 480,
          endRotate: i ? 8 : -8,
        }),
      );
    });
    if (items.length > 0) spawn(items);
  }, [state.pairs, seat, spawn, anchorCenter]);

  /** Baja el par de una carta de tu mano y hace volar las dos hacia la pila central. */
  const pairWithFlight = useCallback(
    (card: Card): boolean => {
      // Mientras se reparte no se baja nada: la mano todavía no se ve completa.
      if (deal.dealing) return false;
      const twin = game.twinOf(card.id);
      const pile = centerOf(pileRef.current);
      const origins = twin
        ? [card, twin].map((c) => centerOf(handRef.current?.querySelector(`[data-hand-id="${c.id}"]`)))
        : [];
      const pair = game.pairByCard(card.id);
      if (!pair || !pile) return false;
      pair.forEach((c, i) => {
        const from = origins[i];
        if (from) {
          spawn([
            {
              from,
              to: { x: pile.x + (i ? 10 : -10), y: pile.y },
              card: c,
              heightVar: '--ch',
              durationMs: 480,
              delayMs: i * 60,
              endRotate: i ? 8 : -8,
            },
          ]);
        }
      });
      return true;
    },
    [game, spawn, deal.dealing],
  );

  const pickFromSeat = (s: number, index: number) => {
    if (myTurn && game.stealableSeats.includes(s)) game.drawAt(index, s);
  };

  // Los avisos de instrucciones salen solo al inicio de la partida (hasta que termina tu primer turno).
  const showStartHint = useStartHint(myTurn, state.roundNo, game.gameOver || game.iAmOut);

  const hint = (() => {
    if (deal.dealing) {
      if (deal.shuffling) return 'Barajando el mazo...';
      if (deal.dealingTo !== null) return `Repartiendo a ${names[deal.dealingTo]}...`;
      return 'Repartiendo las cartas...';
    }
    if (game.pairing) {
      if (game.pairableIds.size > 0) return 'Baja tus pares: toca una carta con pareja o arrástrala a la mesa.';
      return '¡Listo! Esperando a que los demás bajen sus pares...';
    }
    if (!game.playing) return '';
    if (game.iAmOut) return '¡Te salvaste! Mira cómo termina la partida.';
    if (myTurn) return 'Tu turno: elige a quién robarle una carta. ¡A ciegas!';
    if (game.stealableSeats.includes(seat)) return `${names[state.turn]} está eligiendo a quién robarle...`;
    return `${names[state.turn]} está robando una carta...`;
  })();

  const turnLabel = deal.dealing ? 'Reparto' : game.gameOver ? 'Fin' : game.pairing ? 'Bajando pares' : myTurn ? 'Tu turno' : names[state.turn];
  // Aviso persistente mientras tengas el A♠: si te quedas con él al final, pierdes.
  const hasCagao = game.playing && !game.iAmOut && game.hand.some((card) => card.id === CAGAO_CARD_ID);
  const lastPairs = state.pairs.slice(-4);
  const showDropHint = game.pairing && game.pairableIds.size > 0;

  const renderSeat = (s: number, side: 'left' | 'top' | 'right') => (
    <PlayerSeat
      key={s}
      side={side}
      seat={s}
      name={state.players[s].name}
      avatar={resolveAvatarCode(state.players[s], s === seat)}
      // El abanico del rival aparece en su oleada del reparto, no de golpe al empezar.
      count={deal.isSeatDealt(s) ? state.hands[s].length : 0}
      isTurn={game.playing && !deal.dealing && state.turn === s}
      isVictim={game.victimSeat === s}
      out={state.hands[s].length === 0 && !game.pairing}
      pickable={myTurn && game.stealableSeats.includes(s)}
      onPick={pickFromSeat}
      registerAnchor={registerAnchor}
      level={state.players[s].level}
      // Con tres rivales arriba (6 jugadores) la placa va encima del abanico: en fila no caben los
      // tres sin recortar los nombres hasta perderlos.
      stacked={side === 'top' && game.layout.top.length >= 3}
    />
  );

  return (
    <TableLayout
      accent={GAME_ENVIRONMENTS[state.game].accent}
      controlsLeft={
        <>
          <LeaveButton onLeave={onLeave} />
          <button
            type="button"
            onClick={() => setPairsOpen(true)}
            aria-label={`Pares bajados: ${state.pairs.length}`}
            className={`${CORNER_CHIP} w-[4.5rem] justify-center`}
          >
            <Layers className="h-4 w-4" aria-hidden />
            {state.pairs.length}
          </button>
        </>
      }
      // Con tres rivales arriba (6 jugadores) cada abanico cede ancho para que las placas no se recorten.
      vars={{ '--top-avail': game.layout.top.length >= 3 ? '13dvw' : '16dvw' } as CSSProperties}
      topSeats={game.layout.top.map((s) => renderSeat(s, 'top'))}
      controlsCenter={<TurnSound label={turnLabel} myTurn={myTurn} showFlow />}
      controlsRight={<OptionsButton />}
      hint={
        <>
          {/* Aviso de la última jugada: flota con la pista sobre la franja inferior del tablero;
              tiene precedencia sobre la pista inicial (que se esconde mientras hay aviso). */}
          {event && game.playing && (
            <div
              key={event.seq}
              role="status"
              className={`animate-combo-label flex max-w-full items-center gap-1.5 rounded-xl px-3 py-0.5 text-center text-[11px] ring-1 sm:text-xs ${
                event.pair
                  ? 'bg-amber-500/80 font-semibold text-stone-900 ring-amber-200'
                  : 'bg-black/55 text-amber-50 ring-white/15'
              }`}
            >
              <span>
                {event.pair
                  ? event.by === seat
                    ? `Robaste a ${names[event.from]} y bajaste par de ${rankLabel(event.pair[0])}.`
                    : event.from === seat
                      ? `${names[event.by]} te robó y bajó par de ${rankLabel(event.pair[0])}.`
                      : `${names[event.by]} bajó par de ${rankLabel(event.pair[0])}.`
                  : event.by === seat
                    ? `Le robaste una carta a ${names[event.from]}.`
                    : event.from === seat
                      ? `${names[event.by]} te robó una carta.`
                      : `${names[event.by]} le robó una carta a ${names[event.from]}.`}
                {event.outSeats.length > 0 && ` ${event.outSeats.map((s) => names[s]).join(' y ')} se salvó.`}
              </span>
            </div>
          )}
          {/* La pista inicial solo se ve si no hay aviso de última jugada: la pista flota sobre
              la franja inferior del tablero y los dos elementos juntos se partían en dos líneas. */}
          {!event && showStartHint && hint && (
            <p className="pointer-events-none max-w-full rounded-full bg-black/55 px-3 py-0.5 text-center text-[11px] font-medium leading-tight text-amber-50 ring-1 ring-white/10 sm:text-xs">
              {hint}
            </p>
          )}
        </>
      }
      left={game.layout.left !== null && renderSeat(game.layout.left, 'left')}
      right={game.layout.right !== null && renderSeat(game.layout.right, 'right')}
      center={
        <>
          {/* Tablero de madera en perspectiva 2.5D. Los textos van fuera de la parte inclinada. */}
          <div className="absolute inset-0 [perspective:1100px]">
            <div
              ref={boardRef}
              className={`cagao-board absolute inset-0 rounded-[3.5%] [transform-origin:50%_100%] [transform:rotateX(16deg)] ${
                dragging && showDropHint ? 'cagao-board-drop' : ''
              }`}
            >
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[min(78%,22dvh)] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-amber-200/35" />
              <div ref={pileRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative flex items-center justify-center">
                  {state.pairs.length === 0 ? (
                    <span className="block rounded-md border-2 border-dashed border-amber-100/40" style={{ height: 'var(--ph)', aspectRatio: '2.5/3.5' }} />
                  ) : (
                    lastPairs.flatMap((pair) => pair.cards).map((card, i, all) => (
                      <span
                        key={card.id}
                        className={`${i === all.length - 1 || i === all.length - 2 ? 'pile-land' : ''} absolute`}
                        style={{ transform: `rotate(${tilt(card.id)}deg) translate(${(i - all.length / 2) * 3}px, ${(i % 2) * 3}px)` }}
                      >
                        <PlayingCard card={card} heightVar="--ph" />
                      </span>
                    ))
                  )}
                  {state.pairs.length > 0 && (
                    <span style={{ height: 'var(--ph)', aspectRatio: '2.5/3.5' }} className="invisible block" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mazo del reparto: se baraja (se sacude a cada paso) y de ahí salen las manos, una por oleada. */}
          {deal.dealing && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <span
                key={deal.shuffling ? deal.shuffleFrame : 'reparto'}
                className={`relative block ${deal.shuffling ? 'card-wiggle' : ''}`}
                role="img"
                aria-label="Barajando y repartiendo las cartas"
              >
                <span className="absolute inset-0 translate-x-[3px] -translate-y-[3px]">
                  <PlayingCard faceDown heightVar="--ph" />
                </span>
                <span className="absolute inset-0 translate-x-[1.5px] -translate-y-[1.5px]">
                  <PlayingCard faceDown heightVar="--ph" />
                </span>
                <PlayingCard faceDown heightVar="--ph" />
              </span>
            </div>
          )}

          {/* (El aviso de la última jugada vive en el carril de la pista, bajo el tablero.) */}
        </>
      }
      bottomLeft={
        <SeatPlaque
          name={state.players[seat].name}
          avatar={resolveAvatarCode(state.players[seat], true)}
          isTurn={myTurn}
          out={game.iAmOut}
          isMe
          level={state.players[seat].level}
        />
      }
      bottomCenter={
        game.iAmOut ? (
          <p className="flex items-center gap-2 pb-6 text-sm font-bold text-emerald-200">
            <Check className="h-4 w-4" aria-hidden />
            Sin cartas: ¡te salvaste!
          </p>
        ) : (
          <div className="flex min-w-0 flex-col items-center gap-1">
            {hasCagao && (
              <p
                role="alert"
                className="canta-pulse pointer-events-none z-30 whitespace-nowrap rounded-full bg-rose-600 px-3 py-1 text-[13px] font-bold text-white shadow-lg"
              >
                ¡Tienes el A♠! Si te quedas con él, pierdes
              </p>
            )}
            <HandFan
            // Tu mano aparece en tu oleada del reparto, no de golpe al empezar.
            cards={deal.isSeatDealt(seat) ? game.shownHand : []}
            heightVar="--ch"
            avail="min(56dvw, 620px)"
            markedIds={game.pairableIds}
            twinOf={game.twinOf}
            highlightId={game.newCardId}
            interactive={game.pairing && !deal.dealing}
            canDrag={(card) => !deal.dealing && game.pairableIds.has(card.id)}
            dropRef={boardRef}
            onTap={pairWithFlight}
            onDrop={(card) => pairWithFlight(card)}
            onDraggingChange={setDragging}
            containerRef={(el) => {
              (handRef as { current: HTMLDivElement | null }).current = el;
              if (el) registerAnchor(seat, el);
            }}
          />
          </div>
        )
      }
      bottomRight={
        <>
          {game.pairing && (
            <button
              type="button"
              onClick={game.pairAll}
              disabled={deal.dealing || game.pairableIds.size === 0}
              className="cagao-side-btn min-h-[44px] w-full touch-manipulation rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-2 py-2 text-[11px] font-extrabold leading-tight text-stone-900 shadow ring-1 ring-amber-100/60 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 sm:text-xs"
            >
              Bajar todos los pares
            </button>
          )}
          <button
            type="button"
            onClick={game.shuffleHand}
            disabled={deal.dealing || game.hand.length < 2}
            className="cagao-side-btn flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-black/45 px-2 py-2 text-[11px] font-bold text-amber-50 ring-1 ring-amber-200/40 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 sm:text-xs"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden />
            Mezclar mano
          </button>
        </>
      }
      overlays={
        <>
      {dealerOpen && (
        <DealerReveal players={state.players} dealer={state.dealer} onDone={() => setDealerOpen(false)} />
      )}
      {game.gameOver &&
        !endNoticeDismissed &&
        (game.iLost ? (
          <DefeatNotice
            title="¡Eres El Cagao!"
            message="Te quedaste con el A♠ y no pudiste emparejarlo. ¡Pide la revancha!"
            continueLabel="Continuar"
            onRematch={onRematch}
            onContinue={() => setEndNoticeDismissed(true)}
          />
        ) : (
          <VictoryCelebration
            title="¡TE SALVASTE!"
            message={`${loserName} se quedó con El Cagao.`}
            continueLabel="Continuar"
            rewardCoins={game.iLost ? null : (winReward?.coins ?? null)}
            xpGain={game.iLost ? null : (winReward?.xpGain ?? null)}
            onRematch={onRematch}
            onContinue={() => setEndNoticeDismissed(true)}
          />
        ))}

      {game.gameOver && endNoticeDismissed && (
        <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-black/55 p-2 sm:p-3">
          <div className="game-end-panel my-auto max-h-full w-full max-w-2xl space-y-1.5 overflow-y-auto rounded-2xl bg-[#3a2010] p-2.5 text-center ring-2 ring-amber-300/50 sm:space-y-2 sm:p-4">
            <h2 className="text-base font-extrabold sm:text-xl">
              {game.iLost ? '¡Te quedaste con El Cagao!' : `${loserName} se quedó con El Cagao`}
            </h2>
            <div className="game-end-rows space-y-1 text-left text-xs sm:text-base">
              {state.finishOrder.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 sm:gap-2 sm:px-3">
                  <span className="w-5 shrink-0 font-bold tabular-nums text-amber-200">{i + 1}º</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{names[s]}</span>
                  <span className="flex shrink-0 items-center gap-1 text-emerald-200">
                    <Check className="h-3 w-3" aria-hidden />
                    Se salvó
                  </span>
                </div>
              ))}
              {state.loserSeat !== null && (
                <div
                  style={{ '--rh': 'clamp(44px, 12dvh, 90px)' } as CSSProperties}
                  className="game-end-loser flex items-center gap-2 rounded-xl bg-rose-600/30 px-3 py-1.5 ring-1 ring-rose-300"
                >
                  <Skull className="h-4 w-4 shrink-0 text-rose-200" aria-hidden />
                  <span className="min-w-0 flex-1 font-bold">
                    <span className="block truncate">{names[state.loserSeat]}</span>
                    <span className="block text-rose-100">El Cagao</span>
                  </span>
                  {state.hands[state.loserSeat].map((card) => (
                    <PlayingCard key={card.id} card={card} heightVar="--rh" />
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {resultFooter}
              {onLeave && (
                <button
                  type="button"
                  onClick={onLeave}
                  className="min-h-[44px] rounded-lg bg-stone-200 px-6 py-2 text-xs font-bold text-stone-900 active:scale-95 sm:text-sm"
                >
                  Salir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {pairsOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3" onClick={() => setPairsOpen(false)}>
          <div
            role="dialog"
            aria-label="Pares bajados"
            className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 text-stone-900"
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
                      {names[s]} · {mine.length} {mine.length === 1 ? 'par' : 'pares'}
                    </p>
                    <div style={{ '--sh': 'clamp(40px, 12dvh, 64px)' } as CSSProperties} className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {mine.map((p) => (
                        <span key={p.cards[0].id} className="flex items-center gap-0.5">
                          <PlayingCard card={p.cards[0]} heightVar="--sh" />
                          <PlayingCard card={p.cards[1]} heightVar="--sh" />
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

          <FlightLayer flights={flights} onDone={endFlight} />
          <TableNotices connection={connection} notice={notice} onRetry={onRetry} />
        </>
      }
    />
  );
}
