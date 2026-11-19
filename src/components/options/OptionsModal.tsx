import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Lock, Music, Settings, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { useGameSounds } from '@/hooks/useGameSounds';
import { isOwned, shopPrice, useEconomy, type CosmeticCategory } from '@/lib/economy';
import { requestNotificationPermission } from '@/lib/notify';
import { usePrefs } from '@/lib/soundPrefs';
import { CARD_BACK_IMAGES } from '@/components/cagao/CardAssets';
import { CARD_BACK_THEMES, MENU_THEMES, TABLE_THEMES, useVisualPrefs } from '@/lib/visualPrefs';

interface OptionsModalProps {
  onClose: () => void;
}

/** Interruptor accesible con el aspecto de madera y dorado del resto de la app. */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 touch-manipulation rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
        checked ? 'bg-amber-400' : 'bg-black/50 ring-1 ring-amber-200/30'
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-0.5 h-6 w-6 rounded-full shadow transition-transform ${
          checked ? 'translate-x-[22px] bg-amber-950' : 'translate-x-0.5 bg-amber-100'
        }`}
      />
    </button>
  );
}

function Slider({
  value,
  onChange,
  onCommit,
  label,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="h-7 min-w-0 flex-1 cursor-pointer accent-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      />
      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-amber-200">{Math.round(value * 100)}%</span>
    </div>
  );
}

function Row({ icon, title, hint, control, children }: { icon: ReactNode; title: string; hint?: string; control?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-1.5 ring-1 ring-amber-200/15">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/35 text-amber-300">{icon}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-bold text-amber-50">{title}</p>
          {hint && <p className="text-[11px] text-amber-100/65 [@media(max-height:420px)]:hidden">{hint}</p>}
        </div>
        {control}
      </div>
      {children && <div className="-mt-0.5 pl-11">{children}</div>}
    </div>
  );
}

function ThemePicker<T extends string>({
  label,
  value,
  options,
  onChange,
  cardPreview = false,
  lockedPrice,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; color: string; image: string }[];
  onChange: (value: T) => void;
  cardPreview?: boolean;
  /** Precio en monedas si la opción no es del jugador; null si ya es suya. */
  lockedPrice?: (id: T) => number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const price = lockedPrice?.(option.id) ?? null;
        return (
        <button
          key={option.id}
          type="button"
          aria-label={`${label}: ${option.label}${price !== null ? `, bloqueado, cuesta ${price} monedas` : ''}`}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`flex min-w-0 touch-manipulation flex-col items-center gap-1 rounded-lg p-1.5 text-[10px] font-bold text-amber-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
            value === option.id ? 'bg-amber-300/20 ring-2 ring-amber-300' : 'bg-black/20 ring-1 ring-amber-200/15'
          } ${price !== null ? 'opacity-70' : ''}`}
        >
          <span
            aria-hidden
            className={`block bg-cover bg-center bg-no-repeat ${cardPreview ? 'h-10 w-7 rounded' : 'h-7 w-full rounded-md'} ring-1 ring-white/30`}
            style={{ backgroundColor: option.color, backgroundImage: option.image }}
          />
          <span className="truncate">{option.label}</span>
          {price !== null && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-300">
              <Lock className="h-2.5 w-2.5" aria-hidden /> {price} monedas
            </span>
          )}
        </button>
        );
      })}
    </div>
  );
}

/** Panel de opciones: audio, avisos y personalización visual. */
export default function OptionsModal({ onClose }: OptionsModalProps) {
  const { prefs, update } = usePrefs();
  const { prefs: visualPrefs, update: updateVisual } = useVisualPrefs();
  const economy = useEconomy();
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const { playSound } = useGameSounds();
  const titleId = useId();
  const cardBackOptions = CARD_BACK_THEMES.map((theme) => ({
    ...theme,
    image: CARD_BACK_IMAGES[theme.id],
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleNotifications = (value: boolean) => {
    update({ notifications: value });
    if (value) void requestNotificationPermission();
  };

  /**
   * Los temas de pago solo se pueden equipar si ya son del jugador; si no,
   * se avisa del precio y de que se compran en la Tienda (antes se podían
   * equipar gratis desde aquí, sin pasar por la tienda).
   */
  const tryEquip = (
    category: CosmeticCategory,
    id: string,
    label: string,
    patch: Parameters<typeof updateVisual>[0],
  ) => {
    if (isOwned(economy, category, id)) {
      setLockedNotice(null);
      updateVisual(patch);
      return;
    }
    const price = shopPrice(category, id);
    setLockedNotice(
      price !== null
        ? `«${label}» cuesta ${price} monedas — cómpralo en la Tienda.`
        : `«${label}» no está disponible.`,
    );
  };

  /** Precio en monedas si la opción no es del jugador; null si ya es suya. */
  const lockedPriceFor =
    (category: CosmeticCategory) =>
    (id: string): number | null =>
      isOwned(economy, category, id) ? null : shopPrice(category, id);

  return createPortal(
    <div
      className="fixed z-[100] flex items-center justify-center bg-black/65 p-3"
      style={{ top: 0, right: 0, bottom: 0, left: 0, paddingTop: 'calc(var(--sat) + 0.75rem)', paddingBottom: 'calc(var(--sab) + 0.75rem)', paddingLeft: 'calc(var(--sal) + 0.75rem)', paddingRight: 'calc(var(--sar) + 0.75rem)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="wood-panel flex max-h-full w-full max-w-md flex-col p-4"
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-base font-extrabold text-amber-50">
            <Settings className="h-4 w-4 text-amber-300" aria-hidden />
            Opciones
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar opciones"
            className="wood-chip grid h-9 w-9 shrink-0 place-items-center rounded-lg active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-1.5 overflow-y-auto pr-1">
          <Row
            icon={prefs.notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            title="Notificaciones"
            hint="Consejos, avisos de la mesa y aviso de tu turno"
            control={<Switch checked={prefs.notifications} onChange={toggleNotifications} label="Notificaciones" />}
          />

          <Row
            icon={prefs.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            title="Silenciar todo"
            hint="Apaga la música y los efectos"
            control={<Switch checked={prefs.muted} onChange={(value) => update({ muted: value })} label="Silenciar todo el audio" />}
          >
            <Slider
              value={prefs.master}
              onChange={(value) => update({ master: value })}
              onCommit={() => playSound('cardSlide')}
              label="Volumen general"
              disabled={prefs.muted}
            />
          </Row>

          <Row
            icon={<Music className="h-4 w-4" />}
            title="Música de fondo"
            control={<Switch checked={prefs.musicOn} onChange={(value) => update({ musicOn: value })} label="Música de fondo" />}
          >
            <Slider
              value={prefs.music}
              onChange={(value) => update({ music: value })}
              label="Volumen de la música"
              disabled={prefs.muted || !prefs.musicOn}
            />
          </Row>

          <Row
            icon={<Zap className="h-4 w-4" />}
            title="Efectos y tonos"
            hint="Cartas, pares, victoria"
            control={<Switch checked={prefs.sfxOn} onChange={(value) => update({ sfxOn: value })} label="Efectos de sonido" />}
          >
            <Slider
              value={prefs.sfx}
              onChange={(value) => update({ sfx: value })}
              onCommit={() => playSound('pairMatch')}
              label="Volumen de efectos"
              disabled={prefs.muted || !prefs.sfxOn}
            />
          </Row>

          <section className="space-y-2 rounded-xl bg-black/25 p-3 ring-1 ring-amber-200/15" aria-label="Personalización visual">
            <h3 className="text-sm font-bold text-amber-50">Apariencia</h3>
            {lockedNotice && (
              <p role="status" className="rounded-lg bg-amber-300/15 px-2 py-1.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/40">
                {lockedNotice}
              </p>
            )}
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-amber-100/80">Reverso de las cartas</p>
                <ThemePicker
                  label="Reverso de las cartas"
                  value={visualPrefs.cardBack}
                  options={cardBackOptions}
                  onChange={(cardBack) =>
                    tryEquip(
                      'cardBack',
                      cardBack,
                      CARD_BACK_THEMES.find((t) => t.id === cardBack)?.label ?? cardBack,
                      { cardBack },
                    )
                  }
                  lockedPrice={lockedPriceFor('cardBack')}
                  cardPreview
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-amber-100/80">Mesa de juego</p>
                <ThemePicker
                  label="Mesa de juego"
                  value={visualPrefs.table}
                  options={TABLE_THEMES}
                  onChange={(table) =>
                    tryEquip(
                      'table',
                      table,
                      TABLE_THEMES.find((t) => t.id === table)?.label ?? table,
                      { table },
                    )
                  }
                  lockedPrice={lockedPriceFor('table')}
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-amber-100/80">Menú principal</p>
                <ThemePicker
                  label="Fondo del menú principal"
                  value={visualPrefs.menu}
                  options={MENU_THEMES}
                  onChange={(menu) =>
                    tryEquip(
                      'menu',
                      menu,
                      MENU_THEMES.find((t) => t.id === menu)?.label ?? menu,
                      { menu },
                    )
                  }
                  lockedPrice={lockedPriceFor('menu')}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
