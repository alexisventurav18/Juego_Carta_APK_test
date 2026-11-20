import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Layers, Trophy } from 'lucide-react';
import { rankName } from '@/games/cards';
import { HAND_SIZE, TABLE_SIZE, type RobaitoEvent, type RobaitoMove, type RobaitoState } from '@/games/robaito';
import { isBotPlayer } from '@/games/shared';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useRobaitoGame } from '@/hooks/useRobaitoGame';
import { useWinReward } from '@/hooks/useWinReward';
import { GAME_ENVIRONMENTS } from '@/lib/visualPrefs';
import { resolveAvatarCode } from '../avatar/resolve';
import { DorsoUI } from '../CartaUI';
import DealerReveal from '../DealerReveal';
import DefeatNotice from '../DefeatNotice';
import FlightLayer, { type Flight } from '../cagao/FlightLayer';
import { HandFan } from '../cagao/Fans';
import PlayerSeat, { SeatPlaque } from '../cagao/PlayerSeat';
import PlayingCard from '../cagao/PlayingCard';
import TableLayout from '../table/TableLayout';
import { CORNER_CHIP, LeaveButton, TableNotices, TurnSound } from '../table/chips';
import { TB_DROP, TB_MAIN, TB_SING } from '../table/styles';
import { useDealFlights } from '../table/useDealFlights';
import { centerOf, useFlights } from '../table/useFlights';
import { useStartHint } from '../table/useStartHint';
import { useDealIntro } from '../useDealIntro';
import VictoryCelebration from '../VictoryCelebration';
import { PANEL_BUTTON_QUIET } from '../wood/styles';
import PilePad from './PilePad';

export interface RobaitoTableProps {
  state: RobaitoState;
  seat: number;
  onMove: (move: RobaitoMove) => void;
  /** Botón de salir dentro de la mesa (ocupa todo el viewport). */
  onLeave?: () => void;
  /** Texto de la sala o partida. */
  roomLabel?: string;
  connection?: 'connected' | 'connecting' | 'offline';
  onRetry?: () => void;
  /** Aviso de error o información pasajera. */
  notice?: string | null;
  /** Contenido extra del resultado (p. ej. el botón "Jugar otra partida"). */
  resultFooter?: ReactNode;
  /** Revancha inmediata en la pantalla de fin de partida (solo sin conexión). */
  onRematch?: () => void;
  /**
   * Aviso de cuándo se está repartiendo en pantalla: mientras el reparto está activo nadie
   * juega (ni el humano, que ya lo bloquea la mesa, ni los bots, que esperan a que termine).
   */
  onDealingChange?: (dealing: boolean) => void;
}

const VARS = {
  '--th': 'clamp(40px, 16.2dvh, 112px)',
  '--sh': 'clamp(34px, 12.5dvh, 84px)',
} as CSSProperties;

/** Tiempo (ms) que tarda la animación de una carta jugada hasta llegar al centro. */
const PLAY_FLIGHT_MS = 340;

function cardsWord(n: number): string {
  return n === 1 ? '1 carta' : `${n} cartas`;
}

/** Frase con la que se anuncia la última jugada. */
function describeEvent(event: RobaitoEvent, seat: number, names: string[]): string {
  const me = event.by === seat;
  const who = names[event.by];
  const rank = rankName(event.card.rank);
  let text: string;
  if (event.kind === 'steal') {
    const total = event.stolen.reduce((sum, s) => sum + s.count, 0);
    const victims = event.stolen.map((s) => (s.seat === seat ? 'ti' : names[s.seat])).join(' y ');
    text = me
      ? `¡Robaíto! Con el ${rank} le robaste ${cardsWord(total)} a ${victims}.`
      : event.stolen.some((s) => s.seat === seat)
        ? `¡${who} te robó el paquete (${cardsWord(total)}) con un ${rank}!`
        : `¡Robaíto! ${who} le robó ${cardsWord(total)} a ${victims} con un ${rank}.`;
  } else if (event.kind === 'capture') {
    text = me
      ? `Levantaste ${cardsWord(event.gained)} con el ${rank}.`
      : `${who} levantó ${cardsWord(event.gained)} con un ${rank}.`;
  } else {
    text = me ? `Botaste el ${rank} a la mesa.` : `${who} botó un ${rank} a la mesa.`;
  }
  if (event.redeal) text += ' Se reparten cartas nuevas.';
  if (event.swept > 0) text += ` Las ${event.swept} cartas sueltas pasan al último que se llevó cartas.`;
  return text;
}

/**
 * Mesa de El Robaíto. Mismo esqueleto, misma mano en abanico, mismos vuelos de cartas y mismos sonidos que
 * los otros juegos. Toca una carta para elegirla (se marca qué se llevaría) y tócala otra vez, pulsa el botón
 * o arrástrala al centro para jugarla.
 */
export default function RobaitoTable({ state, seat, onMove, onLeave, roomLabel, connection, onRetry, notice, resultFooter, onRematch, onDealingChange }: RobaitoTableProps) {
  const game = useRobaitoGame({ state, seat, onMove });
  const { event } = game;
  const winReward = useWinReward(state, seat);
  const seats = state.players.length;
  const [dragging, setDragging] = useState(false);
  const [dealerOpen, setDealerOpen] = useState(state.dealNo === 1 && !state.players.some(isBotPlayer));
  const [endNoticeDismissed, setEndNoticeDismissed] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pileRefs = useRef(new Map<number, HTMLElement>());
  const deal = useDealIntro(state.roundNo, seats, HAND_SIZE, TABLE_SIZE, !dealerOpen);
  // El reparto en pantalla también bloquea a los bots: la mesa avisa a quien la monta (sin
  // conexión o en sala) de cuándo se está repartiendo, y esa persona no pide jugadas de bot.
  useEffect(() => {
    onDealingChange?.(deal.dealing);
  }, [deal.dealing, onDealingChange]);
  const { flights, spawn, endFlight, registerAnchor, anchorCenter } = useFlights();
  const { playSound } = useGameSounds();

  const names = state.players.map((p, s) => (s === seat ? 'Tú' : p.name));
  const hand = game.hand;
  const myTurn = game.myTurn && !deal.dealing;
  const showStartHint = useStartHint(myTurn, state.roundNo, game.gameOver);
  const showEndNotice = game.gameOver && !endNoticeDismissed;

  const deckDisplayCount = deal.dealing
    ? state.deck.length + Math.max(0, deal.dealSteps - Math.min(deal.revealed, deal.dealSteps))
    : state.deck.length;

  const registerPile = useCallback(
    (s: number) => (el: HTMLElement | null) => {
      if (el) pileRefs.current.set(s, el);
      else pileRefs.current.delete(s);
    },
    [],
  );

  /* ------------------------- reparto, vuelos y sonidos ------------------------- */

  // El primer reparto: se baraja y cada carta sale del mazo hacia quien la recibe o hacia la mesa.
  const initialTable = useRef(state.table);
  const tableCardAt = useCallback((i: number) => initialTable.current[i] ?? null, []);
  useDealFlights({
    deal,
    roundKey: state.roundNo,
    seats,
    cardsPerHand: HAND_SIZE,
    deckRef,
    boardRef: tableRef,
    anchorCenter,
    spawn,
    tableCardAt,
    playSound,
  });

  // Cada jugada: la carta va del jugador al centro y de ahí al paquete; los paquetes robados cruzan la mesa.
  const lastSeq = useRef(event?.seq ?? 0);
  useEffect(() => {
    if (!event || event.seq === lastSeq.current) return;
    lastSeq.current = event.seq;
    const from = anchorCenter(event.by);
    const center = centerOf(tableRef.current);
    const mine = centerOf(pileRefs.current.get(event.by));
    const items: Omit<Flight, 'id'>[] = [];
    if (from && center) {
      items.push({ from, to: center, card: event.card, heightVar: '--th', durationMs: PLAY_FLIGHT_MS, plain: true });
    }
    if (event.kind !== 'discard' && center && mine) {
      const base = PLAY_FLIGHT_MS + 60;
      items.push({ from: center, to: mine, card: event.card, heightVar: '--th', delayMs: base, durationMs: 420, plain: true });
      event.tableTaken.forEach((card, i) =>
        items.push({
          from: { x: center.x + (i - (event.tableTaken.length - 1) / 2) * 18, y: center.y },
          to: mine,
          card,
          heightVar: '--th',
          delayMs: base + 40 + i * 60,
          durationMs: 420,
          plain: true,
        }),
      );
      event.stolen.forEach((stolen, k) => {
        const victim = centerOf(pileRefs.current.get(stolen.seat));
        if (!victim) return;
        for (let i = 0; i < Math.min(stolen.count, 4); i++) {
          items.push({
            from: victim,
            to: mine,
            card: null,
            heightVar: '--sh',
            delayMs: base + 80 + k * 120 + i * 70,
            durationMs: 480,
            endRotate: i % 2 ? 6 : -6,
          });
        }
      });
    }
    // Reparto de 4 cartas nuevas a cada jugador, tras terminarse la jugada.
    if (event.redeal) {
      const deck = centerOf(deckRef.current);
      if (deck) {
        for (let i = 0; i < HAND_SIZE * seats; i++) {
          const to = anchorCenter((event.by + 1 + (i % seats)) % seats);
          if (to) items.push({ from: deck, to, card: null, heightVar: '--oh', delayMs: 900 + i * 70, durationMs: 320 });
        }
      }
    }
    if (items.length > 0) spawn(items);
  }, [event, seats, spawn, anchorCenter]);

  /* ------------------------------ presentación ------------------------------ */

  const shownHand = useMemo(
    () => hand.filter((_, i) => deal.isHandDealt(seat, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hand, deal.dealing, deal.revealed, seat],
  );
  const dealtCount = (s: number) => state.hands[s].filter((_, i) => deal.isHandDealt(s, i)).length;
  const mineRef = useCallback((el: HTMLDivElement | null) => registerAnchor(seat, el), [registerAnchor, seat]);
  const selectedIds = useMemo(() => new Set(game.selected ? [game.selected.id] : []), [game.selected]);
  const liftedTableIds = useMemo(() => new Set(game.selectedOptions?.table.map((c) => c.id) ?? []), [game.selectedOptions]);
  const isTargeted = (s: number) => game.selectedOptions?.steals.includes(s) ?? false;

  const hint = (() => {
    if (!game.playing) return '';
    if (deal.dealing) return 'Repartiendo las cartas...';
    if (myTurn) {
      if (game.selectedKind === 'steal') return '¡Esa carta le roba el paquete a un rival! Tócala de nuevo para jugarla.';
      if (game.selectedKind === 'capture') return 'Esa carta levanta cartas de la mesa. Tócala de nuevo para jugarla.';
      if (game.selected) return 'No empareja con nada: se quedará en la mesa.';
      if (game.stealIds.size > 0) return '¡Puedes robar un paquete! Busca las cartas con aro dorado.';
      return 'Tu turno: elige una carta o arrástrala a la mesa.';
    }
    return `Turno de ${state.players[state.turn].name}...`;
  })();

  const turnLabel = game.gameOver ? 'Fin' : deal.dealing ? 'Reparto' : myTurn ? 'Tu turno' : names[state.turn];

  const renderSeat = (s: number, side: 'left' | 'top' | 'right') => (
    <PlayerSeat
      key={s}
      side={side}
      seat={s}
      name={state.players[s].name}
      avatar={resolveAvatarCode(state.players[s], false)}
      count={dealtCount(s)}
      isTurn={game.playing && !deal.dealing && state.turn === s}
      isVictim={isTargeted(s)}
      out={false}
      pickable={false}
      onPick={() => undefined}
      registerAnchor={registerAnchor}
      packetCount={state.piles[s].length}
    />
  );

  const pileOf = (s: number) => (
    <PilePad
      pile={state.piles[s]}
      name={state.players[s].name}
      mine={s === seat}
      targeted={isTargeted(s)}
      registerRef={registerPile(s)}
    />
  );

  const playButton = (() => {
    const disabled = !myTurn || !game.selected;
    const onClick = () => game.selected && game.play(game.selected);
    if (game.selectedKind === 'steal') {
      return (
        <button type="button" onClick={onClick} className={TB_SING}>
          ¡Robar paquete!
        </button>
      );
    }
    if (game.selectedKind === 'capture') {
      return (
        <button type="button" onClick={onClick} className={TB_MAIN}>
          Levantar cartas
        </button>
      );
    }
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={TB_DROP}>
        {game.selected ? 'Botar carta' : 'Jugar carta'}
      </button>
    );
  })();

  const standings = state.players
    .map((player, s) => ({ player, s, count: state.piles[s].length }))
    .sort((a, b) => b.count - a.count);
  const winnerNames = state.winnerSeats.map((s) => names[s]).join(' y ');
  const bestCount = state.winnerSeats.length > 0 ? state.piles[state.winnerSeats[0]].length : 0;

  return (
    <TableLayout
      accent={GAME_ENVIRONMENTS[state.game].accent}
      centerRef={boardRef}
      bottomCenterRef={mineRef}
      vars={VARS}
      topLeft={
        <>
          <LeaveButton onLeave={onLeave} />
          <span className={`${CORNER_CHIP} cursor-default`} title={`Cartas en el mazo: ${deckDisplayCount}`}>
            <Layers className="h-4 w-4 text-amber-300" aria-hidden />
            {deckDisplayCount}
          </span>
        </>
      }
      topCenter={game.layout.top.map((s) => (
        <div key={s} className="flex min-w-0 items-center justify-center gap-[clamp(6px,1.6dvw,16px)]">
          {renderSeat(s, 'top')}
          {pileOf(s)}
        </div>
      ))}
      topRight={<TurnSound label={turnLabel} myTurn={myTurn} />}
      left={game.layout.left !== null && renderSeat(game.layout.left, 'left')}
      right={game.layout.right !== null && renderSeat(game.layout.right, 'right')}
      center={
        <>
          {/* Tablero de madera en perspectiva 2.5D, igual que El Cagao */}
          <div aria-hidden className="pointer-events-none absolute inset-0 [perspective:1100px]">
            <div
              className={`cagao-board absolute inset-0 rounded-[3.5%] [transform-origin:50%_100%] [transform:rotateX(16deg)] ${
                dragging && myTurn ? 'cagao-board-drop' : ''
              }`}
            />
          </div>

          {/* Paquetes de los rivales de los costados: junto a su asiento */}
          {game.layout.left !== null && (
            <div className="absolute left-[1.5%] top-1/2 z-10 -translate-y-1/2">{pileOf(game.layout.left)}</div>
          )}
          {game.layout.right !== null && (
            <div className="absolute right-[1.5%] top-1/2 z-10 -translate-y-1/2">{pileOf(game.layout.right)}</div>
          )}

          {/* Mazo y cartas de la mesa */}
          <div className="absolute inset-x-[15%] bottom-[20%] top-[8%] z-10 flex items-center justify-center gap-[clamp(10px,3dvw,28px)]">
            <div className="flex shrink-0 flex-col items-center">
              <div ref={deckRef} className="relative" role="img" aria-label={`Mazo: ${deckDisplayCount} cartas`}>
                {deckDisplayCount > 0 ? (
                  <span className="block rounded-lg shadow-[2px_2px_0_rgba(255,255,255,0.18),4px_4px_0_rgba(255,255,255,0.1)]">
                    <DorsoUI className="h-[var(--th)]" />
                  </span>
                ) : (
                  <span className="block aspect-[2.5/3.5] h-[var(--th)] rounded-lg border-2 border-dashed border-amber-100/40" />
                )}
                <span className="pointer-events-none absolute -right-2 -top-2 z-10 btn-gold rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none tabular-nums shadow sm:text-xs">
                  {deckDisplayCount}
                </span>
              </div>
              <span className="-mt-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold leading-none text-amber-100 sm:text-xs">Mazo</span>
            </div>

            <div ref={tableRef} className="flex min-w-0 items-center justify-center" aria-label="Cartas de la mesa">
              {state.table.length === 0 ? (
                <span className="block aspect-[2.5/3.5] h-[var(--th)] rounded-lg border-2 border-dashed border-amber-100/40" />
              ) : (
                state.table.map((card, i) => {
                  if (!deal.isTableDealt(i)) return null;
                  const n = state.table.length;
                  const lifted = liftedTableIds.has(card.id);
                  return (
                    <span
                      key={card.id}
                      className={`pile-land relative block shrink-0 transition-transform duration-150 ${lifted ? '-translate-y-2' : ''}`}
                      style={{
                        marginLeft: i === 0 ? 0 : n > 6 ? 'calc(var(--th) * -0.4)' : n > 4 ? 'calc(var(--th) * -0.14)' : '6px',
                        zIndex: i + 1,
                      }}
                    >
                      <span className={`block rounded-[calc(var(--th)*0.07)] ${lifted ? 'ring-[3px] ring-yellow-300' : ''}`}>
                        <PlayingCard card={card} heightVar="--th" plain />
                      </span>
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Aviso de la última jugada */}
          {event && game.playing && (
            <div className="pointer-events-none absolute inset-x-0 top-1 z-30 flex justify-center px-1">
              <div
                key={event.seq}
                role="status"
                className={`animate-combo-label flex max-w-full items-center gap-1.5 rounded-xl px-3 py-1 text-center text-[11px] ring-1 sm:text-xs ${
                  event.kind === 'steal'
                    ? 'bg-amber-500/85 font-bold text-stone-900 ring-amber-200'
                    : event.kind === 'capture'
                      ? 'bg-lime-700/80 font-semibold text-lime-50 ring-lime-200/60'
                      : 'bg-black/55 text-amber-50 ring-white/15'
                }`}
              >
                {describeEvent(event, seat, names)}
              </div>
            </div>
          )}

          {game.playing && showStartHint && hint && (
            <p className="pointer-events-none absolute bottom-0 left-1/2 z-30 max-w-[96%] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-center text-[11px] font-medium leading-tight text-amber-50 ring-1 ring-white/10 sm:text-xs">
              {hint}
            </p>
          )}
        </>
      }
      bottomLeft={
        <div className="flex min-w-0 flex-col items-start gap-1">
          {pileOf(seat)}
          <SeatPlaque
            name={state.players[seat].name}
            avatar={resolveAvatarCode(state.players[seat], true)}
            isTurn={myTurn}
            out={false}
            isMe
            packetCount={state.piles[seat].length}
          />
        </div>
      }
      bottomCenter={
        <HandFan
          cards={shownHand}
          heightVar="--ch"
          avail="min(54dvw, 600px)"
          plain
          selectedIds={selectedIds}
          markedIds={game.stealIds}
          playableIds={game.liftIds}
          interactive={myTurn}
          canDrag={() => myTurn}
          dropRef={boardRef}
          onTap={game.tapCard}
          onDrop={(card) => {
            if (!myTurn) return false;
            game.play(card);
            return true;
          }}
          onDragStart={(card) => game.setCardId(card.id)}
          onDraggingChange={setDragging}
        />
      }
      bottomRight={game.playing ? <div className="flex w-full flex-col gap-1">{playButton}</div> : null}
      overlays={
        <>
          {dealerOpen && <DealerReveal players={state.players} dealer={state.dealer} onDone={() => setDealerOpen(false)} />}

          {showEndNotice &&
            (game.iWon ? (
              <VictoryCelebration
                title={game.tie ? '¡EMPATE!' : '¡GANASTE!'}
                message={
                  game.tie
                    ? `Empataste con ${state.winnerSeats
                        .filter((s) => s !== seat)
                        .map((s) => names[s])
                        .join(' y ')} con ${bestCount} cartas.`
                    : `Juntaste ${bestCount} cartas en tu paquete.`
                }
                continueLabel="Continuar"
                rewardCoins={game.iWon ? winReward : null}
                onRematch={onRematch}
                onContinue={() => setEndNoticeDismissed(true)}
              />
            ) : (
              <DefeatNotice
                title="Perdiste la partida"
                message={`${winnerNames} ${state.winnerSeats.length > 1 ? 'empataron con' : 'juntó'} ${bestCount} cartas.`}
                continueLabel="Ver resultados"
                onRematch={onRematch}
                onContinue={() => setEndNoticeDismissed(true)}
              />
            ))}

          {game.gameOver && endNoticeDismissed && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-2 sm:p-3">
              <div
                style={{ '--rh': 'clamp(34px, 10.6dvh, 67px)' } as CSSProperties}
                className="wood-panel max-h-[calc(100dvh_-_var(--sat)_-_var(--sab)_-_1rem)] w-full max-w-md space-y-1.5 overflow-y-auto p-2 text-center sm:space-y-2 sm:p-4"
              >
                <h2 className="text-sm font-extrabold sm:text-xl">
                  {game.tie ? `¡Empate entre ${winnerNames}!` : game.iWon ? '¡Ganaste la partida!' : `${winnerNames} ganó la partida`}
                </h2>
                <div className="space-y-1">
                  {standings.map(({ player, s, count }) => {
                    const won = state.winnerSeats.includes(s);
                    const top = state.piles[s][state.piles[s].length - 1];
                    return (
                      <div
                        key={player.id}
                        className={`flex items-center gap-1.5 rounded-xl px-1.5 py-1 sm:gap-2 sm:px-2 ${won ? 'bg-amber-400/25 ring-1 ring-amber-300' : 'bg-black/25'}`}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs font-semibold sm:text-sm">
                          {won && <Trophy className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />}
                          <span className="truncate">{names[s]}</span>
                        </span>
                        <span className="shrink-0 text-xs font-extrabold tabular-nums text-amber-300 sm:text-sm">{cardsWord(count)}</span>
                        {top && <PlayingCard card={top} heightVar="--rh" plain />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {resultFooter}
                  {onLeave && (
                    <button type="button" onClick={onLeave} className={PANEL_BUTTON_QUIET}>
                      Salir
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <FlightLayer flights={flights} onDone={endFlight} />
          <TableNotices connection={connection} notice={notice} onRetry={onRetry} />
          {roomLabel && <span className="sr-only">{roomLabel}</span>}
        </>
      }
    />
  );
}
