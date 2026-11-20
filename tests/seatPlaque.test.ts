import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// La placa y el paquete no se pueden renderizar en Node: su cadena de imports usa el alias `@/`
// (Avatar -> games/avatar, PlayingCard -> games/cards) y el runner tsx no lo resuelve. Se comprueba
// el marcado en el código fuente, como hace roomChat.test.ts con RoomView.tsx.
const playerSeat = readFileSync('src/components/cagao/PlayerSeat.tsx', 'utf8');
const pilePad = readFileSync('src/components/robaito/PilePad.tsx', 'utf8');

// Solo el cuerpo de SeatPlaque: PlayerSeat (el abanico del rival) sigue usando `count` para
// dibujar sus cartas boca abajo, y eso no debe confundir estas aserciones. El icono de mazo
// (PacketIcon) vive justo encima de SeatPlaque, así que va en su propio recorte.
const seatPlaque = playerSeat.slice(
  playerSeat.indexOf('export function SeatPlaque'),
  playerSeat.indexOf('interface PlayerSeatProps'),
);
const packetIcon = playerSeat.slice(
  playerSeat.indexOf('function PacketIcon'),
  playerSeat.indexOf('export function SeatPlaque'),
);

describe('placa de jugador (SeatPlaque)', () => {
  it('no muestra texto con las cartas en mano: ni "N carta(s)" ni la prop count', () => {
    assert.ok(seatPlaque.length > 0, 'se encontró el cuerpo de SeatPlaque');
    assert.ok(!seatPlaque.includes("'carta'"), 'no debe quedar texto de "carta" en la placa');
    assert.ok(!seatPlaque.includes("'cartas'"), 'no debe quedar texto de "cartas" en la placa');
    // "packetCount" contiene "count": se comprueba la prop por su declaración, no por substring.
    assert.ok(!seatPlaque.includes('count: number'), 'SeatPlaque ya no declara la prop count');
    assert.ok(!seatPlaque.includes('count === 1'), 'ya no hay singular/plural de cartas en la placa');
  });

  it('el paquete se dibuja como icono de mazo con el contador centrado dentro', () => {
    assert.ok(packetIcon.length > 0, 'se encontró el icono de mazo (PacketIcon)');
    assert.ok(seatPlaque.includes('packetCount'), 'la placa acepta packetCount');
    assert.ok(seatPlaque.includes('<PacketIcon count={packetCount}'), 'la placa dibuja el icono cuando hay paquete');
    assert.ok(packetIcon.includes('role="img"'), 'el icono lleva su descripción accesible');
    assert.ok(packetIcon.includes('aria-label={`${count} en paquete`}'), 'el contador anuncia cuántas hay en el paquete');
    assert.ok(packetIcon.includes('tabular-nums'), 'el contador usa cifras tabulares (se lee igual con 1 y 2 cifras)');
    assert.ok(packetIcon.includes('items-center justify-center'), 'el contador va centrado dentro del mazo');
  });

  it('la etiqueta de rondas ganadas sigue como texto y la sub-línea solo existe si hay algo que mostrar', () => {
    assert.ok(seatPlaque.includes('{tag}'), 'el tag (p. ej. "2 ganadas") sigue mostrándose');
    assert.ok(seatPlaque.includes('hasSubLine'), 'hay una condición que decide si la sub-línea existe');
    assert.ok(seatPlaque.includes('{hasSubLine && ('), 'sin equipo, tag ni paquete no se renderiza la sub-línea');
  });

  it('el nombre sigue truncado y "Salvó" se mantiene cuando el jugador se queda sin cartas', () => {
    assert.ok(seatPlaque.includes('block truncate'), 'el nombre sigue truncado como antes');
    assert.ok(seatPlaque.includes('Salvó'), 'salir sin cartas sigue mostrando "Salvó"');
  });

  it('PlayerSeat reenvía el paquete a la placa sin tocar el abanico del rival', () => {
    assert.ok(playerSeat.includes('packetCount?: number'), 'PlayerSeat acepta packetCount');
    assert.ok(playerSeat.includes('packetCount={packetCount}'), 'PlayerSeat lo reenvía a SeatPlaque');
    assert.ok(playerSeat.includes('count={count}'), 'el abanico del rival sigue usando count');
  });
});

describe('etiqueta del paquete (PilePad)', () => {
  it('"Tu paquete" se ve completo: sin límite de ancho ni truncate', () => {
    const labelClass = pilePad.match(/<span className="([^"]*)">\s*\{mine \? 'Tu paquete'/)?.[1] ?? '';
    assert.ok(labelClass.length > 0, 'la etiqueta de "Tu paquete" existe');
    assert.ok(!labelClass.includes('max-w-'), 'la etiqueta no debe tener un ancho máximo');
    assert.ok(!labelClass.includes('truncate'), 'la etiqueta no debe recortarse con puntos suspensivos');
    assert.ok(labelClass.includes('whitespace-nowrap'), 'la etiqueta no debe partirse en dos líneas');
  });
});
