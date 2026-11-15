import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Dices, X } from 'lucide-react';
import {
  type AvatarConfig,
  decodeAvatar,
  encodeAvatar,
  EYE_COLORS,
  EYE_TYPES,
  type Gender,
  HAIR_COLORS,
  HAIR_STYLES,
  MOUTH_COLORS,
  MOUTH_TYPES,
  MUSTACHE_COLORS,
  MUSTACHE_STYLES,
  normalizeAvatar,
  optionsFor,
  randomAvatar,
  SKIN_TONES,
  type StyleOption,
} from '@/games/avatar';
import AvatarSvg from './AvatarSvg';

interface AvatarEditorProps {
  /** Avatar actual, o null si todavía no eligió uno (entonces se empieza por el género). */
  initial: string | null;
  onSave: (code: string) => void;
  onClose: () => void;
}

type Tab = 'skin' | 'hair' | 'eyes' | 'mouth' | 'mustache';

const TAB_LABEL: Record<Tab, string> = {
  skin: 'Piel',
  hair: 'Cabello',
  eyes: 'Ojos',
  mouth: 'Boca',
  mustache: 'Bigote',
};

/** Muestras de color: círculo con aro dorado en el elegido. */
function Swatches({
  colors,
  value,
  onChange,
  label,
}: {
  colors: string[];
  value: number;
  onChange: (index: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((color, index) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={index === value}
          aria-label={`${label} ${index + 1}`}
          onClick={() => onChange(index)}
          className={`relative grid h-8 w-8 touch-manipulation place-items-center rounded-full ring-1 ring-black/40 transition-transform active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
            index === value ? 'scale-110 !ring-2 !ring-amber-300' : ''
          }`}
          style={{ backgroundColor: color }}
        >
          {index === value && <Check className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** Rejilla de estilos: cada uno se ve como la cara pequeña con ese estilo aplicado. */
function StyleGrid({
  options,
  value,
  apply,
  onChange,
}: {
  options: StyleOption[];
  value: number;
  apply: (id: number) => AvatarConfig;
  onChange: (id: number) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.id)}
          className={`aspect-square touch-manipulation overflow-hidden rounded-xl bg-black/30 p-0.5 ring-1 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
            option.id === value ? 'ring-2 ring-amber-300' : 'ring-amber-200/20'
          }`}
        >
          <AvatarSvg config={apply(option.id)} className="block h-full w-full rounded-lg" />
        </button>
      ))}
    </div>
  );
}

/**
 * Editor de avatar. Empieza por elegir Masculino o Femenino (si no hay avatar guardado); luego, por pestañas:
 * piel, cabello, ojos, boca y bigote, cada uno con su estilo y su color. El género filtra los estilos que se
 * ofrecen (el bigote solo está disponible para el género masculino).
 */
export default function AvatarEditor({ initial, onSave, onClose }: AvatarEditorProps) {
  const start = useMemo(() => decodeAvatar(initial), [initial]);
  const [config, setConfig] = useState<AvatarConfig>(() => start ?? randomAvatar(Math.random, 'm'));
  const [step, setStep] = useState<'gender' | 'edit'>(start ? 'edit' : 'gender');
  const [tab, setTab] = useState<Tab>('skin');
  const titleId = useId();

  const tabs: Tab[] = config.gender === 'm' ? ['skin', 'hair', 'eyes', 'mouth', 'mustache'] : ['skin', 'hair', 'eyes', 'mouth'];
  const activeTab = tabs.includes(tab) ? tab : 'skin';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = (changes: Partial<AvatarConfig>) => setConfig((current) => normalizeAvatar({ ...current, ...changes }));
  const withChange = (changes: Partial<AvatarConfig>) => normalizeAvatar({ ...config, ...changes });

  const chooseGender = (gender: Gender) => {
    if (gender !== config.gender || step === 'gender') {
      // Se parte de una cara al azar del género elegido, pero se respeta el tono de piel que ya había.
      setConfig((current) => normalizeAvatar({ ...randomAvatar(Math.random, gender), skin: current.skin }));
    }
    setStep('edit');
    setTab('skin');
  };

  const sections: Record<Tab, JSX.Element> = {
    skin: <Swatches colors={SKIN_TONES} value={config.skin} onChange={(skin) => patch({ skin })} label="Tono de piel" />,
    hair: (
      <div className="space-y-3">
        <StyleGrid
          options={optionsFor(HAIR_STYLES, config.gender)}
          value={config.hairStyle}
          apply={(id) => withChange({ hairStyle: id })}
          onChange={(hairStyle) => patch({ hairStyle })}
        />
        <Swatches colors={HAIR_COLORS} value={config.hairColor} onChange={(hairColor) => patch({ hairColor })} label="Color de cabello" />
      </div>
    ),
    eyes: (
      <div className="space-y-3">
        <StyleGrid
          options={optionsFor(EYE_TYPES, config.gender)}
          value={config.eyeType}
          apply={(id) => withChange({ eyeType: id })}
          onChange={(eyeType) => patch({ eyeType })}
        />
        <Swatches colors={EYE_COLORS} value={config.eyeColor} onChange={(eyeColor) => patch({ eyeColor })} label="Color de ojos" />
      </div>
    ),
    mouth: (
      <div className="space-y-3">
        <StyleGrid
          options={optionsFor(MOUTH_TYPES, config.gender)}
          value={config.mouthType}
          apply={(id) => withChange({ mouthType: id })}
          onChange={(mouthType) => patch({ mouthType })}
        />
        <Swatches colors={MOUTH_COLORS} value={config.mouthColor} onChange={(mouthColor) => patch({ mouthColor })} label="Color de boca" />
      </div>
    ),
    mustache: (
      <div className="space-y-3">
        <StyleGrid
          options={optionsFor(MUSTACHE_STYLES, config.gender)}
          value={config.mustache}
          apply={(id) => withChange({ mustache: id })}
          onChange={(mustache) => patch({ mustache })}
        />
        <Swatches
          colors={MUSTACHE_COLORS}
          value={config.mustacheColor}
          onChange={(mustacheColor) => patch({ mustacheColor })}
          label="Color de bigote"
        />
      </div>
    ),
  };

  return createPortal(
    <div
      className="fixed z-[100] flex items-center justify-center bg-black/70 p-3"
      style={{ top: 0, right: 0, bottom: 0, left: 0, paddingTop: 'calc(var(--sat) + 0.5rem)', paddingBottom: 'calc(var(--sab) + 0.5rem)', paddingLeft: 'calc(var(--sal) + 0.5rem)', paddingRight: 'calc(var(--sar) + 0.5rem)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="wood-panel flex max-h-full w-full max-w-3xl flex-col p-3 sm:p-4"
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <h2 id={titleId} className="text-base font-extrabold text-amber-50">
            {step === 'gender' ? 'Crea tu personaje' : 'Tu avatar'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="wood-chip grid h-9 w-9 shrink-0 place-items-center rounded-lg active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'gender' ? (
          <div className="flex min-h-0 flex-col items-center gap-3 overflow-y-auto py-1">
            <p className="text-sm text-amber-100/85">¿Cómo es tu personaje? Luego podrás ajustar todos los detalles.</p>
            <div className="flex w-full max-w-md gap-3">
              {(['m', 'f'] as const).map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => chooseGender(gender)}
                  className="wood-block flex min-w-0 flex-1 touch-manipulation flex-col items-center gap-2 rounded-2xl p-3 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 active:scale-95"
                >
                  <span className="block aspect-square w-[min(100%,clamp(70px,26dvh,130px))] overflow-hidden rounded-full ring-2 ring-amber-900/70">
                    <AvatarSvg
                      config={normalizeAvatar({
                        gender,
                        skin: 2,
                        hairStyle: gender === 'm' ? 1 : 8,
                        hairColor: 1,
                        eyeType: 0,
                        eyeColor: 1,
                        mouthType: 0,
                        mouthColor: 0,
                        mustache: 0,
                        mustacheColor: 1,
                      })}
                      className="block h-full w-full"
                    />
                  </span>
                  <span className="text-sm font-extrabold text-amber-50">{gender === 'm' ? 'Masculino' : 'Femenino'}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
            {/* Vista previa y acciones */}
            <div className="flex shrink-0 flex-row items-center justify-center gap-3 sm:w-[34%] sm:flex-col">
              <span className="block aspect-square w-[clamp(72px,32dvh,190px)] max-w-full overflow-hidden rounded-full ring-4 ring-amber-900/70 shadow-[0_6px_16px_rgba(0,0,0,0.5)]">
                <AvatarSvg config={config} title="Vista previa de tu avatar" className="block h-full w-full" />
              </span>
              <div className="flex min-w-0 flex-col gap-2 sm:w-full">
                <div role="radiogroup" aria-label="Género" className="grid grid-cols-2 gap-1.5">
                  {(['m', 'f'] as const).map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      role="radio"
                      aria-checked={config.gender === gender}
                      onClick={() => chooseGender(gender)}
                      className={`min-h-[36px] touch-manipulation rounded-lg px-2 text-xs font-bold transition-transform active:scale-95 ${
                        config.gender === gender ? 'btn-gold' : 'btn-wood'
                      }`}
                    >
                      {gender === 'm' ? 'Masculino' : 'Femenino'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setConfig((current) => randomAvatar(Math.random, current.gender))}
                  className="btn-wood flex min-h-[36px] touch-manipulation items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold active:scale-95"
                >
                  <Dices className="h-4 w-4" aria-hidden />
                  Aleatorio
                </button>
                <button
                  type="button"
                  onClick={() => onSave(encodeAvatar(config))}
                  className="btn-gold flex min-h-[40px] touch-manipulation items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-extrabold active:scale-95"
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Guardar
                </button>
              </div>
            </div>

            {/* Opciones por pestañas */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              <div role="tablist" aria-label="Partes del avatar" className="flex shrink-0 gap-1 overflow-x-auto">
                {tabs.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={id === activeTab}
                    onClick={() => setTab(id)}
                    className={`min-h-[34px] shrink-0 touch-manipulation rounded-lg px-3 text-xs font-bold transition-transform active:scale-95 ${
                      id === activeTab ? 'btn-gold' : 'btn-wood'
                    }`}
                  >
                    {TAB_LABEL[id]}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-black/20 p-2.5 ring-1 ring-amber-200/10">
                {sections[activeTab]}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
