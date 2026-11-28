import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CONNECTION_ALERT_DELAY_MS, createConnectionAlert } from '../src/lib/connectionAlert';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Aviso de conexión con retardo (punto 8): solo aparece si el estado sin
 * conexión dura más de ~3 s seguidos; las desconexiones breves no muestran
 * nada. Los tests de comportamiento usan un retardo corto (el de verdad es
 * CONNECTION_ALERT_DELAY_MS) y los de cableado comprueban que RoomView usa
 * ese retardo en los dos sitios donde se renderiza el aviso (banda de la
 * sala en espera y mesas, vía TableNotices).
 */
describe('aviso de conexión con retardo (connectionAlert)', () => {
  it('el retardo es de 3 s', () => {
    assert.equal(CONNECTION_ALERT_DELAY_MS, 3000);
  });

  it('desconexión breve (<3 s) no muestra el aviso', async () => {
    const alert = createConnectionAlert(50);
    const shown: boolean[] = [];
    alert.update('connecting', (visible) => shown.push(visible));
    assert.equal(alert.visible, false);
    await sleep(20);
    alert.update('connected', (visible) => shown.push(visible));
    await sleep(80);
    assert.equal(alert.visible, false);
    assert.deepEqual(shown, [], 'reconexión breve: no se avisa nada');
  });

  it('desconexión larga sí muestra el aviso', async () => {
    const alert = createConnectionAlert(50);
    const shown: boolean[] = [];
    alert.update('offline', (visible) => shown.push(visible));
    assert.equal(alert.visible, false);
    await sleep(80);
    assert.equal(alert.visible, true);
    assert.deepEqual(shown, [true]);
  });

  it('al reconectar se oculta de inmediato', async () => {
    const alert = createConnectionAlert(30);
    const shown: boolean[] = [];
    alert.update('offline', (visible) => shown.push(visible));
    await sleep(50);
    assert.equal(alert.visible, true);
    alert.update('connected', (visible) => shown.push(visible));
    assert.equal(alert.visible, false);
    assert.deepEqual(shown, [true, false]);
  });

  it('al desmontar no hay aviso fantasma', async () => {
    const alert = createConnectionAlert(30);
    const shown: boolean[] = [];
    alert.update('connecting', (visible) => shown.push(visible));
    alert.dispose();
    await sleep(60);
    assert.equal(alert.visible, false);
    assert.deepEqual(shown, [], 'dispose cancela el temporizador pendiente');
  });

  it('cada cambio de estado reinicia el conteo', async () => {
    const alert = createConnectionAlert(50);
    const shown: boolean[] = [];
    alert.update('connecting', (visible) => shown.push(visible));
    await sleep(30);
    alert.update('offline', (visible) => shown.push(visible));
    await sleep(30);
    assert.equal(alert.visible, false, 'aún no pasaron 3 s desde el último cambio');
    await sleep(40);
    assert.equal(alert.visible, true);
    assert.deepEqual(shown, [true]);
  });
});

describe('RoomView: el retardo llega a los dos avisos', () => {
  const roomView = read('src/components/RoomView.tsx');

  it('usa el retardo con limpieza al cambiar de estado o al desmontar, antes de los retornos tempranos', () => {
    assert.ok(roomView.includes('createConnectionAlert()'), 'RoomView: crea el retardo de conexión');
    assert.ok(
      roomView.includes('alert.update(connection, setConnectionAlertVisible)'),
      'RoomView: el efecto actualiza el aviso con el estado de conexión',
    );
    assert.ok(roomView.includes('return () => alert.dispose();'), 'RoomView: el efecto limpia el temporizador');
    const effectAt = roomView.indexOf('alert.update(connection');
    const earlyReturnAt = roomView.indexOf('if (loadError) {');
    assert.ok(
      effectAt > 0 && effectAt < earlyReturnAt,
      'RoomView: el efecto del retardo va con los demás hooks, antes de los retornos tempranos',
    );
  });

  it('las mesas reciben la conexión con retardo y la banda se oculta en desconexiones breves', () => {
    assert.ok(
      roomView.includes("connectionAlertVisible ? connection : 'connected'"),
      'RoomView: shownConnection es la conexión con retardo',
    );
    assert.ok(roomView.includes('connection: shownConnection'), 'RoomView: las mesas reciben shownConnection');
    assert.ok(
      roomView.includes("connection === 'connected' || connectionAlertVisible"),
      'RoomView: la banda solo se ve conectado o con desconexión larga',
    );
  });

  it('la banda de la sala en espera es una píldora fina, sin el span invisible', () => {
    assert.ok(!roomView.includes('invisible ml-2'), 'RoomView: ya no queda el span invisible que ensanchaba el banner');
    assert.ok(roomView.includes('room-waiting-connection mx-auto mb-1 flex w-fit'), 'RoomView: la banda es una píldora centrada de su ancho');
    assert.ok(roomView.includes('rounded-full px-2.5 py-0.5'), 'RoomView: la banda es fina (poco padding, texto pequeño)');
    assert.ok(roomView.includes('Conectado al servidor'), 'RoomView: la banda sigue visible y legible al conectar');
  });

  it('TableNotices (las 4 mesas) solo avisa sin conexión o conectando', () => {
    const chips = read('src/components/table/chips.tsx');
    assert.ok(
      chips.includes("(connection === 'offline' || connection === 'connecting')"),
      'TableNotices: el aviso de mesa solo aparece sin conexión o conectando',
    );
  });
});
