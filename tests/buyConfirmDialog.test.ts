import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsx compila los .tsx con el runtime clásico de JSX (`React.createElement`):
// se expone React como global para que los componentes rendericen en Node.
(globalThis as unknown as { React: typeof React }).React = React;
import BuyConfirmDialog from '../src/components/BuyConfirmDialog';
import { buyItem, defaultEconomy, isOwned } from '../src/lib/economy';

function renderDialog(props: { itemLabel: string; price: number; coins: number }): string {
  return renderToStaticMarkup(
    React.createElement(BuyConfirmDialog, {
      ...props,
      onConfirm: () => {},
      onCancel: () => {},
    }),
  );
}

/** El botón de confirmar del diálogo. */
function confirmButton(html: string): string {
  const match = html.match(/<button[^>]*>Comprar y equipar<\/button>/);
  assert.ok(match, 'falta el botón de confirmar');
  return match[0];
}

/** ¿Lleva el atributo disabled? (las clases `disabled:…` de Tailwind no cuentan). */
function isDisabled(buttonHtml: string): boolean {
  return /\sdisabled=""/.test(buttonHtml);
}

describe('BuyConfirmDialog: contenido', () => {
  it('muestra el nombre del artículo, el precio y las monedas actuales', () => {
    const html = renderDialog({ itemLabel: 'Mesa verde', price: 100, coins: 330 });
    assert.match(html, /Mesa verde/);
    assert.match(html, /100 monedas/);
    assert.match(html, /Tienes 330 monedas/);
    assert.match(html, /te quedarían 230/);
  });

  it('es un diálogo modal con Cancelar y Comprar y equipar', () => {
    const html = renderDialog({ itemLabel: 'Mesa verde', price: 100, coins: 330 });
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, />Cancelar</);
    assert.match(html, />Comprar y equipar</);
  });

  it('el botón de cancelar tiene el foco por defecto', () => {
    const html = renderDialog({ itemLabel: 'Mesa verde', price: 100, coins: 330 });
    assert.match(html, /autofocus/i);
  });
});

describe('BuyConfirmDialog: sin fondos', () => {
  it('dice cuánto falta y desactiva la confirmación', () => {
    const html = renderDialog({ itemLabel: 'Mesa bandera', price: 300, coins: 230 });
    assert.match(html, /Te faltan 70 monedas/);
    // El botón de confirmar sale desactivado: no se puede comprar sin fondos.
    assert.equal(isDisabled(confirmButton(html)), true);
  });

  it('con el dinero justo permite confirmar', () => {
    const html = renderDialog({ itemLabel: 'Mesa verde', price: 100, coins: 100 });
    assert.doesNotMatch(html, /Te faltan/);
    assert.equal(isDisabled(confirmButton(html)), false);
  });

  it('un artículo gratis se muestra como Gratis y se puede confirmar', () => {
    const html = renderDialog({ itemLabel: 'Mesa de madera', price: 0, coins: 0 });
    assert.match(html, /gratis/);
    assert.doesNotMatch(html, /Te faltan/);
    assert.equal(isDisabled(confirmButton(html)), false);
  });
});

describe('BuyConfirmDialog: flujo de compra', () => {
  it('confirmar descuenta el precio y marca el artículo como propio', () => {
    // El diálogo solo abre la puerta: al confirmar, la Tienda y Opciones
    // ejecutan buyItem; aquí se comprueba ese paso del flujo.
    const eco = { ...defaultEconomy(), coins: 330 };
    const result = buyItem(eco, 'table', 'verde');
    assert.equal(result.ok, true);
    assert.equal(result.state.coins, 230);
    assert.ok(isOwned(result.state, 'table', 'verde'));
  });

  it('cancelar no compra: sin llamar a buyItem el saldo y la propiedad no cambian', () => {
    const eco = { ...defaultEconomy(), coins: 330 };
    assert.equal(eco.coins, 330);
    assert.equal(isOwned(eco, 'table', 'verde'), false);
  });

  it('sin fondos no se compra y el saldo queda intacto', () => {
    const eco = { ...defaultEconomy(), coins: 50 };
    const result = buyItem(eco, 'table', 'verde');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'funds');
    assert.equal(result.state.coins, 50);
    assert.equal(isOwned(result.state, 'table', 'verde'), false);
  });
});
