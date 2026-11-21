import { type CasinoState, createCasinoGame } from './casino.ts';
import { createTresYDosGame, TARGET_WINS, type TresYDosState } from './tresYDos.ts';
import { type CagaoState, createCagaoGame } from './cagao.ts';
import { createRobaitoGame, type RobaitoState } from './robaito.ts';
import { encodeAvatar, type Gender, randomAvatar } from './avatar.ts';
import { randomInt } from './cards.ts';
import type { GameId, Player } from './shared.ts';

export type GameState = CasinoState | TresYDosState | CagaoState | RobaitoState;

export interface GameInfo {
  id: GameId;
  name: string;
  tagline: string;
  playerCounts: number[];
  playerCountLabel: string;
  maxPlayers: number;
  soloPlayerCount: number;
  rules: string[];
  quickRules?: string[];
}

export const GAMES: Record<GameId, GameInfo> = {
  casino: {
    id: 'casino',
    name: 'Casino',
    tagline: 'Captura cartas y suma puntos.',
    playerCounts: [2, 4],
    playerCountLabel: '2 o 4 en parejas',
    maxPlayers: 4,
    soloPlayerCount: 4,
    quickRules: [
      'Captura: juega una carta de tu mano y llévate cartas de la mesa del mismo valor, o cuyo total sea ese valor.',
      'Suma: junta tu carta con cartas de la mesa para formar una suma, y llévatela después con otra carta de ese valor.',
      'Gana el primer equipo que llegue a 21 puntos.',
      'Zona de Cierre: con 17 puntos o más solo sumas con las mayorías que te faltan para llegar a 21 exactos.',
    ],
    rules: [
      'Se usa la baraja americana de 52 cartas. Con 4 jugadores, las parejas son los que se sientan frente a frente.',
      'Cada jugador recibe 4 cartas y se ponen 4 boca arriba en el centro. Al empezar, un sorteo elige quién reparte (contra bots, un volado de cara o cruz); el reparto rota cada ronda. Los Ases, el 10 de diamantes, el 2 de picas y las espadas salen menos en la mano inicial.',
      'Valores: del 2 al 10 su número, J vale 11, Q vale 12, K vale 13 y el As vale 1 o 14.',
      'En tu turno juega una carta de tu mano para llevarte cartas de la mesa: una carta suelta del mismo valor, o cartas sueltas que sumen el valor de tu carta. También puedes llevarte varios grupos de cartas sueltas (pares) si cada grupo suma el valor de tu carta, como K con Q y A.',
      'Si ya formaste una combinación y en tu turno no puedes formar ni capturar algo nuevo, debes llevarte tu propia combinación. Si no has formado nada, puedes dejar tu carta en la mesa aunque haya capturas posibles.',
      'Sumatoria: une tu carta con cartas sueltas de la mesa; su valor es la suma de todas. Pares: tu carta y las demás cartas sueltas suman el valor de una carta suelta de la mesa, y se agrupan con ella. En ambos casos debe quedarte en mano una carta de ese valor.',
      'Para subir una sumatoria, usa una carta de tu mano: su valor aumenta con esa carta. Cualquier jugador puede ampliarla con su carta y cartas sueltas de la mesa. Si tienes en mano otra carta del mismo valor que la sumatoria, puedes convertirla en pares y llevártela después con la última carta de ese valor. Si en la mesa hay una carta suelta de ese mismo valor, puedes unirla en el mismo turno para formar pares. A un par no se le cambia el valor: solo puedes sumarle una carta de su mismo valor, o tu carta junto con cartas sueltas que den justo ese valor (2 y 3 sobre un par de 5), si te queda otra de ese valor en mano. Cualquier jugador puede llevarse una sumatoria o un par ajeno, solo o junto con otras cartas que completen el valor de su carta. Mientras tengas una combinación tuya en la mesa, no puedes gastar tu última carta de cierre en otra jugada que no sea llevártela o reforzarla.',
      'Si te llevas todas las cartas de la mesa haces un virao (1 punto). Si el rival tiene viraos, en lugar de ganar uno le quitas uno suyo. Solo acumulas viraos cuando el rival no tiene ninguno. La última jugada de la ronda no cuenta como virao.',
      'Al terminar una ronda, solo el repartidor de la siguiente puede iniciarla con su botón; si el repartidor es un bot, la inicia sola tras una pausa.',
      'Puntos por ronda: 3 por la mayoría de cartas, 2 por el 10 de diamantes, 1 por el 2 de picas, 1 por la mayoría de picas y 1 por cada as.',
      'Gana el primer equipo que llegue a 21 puntos.',
      'Cierre obligatorio: cuando un equipo empieza una ronda con 17 puntos o más, los ases, el Gran Casino, el Dueño y los viraos dejan de sumarle. Solo puede ganar con la mayoría de cartas (3 puntos) y la mayoría de picas (1 punto), y únicamente la que le falte para llegar a 21 exactos.',
      'Si con 17 puntos consigue solo una de las dos, suma lo logrado y debe conseguir la otra en las rondas siguientes: 17 + mayoría de cartas = 20, y le falta la mayoría de picas; 17 + mayoría de picas = 18, y le falta la mayoría de cartas. Con 19 o 20 puntos le falta la mayoría de picas.',
      'Si los dos equipos completan sus 21 en la misma ronda, gana el que tenga más puntos y, de empatar, el que más puntos hizo en esa ronda.',
    ],
  },
  tresydos: {
    id: 'tresydos',
    name: 'Tres y Dos',
    tagline: 'Roba, bota y canta el 3 y 2.',
    playerCounts: [2, 3, 4],
    playerCountLabel: 'De 2 a 4 jugadores',
    maxPlayers: 4,
    soloPlayerCount: 3,
    quickRules: [
      'Cada turno robas una carta (del Monte o del Pozo) y botas otra al Pozo: siempre te quedas con 5.',
      'Cantas 3 y 2 cuando tu mano es una tercia y un par, como K-K-K-8-8.',
      'Si robas del Pozo, no puedes botar esa misma carta en ese turno.',
      `Gana la partida quien primero cante ${TARGET_WINS} rondas.`,
    ],
    rules: [
      'Se usa la baraja americana de 52 cartas. Pueden jugar de 2 a 4 personas, cada una por su cuenta.',
      'Cada ronda reparte 5 cartas a cada jugador y pone una boca arriba para empezar el Pozo. El resto forma el Monte, boca abajo. Empieza el jugador que está después del que reparte, y el reparto rota en cada ronda.',
      'En tu turno primero robas: la carta de arriba del Monte o la de arriba del Pozo. Con 6 cartas en la mano, botas una al Pozo. Mientras no hayas robado no puedes botar.',
      'Si tomaste la carta del Pozo, no puedes botar esa misma carta en ese turno. Si la robaste del Monte, puedes botar cualquiera de tus 6.',
      'Ganas la ronda cuando, al botar, te quedan 5 cartas que forman una tercia y un par (tres iguales y dos iguales): eso es cantar el 3 y 2. Cuatro iguales más una distinta no cuenta.',
      'Si el Monte se acaba, las cartas del Pozo (menos la de arriba) se barajan y forman un Monte nuevo.',
      `Cada 3 y 2 vale una ronda ganada. Gana la partida el primero que llegue a ${TARGET_WINS} rondas. Entre rondas, solo el que reparte la siguiente puede iniciarla; si es un bot, la inicia sola tras una pausa.`,
    ],
  },
  cagao: {
    id: 'cagao',
    name: 'El Cagao',
    tagline: 'Empareja cartas y evita el A♠.',
    playerCounts: [2, 3, 4, 5, 6],
    playerCountLabel: 'De 2 a 6 jugadores',
    maxPlayers: 6,
    soloPlayerCount: 4,
    quickRules: [
      'Se juega con 49 cartas: la baraja sin tres de los Ases. El A♠ no tiene pareja: es El Cagao.',
      'Al empezar, todos bajan sus pares (dos cartas del mismo número).',
      'En tu turno le robas una carta, a ciegas, al jugador que elijas. Si hace par con una tuya, bajas las dos.',
      'Te salvas cuando te quedas sin cartas. Pierde el último que se queda con El Cagao.',
    ],
    rules: [
      'Se usa la baraja americana de 52 cartas sin los Ases de corazones, diamantes y tréboles: quedan 49 cartas. El único As que queda, el A♠, no tiene pareja y es El Cagao. Pueden jugar de 2 a 6 personas.',
      'Se reparte todo el mazo, una carta a la vez. Algunos jugadores se quedan con una carta más, y eso es normal.',
      'Antes de empezar, todos bajan los pares que tengan: dos cartas del mismo número, sin importar el palo. Tú los bajas tocando una carta que tenga pareja o arrastrándola al centro de la mesa (también está el botón para bajar todos de una vez); los bots lo hacen solos. Si tienes tres iguales, bajas dos y te quedas con la otra. Nadie roba hasta que todos terminen.',
      'Empieza el jugador que está después del que reparte. En tu turno miras las cartas boca abajo del jugador que elijas (cualquiera que todavía tenga cartas) y jalas una sin saber cuál es.',
      'Si la carta que robaste hace par con una de tu mano, bajas las dos al momento. Si no, se queda en tu mano. Cuando te roban a ti, tu mano se baraja sola para que nadie sepa dónde quedó cada carta.',
      'Quien se queda sin cartas se salva y sale del juego: ya no roba ni le roban.',
      'La partida termina cuando solo queda un jugador con cartas. Esa persona tiene El Cagao (el A♠) y pierde.',
    ],
  },
  robaito: {
    id: 'robaito',
    name: 'El Robaíto',
    tagline: 'Roba paquetes o levanta cartas.',
    playerCounts: [2, 3, 4],
    playerCountLabel: 'De 2 a 4 jugadores',
    maxPlayers: 4,
    soloPlayerCount: 3,
    quickRules: [
      'Juega una carta: te llevas las cartas de la mesa del mismo número, y tu carta queda arriba de tu paquete.',
      'Si tu carta iguala la de arriba del paquete de un rival, ¡le robas el paquete entero!',
      'Si no igualas nada, tu carta se queda en la mesa.',
      'Gana quien termine con más cartas en su paquete.',
    ],
    rules: [
      'Se usa la baraja americana de 52 cartas, sin comodines. Solo importa el número de la carta (A, 2 al 10, J, Q, K); el palo no cuenta. Pueden jugar de 2 a 4 personas, cada una por su cuenta.',
      'Cada jugador recibe 4 cartas boca abajo (solo tú ves las tuyas) y se ponen 4 boca arriba en el centro de la mesa. El resto forma el mazo. Un sorteo elige quién reparte y empieza el jugador que le sigue.',
      'En tu turno juegas una carta de tu mano. Si en la mesa hay una o más cartas de ese mismo número, te las llevas todas, y tu carta queda encima de tu paquete.',
      'Cada jugador tiene su paquete boca arriba junto a él: solo se ve la última carta que entró (la de arriba) y cuántas cartas tiene en total. Si tu carta iguala la de arriba del paquete de un rival, le robas el paquete completo: lo juntas con el tuyo y tu carta queda arriba. Tu propio paquete no se roba.',
      'Si tu carta iguala cartas de la mesa y también la cima de uno o más paquetes rivales, te llevas todo en la misma jugada. Es obligatorio: si tu carta puede capturar, captura.',
      'Si tu carta no iguala nada, la botas al centro de la mesa, boca arriba.',
      'Cuando todos se quedan sin cartas y todavía hay mazo, se reparten 4 cartas nuevas a cada jugador (la mesa no recibe cartas nuevas).',
      'Al terminar el mazo y jugarse las últimas cartas, las que queden sueltas en la mesa son del último jugador que se llevó cartas o robó un paquete.',
      'Gana quien tenga más cartas en su paquete. Si dos o más tienen la misma cantidad, hay empate.',
    ],
  },
};

export function createGameState(game: GameId, players: Player[], dealer?: number): GameState {
  if (game === 'casino') return createCasinoGame(players, dealer);
  if (game === 'tresydos') return createTresYDosGame(players, dealer);
  if (game === 'robaito') return createRobaitoGame(players, dealer);
  return createCagaoGame(players, dealer);
}

/** Nombres de los bots con su género, para que la cara que se les da vaya con el nombre. */
const BOT_NAMES: { name: string; gender: Gender }[] = [
  { name: 'Santiago', gender: 'm' },
  { name: 'Valentina', gender: 'f' },
  { name: 'Mateo', gender: 'm' },
  { name: 'Camila', gender: 'f' },
  { name: 'Sebastián', gender: 'm' },
  { name: 'Luciana', gender: 'f' },
  { name: 'Gabriel', gender: 'm' },
  { name: 'Daniela', gender: 'f' },
];

export function createSoloPlayers(
  game: GameId,
  human: Player,
  playerCount = GAMES[game].soloPlayerCount,
  botLevel?: () => number,
): Player[] {
  return fillWithBots(game, [human], playerCount, botLevel);
}

/**
 * Completa la mesa con bots hasta `targetCount` jugadores. Los nombres y los
 * ids no se repiten con los que ya están sentados (sirve tanto para el modo
 * sin conexión como para completar una sala en línea). Si ya hay suficientes,
 * devuelve la lista tal cual. Con `botLevel`, cada bot recibe su nivel de
 * esa función (cercano al del humano); sin ella, los bots no llevan nivel.
 */
export function fillWithBots(
  game: GameId,
  players: Player[],
  targetCount: number,
  botLevel?: () => number,
): Player[] {
  void game;
  const needed = targetCount - players.length;
  if (needed <= 0) return players;
  const usedNames = new Set(players.map((p) => p.name));
  const usedIds = new Set(players.map((p) => p.id));
  const available = BOT_NAMES.filter((b) => !usedNames.has(b.name));
  let nextBot = 1;
  for (const p of players) {
    const m = /^bot-(\d+)$/.exec(p.id);
    if (m) nextBot = Math.max(nextBot, Number(m[1]) + 1);
  }
  const bots: Player[] = [];
  for (let i = 0; i < needed; i++) {
    const pool = available.length > 0 ? available : [...BOT_NAMES];
    const [pick] = pool.splice(randomInt(pool.length), 1);
    let id = `bot-${nextBot++}`;
    while (usedIds.has(id)) id = `bot-${nextBot++}`;
    usedIds.add(id);
    bots.push({
      id,
      name: pick.name,
      avatar: encodeAvatar(randomAvatar(Math.random, pick.gender)),
      ...(botLevel ? { level: botLevel() } : {}),
    });
  }
  return [...players, ...bots];
}

/** La menor cantidad válida de jugadores para el juego que no baje de `atLeast` (o el máximo si no hay). */
export function minValidPlayerCount(game: GameId, atLeast: number): number {
  const valid = GAMES[game].playerCounts.find((count) => count >= atLeast);
  return valid ?? GAMES[game].maxPlayers;
}

export function canStartGame(game: GameId, playerCount: number): boolean {
  return GAMES[game].playerCounts.includes(playerCount);
}

export function isGameFinished(state: GameState): boolean {
  return state.phase === 'gameOver';
}
