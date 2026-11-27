import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Check, ChevronRight, CloudDownload, Copy, KeyRound, Music, Settings, ShoppingBag, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { useGameSounds } from '@/hooks/useGameSounds';
import { copyText } from '@/lib/clipboard';
import { requestNotificationPermission } from '@/lib/notify';
import { getIdentityForRecovery, getSyncStatus } from '@/lib/progress';
import { encodeRecoveryCode } from '@/lib/recoveryCode';
import { usePrefs } from '@/lib/soundPrefs';
import { OPEN_RECOVERY_EVENT } from '../RecoveryModal';
import { OPEN_STORE_EVENT } from '../Store';

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

/** Panel de opciones: audio, avisos y personalización visual. */
export default function OptionsModal({ onClose }: OptionsModalProps) {
  const { prefs, update } = usePrefs();
  const { playSound } = useGameSounds();
  const titleId = useId();
  // El código de respaldo codifica la identidad (id + clave secreta): la
  // misma fuente que usaba el Perfil, ahora aquí (B4).
  const identity = getIdentityForRecovery();
  const recoveryCode = encodeRecoveryCode(identity.playerId, identity.key);
  const sync = getSyncStatus();
  const [copied, setCopied] = useState(false);

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

  async function copyCode(): Promise<void> {
    if (!recoveryCode) return;
    await copyText(recoveryCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Abre el flujo de recuperación: el modal vive en el menú, así que se
   * cierran las Opciones y se le pide al menú que lo abra. Sin este cierre,
   * el modal de recuperación quedaría tapado por el de Opciones.
   */
  const openRecovery = () => {
    onClose();
    window.dispatchEvent(new CustomEvent(OPEN_RECOVERY_EVENT));
  };

  /**
   * Abre la Tienda desde Opciones (fila "Apariencia"): mismo patrón que la
   * recuperación — el catálogo vive en la Tienda, aquí no hay selectores
   * duplicados. Un toque más para llegar, a cambio de una sola tienda.
   */
  const openStore = () => {
    onClose();
    window.dispatchEvent(new CustomEvent(OPEN_STORE_EVENT));
  };

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

          {/* Apariencia: una sola fila que abre la Tienda, donde vive el
              catálogo completo con vista previa. Antes había aquí 3
              selectores con compra integrada: el mismo catálogo en dos
              sitios. Un toque más para llegar, a cambio de una sola tienda. */}
          <Row
            icon={<ShoppingBag className="h-4 w-4" />}
            title="Apariencia"
            hint="Dorsos, mesas y fondos de la Tienda"
            control={
              <button
                type="button"
                onClick={openStore}
                aria-label="Abrir la Tienda para cambiar la apariencia"
                className="btn-wood flex min-h-[36px] shrink-0 touch-manipulation items-center gap-1 rounded-lg px-3 text-[13px] font-bold transition-transform active:scale-95"
              >
                Abrir Tienda
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
            }
          />

          {/* Progreso en la nube: restaurar en este teléfono el progreso
              guardado con el código de respaldo de otro teléfono. El código
              también vive aquí (antes solo estaba en Perfil). */}
          <section className="space-y-2 rounded-xl bg-black/25 p-3 ring-1 ring-amber-200/15" aria-label="Progreso en la nube">
            <h3 className="flex items-center gap-2 text-sm font-bold text-amber-50">
              <CloudDownload className="h-4 w-4 text-amber-300" aria-hidden />
              Progreso en la nube
            </h3>
            <p className="text-xs leading-relaxed text-amber-100/70">
              Restaura tus monedas, nivel y cosméticos en este teléfono con el código de respaldo de tu otro
              teléfono.
            </p>
            <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              Mi código de respaldo
            </p>
            <p className="text-xs leading-relaxed text-amber-100/70">
              Con este código recuperas tu progreso en otro teléfono. Guárdalo como una contraseña: quien lo
              tenga puede entrar como tú. No lo compartas.
            </p>
            {recoveryCode ? (
              <>
                <p className="break-all rounded-lg bg-black/40 px-2.5 py-2 font-mono text-[12px] leading-relaxed tracking-wide text-amber-50 ring-1 ring-amber-200/15">
                  {recoveryCode}
                </p>
                <button
                  type="button"
                  onClick={copyCode}
                  className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95"
                >
                  {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  {copied ? 'Copiado' : 'Copiar código'}
                </button>
              </>
            ) : (
              <p className="text-xs text-amber-100/70">No se pudo generar el código en este momento.</p>
            )}
            <p className="text-xs font-bold text-amber-100/70">
              {sync.hasConflict
                ? `Hay una copia más reciente en la nube (${formatSyncDate(sync.conflictAt)}). Usa «Recuperar mi progreso» para verla.`
                : sync.lastSyncedAt
                  ? `Último respaldo: ${formatSyncDate(sync.lastSyncedAt)}.`
                  : 'Aún no hay respaldo en la nube: se sube solo cuando ganas o compras algo.'}
            </p>
            <button
              type="button"
              onClick={openRecovery}
              className="btn-gold flex min-h-[40px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition-transform active:scale-[0.98]"
            >
              <CloudDownload className="h-4 w-4 shrink-0" aria-hidden />
              Recuperar mi progreso
            </button>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatSyncDate(timestamp: number | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
