/**
 * Extrae el mensaje real del servidor de un error de `supabase.functions.invoke`.
 *
 * Cuando una Edge Function rechaza la petición, supabase-js lanza un
 * `FunctionsHttpError` con el mensaje genérico "Edge Function returned a non-2xx
 * status code" y la `Response` en `context`: el mensaje útil (p. ej. "Esta sala ya
 * no existe.") viene en el cuerpo como `{ error: '...' }`. Si no hay mensaje del
 * servidor —o el fallo es de red— se devuelve null para que quien llama use el
 * mensaje genérico de "sin conexión".
 */
export async function serverErrorMessage(error: unknown): Promise<string | null> {
  if (!error || typeof error !== 'object') return null;
  const err = error as { message?: unknown; context?: unknown };
  const context = err.context as
    | { json?: () => Promise<unknown>; text?: () => Promise<string> }
    | undefined;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body && typeof body === 'object') {
        const message = (body as { error?: unknown }).error;
        if (typeof message === 'string' && message.trim()) return message;
      }
    } catch {
      // Cuerpo no-JSON o ya consumido: se intenta leerlo como texto.
      if (typeof context.text === 'function') {
        try {
          const text = await context.text();
          if (text.trim()) return text;
        } catch {
          // Sin cuerpo legible: se sigue con el mensaje del error.
        }
      }
    }
  }
  if (typeof err.message === 'string' && err.message.trim()) {
    // El mensaje genérico de estado HTTP y los fallos de red no dicen nada útil
    // al jugador: para esos casos se usa el mensaje genérico de "sin conexión".
    if (/non-2xx/i.test(err.message)) return null;
    if (/failed to send a request|failed to fetch|network/i.test(err.message)) return null;
    return err.message;
  }
  return null;
}
