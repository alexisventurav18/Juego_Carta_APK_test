import { useEffect, useState } from 'react';
import { Check, CloudDownload, KeyRound, X } from 'lucide-react';
import { getEconomy } from '@/lib/economy';
import { levelFromXp } from '@/lib/experience';
import { restoreIdentity } from '@/lib/identity';
import {
  applySnapshot,
  downloadProgress,
  getSyncStatus,
  uploadProgress,
  type CloudCopy,
} from '@/lib/progress';
import { decodeRecoveryCode } from '@/lib/recoveryCode';

interface RecoveryModalProps {
  onClose: () => void;
  /** Se llama cuando la identidad o el progreso cambiaron: el menú refresca nombre y avatar. */
  onRestored: () => void;
}

/**
 * Evento que abre el modal de recuperación desde otro sitio de la app (hoy,
 * el apartado de Opciones): el modal vive en el menú, que es quien escucha
 * este evento y lo abre.
 */
export const OPEN_RECOVERY_EVENT = 'cartas:open-recovery';

type Step = 'code' | 'checking' | 'conflict' | 'done' | 'error';

/** La economía local está vacía cuando nunca se jugó ni se ganó nada en este teléfono. */
function isLocalEmpty(): boolean {
  const economy = getEconomy();
  return (
    economy.gamesPlayed === 0 &&
    economy.coins === 0 &&
    economy.xp === 0 &&
    economy.awarded.length === 0 &&
    economy.ownedCardBacks.length === 0 &&
    economy.ownedTables.length === 0 &&
    economy.ownedMenus.length === 0
  );
}

function formatCloudDate(timestamp: number | null): string {
  if (!timestamp) return 'sin fecha';
  return new Date(timestamp).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecoveryModal({ onClose, onRestored }: RecoveryModalProps) {
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [cloud, setCloud] = useState<CloudCopy | null>(null);

  // Si ya hay un conflicto registrado (la nube tiene una copia más nueva
  // que la de este teléfono), se ofrece la elección sin pedir el código:
  // la identidad de este teléfono ya es la dueña de esa copia.
  useEffect(() => {
    if (!getSyncStatus().hasConflict) return;
    let cancelled = false;
    setStep('checking');
    downloadProgress()
      .then((copy) => {
        if (cancelled) return;
        if (copy.snapshot) {
          setCloud(copy);
          setStep('conflict');
        } else {
          setStep('code');
        }
      })
      .catch(() => {
        if (!cancelled) setStep('code');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function recoverWithCode(): Promise<void> {
    const decoded = decodeRecoveryCode(code);
    if (!decoded) {
      setMessage('Ese código no parece válido. Revisa que esté completo y prueba de nuevo.');
      setStep('error');
      return;
    }
    if (!restoreIdentity(decoded.playerId, decoded.key)) {
      setMessage('Ese código no parece válido. Revisa que esté completo y prueba de nuevo.');
      setStep('error');
      return;
    }
    setStep('checking');
    try {
      const copy = await downloadProgress();
      if (!copy.snapshot) {
        setMessage(
          'Identidad restaurada. Aún no había progreso guardado para este código, pero desde ahora tu progreso se respaldará con él.',
        );
        onRestored();
        setStep('done');
        return;
      }
      if (isLocalEmpty()) {
        applySnapshot(copy.snapshot, copy.profile, copy.updatedAt);
        setMessage(
          `Progreso restaurado: ${copy.snapshot.economy.coins} monedas, nivel ${levelFromXp(copy.snapshot.economy.xp).level} y tus cosméticos.`,
        );
        onRestored();
        setStep('done');
        return;
      }
      setCloud(copy);
      setStep('conflict');
    } catch (error) {
      const text = error instanceof Error ? error.message : '';
      setMessage(
        text.includes('perfil')
          ? 'Ese código no tiene progreso guardado en la nube.'
          : 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
      );
      setStep('error');
    }
  }

  async function useCloudCopy(): Promise<void> {
    if (!cloud?.snapshot) return;
    applySnapshot(cloud.snapshot, cloud.profile, cloud.updatedAt);
    setMessage(
      `Progreso restaurado: ${cloud.snapshot.economy.coins} monedas, nivel ${levelFromXp(cloud.snapshot.economy.xp).level} y tus cosméticos.`,
    );
    onRestored();
    setStep('done');
  }

  async function keepLocalCopy(): Promise<void> {
    setStep('checking');
    const result = await uploadProgress(true);
    if (result === 'saved') {
      setMessage('Te quedaste con el progreso de este teléfono y ya quedó respaldado en la nube.');
      setStep('done');
      return;
    }
    if (result === 'conflict') {
      try {
        const copy = await downloadProgress();
        if (copy.snapshot) {
          setCloud(copy);
          setStep('conflict');
          return;
        }
      } catch {
        // Si la nube ya no responde, se cae al error genérico.
      }
    }
    setMessage('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
    setStep('error');
  }

  const cloudLevel = cloud?.snapshot ? levelFromXp(cloud.snapshot.economy.xp).level : null;

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Recuperar mi progreso"
    >
      <div className="wood-panel relative m-auto w-full max-w-sm space-y-4 p-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="wood-chip absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg transition-transform active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="flex items-center gap-2 pr-8 text-lg font-extrabold text-amber-50">
          <CloudDownload className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          Recuperar mi progreso
        </p>

        {step === 'code' && (
          <>
            <p className="text-sm leading-relaxed text-amber-100/80">
              Escribe el código de respaldo de tu otro teléfono (lo ves en Perfil → Código de respaldo). Tu
              progreso se descarga y se queda en este teléfono.
            </p>
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={3}
              spellCheck={false}
              autoCapitalize="characters"
              placeholder="AAAAAA-BBBBBB-CCCCCC-…"
              aria-label="Código de respaldo"
              className="w-full resize-none rounded-lg bg-black/40 px-3 py-2 font-mono text-[13px] leading-relaxed tracking-wide text-amber-50 ring-1 ring-amber-200/15 placeholder:text-amber-100/40"
            />
            <button
              type="button"
              onClick={recoverWithCode}
              disabled={code.trim().length === 0}
              className="btn-gold flex min-h-[40px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
              Recuperar
            </button>
          </>
        )}

        {step === 'checking' && (
          <p className="text-sm leading-relaxed text-amber-100/80">Buscando tu progreso en la nube…</p>
        )}

        {step === 'conflict' && cloud?.snapshot && (
          <>
            <p className="text-sm leading-relaxed text-amber-100/80">
              La nube tiene una copia del <strong className="text-amber-50">{formatCloudDate(cloud.updatedAt)}</strong>{' '}
              con <strong className="text-amber-50">{cloud.snapshot.economy.coins} monedas</strong>
              {cloudLevel !== null && (
                <>
                  {' '}y nivel <strong className="text-amber-50">{cloudLevel}</strong>
                </>
              )}
              , y este teléfono tiene otro progreso. ¿Cuál te quedas?
            </p>
            <button
              type="button"
              onClick={useCloudCopy}
              className="btn-gold flex min-h-[40px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition-transform active:scale-[0.98]"
            >
              <CloudDownload className="h-4 w-4 shrink-0" aria-hidden />
              Restaurar la copia de la nube
            </button>
            <button
              type="button"
              onClick={keepLocalCopy}
              className="btn-wood flex min-h-[40px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition-transform active:scale-[0.98]"
            >
              Quedarme con la de este teléfono
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-100/80">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              {message}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-gold flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-lg px-3 text-sm font-extrabold transition-transform active:scale-[0.98]"
            >
              Entendido
            </button>
          </>
        )}

        {step === 'error' && (
          <>
            <p className="text-sm leading-relaxed text-amber-100/80">{message}</p>
            <button
              type="button"
              onClick={() => setStep('code')}
              className="btn-wood flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-lg px-3 text-sm font-bold transition-transform active:scale-[0.98]"
            >
              Volver a intentarlo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
