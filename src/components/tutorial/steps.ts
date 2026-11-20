import type { Card } from '@/games/cards';
import { TARGET_WINS } from '@/games/tresYDos';
import type { GameId } from '@/games/shared';

const card = (id: string, suit: Card['suit'], rank: number): Card => ({ id, suit, rank });

/** Práctica de tocar una carta: acierta con la que cumple `correct`. */
export interface TapPractice {
  kind: 'tap';
  cards: Card[];
  /** Las cartas se ven boca abajo hasta que se toca una (robar). */
  faceDown?: boolean;
  /** Etiqueta de cada carta cuando están boca abajo (Monte, Pozo...). */
  labels?: string[];
  correct: (card: Card, index: number) => boolean;
  /** Carta que se descubre al acertar, para practicar el robo. */
  reveal?: Card;
  success: string;
  wrong: string;
}

/** Práctica de elegir una carta de la mano (y, si hay, cartas de la mesa) y pulsar el botón de la jugada. */
export interface PlayPractice {
  kind: 'play';
  hand: Card[];
  table: Card[];
  action: string;
  check: (hand: Card, table: Card[]) => boolean;
  success: string;
  wrong: string;
}

export type Practice = TapPractice | PlayPractice;

export interface TutorialStep {
  title: string;
  body: string[];
  /** Cartas de adorno para ilustrar el paso (sin interacción). */
  demo?: { cards: Card[]; faceDown?: boolean; caption?: string }[];
  practice?: Practice;
}

const sameIds = (cards: Card[], ids: string[]) => cards.length === ids.length && ids.every((id) => cards.some((c) => c.id === id));

const CASINO: TutorialStep[] = [
  {
    title: 'Bienvenido al Casino',
    body: [
      'Dos equipos compiten por llegar a 21 puntos. Con 4 jugadores, tu compañero es quien se sienta frente a ti.',
      'Cada uno recibe 4 cartas en la mano y hay 4 cartas boca arriba en el centro de la mesa. Las cartas de tu mano son las únicas que puedes jugar.',
    ],
    demo: [
      { cards: [card('d1', 'corazones', 6), card('d2', 'picas', 9), card('d3', 'diamantes', 4), card('d4', 'treboles', 13)], caption: 'La mesa' },
      { cards: [card('d5', 'corazones', 7), card('d6', 'treboles', 3), card('d7', 'picas', 12), card('d8', 'diamantes', 10)], caption: 'Tu mano' },
    ],
  },
  {
    title: 'Elige una carta',
    body: ['En tu turno siempre empiezas eligiendo una carta de tu mano: tócala y se eleva. También puedes arrastrarla hacia la mesa.', 'Pruébalo: toca el 7 de corazones.'],
    practice: {
      kind: 'tap',
      cards: [card('t1', 'corazones', 7), card('t2', 'treboles', 3), card('t3', 'picas', 13), card('t4', 'diamantes', 10)],
      correct: (c) => c.id === 't1',
      success: '¡Eso es! La carta elegida se eleva con un aro dorado.',
      wrong: 'Esa no es: toca el 7 de corazones.',
    },
  },
  {
    title: 'Captura por igual',
    body: [
      'Para capturar, juega una carta de tu mano y llévate una carta de la mesa del mismo valor.',
      'Elige tu 7 de corazones, toca el 7 de picas de la mesa y pulsa Capturar.',
    ],
    practice: {
      kind: 'play',
      hand: [card('p1', 'corazones', 7), card('p2', 'treboles', 3), card('p3', 'picas', 13)],
      table: [card('q1', 'picas', 7), card('q2', 'diamantes', 4), card('q3', 'treboles', 12)],
      action: 'Capturar',
      check: (hand, table) => hand.id === 'p1' && sameIds(table, ['q1']),
      success: '¡Capturaste el 7! Esas dos cartas pasan a tu pila.',
      wrong: 'Elige tu 7 de corazones y, de la mesa, solo el 7 de picas.',
    },
  },
  {
    title: 'Captura por suma',
    body: [
      'También puedes llevarte varias cartas sueltas cuyo total sea el valor de tu carta. Valores: del 2 al 10 su número, J vale 11, Q 12, K 13 y el As 1 o 14.',
      'Elige el 9 de diamantes y las cartas que suman 9 (4 + 5). Luego pulsa Capturar.',
    ],
    practice: {
      kind: 'play',
      hand: [card('s1', 'diamantes', 9), card('s2', 'treboles', 2), card('s3', 'picas', 13)],
      table: [card('u1', 'picas', 4), card('u2', 'corazones', 5), card('u3', 'treboles', 12)],
      action: 'Capturar',
      check: (hand, table) => hand.id === 's1' && sameIds(table, ['u1', 'u2']),
      success: '¡Muy bien! 4 + 5 = 9, y te las llevas todas con el 9.',
      wrong: 'Busca las cartas de la mesa que sumen 9: el 4 y el 5.',
    },
  },
  {
    title: 'Sumar, hacer par o tirar',
    body: [
      'Si no puedes capturar, tienes tres opciones: Tirar tu carta a la mesa (arrástrala), Sumar para juntar tu carta con cartas sueltas y formar una combinación, o Hacer par.',
      'Una combinación vale lo que suman sus cartas y te la llevas después con otra carta de ese valor. Pero ojo: si el rival se la lleva primero, es suya.',
    ],
  },
  {
    title: 'Cómo se puntúa',
    body: [
      'Al terminar la ronda: 3 puntos por la mayoría de cartas, 2 por el 10 de diamantes, 1 por el 2 de picas, 1 por la mayoría de picas y 1 por cada As.',
      'Si te llevas todas las cartas de la mesa haces un virao (1 punto).',
    ],
    demo: [{ cards: [card('a1', 'corazones', 1), card('a2', 'diamantes', 10), card('a3', 'picas', 2)], caption: 'Las cartas que más valen' }],
  },
  {
    title: 'La Zona de Cierre',
    body: [
      'Con 17 puntos o más entras en la Zona de Cierre: los ases y los viraos dejan de sumarte.',
      'Solo puedes ganar con las mayorías que te faltan para llegar a 21 exactos. La mesa te avisará cuando entres.',
    ],
  },
  {
    title: 'Controles',
    body: [
      'Toca una carta para elegirla, toca las de la mesa que quieres y pulsa el botón de la jugada. O arrastra tu carta a la mesa.',
      'Arriba a la izquierda salen de la partida y ves tus cartas capturadas; arriba a la derecha está el engranaje de Opciones (sonido, música y avisos).',
    ],
  },
];

const TRES_Y_DOS: TutorialStep[] = [
  {
    title: 'Bienvenido a Tres y Dos',
    body: [
      'Cada uno juega por su cuenta con 5 cartas. Ganas la ronda cuando tu mano es una tercia (3 iguales) y un par (2 iguales): eso es cantar el 3 y 2.',
      `Gana la partida el primero que cante ${TARGET_WINS} rondas.`,
    ],
    demo: [{ cards: [card('w1', 'picas', 13), card('w2', 'corazones', 13), card('w3', 'treboles', 13), card('w4', 'diamantes', 8), card('w5', 'treboles', 8)], caption: 'Un 3 y 2: tres reyes y dos ochos' }],
  },
  {
    title: 'Roba una carta',
    body: ['En tu turno primero robas: la carta de arriba del Monte (boca abajo) o la de arriba del Pozo (boca arriba).', 'Pruébalo: toca el Monte.'],
    practice: {
      kind: 'tap',
      cards: [card('m1', 'treboles', 4), card('m2', 'diamantes', 9)],
      faceDown: true,
      labels: ['Monte', 'Pozo'],
      correct: (_c, index) => index === 0,
      reveal: card('m1', 'treboles', 4),
      success: 'Robaste el 4 de tréboles. Ahora tienes 6 cartas: toca "Siguiente" para botar una.',
      wrong: 'Para esta práctica, toca el Monte.',
    },
  },
  {
    title: 'Bota una carta',
    body: [
      'Con 6 cartas en la mano, botas una al Pozo y te quedas con 5. Siempre debes botar después de robar.',
      'Tu mano tiene tres reyes, dos ochos y un 4 que sobra. Elige la carta que botarías y pulsa Botar.',
    ],
    practice: {
      kind: 'play',
      hand: [card('b1', 'picas', 13), card('b2', 'corazones', 13), card('b3', 'treboles', 13), card('b4', 'diamantes', 8), card('b5', 'treboles', 8), card('b6', 'treboles', 4)],
      table: [],
      action: 'Botar',
      check: (hand) => hand.id === 'b6',
      success: '¡Cantas 3 y 2! Botar el 4 te deja tres reyes y dos ochos.',
      wrong: 'Esa carta te sirve. Bota la que no forma parte de la tercia ni del par.',
    },
  },
  {
    title: 'La regla del Pozo',
    body: [
      'Si robas la carta del Pozo, no puedes botar esa misma carta en ese turno. Si robas del Monte, puedes botar cualquiera de tus 6.',
      'Si el Monte se acaba, las cartas del Pozo se barajan y forman uno nuevo.',
    ],
  },
  {
    title: 'Controles',
    body: [
      'Toca el Monte o el Pozo para robar. Luego toca una carta de tu mano y pulsa Botar, o arrástrala hasta la mesa.',
      'Cuando tu mano sea un 3 y 2, aparecerá el botón para cantarlo. El engranaje de arriba a la derecha abre las Opciones.',
    ],
  },
];

const CAGAO: TutorialStep[] = [
  {
    title: 'Bienvenido a El Cagao',
    body: [
      'Se juega con 49 cartas: la baraja sin tres de los Ases. El único As que queda, el A♠, no tiene pareja: es El Cagao.',
      'El objetivo es quedarte sin cartas emparejándolas. Pierde el último jugador que se queda con El Cagao.',
    ],
    demo: [{ cards: [card('picas-1', 'picas', 1)], caption: 'El Cagao (A♠)' }],
  },
  {
    title: 'Baja tus pares',
    body: ['Al empezar, todos bajan sus pares: dos cartas del mismo número, sin importar el palo. Toca una carta que tenga pareja o arrástrala al centro.', 'Pruébalo: toca una carta que tenga pareja.'],
    practice: {
      kind: 'tap',
      cards: [card('c1', 'corazones', 7), card('c2', 'treboles', 7), card('c3', 'diamantes', 12), card('c4', 'picas', 3), card('c5', 'corazones', 3), card('c6', 'treboles', 9)],
      correct: (c) => c.rank === 7 || c.rank === 3,
      success: '¡Bien! Esa carta y su pareja bajan a la mesa.',
      wrong: 'Esa no tiene pareja. Busca dos cartas con el mismo número (los 7 o los 3).',
    },
  },
  {
    title: 'Roba a ciegas',
    body: [
      'Después, en tu turno le robas una carta al jugador que tú elijas, sin ver cuál es. Si hace par con una tuya, bajas las dos.',
      'Pruébalo: toca una de las cartas boca abajo de tu rival.',
    ],
    practice: {
      kind: 'tap',
      cards: [card('r1', 'diamantes', 9), card('r2', 'picas', 5), card('r3', 'treboles', 11)],
      faceDown: true,
      correct: () => true,
      reveal: card('r1', 'diamantes', 9),
      success: 'Sacaste un 9 y tenías otro 9 en la mano: ¡bajas el par!',
      wrong: '',
    },
  },
  {
    title: 'Salvarse o perder',
    body: [
      'Quien se queda sin cartas se salva y sale del juego. La partida termina cuando solo queda un jugador con cartas: esa persona tiene El Cagao y pierde.',
      'Nadie sabe quién tiene El Cagao hasta el final: solo se revela cuando la partida termina.',
      'Cuando te roban a ti, tu mano se baraja sola para que nadie sepa dónde quedó cada carta.',
    ],
  },
  {
    title: 'Controles',
    body: [
      'Toca (o arrastra) tus cartas con pareja para bajarlas. También hay un botón para bajar todos los pares de una vez y otro para mezclar tu mano.',
      'En tu turno, toca la carta del rival que quieres jalar. El engranaje de arriba a la derecha abre las Opciones.',
    ],
  },
];

const ROBAITO: TutorialStep[] = [
  {
    title: 'Bienvenido a El Robaíto',
    body: [
      'Cada jugador recibe 4 cartas y hay 4 boca arriba en el centro de la mesa. Solo importa el número de la carta: el palo no cuenta.',
      'En tu turno juegas una carta. Gana quien termine con más cartas en su paquete.',
    ],
    demo: [
      { cards: [card('w1', 'corazones', 6), card('w2', 'picas', 9), card('w3', 'diamantes', 4), card('w4', 'treboles', 13)], caption: 'La mesa' },
      { cards: [card('w5', 'corazones', 9), card('w6', 'treboles', 3), card('w7', 'picas', 12), card('w8', 'diamantes', 10)], caption: 'Tu mano' },
    ],
  },
  {
    title: 'Levanta de la mesa',
    body: [
      'Si juegas una carta y en la mesa hay cartas del mismo número, te las llevas todas, y tu carta queda encima de tu paquete.',
      'Elige tu 7 de corazones, toca los dos 7 de la mesa y pulsa Levantar.',
    ],
    practice: {
      kind: 'play',
      hand: [card('h1', 'corazones', 7), card('h2', 'treboles', 3), card('h3', 'picas', 13)],
      table: [card('q1', 'picas', 7), card('q2', 'diamantes', 4), card('q3', 'diamantes', 7), card('q4', 'treboles', 12)],
      action: 'Levantar',
      check: (hand, table) => hand.id === 'h1' && sameIds(table, ['q1', 'q3']),
      success: '¡Muy bien! Te llevas los dos 7 de la mesa y tu 7 queda arriba de tu paquete.',
      wrong: 'Elige tu 7 de corazones y, de la mesa, los dos 7 (el de picas y el de diamantes).',
    },
  },
  {
    title: '¡El Robaíto!',
    body: [
      'Cada jugador tiene su paquete boca arriba: solo se ve la última carta que entró. Si tu carta es del mismo número que esa carta de arriba, le robas el paquete entero.',
      'Tienes un 9 en la mano. Toca el paquete al que se lo puedes robar.',
    ],
    practice: {
      kind: 'tap',
      cards: [card('s1', 'treboles', 9), card('s2', 'diamantes', 12), card('s3', 'picas', 5)],
      labels: ['Mateo · 6 cartas', 'Camila · 4 cartas', 'Santiago · 3 cartas'],
      correct: (c) => c.rank === 9,
      success: '¡Robaíto! Te llevas las 6 cartas de Mateo y tu 9 queda arriba de tu paquete.',
      wrong: 'Esa carta de arriba no es un 9. Busca el paquete cuya carta de arriba sea un 9.',
    },
  },
  {
    title: 'Todo en una jugada',
    body: [
      'Si tu carta empareja con la mesa y también con la cima de uno o más paquetes rivales, te llevas todo a la vez. Si no empareja con nada, tu carta se queda en la mesa.',
      'Tu propio paquete no se roba: solo puedes quitarles paquetes a los demás.',
    ],
  },
  {
    title: 'Nuevos repartos y final',
    body: [
      'Cuando todos se quedan sin cartas y aún hay mazo, se reparten 4 cartas nuevas a cada uno (la mesa no recibe cartas).',
      'Al acabarse el mazo, las cartas sueltas que queden en la mesa son del último que se llevó cartas. Gana el paquete más grande; si hay empate, se comparte la victoria.',
    ],
  },
  {
    title: 'Controles',
    body: [
      'Toca una carta para elegirla: verás qué cartas de la mesa te llevarías y qué paquetes le robarías. Tócala otra vez, pulsa el botón o arrástrala al centro para jugarla.',
      'Las cartas con aro dorado roban un paquete y las de aro verde levantan de la mesa. El engranaje de arriba a la derecha abre las Opciones.',
    ],
  },
];

export const TUTORIALS: Record<GameId, TutorialStep[]> = {
  casino: CASINO,
  tresydos: TRES_Y_DOS,
  cagao: CAGAO,
  robaito: ROBAITO,
};
