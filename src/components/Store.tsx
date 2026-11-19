import { useState } from 'react';
import { Check, Coins, Flame, Lock, ShoppingBag, Trophy, X } from 'lucide-react';
import { CARD_BACK_IMAGES } from './cagao/CardAssets';
import {
  buyCosmetic,
  isOwned,
  SHOP_ITEMS,
  useEconomy,
  type CosmeticCategory,
} from '@/lib/economy';
import {
  MENU_THEMES,
  TABLE_THEMES,
  useVisualPrefs,
} from '@/lib/visualPrefs';

const TABS: { id: CosmeticCategory; label: string }[] = [
  { id: 'cardBack', label: 'Dorsos de cartas' },
  { id: 'table', label: 'Mesas' },
  { id: 'menu', label: 'Fondo de inicio' },
];

const TAB_HINT: Record<CosmeticCategory, string> = {
  cardBack: 'El diseño del reverso de tus cartas.',
  table: 'El tapete donde se juega la partida.',
  menu: 'El fondo de la pantalla principal.',
};

function previewStyle(category: CosmeticCategory, id: string): { backgroundImage?: string; backgroundColor?: string } {
  if (category === 'cardBack') {
    return { backgroundImage: CARD_BACK_IMAGES[id as keyof typeof CARD_BACK_IMAGES], backgroundColor: '#7a3a10' };
  }
  if (category === 'table') {
    const theme = TABLE_THEMES.find((t) => t.id === id);
    return { backgroundImage: theme?.image, backgroundColor: theme?.color };
  }
  const theme = MENU_THEMES.find((t) => t.id === id);
  return { backgroundImage: theme?.image, backgroundColor: theme?.color };
}

export default function Store({ onClose }: { onClose: () => void }) {
  const economy = useEconomy();
  const { prefs, update } = useVisualPrefs();
  const [tab, setTab] = useState<CosmeticCategory>('cardBack');
  const [message, setMessage] = useState<string | null>(null);

  const equippedId = tab === 'cardBack' ? prefs.cardBack : tab === 'table' ? prefs.table : prefs.menu;
  const items = SHOP_ITEMS.filter((item) => item.category === tab);

  const equip = (id: string) => {
    if (tab === 'cardBack') update({ cardBack: id as typeof prefs.cardBack });
    else if (tab === 'table') update({ table: id as typeof prefs.table });
    else update({ menu: id as typeof prefs.menu });
    setMessage('¡Equipado! Se ve en toda la app.');
  };

  const buy = (id: string, label: string, price: number) => {
    const result = buyCosmetic(tab, id);
    if (!result.ok) {
      setMessage(
        result.reason === 'funds'
          ? `Te faltan ${price - economy.coins} monedas. Gana partidas para conseguirlas.`
          : 'Ese artículo no está disponible.',
      );
      return;
    }
    setMessage(`¡Compraste ${label}! Tócalo de nuevo para equiparlo.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
      role="dialog"
      aria-label="Tienda de cosméticos"
      onClick={onClose}
    >
      <div
        className="wood-panel flex max-h-full w-full max-w-2xl flex-col p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-amber-50">
            <ShoppingBag className="h-5 w-5 text-amber-300" aria-hidden />
            Tienda
          </h2>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1.5 text-sm font-extrabold text-amber-300 ring-1 ring-amber-300/60">
              <Coins className="h-4 w-4" aria-hidden />
              {economy.coins} monedas
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar la tienda"
              className="wood-chip grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-lg transition-transform active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mb-3 shrink-0 text-[13px] text-amber-100/80">
          Gana partidas para conseguir monedas: Casino 100, Tres y Dos 80, El Robaíto 70 y El Cagao 60,
          más 50 al entrar cada día y bonus por racha. Solo cambia cómo se ve el juego, nunca te da ventaja.
        </p>

        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 text-[13px] font-bold text-amber-100/85">
          <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 ring-1 ring-amber-200/20">
            <Trophy className="h-4 w-4 text-amber-300" aria-hidden />
            {economy.wins} {economy.wins === 1 ? 'victoria' : 'victorias'}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 ring-1 ring-amber-200/20">
            <Flame className="h-4 w-4 text-orange-400" aria-hidden />
            Racha de {economy.streak}
          </span>
        </div>

        <div className="mb-3 flex shrink-0 gap-2" role="tablist" aria-label="Categorías de la tienda">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setMessage(null);
              }}
              className={`min-h-[40px] flex-1 touch-manipulation rounded-lg px-2 text-[13px] font-extrabold transition-transform active:scale-95 ${
                tab === id ? 'btn-gold' : 'btn-wood'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-2 shrink-0 text-[13px] text-amber-100/70">{TAB_HINT[tab]}</p>

        {message && (
          <p role="status" className="mb-2 shrink-0 rounded-xl bg-amber-400/20 px-3 py-2 text-[13px] font-bold text-amber-200 ring-1 ring-amber-300/50">
            {message}
          </p>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {items.map((item) => {
            const owned = isOwned(economy, item.category, item.id);
            const equipped = equippedId === item.id;
            const canAfford = economy.coins >= item.price;
            const preview = previewStyle(item.category, item.id);
            return (
              <div
                key={item.id}
                className={`flex flex-col overflow-hidden rounded-xl ring-1 ${
                  equipped ? 'bg-amber-400/15 ring-amber-300' : 'bg-black/30 ring-amber-200/20'
                }`}
              >
                <div
                  className="h-20 w-full shrink-0 bg-cover bg-center"
                  style={{ backgroundImage: preview.backgroundImage, backgroundColor: preview.backgroundColor }}
                  aria-hidden
                />
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
                  <p className="text-[13px] font-extrabold leading-tight text-amber-50">{item.label}</p>
                  <p className="flex items-center gap-1 text-[13px] font-bold text-amber-300">
                    {item.price === 0 ? (
                      'Gratis'
                    ) : (
                      <>
                        <Coins className="h-4 w-4" aria-hidden />
                        {item.price} monedas
                      </>
                    )}
                  </p>
                  <div className="mt-auto">
                    {equipped ? (
                      <span className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-amber-400/25 text-[13px] font-extrabold text-amber-300 ring-1 ring-amber-300/60">
                        <Check className="h-4 w-4" aria-hidden />
                        Equipado
                      </span>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => equip(item.id)}
                        className="btn-gold flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-lg text-[13px] font-extrabold transition-transform active:scale-95"
                      >
                        Equipar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => buy(item.id, item.label, item.price)}
                        disabled={!canAfford}
                        className="btn-gold flex min-h-[40px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg text-[13px] font-extrabold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Lock className="h-4 w-4" aria-hidden />
                        {canAfford ? 'Comprar' : `Te faltan ${item.price - economy.coins}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 shrink-0 text-center text-[13px] text-amber-100/60">
          Lo que ya tenías equipado sigue siendo tuyo, sin pagar nada.
        </p>
      </div>
    </div>
  );
}
