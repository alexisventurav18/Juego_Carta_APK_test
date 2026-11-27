import { useCallback, useEffect, useState } from 'react';
import { Chrome, Facebook, LogOut, Mail, ShieldCheck, Smartphone, Unlink, UserRound } from 'lucide-react';
import {
  afterSignIn,
  chooseLocalOnly,
  fetchAccountStatus,
  getAccessToken,
  getAccountState,
  linkCurrentIdentity,
  restoreFromAccount,
  sendEmailCode,
  signInWithProvider,
  signOut,
  unlinkAccount,
  verifyEmailCode,
  type AccountProvider,
  type LinkedAccount,
} from '@/lib/account';
import { getPlayerId } from '@/lib/identity';

/*
 * Sección "Cuenta" del Perfil: entrar con Google / Facebook / código por
 * correo, o seguir jugando solo local.
 *
 * El login NUNCA es obligatorio: sin cuenta el juego funciona como siempre
 * (identidad del dispositivo + código de respaldo). Quien elige "Seguir sin
 * cuenta" no ve ningún aviso al arrancar: la elección queda guardada y la
 * sección sigue ofreciendo entrar cuando quiera.
 *
 * Tras entrar, si la cuenta no tiene vínculo se vincula sola el progreso
 * actual; si ya tiene progreso de OTRO teléfono, se ofrece restaurarlo
 * (eso rota la clave: el teléfono viejo se actualiza solo al abrir el
 * juego con su sesión). En web, el retorno de Google/Facebook recarga la
 * página: la vuelta se detecta con una marca en sessionStorage.
 */

const RETURN_KEY = 'cartas.accountReturn';

function providerLabel(provider: AccountProvider): string {
  if (provider === 'google') return 'Google';
  if (provider === 'facebook') return 'Facebook';
  return 'correo';
}

interface ServerStatus {
  linked: boolean;
  playerId: string | null;
  provider: AccountProvider | null;
  email: string | null;
}

export default function AccountSection() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [linked, setLinked] = useState<LinkedAccount | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [restoreDismissed, setRestoreDismissed] = useState(false);

  const refresh = useCallback(async () => {
    const state = await getAccountState();
    setHasSession(state.hasSession);
    setSessionEmail(state.sessionEmail);
    setLinked(state.linked);
    setLocalOnly(state.localOnly);
    if (state.hasSession) {
      try {
        setServer(await fetchAccountStatus());
      } catch {
        setServer(null);
      }
    } else {
      setServer(null);
    }
    setLoading(false);
  }, []);

  /** Tras entrar: vincular el progreso actual si la cuenta está libre; si ya es mía, nada. */
  const completeSignIn = useCallback(async () => {
    const result = await afterSignIn();
    if (result.step === 'link-available') {
      await linkCurrentIdentity();
      setNotice('Tu progreso quedó guardado en tu cuenta.');
    } else if (result.step === 'already-linked') {
      setNotice('Ya entraste con esa cuenta.');
    }
    // 'needs-restore': la tarjeta de restaurar se muestra sola abajo.
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Vuelta de Google/Facebook en web: la página recargó; completar el vínculo solo si venimos de entrar.
  useEffect(() => {
    let returning = false;
    try {
      returning = sessionStorage.getItem(RETURN_KEY) === '1';
      if (returning) sessionStorage.removeItem(RETURN_KEY);
    } catch {
      returning = false;
    }
    if (!returning) return;
    void (async () => {
      if (!(await getAccessToken())) return;
      setBusy('return');
      try {
        await completeSignIn();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión.');
      } finally {
        setBusy(null);
      }
    })();
  }, [completeSignIn]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo falló. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const handleProvider = (provider: 'google' | 'facebook') =>
    run(provider, async () => {
      // En web la página se va al proveedor y vuelve: marcar la vuelta antes de salir.
      try {
        sessionStorage.setItem(RETURN_KEY, '1');
      } catch {
        // Sin sessionStorage la vuelta simplemente no se autocompleta.
      }
      const result = await signInWithProvider(provider);
      if (result === 'signed-in') await completeSignIn();
    });

  const handleSendCode = () =>
    run('otp-send', async () => {
      await sendEmailCode(email);
      setOtpSent(true);
      setNotice(`Te enviamos un código a ${email.trim().toLowerCase()}. Revisa también el spam.`);
    });

  const handleVerifyCode = () =>
    run('otp-verify', async () => {
      await verifyEmailCode(email, code);
      setCode('');
      setOtpSent(false);
      setShowOtp(false);
      await completeSignIn();
    });

  const handleLink = () =>
    run('link', async () => {
      await linkCurrentIdentity();
      setNotice('Tu progreso quedó guardado en tu cuenta.');
      await refresh();
    });

  const handleRestore = () =>
    run('restore', async () => {
      const ok = await restoreFromAccount();
      if (!ok) throw new Error('No se pudo restaurar tu progreso. Inténtalo de nuevo.');
      setNotice('Progreso restaurado en este teléfono.');
      setRestoreDismissed(false);
      await refresh();
    });

  const handleUnlink = () =>
    run('unlink', async () => {
      if (!confirmUnlink) {
        setConfirmUnlink(true);
        return;
      }
      setConfirmUnlink(false);
      await unlinkAccount();
      setNotice('Cuenta desvinculada. Tu progreso sigue en este teléfono.');
      await refresh();
    });

  const handleSignOut = () =>
    run('signout', async () => {
      await signOut();
      setServer(null);
      setLinked(null);
      await refresh();
    });

  const handleLocalOnly = () => {
    chooseLocalOnly();
    setLocalOnly(true);
    setNotice(null);
  };

  // Sin respuesta del servidor, la caché local + sesión valen como vinculado (se confirma al recuperar conexión).
  const linkedToMe =
    (!!server?.linked && !!server.playerId && server.playerId === getPlayerId()) ||
    (!server && !!linked && hasSession);
  const linkedToOther =
    !!server?.linked && !!server.playerId && server.playerId !== getPlayerId() && !restoreDismissed;
  const displayLink = linkedToMe
    ? { provider: server?.provider ?? linked?.provider ?? 'google', email: server?.email ?? linked?.email ?? sessionEmail }
    : null;

  return (
    <div className="profile-account space-y-2 rounded-xl bg-black/25 px-3 py-3 ring-1 ring-amber-200/15">
      <p className="flex items-center gap-1.5 text-sm font-extrabold text-amber-300">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Cuenta
      </p>

      {loading && <p className="text-xs text-amber-100/70">Cargando…</p>}

      {!loading && displayLink && (
        <>
          <p className="text-xs leading-relaxed text-amber-100/70">
            Tu progreso está guardado en tu cuenta de {providerLabel(displayLink.provider)}
            {displayLink.email ? ` (${displayLink.email})` : ''}. Puedes recuperarlo en otro teléfono entrando con la
            misma cuenta.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={busy !== null}
              className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={() => void handleUnlink()}
              disabled={busy !== null}
              className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden />
              {confirmUnlink ? 'Toca de nuevo para desvincular' : busy === 'unlink' ? 'Desvinculando…' : 'Desvincular'}
            </button>
          </div>
        </>
      )}

      {!loading && linkedToOther && (
        <>
          <p className="text-xs leading-relaxed text-amber-100/70">
            Esta cuenta de {providerLabel(server?.provider ?? 'google')}
            {server?.email ? ` (${server.email})` : ''} ya tiene progreso guardado en otro teléfono.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRestore()}
              disabled={busy !== null}
              className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              <Smartphone className="h-3.5 w-3.5" aria-hidden />
              {busy === 'restore' ? 'Restaurando…' : 'Restaurar mi progreso en este teléfono'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRestoreDismissed(true);
                handleLocalOnly();
              }}
              disabled={busy !== null}
              className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              Ahora no
            </button>
          </div>
          <p className="text-xs leading-relaxed text-amber-100/70">
            Al restaurar, el otro teléfono deja de tener la clave actual; se actualiza solo al abrir el juego con su
            sesión.
          </p>
        </>
      )}

      {!loading && !displayLink && !linkedToOther && hasSession && (
        <>
          <p className="text-xs leading-relaxed text-amber-100/70">
            Entraste{sessionEmail ? ` como ${sessionEmail}` : ''}, pero tu progreso todavía no está guardado en esta
            cuenta.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleLink()}
              disabled={busy !== null}
              className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {busy === 'link' ? 'Vinculando…' : 'Vincular mi progreso a esta cuenta'}
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={busy !== null}
              className="btn-wood flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </>
      )}

      {!loading && !displayLink && !linkedToOther && !hasSession && (
        <>
          <p className="text-xs leading-relaxed text-amber-100/70">
            {localOnly
              ? 'Juegas sin cuenta: tu progreso vive solo en este teléfono (también puedes recuperarlo con el código de respaldo). Entra cuando quieras para guardarlo en una cuenta.'
              : 'Tu progreso quedará guardado en tu cuenta y podrás recuperarlo en otro teléfono. Sin cuenta, el juego funciona igual: tu progreso vive en este teléfono.'}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleProvider('google')}
              disabled={busy !== null}
              className="btn-wood flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              <Chrome className="h-4 w-4" aria-hidden />
              {busy === 'google' ? 'Abriendo Google…' : 'Entrar con Google'}
            </button>
            <button
              type="button"
              onClick={() => void handleProvider('facebook')}
              disabled={busy !== null}
              className="btn-wood flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
            >
              <Facebook className="h-4 w-4" aria-hidden />
              {busy === 'facebook' ? 'Abriendo Facebook…' : 'Entrar con Facebook'}
            </button>
            {!showOtp ? (
              <button
                type="button"
                onClick={() => setShowOtp(true)}
                disabled={busy !== null}
                className="btn-wood flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Entrar con código por correo
              </button>
            ) : (
              <div className="space-y-2 rounded-lg bg-black/25 p-2 ring-1 ring-amber-200/15">
                {!otpSent ? (
                  <>
                    <label className="block text-xs font-bold text-amber-100/70" htmlFor="account-email">
                      Tu correo
                    </label>
                    <input
                      id="account-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      disabled={busy !== null}
                      className="w-full rounded-lg bg-black/40 px-3 py-2 text-sm font-bold text-amber-50 ring-1 ring-amber-200/25 placeholder:text-amber-100/40"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendCode()}
                      disabled={busy !== null || !email.trim()}
                      className="btn-wood flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
                    >
                      {busy === 'otp-send' ? 'Enviando…' : 'Enviar código'}
                    </button>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-amber-100/70" htmlFor="account-code">
                      Código de 6 dígitos enviado a {email.trim().toLowerCase()}
                    </label>
                    <input
                      id="account-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      disabled={busy !== null}
                      className="w-full rounded-lg bg-black/40 px-3 py-2 text-center text-lg font-extrabold tracking-[0.3em] text-amber-50 ring-1 ring-amber-200/25 placeholder:text-amber-100/40"
                    />
                    <button
                      type="button"
                      onClick={() => void handleVerifyCode()}
                      disabled={busy !== null || code.length !== 6}
                      className="btn-wood flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-60"
                    >
                      {busy === 'otp-verify' ? 'Verificando…' : 'Verificar código'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setCode('');
                      }}
                      disabled={busy !== null}
                      className="w-full text-center text-xs font-bold text-amber-100/70 underline"
                    >
                      Cambiar correo o reenviar
                    </button>
                  </>
                )}
              </div>
            )}
            {!localOnly && (
              <button
                type="button"
                onClick={handleLocalOnly}
                disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold text-amber-100/70 transition-transform active:scale-95 disabled:opacity-60"
              >
                <UserRound className="h-3.5 w-3.5" aria-hidden />
                Seguir sin cuenta
              </button>
            )}
          </div>
        </>
      )}

      {busy === 'return' && <p className="text-xs font-bold text-amber-100/70">Completando el inicio de sesión…</p>}
      {error && <p className="text-xs font-bold text-red-300">{error}</p>}
      {notice && <p className="text-xs font-bold text-emerald-300">{notice}</p>}
    </div>
  );
}
