import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsx compila los .tsx con el runtime clásico de JSX (`React.createElement`):
// se expone React como global para que los componentes rendericen en Node.
(globalThis as unknown as { React: typeof React }).React = React;
import RoomChat from '../src/components/RoomChat';
import type { Player } from '../src/games/shared';
import {
  canSendChat,
  CHAT_COOLDOWN_MS,
  CHAT_EMOJIS,
  chatCooldownRemainingMs,
  chatToastText,
  isAllowedChatSender,
  isValidChatPayload,
  QUICK_MESSAGES,
  type RoomChatMessage,
} from '../src/lib/roomChat';

const baseEmoji: RoomChatMessage = { kind: 'emoji', emoji: '😂', fromId: 'ana', fromName: 'Ana', at: 1000 };
const baseQuick: RoomChatMessage = { kind: 'quick', text: '¡Buena jugada!', fromId: 'ana', fromName: 'Ana', at: 1000 };

const PLAYERS: Player[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'luis', name: 'Luis' },
  { id: 'bot-1', name: 'Bot 1' },
];

describe('chat de sala: el catálogo cerrado', () => {
  it('acepta los 8 emojis del catálogo', () => {
    for (const emoji of CHAT_EMOJIS) {
      assert.equal(isValidChatPayload({ ...baseEmoji, emoji }), true, emoji);
    }
  });

  it('acepta los 10 mensajes predeterminados', () => {
    for (const text of QUICK_MESSAGES) {
      assert.equal(isValidChatPayload({ ...baseQuick, text }), true, text);
    }
  });

  it('rechaza texto libre', () => {
    assert.equal(isValidChatPayload({ ...baseQuick, text: 'eres un tramposo' }), false);
    assert.equal(isValidChatPayload({ ...baseQuick, text: '¡Buena jugada! ' }), false);
    assert.equal(isValidChatPayload({ ...baseQuick, text: '' }), false);
  });

  it('rechaza emojis fuera del catálogo', () => {
    assert.equal(isValidChatPayload({ ...baseEmoji, emoji: '💩' }), false);
    assert.equal(isValidChatPayload({ ...baseEmoji, emoji: '😀' }), false);
  });

  it('rechaza kind inválido y mensajes mezclados', () => {
    assert.equal(isValidChatPayload({ ...baseEmoji, kind: 'text' }), false);
    assert.equal(isValidChatPayload({ ...baseEmoji, kind: 'sticker' }), false);
    assert.equal(isValidChatPayload({ ...baseEmoji, text: '¡Buena jugada!' }), false);
    assert.equal(isValidChatPayload({ ...baseQuick, emoji: '😂' }), false);
  });

  it('rechaza remitentes vacíos o sin fecha', () => {
    assert.equal(isValidChatPayload({ ...baseEmoji, fromId: '' }), false);
    assert.equal(isValidChatPayload({ ...baseEmoji, fromId: '   ' }), false);
    assert.equal(isValidChatPayload({ ...baseEmoji, fromName: '' }), false);
    assert.equal(isValidChatPayload({ ...baseEmoji, fromName: 'A'.repeat(25) }), false);
    assert.equal(isValidChatPayload({ ...baseEmoji, at: 'ayer' }), false);
    const { at: _at, ...noAt } = baseEmoji;
    assert.equal(isValidChatPayload(noAt), false);
  });

  it('rechaza lo que no es un objeto con forma de mensaje', () => {
    assert.equal(isValidChatPayload(null), false);
    assert.equal(isValidChatPayload('hola'), false);
    assert.equal(isValidChatPayload([baseEmoji]), false);
    assert.equal(isValidChatPayload({}), false);
  });
});

describe('chat de sala: anti-spam', () => {
  it('sin mensaje previo se puede enviar', () => {
    assert.equal(canSendChat(null), true);
    assert.equal(chatCooldownRemainingMs(null), 0);
  });

  it('bloquea el segundo envío antes de 3 s y lo permite después', () => {
    assert.equal(canSendChat(1000, 1000), false);
    assert.equal(chatCooldownRemainingMs(1000, 1000), CHAT_COOLDOWN_MS);
    assert.equal(canSendChat(1000, 3999), false);
    assert.equal(chatCooldownRemainingMs(1000, 3999), 1);
    assert.equal(canSendChat(1000, 4000), true);
    assert.equal(chatCooldownRemainingMs(1000, 4000), 0);
    assert.equal(canSendChat(1000, 9999), true);
  });
});

describe('chat de sala: quién puede hablar', () => {
  it('solo muestra mensajes de un humano que está en la sala', () => {
    assert.equal(isAllowedChatSender(baseEmoji, PLAYERS), true);
    assert.equal(isAllowedChatSender({ ...baseEmoji, fromId: 'bot-1', fromName: 'Bot 1' }, PLAYERS), false);
    assert.equal(isAllowedChatSender({ ...baseEmoji, fromId: 'otro', fromName: 'Otro' }, PLAYERS), false);
    assert.equal(isAllowedChatSender(baseEmoji, []), false);
  });

  it('el aviso muestra "Nombre: contenido"', () => {
    assert.equal(chatToastText(baseEmoji), 'Ana: 😂');
    assert.equal(chatToastText(baseQuick), 'Ana: ¡Buena jugada!');
  });
});

describe('chat de sala: el componente', () => {
  it('siempre muestra el botón flotante y, cerrado, no muestra el panel', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomChat, { toast: null, myId: 'ana', myName: 'Ana', onSend: () => undefined }),
    );
    assert.ok(html.includes('💬'), 'el botón flotante 💬 debe verse');
    assert.ok(html.includes('Abrir chat'));
    assert.ok(!html.includes('¡Buena jugada!'), 'con el panel cerrado no se ven los mensajes');
  });

  it('con el panel abierto se ve la pestaña de emojis por defecto y el aviso con el último mensaje', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomChat, {
        toast: baseQuick,
        myId: 'ana',
        myName: 'Ana',
        onSend: () => undefined,
        defaultOpen: true,
      }),
    );
    for (const emoji of CHAT_EMOJIS) assert.ok(html.includes(emoji), `falta el emoji ${emoji}`);
    assert.ok(html.includes('Emojis'), 'debe verse la pestaña Emojis');
    assert.ok(html.includes('Mensajes'), 'debe verse la pestaña Mensajes');
    // Con la pestaña de emojis activa, los mensajes rápidos no se renderizan.
    assert.ok(!html.includes('¡Qué suerte!'), 'en la pestaña de emojis no se ven los mensajes');
    assert.ok(html.includes('Ana: ¡Buena jugada!'), 'el aviso muestra el último mensaje');
  });

  it('el aviso de un emoji lo muestra grande y animado, separado del nombre', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomChat, {
        toast: baseEmoji,
        myId: 'ana',
        myName: 'Ana',
        onSend: () => undefined,
      }),
    );
    assert.ok(html.includes('chat-toast-emoji'), 'el emoji debe ir en su propio elemento animado');
    assert.ok(html.includes('😂'), 'el emoji debe verse');
    assert.ok(html.includes('Ana:'), 'el nombre del remitente debe verse');
    assert.ok(!html.includes('Ana: 😂'), 'el emoji ya no va pegado al texto: va en su propio elemento');
  });

  it('con la pestaña de mensajes se ven los 10 mensajes y no los emojis', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomChat, {
        toast: null,
        myId: 'ana',
        myName: 'Ana',
        onSend: () => undefined,
        defaultOpen: true,
        defaultTab: 'quick',
      }),
    );
    for (const text of QUICK_MESSAGES) assert.ok(html.includes(text), `falta el mensaje ${text}`);
    for (const emoji of CHAT_EMOJIS) assert.ok(!html.includes(emoji), `no debe verse el emoji ${emoji}`);
  });
});

describe('chat en los 4 modos: vive en RoomView, nunca en una mesa', () => {
  const roomView = readFileSync('src/components/RoomView.tsx', 'utf8');
  const tables = [
    'src/components/CasinoTable.tsx',
    'src/components/TresYDosTable.tsx',
    'src/components/cagao/GameTable.tsx',
    'src/components/robaito/RobaitoTable.tsx',
  ];

  it('RoomView renderiza el chat una sola vez, en la rama de partida en curso', () => {
    const uses = [...roomView.matchAll(/<RoomChat[\s>]/g)];
    assert.equal(uses.length, 1, 'RoomChat debe aparecer una sola vez en RoomView');
    // El índice del uso JSX (no el de `useState<RoomChatMessage>`).
    const chatAt = uses[0].index ?? -1;
    const guardAt = roomView.indexOf("state !== null && room.status !== 'waiting'");
    assert.ok(guardAt !== -1 && guardAt < chatAt, 'el chat va dentro de la rama de partida en curso');
    // Las 4 mesas se eligen en esa misma rama: el chat queda fuera del
    // ternario, así que vale igual para Casino, Tres y Dos, El Cagao y El Robaíto.
    for (const table of ['<CasinoTable', '<TresYDosTable', '<RobaitoTable', '<CagaoTable']) {
      const tableAt = roomView.indexOf(table);
      assert.ok(tableAt !== -1 && tableAt < chatAt, `${table} se renderiza en la misma rama, antes que el chat`);
    }
  });

  it('ninguna mesa monta el chat por su cuenta', () => {
    for (const file of tables) {
      assert.ok(!readFileSync(file, 'utf8').includes('RoomChat'), `${file} no debe mencionar RoomChat`);
    }
  });

  it('el chat solo se muestra cuando hay otro humano en la mesa', () => {
    assert.ok(roomView.includes('hasOtherHuman'), 'RoomView calcula si hay otro humano');
    assert.ok(roomView.includes('{hasOtherHuman && <RoomChat'), 'el chat se monta solo si hay otro humano');
  });
});
