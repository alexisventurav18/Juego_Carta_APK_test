/** URL relativa compatible con el despliegue web y el paquete Android de Capacitor. */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
