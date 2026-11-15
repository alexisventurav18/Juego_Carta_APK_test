import { useMemo, type CSSProperties } from 'react';
import { decodeAvatar } from '@/games/avatar';
import AvatarSvg from './AvatarSvg';

interface AvatarProps {
  /** Código del avatar (ver games/avatar.ts). */
  code: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** Foto de perfil redonda. El tamaño y el aro los define quien la usa mediante `className`. */
export default function Avatar({ code, className = '', style, title }: AvatarProps) {
  const config = useMemo(() => decodeAvatar(code), [code]);
  if (!config) return null;
  return (
    <span className={`block shrink-0 overflow-hidden rounded-full ${className}`} style={style}>
      <AvatarSvg config={config} title={title} className="block h-full w-full" />
    </span>
  );
}
