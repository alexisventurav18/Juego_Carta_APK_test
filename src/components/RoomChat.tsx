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
}

/**
 * Chat de texto de la sala online: botón flotante, panel con emojis y
 * mensajes predeterminados, y aviso temporal con el último mensaje.
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
export default function RoomChat({ toast, myId, myName, onSend, defaultOpen = false }: RoomChatProps) {
  const [open, setOpen] = useState(defaultOpen);
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
      {/* Aviso temporal con el último mensaje (propio o ajeno), ~4 s. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-12 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-xl bg-black/60 px-3 py-1.5 text-center text-xs font-semibold text-amber-50 ring-1 ring-white/15 sm:text-sm"
        >
          {chatToastText(toast)}
        </div>
      )}

      {/* Panel con emojis y mensajes predeterminados. */}
      {open && (
        <div className="fixed bottom-[136px] left-3 z-50 flex max-h-[62dvh] w-[min(92vw,320px)] flex-col gap-2 overflow-y-auto rounded-2xl bg-stone-900/95 p-3 text-amber-50 shadow-2xl ring-1 ring-white/15">
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

          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Emojis">
            {CHAT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Enviar ${emoji}`}
                onClick={() => send({ kind: 'emoji', emoji })}
                className="flex min-h-[44px] items-center justify-center rounded-xl bg-white/10 text-2xl transition-transform active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>

          <p className="pt-1 text-xs font-bold text-amber-200/80">Mensajes rápidos</p>
          <div className="flex flex-col gap-1.5">
            {QUICK_MESSAGES.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => send({ kind: 'quick', text })}
                className="min-h-[40px] rounded-lg bg-white/5 px-3 py-2 text-left text-sm font-semibold text-amber-50 transition-transform active:scale-[0.98]"
              >
                {text}
              </button>
            ))}
          </div>
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
