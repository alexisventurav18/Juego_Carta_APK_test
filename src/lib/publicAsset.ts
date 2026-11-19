/**
 * URL del recurso de `public/`, compatible con el despliegue web y el paquete Android de Capacitor.
 *
 * Devuelve una URL ABSOLUTA resuelta contra el documento. Con `base: './'` (vite.config.ts) la ruta cruda
 * sería `./images/...`; si esa ruta viaja dentro de una variable CSS (`--menu-bg-image: url(...)`), el
 * navegador la resuelve contra la hoja de estilos (`/assets/index-*.css`) y acaba en `/assets/images/...`,
 * que no existe (404). Resolviéndola aquí, el fondo carga igual desde un `style` inline que desde una clase.
 */
export function publicAsset(path: string): string {
  // Fuera de Vite (p. ej. pruebas con tsx) import.meta.env no existe: se usa '/'.
  const base = import.meta.env?.BASE_URL ?? '/';
  const relative = `${base}${path.replace(/^\/+/, '')}`;
  if (typeof document === 'undefined') return relative;
  try {
    return new URL(relative, document.baseURI).href;
  } catch {
    return relative;
  }
}
