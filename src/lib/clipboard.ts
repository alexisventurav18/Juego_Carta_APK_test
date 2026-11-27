/**
 * Copia texto al portapapeles, con el apaño del área oculta para los
 * navegadores/WebView donde `navigator.clipboard` no está (el APK viejo).
 * Lo usan el Perfil y Opciones para el código de respaldo: la misma
 * lógica en los dos sitios, sin duplicarla.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('sin portapapeles');
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      return true;
    } catch {
      return false;
    }
  }
}
