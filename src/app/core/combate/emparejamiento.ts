import type { Dados } from '../dados/dados';
import type { Objetivos } from '../estado/combate';

// EMPAREJAMIENTO DEL COMBATE (Sprint 7, paso 3): quién ataca a quién. Solo calcula; no toca el estado.
//
// Los luchadores se nombran por un id (el jugador, cada seguidor, cada enemigo del combate). Quien llama
// decide los ids y quién lucha (el mono, por ejemplo, ni siquiera entra en las listas).
//
// REGLAS (decididas por el autor):
//   - Al empezar se sortea (emparejar). Cada luchador del bando PEQUEÑO recibe un rival distinto del
//     bando grande; los que sobran del bando grande se reparten al azar entre los del bando pequeño.
//     Con los dos bandos iguales, todos van uno contra uno.
//   - Cada uno ataca SOLO a su objetivo. El que tiene varios encima recibe todos sus ataques, pero
//     solo golpea a uno.
//   - Las parejas duran hasta que uno cae. Entonces (reemparejar), quien se ha quedado sin objetivo
//     recibe otro al azar entre los rivales que siguen vivos. Vale para los dos bandos.
//   - SIEMPRE HAY AL MENOS UN ENEMIGO QUE VA A POR EL JUGADOR (decidido por el autor, 19-nov): el
//     jugador es el PRIMERO de la lista de aliados. Si los enemigos son menos que vuestro bando, uno
//     de ellos (al azar) es el rival del jugador; y si tras una ronda nadie le ataca, uno de los
//     enemigos vivos (al azar) pasa a atacarle.
//
// Cada elección al azar gasta UN número del generador; si solo hay una opción, no se tira nada.
// El orden es siempre el mismo (primero los aliados, en su orden, luego los enemigos), así que con la
// misma semilla sale el mismo emparejamiento.

// Quién ataca a quién: objetivos['jugador'] = 'enemigo_2'. El tipo vive en el estado (va guardado en el combate).
export type { Objetivos } from '../estado/combate';

/**
 * Sorteo inicial. aliados = el jugador (SIEMPRE el primero) y los seguidores que luchan; enemigos = los enemigos del combate.
 * Si algún bando está vacío, no hay a quién atacar: devuelve {}.
 */
export function emparejar(aliados: readonly string[], enemigos: readonly string[], dados: Dados): Objetivos {
  comprobarIds(aliados, enemigos);
  if (aliados.length === 0 || enemigos.length === 0) {
    return {};
  }

  const objetivos: Objetivos = {};

  // Si los enemigos son menos, el primero en elegirse es el rival del jugador: así siempre le ataca uno.
  if (enemigos.length < aliados.length) {
    const jugador = aliados[0];
    const rivalDelJugador = elegirAlAzar(enemigos, dados);
    objetivos[jugador] = rivalDelJugador;
    objetivos[rivalDelJugador] = jugador;
    const otrosEnemigos = enemigos.filter(e => e !== rivalDelJugador);
    const libres = aliados.slice(1);
    for (const enemigo of otrosEnemigos) {
      const rival = sacarAlAzar(libres, dados);
      objetivos[enemigo] = rival;
      objetivos[rival] = enemigo;
    }
    // Los aliados que sobran van al azar a por uno de los enemigos.
    for (const sobrante of libres) {
      objetivos[sobrante] = elegirAlAzar(enemigos, dados);
    }
    return objetivos;
  }

  // Si los enemigos son tantos o más, cada aliado (el jugador incluido) recibe un rival distinto.
  const [pequeno, grande] = [aliados, enemigos];
  const libres = [...grande];
  for (const luchador of pequeno) {
    const rival = sacarAlAzar(libres, dados);
    objetivos[luchador] = rival;
    objetivos[rival] = luchador;
  }

  // Los que sobran del bando grande se reparten al azar entre los del bando pequeño.
  for (const sobrante of libres) {
    objetivos[sobrante] = elegirAlAzar(pequeno, dados);
  }

  return objetivos;
}

/**
 * Después de una ronda: aliados y enemigos son los que siguen VIVOS. Quien sigue teniendo un objetivo
 * vivo lo mantiene; quien lo ha perdido recibe uno nuevo al azar entre los rivales vivos.
 * Los muertos desaparecen de la lista. Si un bando ha caído entero, devuelve {} (el combate ha terminado).
 */
export function reemparejar(objetivos: Objetivos, aliados: readonly string[], enemigos: readonly string[], dados: Dados): Objetivos {
  comprobarIds(aliados, enemigos);
  if (aliados.length === 0 || enemigos.length === 0) {
    return {};
  }

  const nuevos: Objetivos = {};
  for (const [luchador, rivales] of [
    ...aliados.map(a => [a, enemigos] as const),
    ...enemigos.map(e => [e, aliados] as const),
  ]) {
    const actual = objetivos[luchador];
    nuevos[luchador] = actual !== undefined && rivales.includes(actual) ? actual : elegirAlAzar(rivales, dados);
  }

  // Si nadie ataca al jugador (el primero de los aliados), uno de los enemigos vivos, al azar, pasa a atacarle.
  const jugador = aliados[0];
  if (!enemigos.some(e => nuevos[e] === jugador)) {
    nuevos[elegirAlAzar(enemigos, dados)] = jugador;
  }
  return nuevos;
}

/** Quiénes atacan a este luchador (para enseñarlo: "Te atacan: Pirata esqueleto 1 y 3"). */
export function atacantesDe(objetivos: Objetivos, id: string): string[] {
  return Object.keys(objetivos).filter(luchador => objetivos[luchador] === id);
}

/** Elige uno al azar. Si solo hay uno, no gasta ningún número del generador. */
function elegirAlAzar(lista: readonly string[], dados: Dados): string {
  return lista.length === 1 ? lista[0] : lista[dados.entero(0, lista.length - 1)];
}

/** Saca uno al azar de la lista (la lista pierde ese elemento). Si solo hay uno, no gasta ningún número. */
function sacarAlAzar(lista: string[], dados: Dados): string {
  const posicion = lista.length === 1 ? 0 : dados.entero(0, lista.length - 1);
  return lista.splice(posicion, 1)[0];
}

/** Un mismo id no puede estar dos veces (ni repetido en un bando ni en los dos). */
function comprobarIds(aliados: readonly string[], enemigos: readonly string[]): void {
  const todos = [...aliados, ...enemigos];
  const repetido = todos.find((id, i) => todos.indexOf(id) !== i);
  if (repetido !== undefined) {
    throw new Error(`Emparejamiento: el luchador "${repetido}" está repetido`);
  }
}
