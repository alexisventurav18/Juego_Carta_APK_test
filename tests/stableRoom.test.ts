import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// La sala tampoco se puede renderizar en Node: se comprueba el marcado en
// el código fuente, como hace waitingRoom.test.ts.
const waiting = readFileSync('src/components/WaitingRoom.tsx', 'utf8');
const roomView = readFileSync('src/components/RoomView.tsx', 'utf8');
const roomChat = readFileSync('src/components/RoomChat.tsx', 'utf8');

describe('sala de espera: las filas no cambian de tamaño', () => {
  it('el hueco vacío mide lo mismo que la fila de un jugador', () => {
    const slot = waiting.slice(waiting.indexOf('room-waiting-empty-slot'), waiting.indexOf('room-waiting-empty-slot') + 300);
    assert.ok(slot.includes('min-h-9'), 'el hueco mide min-h-9 en móvil, como la fila');
    assert.ok(slot.includes('sm:min-h-[44px]'), 'el hueco mide 44px en escritorio, como la fila');
  });

  it('los botones de código e invitación tienen ancho fijo', () => {
    assert.ok(waiting.includes('btn-wood inline-flex min-h-9 w-full items-center justify-center'), 'Copiar código ocupa todo el ancho del panel');
    assert.ok(waiting.includes('btn-gold inline-flex min-h-9 w-full items-center justify-center'), 'Compartir invitación ocupa todo el ancho del panel');
  });

  it('el mensaje de compartir siempre reserva su hueco', () => {
    assert.ok(!waiting.includes('{shareMessage && <p'), 'el mensaje ya no aparece y desaparece');
    assert.ok(waiting.includes('min-h-8'), 'el hueco del mensaje mide dos líneas siempre');
  });

  it('la nota de matchmaking no cambia cada segundo', () => {
    assert.ok(!waiting.includes('Si no se llena en ${secondsLeft}'), 'la nota ya no lleva los segundos dentro');
    assert.ok(waiting.includes('Si no se llena, se completa con bots'), 'la nota es un texto fijo; los segundos ya se ven grandes debajo');
  });

  it('la cuenta atrás es monoespaciada y con dos cifras', () => {
    assert.ok(waiting.includes('font-mono'), 'la cuenta atrás usa fuente monoespaciada');
    assert.ok(waiting.includes("padStart(2, '0')"), 'los segundos siempre llevan dos cifras');
  });
});

describe('sala: los avisos no empujan el contenido', () => {
  it('la barra de conexión reserva el hueco de Reintentar', () => {
    assert.ok(roomView.includes('invisible ml-2'), 'sin conexión el botón es invisible pero ocupa su hueco');
  });

  it('el aviso de error flota encima en vez de empujar la sala', () => {
    const notice = roomView.slice(roomView.indexOf('role="alert"'), roomView.indexOf('role="alert"') + 300);
    assert.ok(notice.includes('fixed left-1/2 top-2'), 'el aviso es fijo y centrado arriba');
    assert.ok(!notice.includes('mb-5'), 'el aviso ya no va dentro del flujo');
  });

  it('el aviso de chat va debajo del aviso de abandono', () => {
    assert.ok(roomChat.includes('top-[6.75rem]'), 'el aviso de chat queda debajo del de abandono');
    assert.ok(roomChat.includes('fixed left-1/2'), 'el aviso de chat sigue fijo y centrado');
  });
});
