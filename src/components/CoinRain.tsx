import { useState } from 'react';
import { COIN_RAIN_COUNT } from '../lib/motion';

interface Coin {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

function makeCoins(count: number): Coin[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.4,
    duration: 2.4 + Math.random() * 1.6,
    size: 22 + Math.random() * 14,
  }));
}

/**
 * Lluvia de monedas de la victoria: ~22 monedas doradas que caen girando,
 * con el mismo patrón de piezas aleatorias del confeti. Capa decorativa:
 * `pointer-events: none`, por debajo del contenido del aviso, y solo
 * anima `transform` y `opacity`.
 */
export default function CoinRain({ count = COIN_RAIN_COUNT }: { count?: number }) {
  const [coins] = useState(() => makeCoins(count));

  return (
    <div aria-hidden className="coin-rain-layer">
      {coins.map((coin) => (
        <span
          key={coin.id}
          className="coin-rain-piece"
          style={{
            left: `${coin.left}%`,
            width: coin.size,
            height: coin.size,
            fontSize: coin.size * 0.55,
            animationDuration: `${coin.duration}s`,
            animationDelay: `${coin.delay}s`,
          }}
        >
          $
        </span>
      ))}
    </div>
  );
}
