import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Layers, Lock, Sparkles, X } from 'lucide-react';
import {
  CASINO_TARGET,
  type CasinoMove,
  type CasinoState,
  closingNeeds,
  isCaptureForced,
  nextDealerSeat,
} from '@/games/casino';
import {
  canCapture,
  captureValues,
  convertValue,
  expansionToPairsValue,
  expansionValue,
  formationValue,
  isLegalCapture,
  raiseValue,
  tableItems,
} from '@/games/casinoCapture';
import type { Card } from '@/games/cards';
import { isBotPlayer, teamName, teamOf } from '@/games/shared';
import { useGameSounds } from '@/hooks/useGameSounds';
import CapturedPile from './CapturedPile';
import CaptureFlight from './CaptureFlight';
import CartaUI, { DorsoUI } from './CartaUI';
import ClosingZoneBanner, { type ClosingAlert } from './ClosingZoneBanner';
import DealerReveal from './DealerReveal';
import DefeatNotice from './DefeatNotice';
import RoundResultPanel from './RoundResultPanel';
import TableBuild from './TableBuild';
import { useDealIntro } from './useDealIntro';
import VictoryCelebration from './VictoryCelebration';
import FlightLayer from './cagao/FlightLayer';
import { HandFan } from './cagao/Fans';
import PlayerSeat, { SeatPlaque } from './cagao/PlayerSeat';
import type { Point } from './cagao/types';
import TableLayout from './table/TableLayout';
import { CORNER_CHIP, LeaveButton, TableNotices, TurnSound } from './table/chips';
import { seatLayout } from './table/seatLayout';
import { TB_DROP, TB_FORM, TB_MAIN } from './table/styles';
import { useDealFlights } from './table/useDealFlights';
import { centerOf, useFlights } from './table/useFlights';
import { PANEL_BUTTON_QUIET, CHIP_BUTTON } from './wood/styles';

interface CasinoTableProps {
  state: CasinoState;
  seat: number;
  onMove: (move: CasinoMove) => void;
  /** Botón de salir dentro de la mesa (ocupa todo el viewport). */
  onLeave?: () => void;
  /** Texto de la sala o partida, visible en la hoja de cartas capturadas. */
  roomLabel?: string;
  connection?: 'connected' | 'connecting' | 'offline';
  /** Aviso de error o información pasajera. */
  notice?: string | null;
  /** Contenido extra del panel de resultados (p. ej. el botón "Jugar otra partida"). */
  resultFooter?: ReactNode;
}

/** Cartas de la mesa suelta y dentro de combinaciones. */
const allTableCards = (st: CasinoState): Card[] => [...st.table, ...st.builds.flatMap((b) => b.cards)];

function tableTargetAt(point: Point): string | null {
  for (const el of document.elementsFromPoint(point.x, point.y)) {
    const id = el.closest('[data-table-id]')?.getAttribute('data-table-id');
    if (id) return id;
  }
  return null;
}

function isCasinoPointCard(card: { rank: number; suit: string }): boolean {
  return card.rank === 1 || (card.suit === 'diamantes' && card.rank === 10) || (card.suit === 'picas' && card.rank === 2);
}

/**
 * Mesa del Casino. Usa el mismo esqueleto, la misma mano en abanico, los mismos vuelos de cartas y los
 * mismos sonidos que El Cagao. Se juega igual con el dedo o con el ratón: toca una carta para elegirla,
 * toca las cartas de la mesa que quieres, y pulsa el botón; o arrastra la carta a la mesa (y suéltala
 * sobre una carta de la mesa para capturarla).
 */
export default function CasinoTable({ state, seat, onMove, onLeave, roomLabel, connection, notice, resultFooter }: CasinoTableProps) {
  const [cardId, setCardId] = useState<string | null>(null);
  const [capturedOpen, setCapturedOpen] = useState(false);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const deal = useDealIntro(state.roundNo, state.players.length);
  const deckDisplayCount = deal.dealing
    ? state.deck.length + Math.max(0, deal.dealSteps - Math.min(deal.revealed, deal.dealSteps))
    : state.deck.length;
  const [dealerOpen, setDealerOpen] = useState(state.roundNo === 1 && !state.players.some(isBotPlayer));
  const [endNoticeDismissedRound, setEndNoticeDismissedRound] = useState<number | null>(null);
  const [closingDismissedRound, setClosingDismissedRound] = useState<number | null>(null);
  const [pointCardId, setPointCardId] = useState<string | null>(null);
  const [captureFlightKey, setCaptureFlightKey] = useState<string | null>(null);
  const lastAnimatedCaptureKey = useRef<string | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { flights, spawn, endFlight, registerAnchor, anchorCenter } = useFlights();
  const { playSound, isMuted, toggleMute } = useGameSounds();

  const myTurn = state.phase === 'playing' && state.turn === seat && !deal.dealing;
  const card = state.hands[seat].find((c) => c.id === cardId) ?? null;
  const handAfter = card ? state.hands[seat].filter((c) => c.id !== card.id) : [];
  const items = tableItems(state.table, state.builds);
  const selectedItems = items.filter((item) => tableIds.includes(item.id));
  const selectedLoose = state.table.filter((c) => tableIds.includes(c.id));
  const selectedBuilds = state.builds.filter((build) => tableIds.includes(build.id));
  const capturedTotal = state.captured.reduce(
    (total, groups) => total + groups.reduce((groupTotal, group) => groupTotal + group.cards.length, 0),
    0,
  );
  const mustCapture = myTurn && isCaptureForced(state, seat);
  const cardCanCapture = card !== null && canCapture(card, items, seat);
  const captureReady = card !== null && isLegalCapture(card, selectedItems, seat);
  const canDrop = card !== null && selectedItems.length === 0 && !mustCapture;
  const canFormCombination = card !== null;
  const noBuildSelected = canFormCombination && selectedBuilds.length === 0;
  const sumValue = noBuildSelected ? formationValue('sum', card, selectedLoose, handAfter) : null;
  const pairsValue = noBuildSelected ? formationValue('pairs', card, selectedLoose, handAfter) : null;
  const raiseTarget =
    canFormCombination && selectedBuilds.length === 1 && selectedLoose.length === 0 ? selectedBuilds[0] : null;
  const raisedValue = raiseTarget && card ? raiseValue(card, raiseTarget, handAfter) : null;
  const expandTarget =
    canFormCombination && selectedBuilds.length === 1 && selectedLoose.length > 0 ? selectedBuilds[0] : null;
  const expandedPairsValue = expandTarget && card
    ? expansionToPairsValue(card, expandTarget, selectedLoose, handAfter)
    : null;
  const expandedValue = expandTarget && card
    ? expandedPairsValue ?? expansionValue(card, expandTarget, selectedLoose, handAfter)
    : null;
  const convertedValue = raiseTarget && card ? convertValue(card, raiseTarget, handAfter) : null;
  const mergeCard =
    sumValue !== null
      ? (state.table.find((c) => captureValues(c).includes(sumValue) && !tableIds.includes(c.id)) ?? null)
      : null;
  const nextDealer = nextDealerSeat(state);
  const showEndNotice = state.phase === 'gameOver' && endNoticeDismissedRound !== state.roundNo;
  const iWon = state.winnerTeam === teamOf(seat);
  const myTeam = teamOf(seat);
  const closingAlerts: ClosingAlert[] = [0, 1].flatMap((team) => {
    const needs = closingNeeds(state.scores[team]);
    if (!needs) return [];
    const entered = state.summary !== null && (state.summary.needs?.[team] ?? null) === null;
    return [{ team: teamName(state.players, team), score: state.scores[team], needs, entered }];
  });
  const showClosingAlert =
    closingAlerts.length > 0 && state.phase !== 'gameOver' && !deal.dealing && closingDismissedRound !== state.roundNo;

  const captureNotice = state.lastCapture;
  const currentCaptureKey = captureNotice
    ? `${state.roundNo}:${captureNotice.seat}:${captureNotice.card.id}:${captureNotice.capturedCount}:${captureNotice.virao ? 'v' : 'n'}`
    : null;

  useEffect(() => {
    if (!currentCaptureKey || currentCaptureKey === lastAnimatedCaptureKey.current) return;
    lastAnimatedCaptureKey.current = currentCaptureKey;
    setCaptureFlightKey(currentCaptureKey);
    const timer = window.setTimeout(() => setCaptureFlightKey(null), 950);
    return () => window.clearTimeout(timer);
  }, [currentCaptureKey]);

  /* ------------------------- reparto, vuelos y sonidos ------------------------- */

  const tableCardAt = useCallback((index: number) => state.table[index] ?? null, [state.table]);
  useDealFlights({
    deal,
    roundKey: state.roundNo,
    seats: state.players.length,
    cardsPerHand: 4,
    deckRef,
    boardRef,
    anchorCenter,
    spawn,
    tableCardAt,
    playSound,
  });

  // Jugadas de los demás: su carta vuela del asiento al tablero y, si capturan, se llevan las cartas a su asiento.
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === state || before.roundNo !== state.roundNo) return;
    let actor = -1;
    state.hands.forEach((hand, s) => {
      if (s !== seat && hand.length < before.hands[s].length) actor = s;
    });
    if (actor === -1) return;
    const board = centerOf(boardRef.current);
    const from = anchorCenter(actor);
    if (!board || !from) return;

    const nowCards = allTableCards(state);
    const nowIds = new Set(nowCards.map((c) => c.id));
    const beforeCards = allTableCards(before);
    const beforeIds = new Set(beforeCards.map((c) => c.id));
    const capture = state.lastCapture;
    const isNewCapture =
      capture !== null &&
      capture.seat === actor &&
      (before.lastCapture === null ||
        before.lastCapture.card.id !== capture.card.id ||
        before.lastCapture.capturedCount !== capture.capturedCount);

    if (isNewCapture && capture) {
      spawn([{ from, to: board, card: capture.card, heightVar: '--ch', durationMs: 420, plain: true }]);
      beforeCards
        .filter((c) => !nowIds.has(c.id))
        .slice(0, 10)
        .forEach((c, i) =>
          spawn([{ from: board, to: from, card: c, heightVar: '--ph', durationMs: 460, delayMs: 440 + i * 45, plain: true }]),
        );
      playSound('pairMatch');
    } else {
      nowCards
        .filter((c) => !beforeIds.has(c.id))
        .slice(0, 2)
        .forEach((c) => spawn([{ from, to: board, card: c, heightVar: '--ch', durationMs: 420, plain: true }]));
      playSound('cardSlide');
    }
  }, [state, seat, spawn, anchorCenter, playSound]);

  // Fin de la partida: ganaste o perdiste.
  useEffect(() => {
    if (state.phase !== 'gameOver') return;
    const timer = window.setTimeout(() => playSound(iWon ? 'win' : 'lose'), 500);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.roundNo, iWon, playSound]);

  /** Mi jugada: la carta vuela de la mano al tablero y, si capturo, las cartas de la mesa vuelan hacia mí. */
  const flyMyMove = (played: Card, captured: { id: string; cards: Card[] }[]) => {
    const board = centerOf(boardRef.current);
    const from =
      centerOf(document.querySelector(`[data-hand-id="${played.id}"]`)) ?? anchorCenter(seat);
    const mine = anchorCenter(seat);
    if (board && from) spawn([{ from, to: board, card: played, heightVar: '--ch', durationMs: 420, plain: true }]);
    if (mine) {
      captured
        .flatMap((item) => {
          const origin = centerOf(document.querySelector(`[data-table-id="${item.id}"]`)) ?? board;
          return item.cards.map((c) => ({ c, origin }));
        })
        .slice(0, 10)
        .forEach(({ c, origin }, i) => {
          if (origin) {
            spawn([{ from: origin, to: mine, card: c, heightVar: '--ph', durationMs: 460, delayMs: 440 + i * 45, plain: true }]);
          }
        });
    }
    playSound(captured.length > 0 ? 'pairMatch' : 'cardSlide');
  };

  const reset = () => {
    setCardId(null);
    setTableIds([]);
  };

  const pickCard = (id: string): boolean => {
    if (!myTurn) return false;
    setCardId((prev) => (prev === id ? null : id));
    setTableIds([]);
    return true;
  };

  const pickTableItem = (id: string) => {
    if (!myTurn || !card) return;
    setTableIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const submit = (move: CasinoMove, played: Card, captured: typeof selectedItems = []) => {
    flyMyMove(played, captured);
    onMove(move);
    reset();
  };

  const dropCard = (played: Card) => {
    if (isCasinoPointCard(played)) {
      setPointCardId(played.id);
      window.setTimeout(() => setPointCardId(null), 1000);
    }
    submit({ type: 'play', cardId: played.id, captureIds: [] }, played);
  };

  const capture = () => {
    if (card) submit({ type: 'play', cardId: card.id, captureIds: tableIds }, card, selectedItems);
  };
  const drop = () => {
    if (card) dropCard(card);
  };
  const buildSum = () => {
    if (card) submit({ type: 'build', cardId: card.id, kind: 'sum', tableIds: selectedLoose.map((c) => c.id) }, card);
  };
  const buildPairs = () => {
    if (card) submit({ type: 'build', cardId: card.id, kind: 'pairs', tableIds: selectedLoose.map((c) => c.id) }, card);
  };
  const raise = () => {
    if (card && raiseTarget) submit({ type: 'raise', cardId: card.id, buildId: raiseTarget.id }, card);
  };
  const expand = () => {
    if (card && expandTarget) {
      submit({ type: 'expand', cardId: card.id, buildId: expandTarget.id, tableIds: selectedLoose.map((c) => c.id) }, card);
    }
  };
  const convert = () => {
    if (card && raiseTarget) submit({ type: 'convert', cardId: card.id, buildId: raiseTarget.id }, card);
  };
  const buildSumAndPairs = () => {
    if (card && mergeCard) {
      submit(
        { type: 'build', cardId: card.id, kind: 'sum', tableIds: selectedLoose.map((c) => c.id), mergeId: mergeCard.id },
        card,
      );
    }
  };

  /** Soltar una carta sobre la mesa: si la sueltas sobre una carta de la mesa, intenta capturarla; si no, la tira. */
  const dropOnBoard = (played: Card, point: Point): boolean => {
    if (!myTurn) return false;
    const targetId = tableTargetAt(point);
    let ids = played.id === cardId ? tableIds : [];
    if (targetId && !ids.includes(targetId)) ids = [...ids, targetId];
    const chosen = items.filter((item) => ids.includes(item.id));
    if (chosen.length > 0) {
      if (isLegalCapture(played, chosen, seat)) {
        submit({ type: 'play', cardId: played.id, captureIds: ids }, played, chosen);
        return true;
      }
      // Captura no válida: la carta queda elegida con esa selección para que el aviso explique por qué.
      setCardId(played.id);
      setTableIds(ids);
      return false;
    }
    if (mustCapture) {
      setCardId(played.id);
      setTableIds([]);
      return false;
    }
    dropCard(played);
    return true;
  };

  const hint = (() => {
    if (state.phase !== 'playing') return '';
    if (deal.dealing) {
      if (deal.dealingTo === null) return 'Barajando el mazo...';
      if (deal.dealingTo === 'table') return 'Poniendo cartas en la mesa...';
      return `Repartiendo a ${state.players[deal.dealingTo].name}...`;
    }
    if (!myTurn) return `Turno de ${state.players[state.turn].name}.`;
    if (!card) return mustCapture
      ? 'Tienes una jugada para llevarte cartas: elige una carta que pueda capturar.'
      : 'Elige una carta de tu mano o arrástrala a la mesa.';
    if (captureReady) return 'Listo: te llevas las cartas seleccionadas.';
    if (expandedValue !== null) {
      return expandTarget?.kind === 'pairs'
        ? `Puedes apilar tu carta y las cartas sueltas sobre el par de ${expandedValue}.`
        : `Puedes ampliar la combinación a ${expandedValue} con tu carta y las cartas sueltas.`;
    }
    if (raisedValue !== null) return `Puedes subir la combinación a ${raisedValue} con tu carta.`;
    if (convertedValue !== null) {
      return raiseTarget?.kind === 'pairs'
        ? `Puedes añadir una carta de ${convertedValue} a tus pares.`
        : `Puedes convertir la sumatoria en pares de ${convertedValue}.`;
    }
    if (sumValue !== null && mergeCard) {
      return `Puedes formar una sumatoria de ${sumValue} y unirla a la carta ${sumValue} de la mesa para hacer pares.`;
    }
    if (sumValue !== null) return `Puedes formar una sumatoria de ${sumValue}.`;
    if (pairsValue !== null) return `Puedes formar pares de ${pairsValue}.`;
    if (selectedItems.length > 0) return 'Esa selección no es válida con tu carta.';
    if (mustCapture) {
      return cardCanCapture
        ? 'Tienes una jugada: elige las cartas de la mesa que te llevas.'
        : 'Con esta carta no puedes llevarte nada: elige otra carta.';
    }
    return 'Deja tu carta en la mesa (arrástrala) o une cartas sueltas para formar una combinación.';
  })();

  // Con muchos grupos en la mesa las cartas se achican solas para que nada quede fuera de pantalla.
  const mesaWeight = state.table.length + state.builds.length * 2.2;
  const mesaVars = (
    mesaWeight > 16
      ? { '--mesa-h': '8.5dvh', '--mesa-h-sm': '8.5dvh' }
      : mesaWeight > 10
        ? { '--mesa-h': '10.5dvh', '--mesa-h-sm': '10.5dvh' }
        : { '--mesa-h': '13.5dvh', '--mesa-h-sm': '13.5dvh' }
  ) as CSSProperties;

  const statusText =
    state.phase === 'gameOver' ? 'Fin' : state.phase === 'roundEnd' ? 'Fin de ronda' : deal.dealing ? 'Reparto' : '';
  const turnLabel =
    state.phase === 'playing' && !deal.dealing
      ? state.turn === seat
        ? 'Tu turno'
        : state.players[state.turn].name
      : statusText;
  const handAll = state.hands[seat];
  const shownHand = useMemo(
    () => handAll.filter((_, i) => deal.isHandDealt(seat, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handAll, deal.dealing, deal.revealed, seat],
  );
  const dealtCount = (s: number) => state.hands[s].filter((_, i) => deal.isHandDealt(s, i)).length;
  const layout = useMemo(() => seatLayout(state.players.length, seat), [state.players.length, seat]);
  const showRaise = raiseTarget !== null;
  const showExpand = expandTarget !== null;
  const showFormation = !showRaise && !showExpand;
  const playing = state.phase === 'playing';
  const playableIds = useMemo(
    () => new Set(myTurn ? shownHand.filter((c) => canCapture(c, items, seat)).map((c) => c.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myTurn, shownHand, state.table, state.builds, seat],
  );
  const selectedIds = useMemo(() => new Set(cardId ? [cardId] : []), [cardId]);
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
      tag={state.players.length >= 4 && teamOf(s) === myTeam ? 'Pareja' : undefined}
    />
  );

  const scoreChip = (team: 0 | 1, className: string) => {
    const mine = team === myTeam;
    const needs = closingNeeds(state.scores[team]);
    const progress = Math.min(100, (state.scores[team] / CASINO_TARGET) * 100);
    return (
      <div
        title={teamName(state.players, team)}
        className={`wood-block pointer-events-none absolute z-30 flex w-[clamp(64px,11dvw,96px)] flex-col rounded-lg px-1.5 py-0.5 ${className} ${
          mine ? 'ring-1 ring-amber-300' : ''
        }`}
      >
        <span className="flex items-center justify-between gap-1 text-[10px] font-semibold leading-tight text-amber-100">
          <span className="flex min-w-0 items-center gap-0.5 truncate">
            {needs && <Lock className="h-2.5 w-2.5 shrink-0 text-amber-300" aria-label="Cierre obligatorio" />}
            <span className="truncate">{mine ? 'Nosotros' : 'Ellos'}</span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-amber-300">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            {state.viraos[team]}
          </span>
        </span>
        <span className="flex items-baseline gap-0.5 leading-none">
          <span className="text-sm font-extrabold tabular-nums text-amber-50">{state.scores[team]}</span>
          <span className="text-[10px] text-amber-200/70">/{CASINO_TARGET}</span>
        </span>
        <span className="mt-0.5 h-1 overflow-hidden rounded-full bg-black/40">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </span>
      </div>
    );
  };

  return (
    <TableLayout
      vars={{ '--ch': 'clamp(48px, 19dvh, 128px)' } as CSSProperties}
      sideCols="21%"
      rows="22%_minmax(0,1fr)_36%"
      centerRef={boardRef}
      bottomCenterRef={mineRef}
      topLeft={
        <>
          <LeaveButton onLeave={onLeave} />
          <button
            type="button"
            onClick={() => setCapturedOpen(true)}
            aria-label={`Cartas capturadas: ${capturedTotal}`}
            className={CORNER_CHIP}
          >
            <Layers className="h-4 w-4" aria-hidden />
            {capturedTotal}
          </button>
        </>
      }
      topCenter={layout.top.map((s) => renderSeat(s, 'top'))}
      topRight={<TurnSound label={turnLabel} myTurn={myTurn} muted={isMuted} onToggleMute={toggleMute} />}
      left={layout.left !== null && renderSeat(layout.left, 'left')}
      right={layout.right !== null && renderSeat(layout.right, 'right')}
      center={
        <>
          {/* Tablero de madera en perspectiva 2.5D: solo el fondo se inclina; las cartas quedan planas para tocarlas bien. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 [perspective:1100px]">
            <div
              className={`cagao-board absolute inset-x-[3%] inset-y-[6%] rounded-[3.5%] [transform-origin:50%_100%] [transform:rotateX(16deg)] ${
                dragging && myTurn ? 'cagao-board-drop' : ''
              }`}
            />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[min(70%,22dvh)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-amber-200/30"
          />

          {scoreChip(myTeam as 0 | 1, 'left-[5%] top-[9%]')}
          {scoreChip((1 - myTeam) as 0 | 1, 'right-[5%] top-[9%]')}

          {/* Mazo: de aquí salen las cartas del reparto */}
          <div
            ref={deckRef}
            title={`Mazo: ${deckDisplayCount} cartas`}
            className="absolute left-[3%] top-1/2 z-10 -translate-y-1/2"
          >
            <span className="relative block rounded-lg shadow-[2px_2px_0_rgba(255,255,255,0.18),4px_4px_0_rgba(255,255,255,0.1)]">
              <DorsoUI className="h-[clamp(34px,12dvh,76px)]" />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-extrabold tabular-nums text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
                {deckDisplayCount}
              </span>
            </span>
          </div>

          {/* Cartas y combinaciones de la mesa: se reacomodan solas sin desbordarse */}
          <div
            style={mesaVars}
            className="absolute inset-x-[15%] bottom-[16%] top-[14%] z-10 flex flex-wrap content-center items-center justify-center gap-x-2 gap-y-3 overflow-visible"
          >
            {state.table.length === 0 && state.builds.length === 0 && !deal.dealing && (
              <p className="rounded-full bg-black/45 px-3 py-1 text-center text-sm text-amber-100/90">La mesa está vacía.</p>
            )}
            {state.table.map((c, i) =>
              deal.isTableDealt(i) ? (
                <div key={c.id} data-table-id={c.id} className={c.id === pointCardId ? 'relative animate-point-drop' : 'relative'}>
                  <CartaUI
                    card={c}
                    size="mesa"
                    isSelected={tableIds.includes(c.id)}
                    isDisabled={!myTurn}
                    onClick={() => pickTableItem(c.id)}
                  />
                  {c.id === pointCardId && (
                    <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap btn-gold rounded-full px-2 py-1 text-[10px] font-extrabold shadow-md">
                      Carta de puntos
                    </span>
                  )}
                </div>
              ) : null,
            )}
            {state.builds.map((b) => (
              <div key={b.id} data-table-id={b.id} className="contents">
                <TableBuild build={b} selected={tableIds.includes(b.id)} disabled={!myTurn} onSelect={() => pickTableItem(b.id)} />
              </div>
            ))}
          </div>

          {captureNotice && captureFlightKey === currentCaptureKey && (
            <CaptureFlight
              playerName={state.players[captureNotice.seat]?.name ?? 'Jugador'}
              card={captureNotice.card}
              capturedCount={captureNotice.capturedCount}
              virao={captureNotice.virao}
            />
          )}

          {playing && hint && (
            <p className="pointer-events-none absolute bottom-0 left-1/2 z-30 max-w-[96%] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-center text-[11px] font-medium leading-tight text-amber-50 ring-1 ring-white/10 sm:text-xs">
              {hint}
            </p>
          )}
        </>
      }
      bottomLeft={
        <SeatPlaque
          name={state.players[seat].name}
          count={handAll.length}
          isTurn={myTurn}
          out={false}
          isMe
        />
      }
      bottomCenter={
        <HandFan
          cards={shownHand}
          heightVar="--ch"
          avail="min(54dvw, 600px)"
          plain
          selectedIds={selectedIds}
          playableIds={playableIds}
          interactive={myTurn}
          canDrag={() => myTurn}
          dropRef={boardRef}
          onTap={(c) => pickCard(c.id)}
          onDrop={dropOnBoard}
          onDragStart={(c) => {
            if (c.id !== cardId) {
              setCardId(c.id);
              setTableIds([]);
            }
          }}
          onDraggingChange={setDragging}
        />
      }
      bottomRight={
        playing ? (
          <div className="grid w-full grid-cols-2 gap-1">
            <button type="button" onClick={capture} disabled={!captureReady} className={TB_MAIN}>
              Capturar
            </button>
            {showRaise && (
              <>
                <button type="button" onClick={raise} disabled={raisedValue === null} className={TB_FORM}>
                  Subir
                </button>
                <button type="button" onClick={convert} disabled={convertedValue === null} className={TB_FORM}>
                  {raiseTarget?.kind === 'pairs' ? 'Pares' : 'Convertir'}
                </button>
              </>
            )}
            {showExpand && (
              <button type="button" onClick={expand} disabled={expandedValue === null} className={TB_FORM}>
                Ampliar
              </button>
            )}
            {showFormation && (
              <>
                <button type="button" onClick={buildSum} disabled={sumValue === null} className={TB_FORM}>
                  Sumar
                </button>
                {mergeCard && (
                  <button type="button" onClick={buildSumAndPairs} title="Sumar y unir a la carta de la mesa" className={TB_FORM}>
                    Suma+Par
                  </button>
                )}
                <button type="button" onClick={buildPairs} disabled={pairsValue === null} className={TB_FORM}>
                  Hacer Par
                </button>
              </>
            )}
            <button type="button" onClick={drop} disabled={!canDrop || !card} className={TB_DROP}>
              Tirar
            </button>
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
              <VictoryCelebration onContinue={() => setEndNoticeDismissedRound(state.roundNo)} />
            ) : (
              <DefeatNotice onContinue={() => setEndNoticeDismissedRound(state.roundNo)} />
            ))}
          {showClosingAlert && (
            <ClosingZoneBanner alerts={closingAlerts} onDismiss={() => setClosingDismissedRound(state.roundNo)} />
          )}

          {capturedOpen && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-3"
              onClick={() => setCapturedOpen(false)}
            >
              <div
                role="dialog"
                aria-label="Cartas capturadas"
                className="wood-panel max-h-[85dvh] w-full max-w-2xl overflow-y-auto p-4"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold">Cartas capturadas</h2>
                    {roomLabel && <p className="text-xs text-amber-200/70">{roomLabel}</p>}
                  </div>
                  <button type="button" onClick={() => setCapturedOpen(false)} aria-label="Cerrar" className={CHIP_BUTTON}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {([0, 1] as const).map((team) => (
                    <CapturedPile key={team} title={teamName(state.players, team)} groups={state.captured[team]} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {state.summary && state.phase !== 'playing' && !showEndNotice && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/65 p-3">
              <div className="max-h-full w-full max-w-2xl space-y-3 overflow-y-auto">
                <RoundResultPanel
                  title={
                    state.phase === 'gameOver' && state.winnerTeam !== null
                      ? `Ganó ${teamName(state.players, state.winnerTeam)}`
                      : `Resultado de la ronda ${state.roundNo}`
                  }
                  lines={state.summary.lines}
                  totals={state.summary.totals}
                  teamNames={[teamName(state.players, 0), teamName(state.players, 1)]}
                  onNextRound={state.phase === 'roundEnd' && seat === nextDealer ? () => onMove({ type: 'nextRound' }) : undefined}
                  waitingFor={state.phase === 'roundEnd' ? state.players[nextDealer].name : undefined}
                />
                {resultFooter && <div className="flex justify-center">{resultFooter}</div>}
                {onLeave && state.phase === 'gameOver' && (
                  <div className="flex justify-center">
                    <button type="button" onClick={onLeave} className={PANEL_BUTTON_QUIET}>
                      Salir
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <FlightLayer flights={flights} onDone={endFlight} />
          <TableNotices connection={connection} notice={notice} />
        </>
      }
    />
  );
}
