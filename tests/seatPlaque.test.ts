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

  it('la etiqueta de rondas ganadas sigue como texto y la sub-línea siempre reserva su fila', () => {
    assert.ok(seatPlaque.includes('{tag}'), 'el tag (p. ej. "2 ganadas") sigue mostrándose');
    assert.ok(seatPlaque.includes('hasSubLine'), 'hay una condición que decide qué muestra la sub-línea');
    assert.ok(!seatPlaque.includes('{hasSubLine && ('), 'la sub-línea ya no aparece y desaparece');
    assert.ok(seatPlaque.includes('invisible">Salvó'), 'sin nada que mostrar, un hueco invisible reserva la altura');
  });

  it('el nombre sigue truncado y "Salvó" se mantiene cuando el jugador se queda sin cartas', () => {
    assert.ok(seatPlaque.includes('truncate'), 'el nombre sigue truncado como antes');
    assert.ok(seatPlaque.includes('Salvó'), 'salir sin cartas sigue mostrando "Salvó"');
  });

  it('la insignia de nivel va junto al nombre, compacta y sin empujar nada fuera', () => {
    assert.ok(playerSeat.includes('level?: number'), 'SeatPlaque acepta level');
    assert.ok(seatPlaque.includes('{level !== undefined && <LevelBadge level={level}'), 'la insignia solo se muestra si hay nivel');
    assert.ok(seatPlaque.includes('flex min-w-0 items-center gap-1'), 'el nombre y la insignia comparten una fila flexible');
    assert.ok(playerSeat.includes('shrink-0'), 'la insignia no se encoge ni empuja el nombre fuera');
    assert.ok(playerSeat.includes('aria-label={`Nivel ${level}`}'), 'la insignia anuncia el nivel');
    assert.ok(playerSeat.includes('text-xs'), 'la insignia es text-xs (compacta)');
    assert.ok(playerSeat.includes('fill-sky-200'), 'la estrella va rellena en azul larimar');
  });

  it('PlayerSeat reenvía el nivel a la placa en las dos posiciones', () => {
    assert.ok(playerSeat.includes('level?: number'), 'PlayerSeat acepta level');
    // 3 usos de level={level}: la insignia dentro de SeatPlaque y los dos
    // reenvíos de PlayerSeat (placa de arriba y placa lateral).
    assert.equal(playerSeat.split('level={level}').length - 1, 3);
    assert.equal(playerSeat.split('<SeatPlaque').length - 1, 2, 'hay dos placas (arriba y lateral)');
  });

  it('PlayerSeat reenvía el paquete a la placa sin tocar el abanico del rival', () => {
    assert.ok(playerSeat.includes('packetCount?: number'), 'PlayerSeat acepta packetCount');
    assert.ok(playerSeat.includes('packetCount={packetCount}'), 'PlayerSeat lo reenvía a SeatPlaque');
    assert.ok(playerSeat.includes('count={count}'), 'el abanico del rival sigue usando count');
  });
});

describe('etiqueta del paquete (PilePad)', () => {
  it('"Tu paquete" se ve completo y los nombres largos se recortan con tope', () => {
    const labelClass = pilePad.match(/<span className="([^"]*)">\s*\{mine \? 'Tu paquete'/)?.[1] ?? '';
    assert.ok(labelClass.length > 0, 'la etiqueta de "Tu paquete" existe');
    assert.ok(labelClass.includes('max-w-24'), 'la etiqueta tiene tope de 6rem: "Tu paquete" cabe, un nombre largo no empuja el asiento');
    assert.ok(labelClass.includes('truncate'), 'un nombre largo se recorta con puntos suspensivos');
    assert.ok(labelClass.includes('whitespace-nowrap'), 'la etiqueta no debe partirse en dos líneas');
  });
});
