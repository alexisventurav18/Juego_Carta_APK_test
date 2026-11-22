import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// La opción de recuperar no se puede probar montando componentes en Node
// (la cadena de imports usa el alias `@/` y el runner tsx no lo resuelve):
// se comprueba el marcado en el código fuente, como hace lobbyWeb.test.ts.
const lobby = readFileSync('src/components/Lobby.tsx', 'utf8');
const options = readFileSync('src/components/options/OptionsModal.tsx', 'utf8');
const recovery = readFileSync('src/components/RecoveryModal.tsx', 'utf8');
const profile = readFileSync('src/components/ProfileModal.tsx', 'utf8');

/**
 * "Recuperar mi progreso" vive en Opciones, no en el menú: su fila en la
 * columna del menú (fixed inset-0 overflow-hidden, sin scroll) robaba ~38 px
 * a las tarjetas de juego, y con la tarjeta del torneo encima las tarjetas
 * se aplastaban hasta ~95 px en horizontal corto (800x360 / 819x378): el
 * arte desaparecía y la segunda línea de la descripción se cortaba.
 */
describe('recuperar progreso: en Opciones, no en la columna del menú', () => {
  it('el menú ya no tiene la fila de recuperar (la columna vuelve a caber)', () => {
    assert.ok(!lobby.includes('Recuperar mi progreso'), 'el menú no muestra la opción');
    assert.ok(
      !lobby.includes('onClick={() => setRecoveryOpen(true)}'),
      'ningún botón del menú abre la recuperación (solo el listener del evento)',
    );
  });

  it('el modal de recuperación sigue viviendo en el menú (al restaurar refresca nombre y avatar)', () => {
    assert.ok(lobby.includes('recoveryOpen && ('), 'el modal sigue condicionado a recoveryOpen');
    assert.ok(lobby.includes('<RecoveryModal'), 'el menú renderiza RecoveryModal');
    assert.ok(lobby.includes('setName(getStoredName())'), 'al restaurar se refresca el nombre');
  });

  it('el menú escucha el evento que pide abrir la recuperación', () => {
    assert.ok(lobby.includes('OPEN_RECOVERY_EVENT'), 'el menú importa el evento');
    assert.ok(
      lobby.includes('window.addEventListener(OPEN_RECOVERY_EVENT'),
      'el menú escucha el evento',
    );
    assert.ok(
      lobby.includes('window.removeEventListener(OPEN_RECOVERY_EVENT'),
      'el menú limpia el listener',
    );
  });

  it('Opciones tiene su propio apartado de progreso en la nube con el botón', () => {
    assert.ok(options.includes('Progreso en la nube'), 'el apartado existe');
    assert.ok(options.includes('Recuperar mi progreso'), 'el botón existe');
    assert.ok(
      options.includes('código de respaldo'),
      'el apartado explica que usa el código de respaldo',
    );
  });

  it('el botón de Opciones cierra el panel y pide abrir la recuperación', () => {
    assert.ok(
      options.includes('window.dispatchEvent(new CustomEvent(OPEN_RECOVERY_EVENT))'),
      'el botón despacha el evento',
    );
    // Sin cerrar Opciones antes, el modal de recuperación (z-50) quedaría
    // tapado por el panel de Opciones (z-100).
    const openRecovery = options.slice(options.indexOf('const openRecovery'));
    assert.ok(openRecovery.includes('onClose()'), 'primero se cierran las Opciones');
  });

  it('el evento se define junto al modal de recuperación', () => {
    assert.ok(
      recovery.includes("export const OPEN_RECOVERY_EVENT = 'cartas:open-recovery'"),
      'el evento se define en RecoveryModal',
    );
  });

  it('el aviso de conflicto del perfil apunta a Opciones, no al menú', () => {
    assert.ok(profile.includes('en Opciones para verla'), 'el aviso apunta a Opciones');
    assert.ok(!profile.includes('en el menú para verla'), 'el aviso ya no apunta al menú');
  });
});
