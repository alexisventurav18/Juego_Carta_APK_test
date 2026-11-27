import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Menú limpio (A1, A2, B1, B4, B5, A4): las entradas duplicadas del
// encabezado se quitan sin perder funciones, y el catálogo y el código de
// respaldo viven en un solo sitio cada uno. Como en lobby.test.ts, se
// comprueba el marcado en el código fuente (el alias `@/` no se resuelve
// en el runner tsx).
const lobby = readFileSync('src/components/Lobby.tsx', 'utf8');
const options = readFileSync('src/components/options/OptionsModal.tsx', 'utf8');
const profile = readFileSync('src/components/ProfileModal.tsx', 'utf8');
const store = readFileSync('src/components/Store.tsx', 'utf8');
const recovery = readFileSync('src/components/RecoveryModal.tsx', 'utf8');

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('menú limpio: una sola entrada por función', () => {
  it('A1: la ficha de Monedas es la única entrada a la Tienda', () => {
    assert.ok(!lobby.includes('ShoppingBag'), 'el botón "Tienda" ya no existe');
    assert.ok(
      lobby.includes('Tienda, tienes'),
      'la ficha de Monedas anuncia que es la Tienda',
    );
    assert.ok(
      lobby.includes("onClick={() => setStoreOpen(true)}"),
      'la ficha de Monedas abre la Tienda',
    );
  });

  it('A2: la ficha "Nv." es la única entrada al Perfil', () => {
    assert.ok(!lobby.includes('BarChart3'), 'el icono de Perfil ya no existe');
    assert.equal(
      count(lobby, 'setProfileOpen(true)'),
      1,
      'solo la ficha de nivel abre el Perfil',
    );
  });

  it('B5: la llama vive dentro del botón Logros, no como botón aparte', () => {
    assert.equal(
      count(lobby, "setProgressTab('achievements')"),
      1,
      'solo el botón Logros abre la pestaña Logros',
    );
    // La llama (icono + días) está en el mismo botón que el trofeo y el N/12.
    const logrosBtn = lobby.slice(lobby.indexOf("setProgressTab('achievements')") - 1600);
    assert.ok(logrosBtn.includes('<Flame'), 'el botón Logros lleva la llama');
    assert.ok(logrosBtn.includes('streakDays'), 'el botón Logros muestra los días de racha');
    assert.ok(
      !lobby.includes('Racha diaria:'),
      'ya no hay botón aparte de racha diaria',
    );
  });

  it('B1: Opciones ya no tiene selectores de apariencia; una fila abre la Tienda', () => {
    assert.ok(!options.includes('ThemePicker'), 'no quedan selectores de temas en Opciones');
    assert.ok(!options.includes('Reverso de las cartas'), 'no queda el selector de dorsos');
    assert.ok(!options.includes('Mesa de juego'), 'no queda el selector de mesas');
    assert.ok(!options.includes('Menú principal'), 'no queda el selector de fondos');
    assert.ok(options.includes('Abrir Tienda'), 'la fila de Apariencia abre la Tienda');
    assert.ok(
      options.includes('window.dispatchEvent(new CustomEvent(OPEN_STORE_EVENT))'),
      'la fila despacha el evento de abrir la Tienda',
    );
    assert.ok(
      store.includes("export const OPEN_STORE_EVENT = 'cartas:open-store'"),
      'el evento se define junto a la Tienda',
    );
    assert.ok(lobby.includes('OPEN_STORE_EVENT'), 'el menú importa el evento');
    assert.ok(
      lobby.includes('window.addEventListener(OPEN_STORE_EVENT'),
      'el menú escucha el evento de abrir la Tienda',
    );
    assert.ok(
      lobby.includes('window.removeEventListener(OPEN_STORE_EVENT'),
      'el menú limpia el listener',
    );
  });

  it('B4: el código de respaldo vive en Opciones, con copiar; el Perfil solo enlaza', () => {
    assert.ok(options.includes('Mi código de respaldo'), 'Opciones muestra el código');
    assert.ok(options.includes('Copiar código'), 'Opciones deja copiarlo');
    assert.ok(
      options.includes('encodeRecoveryCode'),
      'Opciones usa la misma fuente del código que usaba el Perfil',
    );
    assert.ok(
      profile.includes('Ver en Opciones'),
      'el Perfil enlaza a Opciones en vez de mostrar el código',
    );
    assert.ok(!profile.includes('encodeRecoveryCode'), 'el Perfil ya no genera el código');
    assert.ok(!profile.includes('Copiar código'), 'el Perfil ya no copia el código');
    assert.ok(
      recovery.includes('Opciones → Progreso en la nube'),
      'la recuperación manda a Opciones, no al Perfil',
    );
    assert.ok(
      !recovery.includes('Perfil → Código de respaldo'),
      'la recuperación ya no manda al Perfil',
    );
  });

  it('A4: la Tienda ya no muestra las insignias de victorias y racha', () => {
    assert.ok(!store.includes('Racha de'), 'la Tienda no muestra la racha');
    assert.ok(!store.includes('economy.wins'), 'la Tienda no muestra las victorias');
    assert.ok(!store.includes('victorias'), 'la Tienda no muestra el conteo de victorias');
  });
});
