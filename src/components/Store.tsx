import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, Coins, Lock, ShoppingBag, X } from 'lucide-react';
import { CARD_BACK_IMAGES } from './cagao/CardAssets';
import BuyConfirmDialog from './BuyConfirmDialog';
import PlayingCard from './PlayingCard';
import type { Card } from '@/games/cards';
import { cardFaceTheme } from '@/lib/cardThemes';
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
  type CardBackTheme,
} from '@/lib/visualPrefs';

const TABS: { id: CosmeticCategory; label: string }[] = [
  { id: 'cardBack', label: 'Dorsos de cartas' },
  { id: 'table', label: 'Mesas' },
  { id: 'menu', label: 'Fondo de inicio' },
];

/**
 * Evento que abre la Tienda desde otro sitio de la app (hoy, la fila
 * "Apariencia" de Opciones): la Tienda vive en el menú, que es quien
 * escucha este evento y la abre.
 */
export const OPEN_STORE_EVENT = 'cartas:open-store';

const TAB_HINT: Record<CosmeticCategory, string> = {
  cardBack: 'El diseño del reverso y de la cara de tus cartas.',
  table: 'El tapete donde se juega la partida.',
  menu: 'El fondo de la pantalla principal.',
};

/** Muestra de cara en la Tienda: Q♥, figura roja con cresta, a los colores de cada tema. */
const SAMPLE_FACE_CARD: Card = { id: 'corazones-12', suit: 'corazones', rank: 12 };

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
  /** Artículo pendiente de confirmar: se abre el diálogo antes de cobrar. */
  const [pendingPurchase, setPendingPurchase] = useState<{ id: string; label: string; price: number } | null>(
    null,
  );

  const equippedId = tab === 'cardBack' ? prefs.cardBack : tab === 'table' ? prefs.table : prefs.menu;
  const items = SHOP_ITEMS.filter((item) => item.category === tab);

  const equip = (id: string) => {
    if (tab === 'cardBack') update({ cardBack: id as typeof prefs.cardBack });
    else if (tab === 'table') update({ table: id as typeof prefs.table });
    else update({ menu: id as typeof prefs.menu });
    setMessage('¡Equipado! Se ve en toda la app.');
  };

  /** Solo se cobra al confirmar en el diálogo: un toque en la tarjeta o en Comprar abre la confirmación. */
  const confirmBuy = () => {
    if (!pendingPurchase) return;
    const { id, label, price } = pendingPurchase;
    setPendingPurchase(null);
    const result = buyCosmetic(tab, id);
    if (!result.ok) {
      setMessage(
        result.reason === 'funds'
          ? `Te faltan ${price - economy.coins} monedas. Gana partidas para conseguirlas.`
          : 'Ese artículo no está disponible.',
      );
      return;
    }
    // Comprar también equipa: un toque y el fondo ya se ve en toda la app.
    equip(id);
    setMessage(`¡Compraste y equipaste ${label}!`);
  };

  /** Tocar la vista previa compra (con confirmación) o equipa si ya es tuya:
      en el móvil el doble toque es incómodo y la tarjeta es el botón grande. */
  const activate = (item: (typeof SHOP_ITEMS)[number]) => {
    const owned = isOwned(economy, item.category, item.id);
    if (equippedId === item.id) return;
    if (owned) equip(item.id);
    else setPendingPurchase({ id: item.id, label: item.label, price: item.price });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
      role="dialog"
      aria-label="Tienda de cosméticos"
      onClick={onClose}
    >
      <div
        className="wood-panel flex max-h-full w-full max-w-2xl flex-col overflow-hidden p-4 [@media(min-width:640px)_and_(min-height:600px)]:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera fija: título, monedas y cierre siempre a la vista. */}
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

        {/*
          Todo lo demás baja en una sola zona con scroll. Antes solo la rejilla tenía scroll y
          la cabecera, el texto, las fichas y las pestañas se comían la altura en horizontal
          corto: la rejilla quedaba aplastada a unas tiras sin poder bajar. Ahora la cabecera
          queda fija arriba y el resto —incluidas las pestañas— baja junto.
        */}
        <div className="store-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <p className="mb-3 text-[13px] text-amber-100/80">
            Gana monedas jugando: Casino 100, Tres y Dos 80, Robaíto 70 y Cagao 60. +50 cada día y bonus por racha.
            Solo cambia cómo se ve el juego, nunca te da ventaja.
          </p>

          <div className="mb-3 flex gap-2" role="tablist" aria-label="Categorías de la tienda">
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

          <p className="mb-2 text-[13px] text-amber-100/70">
            {TAB_HINT[tab]} · {items.length} diseños
          </p>

          {message && (
            <p role="status" className="mb-2 rounded-xl bg-amber-400/20 px-3 py-2 text-[13px] font-bold text-amber-200 ring-1 ring-amber-300/50">
              {message}
            </p>
          )}

          {/* En escritorio grande el panel es más ancho y caben 4 columnas:
              los 8 dorsos se ven en 2 filas sin tanto scroll. En el teléfono
              (o ventana baja) siguen 2-3 columnas como antes. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [@media(min-width:640px)_and_(min-height:600px)]:grid-cols-4">
            {items.map((item) => {
              const owned = isOwned(economy, item.category, item.id);
              const equipped = equippedId === item.id;
              const canAfford = economy.coins >= item.price;
              const preview = previewStyle(item.category, item.id);
              // La cara de muestra usa los colores de ESTE dorso, no del equipado.
              const face = tab === 'cardBack' ? cardFaceTheme(item.id as CardBackTheme) : null;
              const faceVars = (face
                ? {
                    '--card-face-bg': face.bg,
                    '--card-face-frame': face.frame,
                    '--card-face-red': face.red,
                    '--card-face-ink': face.ink,
                    '--card-face-accent': face.accent,
                    '--card-face-crest-a': face.crestA,
                    '--card-face-crest-b': face.crestB,
                  }
                : {}) as CSSProperties;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col overflow-hidden rounded-xl ring-1 transition-transform active:scale-[0.98] ${
                    equipped ? 'bg-amber-400/15 ring-amber-300' : 'bg-black/30 ring-amber-200/20'
                  }`}
                >
                  {/*
                    La vista previa tiene la forma real de lo que se vende: el dorso es una carta
                    (2.5:3.5), la mesa un tapete ancho y el fondo una imagen ancha. Antes era una
                    banda de 80 px que recortaba el diseño a una tira y no se apreciaba nada.
                  */}
                  <button
                    type="button"
                    onClick={() => activate(item)}
                    aria-label={`${item.label}: ${
                      equipped ? 'equipado' : owned ? 'equipar' : `comprar por ${item.price} monedas`
                    }`}
                    className="relative flex items-center justify-center bg-black/40 p-3"
                  >
                    {tab === 'cardBack' ? (
                      // Reverso y cara del tema, lado a lado: el dorso cambia
                      // también cómo se ve la carta boca arriba.
                      <span className="flex items-end justify-center gap-2" aria-hidden>
                        <span
                          className="aspect-[2.5/3.5] w-16 shrink-0 rounded-md bg-cover bg-center shadow-lg ring-1 ring-white/25"
                          style={{ backgroundImage: preview.backgroundImage, backgroundColor: preview.backgroundColor }}
                        />
                        <span style={faceVars}>
                          <PlayingCard card={SAMPLE_FACE_CARD} size="sm" />
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`w-full shrink-0 rounded-lg bg-cover bg-center shadow-lg ring-1 ring-white/25 ${
                          tab === 'table' ? 'aspect-[16/10]' : 'aspect-[16/9]'
                        }`}
                        style={{ backgroundImage: preview.backgroundImage, backgroundColor: preview.backgroundColor }}
                        aria-hidden
                      />
                    )}
                    {equipped ? (
                      <span className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-stone-900">
                        <Check className="h-3 w-3" aria-hidden />
                        Equipado
                      </span>
                    ) : !owned && !canAfford ? (
                      <span className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-extrabold text-amber-200 ring-1 ring-white/20">
                        <Lock className="h-3 w-3" aria-hidden />
                        Bloqueado
                      </span>
                    ) : null}
                    {/* El precio vive sobre la vista previa y en el botón de comprar: en pantallas
                        cortas la parte de abajo de la tarjeta queda bajo el pliegue y sin esto no se ve. */}
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 text-[11px] font-extrabold text-amber-300 ring-1 ring-amber-300/60">
                      {item.price === 0 ? (
                        'Gratis'
                      ) : (
                        <>
                          <Coins className="h-3.5 w-3.5" aria-hidden />
                          {item.price}
                        </>
                      )}
                    </span>
                  </button>
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
                    <p className="text-[13px] font-extrabold leading-tight text-amber-50">{item.label}</p>
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
                          onClick={() => setPendingPurchase({ id: item.id, label: item.label, price: item.price })}
                          disabled={!canAfford}
                          className="btn-gold flex min-h-[40px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg text-[13px] font-extrabold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {canAfford ? (
                            <>
                              <Coins className="h-4 w-4" aria-hidden />
                              Comprar · {item.price}
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4" aria-hidden />
                              Te faltan {item.price - economy.coins}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[13px] text-amber-100/60">
            Lo que ya tenías equipado sigue siendo tuyo, sin pagar nada.
          </p>
        </div>

        {pendingPurchase &&
          createPortal(
            <BuyConfirmDialog
              itemLabel={pendingPurchase.label}
              price={pendingPurchase.price}
              coins={economy.coins}
              onConfirm={confirmBuy}
              onCancel={() => setPendingPurchase(null)}
            />,
            document.body,
          )}
      </div>
    </div>
  );
}
