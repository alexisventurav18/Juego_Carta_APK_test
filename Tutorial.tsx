import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, RotateCcw, X } from 'lucide-react';
import { GAMES } from '@/games';
import type { Card } from '@/games/cards';
import type { GameId } from '@/games/shared';
import PlayingCard from '../cagao/PlayingCard';
import { WoodFrame } from '../cagao/CardAssets';
import { type PlayPractice, type TapPractice, TUTORIALS, type TutorialStep } from './steps';

interface TutorialProps {
  game: GameId;
  /** Cierra el tutorial (también lo hace el botón Saltar). */
  onClose: () => void;
  /** Si se da, al final se ofrece empezar una partida contra bots. */
  onPlay?: () => void;
}

const STAGE_VARS = { '--tut-h': 'clamp(56px, 21dvh, 124px)', '--tut-h-small': 'clamp(40px, 14dvh, 84px)' } as CSSProperties;

function Feedback({ state, success, wrong }: { state: 'idle' | 'ok' | 'bad'; success: string; wrong: string }) {
  if (state === 'idle') return <p className="text-xs text-amber-100/70">Pruébalo tú: es una práctica, no pasa nada si fallas.</p>;
  return (
    <p
      role="status"
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
        state === 'ok' ? 'bg-lime-600/30 text-lime-100 ring-1 ring-lime-300/40' : 'bg-rose-700/40 text-rose-50 ring-1 ring-rose-300/40'
      }`}
    >
      {state === 'ok' && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
      {state === 'ok' ? success : wrong}
    </p>
  );
}

/** Una carta tocable de las prácticas. */
function PracticeCard({
  card,
  faceDown,
  selected,
  label,
  onClick,
  heightVar = '--tut-h',
}: {
  card: Card;
  faceDown?: boolean;
  selected?: boolean;
  label?: string;
  onClick?: () => void;
  heightVar?: string;
}) {
  const face = <PlayingCard card={card} faceDown={faceDown} heightVar={heightVar} plain />;
  return (
    <span className="flex flex-col items-center gap-1">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          aria-label={faceDown ? (label ?? 'Carta boca abajo') : undefined}
          className={`touch-manipulation rounded-[calc(var(--tut-h)*0.07)] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 active:scale-95 ${
            selected ? '-translate-y-2 shadow-[0_0_0_2px_#facc15,0_10px_16px_rgba(0,0,0,0.55)]' : ''
          }`}
        >
          {face}
        </button>
      ) : (
        face
      )}
      {label && <span className="text-[11px] font-bold text-amber-200">{label}</span>}
    </span>
  );
}

function TapBoard({ practice }: { practice: TapPractice }) {
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [picked, setPicked] = useState<number | null>(null);

  const tap = (card: Card, index: number) => {
    const ok = practice.correct(card, index);
    setState(ok ? 'ok' : 'bad');
    setPicked(ok ? index : null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-end justify-center gap-[clamp(6px,1.6dvw,14px)]" style={STAGE_VARS}>
        {practice.cards.map((card, index) => {
          const revealed = practice.faceDown && picked === index && practice.reveal;
          return (
            <PracticeCard
              key={card.id}
              card={revealed ? practice.reveal! : card}
              faceDown={practice.faceDown && !revealed}
              selected={!practice.faceDown && picked === index}
              label={practice.labels?.[index]}
              onClick={() => tap(card, index)}
            />
          );
        })}
      </div>
      <Feedback state={state} success={practice.success} wrong={practice.wrong} />
    </div>
  );
}

function PlayBoard({ practice }: { practice: PlayPractice }) {
  const [handId, setHandId] = useState<string | null>(null);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [done, setDone] = useState(false);

  const reset = () => {
    setHandId(null);
    setTableIds([]);
    setState('idle');
    setDone(false);
  };

  const toggleTable = (id: string) => {
    if (done) return;
    setState('idle');
    setTableIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const run = () => {
    const hand = practice.hand.find((c) => c.id === handId);
    if (!hand) {
      setState('bad');
      return;
    }
    const ok = practice.check(
      hand,
      practice.table.filter((c) => tableIds.includes(c.id)),
    );
    setState(ok ? 'ok' : 'bad');
    setDone(ok);
  };

  return (
    <div className="flex flex-col items-center gap-2.5" style={STAGE_VARS}>
      {practice.table.length > 0 && (
        <div className="flex flex-wrap items-end justify-center gap-[clamp(6px,1.4dvw,12px)] rounded-xl bg-black/25 px-3 py-2 ring-1 ring-amber-200/15">
          {practice.table.map((card) => (
            <PracticeCard
              key={card.id}
              card={card}
              heightVar="--tut-h-small"
              selected={tableIds.includes(card.id)}
              onClick={() => toggleTable(card.id)}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-center gap-[clamp(6px,1.4dvw,12px)]">
        {practice.hand.map((card) => (
          <PracticeCard
            key={card.id}
            card={card}
            selected={handId === card.id}
            onClick={() => {
              if (done) return;
              setState('idle');
              setHandId(card.id);
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={run} disabled={done} className="btn-gold min-h-[38px] touch-manipulation rounded-lg px-4 text-sm font-extrabold active:scale-95 disabled:opacity-50">
          {practice.action}
        </button>
        {(state !== 'idle' || handId) && (
          <button type="button" onClick={reset} aria-label="Reiniciar la práctica" className="btn-wood grid h-[38px] w-[38px] place-items-center rounded-lg active:scale-95">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
      <Feedback state={state} success={practice.success} wrong={practice.wrong} />
    </div>
  );
}

function Demo({ demo }: { demo: NonNullable<TutorialStep['demo']> }) {
  return (
    <div className="flex flex-col items-center gap-3" style={STAGE_VARS}>
      {demo.map((row, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="flex items-end justify-center gap-[clamp(4px,1.2dvw,10px)]">
            {row.cards.map((c) => (
              <PracticeCard key={c.id} card={c} faceDown={row.faceDown} heightVar={demo.length > 1 ? '--tut-h-small' : '--tut-h'} />
            ))}
          </div>
          {row.caption && <span className="text-[11px] font-bold text-amber-200">{row.caption}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Tutorial interactivo por pasos. Cada juego tiene el suyo: explica las reglas principales y los controles, con
 * pequeñas prácticas para tocar. El botón "Saltar" está siempre visible arriba a la derecha.
 */
export default function Tutorial({ game, onClose, onPlay }: TutorialProps) {
  const steps = TUTORIALS[game];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const info = GAMES[game];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(steps.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, steps.length]);

  return (
    <div className="wood-stage fixed inset-0 z-[90] overflow-hidden" role="dialog" aria-modal="true" aria-label={`Tutorial de ${info.name}`}>
      <WoodFrame />
      <div
        className="absolute"
        style={{
          top: 'calc(var(--sat) + clamp(10px, 2.6dvh, 24px))',
          right: 'calc(var(--sar) + clamp(14px, 3.2dvw, 34px))',
          bottom: 'calc(var(--sab) + clamp(10px, 2.6dvh, 24px))',
          left: 'calc(var(--sal) + clamp(14px, 3.2dvw, 34px))',
        }}
      >
        <div className="wood-panel flex h-full min-h-0 flex-col gap-2 p-[clamp(8px,2dvh,16px)]">
          <header className="flex shrink-0 items-center justify-between gap-3">
            <div className="min-w-0 leading-tight">
              <h2 className="truncate text-[clamp(14px,3.8dvh,20px)] font-extrabold text-amber-50">Tutorial de {info.name}</h2>
              <p className="text-[11px] text-amber-100/70">
                Paso {index + 1} de {steps.length}
              </p>
            </div>
            {/* Siempre a la vista: se puede salir en cualquier paso. */}
            <button
              type="button"
              onClick={onClose}
              className="btn-wood flex min-h-[40px] shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 text-sm font-bold active:scale-95"
            >
              <X className="h-4 w-4" aria-hidden />
              Saltar
            </button>
          </header>

          <div key={index} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-[46%]">
              <h3 className="text-[clamp(16px,4.4dvh,24px)] font-extrabold leading-tight text-amber-300">{step.title}</h3>
              {step.body.map((paragraph) => (
                <p key={paragraph} className="text-[clamp(12px,3dvh,15px)] leading-relaxed text-amber-50/95">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center rounded-xl bg-black/20 p-3 ring-1 ring-amber-200/10">
              {step.practice?.kind === 'tap' && <TapBoard practice={step.practice} />}
              {step.practice?.kind === 'play' && <PlayBoard practice={step.practice} />}
              {!step.practice && step.demo && <Demo demo={step.demo} />}
              {!step.practice && !step.demo && (
                <p className="px-4 py-6 text-center text-sm text-amber-100/70">Sigue con el tutorial.</p>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="btn-wood flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-lg px-3 text-sm font-bold active:scale-95 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Atrás
            </button>
            <div className="flex items-center gap-1.5" aria-hidden>
              {steps.map((_, i) => (
                <span key={i} className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-amber-300' : 'w-2 bg-amber-100/30'}`} />
              ))}
            </div>
            {last ? (
              <div className="flex items-center gap-2">
                {onPlay && (
                  <button
                    type="button"
                    onClick={onPlay}
                    className="btn-gold flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold active:scale-95"
                  >
                    <Bot className="h-4 w-4" aria-hidden />
                    Jugar ahora
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className={`${onPlay ? 'btn-wood font-bold' : 'btn-gold font-extrabold'} flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-lg px-3 text-sm active:scale-95`}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Terminar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="btn-gold flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold active:scale-95"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
