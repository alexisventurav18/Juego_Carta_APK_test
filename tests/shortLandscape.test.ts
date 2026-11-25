import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Las pantallas de fin de partida y el perfil no se pueden renderizar en
// Node: su cadena de imports usa el alias `@/` y el runner tsx no lo
// resuelve. Se comprueba el marcado y el CSS en el código fuente, como hace
// waitingRoom.test.ts.
const victory = readFileSync('src/components/VictoryCelebration.tsx', 'utf8');
const defeat = readFileSync('src/components/DefeatNotice.tsx', 'utf8');
const xpBar = readFileSync('src/components/XpGainBar.tsx', 'utf8');
const profile = readFileSync('src/components/ProfileModal.tsx', 'utf8');
const cagao = readFileSync('src/components/cagao/GameTable.tsx', 'utf8');
const tresydos = readFileSync('src/components/TresYDosTable.tsx', 'utf8');
const robaito = readFileSync('src/components/robaito/RobaitoTable.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');

// El primer bloque de horizontal corto (el de los resultados y el perfil).
const mediaQuery = '@media (orientation: landscape) and (max-height: 500px)';
const firstBlockStart = css.indexOf(mediaQuery);
const secondBlockStart = css.indexOf(mediaQuery, firstBlockStart + 1);
const shortLandscape = css.slice(firstBlockStart, secondBlockStart);

describe('pantalla de victoria/derrota en horizontal corto', () => {
  it('el overlay de victoria tiene scroll y el contenido va con m-auto (sin centrado flex que recorte)', () => {
    assert.ok(
      victory.includes('fixed inset-0 z-50 flex overflow-y-auto'),
      'VictoryCelebration: el overlay tiene overflow-y-auto',
    );
    assert.ok(
      victory.includes('relative m-auto w-full max-w-md'),
      'VictoryCelebration: el contenido lleva m-auto',
    );
    assert.ok(!victory.includes('items-center justify-center'), 'VictoryCelebration: sin items-center que recorte');
  });

  it('el overlay de derrota tiene scroll y el contenido va con m-auto', () => {
    assert.ok(
      defeat.includes('fixed inset-0 z-50 flex overflow-y-auto'),
      'DefeatNotice: el overlay tiene overflow-y-auto',
    );
    assert.ok(
      defeat.includes('relative m-auto w-full max-w-md'),
      'DefeatNotice: el contenido lleva m-auto',
    );
  });

  it('victoria y derrota llevan los ganchos de compactación', () => {
    for (const [name, src] of [
      ['VictoryCelebration', victory],
      ['DefeatNotice', defeat],
    ] as const) {
      for (const hook of ['end-notice-icon', 'end-notice-message', 'end-notice-actions']) {
        assert.ok(src.includes(hook), `${name}: lleva la clase ${hook}`);
      }
    }
    assert.ok(victory.includes('end-notice-reward'), 'VictoryCelebration: lleva end-notice-reward');
  });

  it('la barra de XP lleva los ganchos de compactación', () => {
    assert.ok(xpBar.includes('xp-gain-bar'), 'XpGainBar: la raíz lleva xp-gain-bar');
    assert.ok(xpBar.includes('xp-bar h-3.5'), 'XpGainBar: la barra lleva xp-bar');
  });

  it('el CSS compacta el trofeo, el título, la XP y los botones', () => {
    assert.ok(shortLandscape.includes('.end-notice .end-notice-icon {'), 'el CSS compacta el trofeo');
    assert.ok(shortLandscape.includes('height: 48px !important;'), 'el trofeo baja a 48 px');
    assert.ok(shortLandscape.includes('.end-notice-title {'), 'el CSS compacta el título');
    assert.ok(shortLandscape.includes('7dvh'), 'el título usa 7dvh');
    assert.ok(shortLandscape.includes('.end-notice .xp-gain-bar .xp-bar {'), 'el CSS compacta la barra de XP');
    assert.ok(shortLandscape.includes('.end-notice .end-notice-actions button {'), 'el CSS compacta los botones');
    assert.ok(shortLandscape.includes('min-height: 36px !important;'), 'los botones bajan a 36 px');
  });
});

describe('perfil en horizontal corto', () => {
  it('el overlay tiene scroll y el panel va con m-auto', () => {
    assert.ok(
      profile.includes('fixed inset-0 z-50 flex overflow-y-auto'),
      'ProfileModal: el overlay tiene overflow-y-auto',
    );
    assert.ok(profile.includes('profile-panel wood-panel relative m-auto'), 'ProfileModal: el panel lleva m-auto');
  });

  it('el panel lleva los ganchos de compactación', () => {
    for (const hook of ['profile-avatar', 'profile-level', 'profile-stats', 'profile-modes']) {
      assert.ok(profile.includes(hook), `ProfileModal: lleva la clase ${hook}`);
    }
  });

  it('el CSS compacta el panel del perfil', () => {
    assert.ok(shortLandscape.includes('.profile-panel {'), 'el CSS compacta el perfil');
    assert.ok(shortLandscape.includes('padding: 12px !important;'), 'el panel baja a 12 px de relleno');
    assert.ok(shortLandscape.includes('.profile-panel .profile-avatar {'), 'el CSS achica el avatar');
  });
});

describe('paneles de fin de partida en horizontal corto', () => {
  it('los tres paneles llevan game-end-panel y van con m-auto', () => {
    for (const [name, src] of [
      ['El Cagao', cagao],
      ['Tres y Dos', tresydos],
      ['El Robaíto', robaito],
    ] as const) {
      assert.ok(src.includes('game-end-panel'), `${name}: el panel lleva game-end-panel`);
      assert.ok(src.includes('game-end-panel') && src.includes('my-auto'), `${name}: el panel lleva my-auto`);
      assert.ok(src.includes('game-end-rows'), `${name}: las filas llevan game-end-rows`);
    }
  });

  it('los tres overlays tienen scroll', () => {
    for (const [name, src] of [
      ['El Cagao', cagao],
      ['Tres y Dos', tresydos],
      ['El Robaíto', robaito],
    ] as const) {
      assert.ok(src.includes('overflow-y-auto'), `${name}: el overlay tiene overflow-y-auto`);
    }
  });

  it('la carta del perdedor de El Cagao es más grande en horizontal corto', () => {
    assert.ok(cagao.includes("'--rh': 'clamp(44px, 12dvh, 90px)'"), 'El Cagao: la carta usa 12dvh');
    assert.ok(!cagao.includes('15.7dvh'), 'El Cagao: ya no usa 15.7dvh');
  });

  it('los overlays centran el panel en horizontal', () => {
    for (const [name, src] of [
      ['El Cagao', cagao],
      ['Tres y Dos', tresydos],
      ['El Robaíto', robaito],
    ] as const) {
      assert.ok(src.includes('flex justify-center overflow-y-auto'), `${name}: el overlay centra en horizontal`);
    }
  });

  it('los paneles son más anchos que antes', () => {
    assert.ok(cagao.includes('game-end-panel') && cagao.includes('max-w-2xl'), 'El Cagao: el panel es max-w-2xl');
    assert.ok(robaito.includes('game-end-panel') && robaito.includes('max-w-2xl'), 'El Robaíto: el panel es max-w-2xl');
    assert.ok(tresydos.includes('game-end-panel') && tresydos.includes('max-w-3xl'), 'Tres y Dos: el panel es max-w-3xl');
  });

  it('las cartas de muestra de Tres y Dos y El Robaíto crecen en horizontal corto', () => {
    assert.ok(tresydos.includes("'--rh': 'clamp(40px, 12.5dvh, 67px)'"), 'Tres y Dos: la carta usa 12.5dvh');
    assert.ok(robaito.includes("'--rh': 'clamp(40px, 12.5dvh, 67px)'"), 'El Robaíto: la carta usa 12.5dvh');
  });

  it('el CSS agranda los paneles de fin de partida igual en los tres modos', () => {
    assert.ok(shortLandscape.includes('.game-end-panel {'), 'el CSS regula los paneles');
    assert.ok(shortLandscape.includes('padding: 10px 16px !important;'), 'los paneles suben a 10 px de relleno');
    assert.ok(shortLandscape.includes('.game-end-panel h2 {'), 'el CSS regula el título del panel');
    assert.ok(shortLandscape.includes('font-size: clamp(18px, 5dvh, 26px) !important;'), 'el título sube a 18 px en horizontal corto');
    assert.ok(shortLandscape.includes('.game-end-panel button {'), 'el CSS regula los botones del panel');
    assert.ok(shortLandscape.includes('min-height: clamp(40px, 11dvh, 48px) !important;'), 'los botones suben a 40 px');
  });

  it('el CSS agranda el panel de resultado de ronda de Casino', () => {
    assert.ok(shortLandscape.includes('.round-result-panel-compact h2 {'), 'el CSS regula el título de Casino');
    assert.ok(shortLandscape.includes('font-size: clamp(19px, 5dvh, 26px);'), 'el título de Casino sube a 19 px');
    assert.ok(shortLandscape.includes('.round-result-panel-compact button {'), 'el CSS regula los botones de Casino');
    assert.ok(shortLandscape.includes('min-height: clamp(40px, 11dvh, 48px);'), 'los botones de Casino suben a 40 px');
  });
});
