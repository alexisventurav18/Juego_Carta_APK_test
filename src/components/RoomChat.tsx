import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  canSendChat,
  CHAT_EMOJIS,
  chatToastText,
  QUICK_MESSAGES,
  type RoomChatMessage,
} from '../lib/roomChat';

interface RoomChatProps {
  /** Último mensaje válido que se muestra como aviso (null si no hay ninguno visible). */
  toast: RoomChatMessage | null;
  /** Id y nombre del jugador local: con ellos se firman los mensajes que envía. */
  myId: string;
  myName: string;
  /** Envía el mensaje (RoomView lo manda por Broadcast y muestra el eco local). */
  onSend: (msg: RoomChatMessage) => void;
  /** Solo para pruebas: abre el panel desde el primer render. */
  defaultOpen?: boolean;
  /** Solo para pruebas: abre el panel en esa pestaña desde el primer render. */
  defaultTab?: 'emojis' | 'quick';
}

/**
 * Chat de texto de la sala online: botón flotante, panel con emojis y
 * mensajes predeterminados en dos pestañas, y aviso temporal con el último
 * mensaje.
 *
 * Vive en RoomView, fuera de las mesas: por eso funciona igual en Casino,
 * Tres y Dos, El Cagao y El Robaíto sin tocar ninguna mesa. Va con
 * `position: fixed` por encima de la mesa (z-50) y no recibe los
 * `touch-none` de la mesa, así que sus botones se pueden pulsar.
 *
 * El botón flota en la esquina inferior izquierda, por encima de la placa
 * del jugador: abajo a la derecha están los botones de juego (Capturar,
 * Subir...) y en el centro está la mano, así que ahí no tapa nada.
 */
export default function RoomChat({ toast, myId, myName, onSend, defaultOpen = false, defaultTab = 'emojis' }: RoomChatProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<'emojis' | 'quick'>(defaultTab);
  const lastSentRef = useRef<number | null>(null);

  const send = (content: { kind: 'emoji'; emoji: string } | { kind: 'quick'; text: string }) => {
    const now = Date.now();
    // Anti-spam: si no pasaron 3 s desde el último mensaje propio, se ignora.
    if (!canSendChat(lastSentRef.current, now)) return;
    lastSentRef.current = now;
    onSend({ ...content, fromId: myId, fromName: myName, at: now });
    setOpen(false);
  };

  return (
    <>
      {/* Aviso temporal con el último mensaje (propio o ajeno), ~4 s.
          El emoji va en su propio elemento, grande y animado; el texto
          rápido sigue viéndose normal. La clave es la fecha del mensaje:
          cada aviso nuevo vuelve a entrar con el pop. */}
      {toast && (
        <div
          key={toast.at}
          role="status"
          aria-live="polite"
          className="chat-toast pointer-events-none fixed left-1/2 top-12 z-50 flex max-w-[92vw] -translate-x-1/2 items-center justify-center gap-2 rounded-xl bg-black/60 px-3 py-1.5 text-amber-50 ring-1 ring-white/15"
        >
          {toast.kind === 'emoji' ? (
            <>
              <span className="max-w-[46vw] truncate text-xs font-semibold sm:text-sm">{toast.fromName}:</span>
              <span aria-hidden="true" className="chat-toast-emoji inline-block text-3xl leading-none sm:text-4xl">
                {toast.emoji}
              </span>
            </>
          ) : (
            <span className="truncate text-xs font-semibold sm:text-sm">{chatToastText(toast)}</span>
          )}
        </div>
      )}

      {/* Panel con emojis y mensajes predeterminados, en dos secciones:
          solo se ve una a la vez para que el panel no obligue a desplazar. */}
      {open && (
        <div className="fixed bottom-[136px] left-3 z-50 flex max-h-[62dvh] w-[min(92vw,320px)] flex-col gap-2 overflow-hidden rounded-2xl bg-stone-900/95 p-3 text-amber-50 shadow-2xl ring-1 ring-white/15">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold">Chat de mesa</p>
            <button
              type="button"
              aria-label="Cerrar chat"
              onClick={() => setOpen(false)}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-white/10 text-amber-50 transition-transform active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div role="tablist" aria-label="Secciones del chat" className="flex shrink-0 gap-1 rounded-xl bg-white/5 p-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'emojis'}
              onClick={() => setTab('emojis')}
              className={`min-h-[36px] flex-1 rounded-lg text-sm font-extrabold transition-transform active:scale-95 ${
                tab === 'emojis' ? 'bg-amber-400/25 text-amber-200 ring-1 ring-amber-300/50' : 'text-amber-100/70'
              }`}
            >
              Emojis
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'quick'}
              onClick={() => setTab('quick')}
              className={`min-h-[36px] flex-1 rounded-lg text-sm font-extrabold transition-transform active:scale-95 ${
                tab === 'quick' ? 'bg-amber-400/25 text-amber-200 ring-1 ring-amber-300/50' : 'text-amber-100/70'
              }`}
            >
              Mensajes
            </button>
          </div>

          {tab === 'emojis' ? (
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Emojis">
              {CHAT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Enviar ${emoji}`}
                  onClick={() => send({ kind: 'emoji', emoji })}
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-white/10 text-2xl transition-transform active:scale-125 active:-rotate-6"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Mensajes rápidos">
              {QUICK_MESSAGES.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => send({ kind: 'quick', text })}
                  className="min-h-[36px] shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-left text-[13px] font-semibold text-amber-50 transition-transform active:scale-[0.98]"
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botón flotante para abrir/cerrar el chat. */}
      <button
        type="button"
        aria-label={open ? 'Cerrar chat' : 'Abrir chat'}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-[84px] left-3 z-50 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-amber-500 text-2xl shadow-xl ring-2 ring-amber-200/60 transition-transform active:scale-95"
      >
        {open ? <X className="h-5 w-5 text-stone-900" /> : '💬'}
      </button>
    </>
  );
}
