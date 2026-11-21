import type { ResultadoAccion } from '../acciones/accion';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar } from '../acciones/accion';
import { AJUSTES } from '../ajustes/ajustes';
import { condicionesQueProhiben } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { mapaDeLaPartida, vasABordo } from '../mapa/donde-estas';
import { distancia, mismaCasilla, vecinas } from '../mapa/hexagonos';
import { casillaEn, type Coordenada } from '../mapa/mapa';
import { casillaBloqueada, sitioEn } from '../mapa/sitio-actual';
import { obtenerListaEventos } from '../tablas/listas-eventos/cargar-listas-eventos';
import { eventoAleatorio } from '../tablas/listas-eventos/elegir-evento';
import { esAgua } from '../turno/lugar';
import { llegar } from './llegar';

// VIAJAR (Sprint 9, paso 5): moverse por el mapa. ACCIÓN: gasta la acción del día.
//
// A DÓNDE se puede ir (destinosDeViaje):
//   - A bordo: a una casilla de AGUA vecina (el barco va contigo).
//   - A pie: a una casilla de TIERRA vecina (puertos incluidos; el barco se queda donde está).
//   - Nunca a una casilla bloqueada (camino bloqueado, guarida hostil...).
//   - Una casilla más lejos (decidido por el autor el 20-nov: "le sale elegible un hexágono más"):
//       · el NAVEGANTE (sobrenombre, o un seguidor con la habilidad "navegacion"), por mar, si la
//         casilla de en medio también es agua;
//       · el SUPERVIVIENTE, a pie, si la casilla de en medio Y la de destino son jungla profunda.
//
// Qué pasa al viajar, en orden:
//   1. Te mueves (y el barco contigo si vas a bordo).
//   2. Llegada (llegar.ts): condiciones que terminan al llegar, puerto principal y victoria.
//   3. Si la partida sigue: los eventos señalados en esa casilla (marcas "evento"; p. ej. un tesoro
//      de un mapa) y después UNA de estas:
//        · una guarida pirata sin explorar → su evento (E038, "guarida_pirata"), sin tirada de viaje;
//        · una zona de barcos (a bordo): AJUSTES.probabilidadEventoAlViajar (50 %) de un encuentro
//          con un barco aleatorio (E008, "barco"; decidido por el autor el 20-nov);
//        · si no, el 50 % de un evento de la lista del terreno de destino (data/eventos-terreno/).
//   4. Toca comer.
// Una condición que prohíbe viajar (la tormenta) lo impide.

const SOBRENOMBRE_NAVEGANTE = 'el_navegante';
const HABILIDAD_NAVEGACION = 'navegacion';
const SOBRENOMBRE_SUPERVIVIENTE = 'el_superviviente';

export interface ResultadoViaje extends ResultadoAccion {
  puertoNuevo: boolean;
}

/** Solo consulta: si no se puede viajar, las condiciones que lo impiden (["tormenta"]); si se puede, []. */
export function condicionesQueImpidenViajar(estado: Estado): string[] {
  return condicionesQueProhiben(estado.jugador, 'viajar');
}

/** ¿Llega una casilla más lejos por mar? (sobrenombre "el navegante" o un seguidor navegante) */
export function tieneNavegacion(jugador: Jugador): boolean {
  return jugador.sobrenombre === SOBRENOMBRE_NAVEGANTE || jugador.seguidores.some(s => s.habilidades.includes(HABILIDAD_NAVEGACION));
}

/**
 * Solo consulta: las casillas a las que se puede viajar desde donde está el jugador (sin mirar si
 * ahora es momento de actuar: eso lo comprueba viajar). Primero las vecinas; después, las de una
 * casilla más lejos (navegante o superviviente).
 */
export function destinosDeViaje(estado: Estado): Coordenada[] {
  const mapa = mapaDeLaPartida(estado);
  const desde = estado.mundo.posicion;
  const aBordo = vasABordo(estado);
  const terreno = (c: Coordenada) => casillaEn(mapa, c.col, c.fila)!.terreno;
  const libre = (c: Coordenada) => !casillaBloqueada(estado, c);
  const sePuedePisar = (c: Coordenada) => libre(c) && esAgua(terreno(c)) === aBordo;

  const cerca = vecinas(mapa, desde).filter(sePuedePisar);
  // ¿Puede pasar por esta casilla (y llegar a otra igual) para ir una más lejos?
  let paso: ((c: Coordenada) => boolean) | null = null;
  if (aBordo && tieneNavegacion(estado.jugador)) paso = sePuedePisar;
  if (!aBordo && estado.jugador.sobrenombre === SOBRENOMBRE_SUPERVIVIENTE) paso = c => libre(c) && terreno(c) === 'jungla_profunda';
  if (!paso) return cerca;

  const lejos: Coordenada[] = [];
  for (const medio of vecinas(mapa, desde).filter(paso)) {
    for (const c of vecinas(mapa, medio)) {
      const nueva = distancia(desde, c) === 2 && paso(c) && !lejos.some(l => mismaCasilla(l, c));
      if (nueva) lejos.push(c);
    }
  }
  return [...cerca, ...lejos];
}

export function viajar(estado: Estado, destino: Coordenada, dados: Dados): ResultadoViaje {
  comprobarQueSePuedeActuar(estado, 'viajar');
  const impiden = condicionesQueImpidenViajar(estado);
  if (impiden.length > 0) {
    throw new Error(`viajar: no se puede viajar (${impiden.join(', ')})`);
  }
  if (!destinosDeViaje(estado).some(d => mismaCasilla(d, destino))) {
    throw new Error(`viajar: no se puede viajar a ${destino.col},${destino.fila} desde ${estado.mundo.posicion.col},${estado.mundo.posicion.fila}`);
  }

  // 1. Moverse (con el barco, si vas a bordo).
  const aBordo = vasABordo(estado);
  const casilla = { col: destino.col, fila: destino.fila };
  const movido: Estado = {
    ...estado,
    mundo: { ...estado.mundo, posicion: casilla, ...(aBordo ? { posicionBarco: { ...casilla } } : {}) },
  };

  // 2. Llegada.
  const sitio = sitioEn(movido, casilla, aBordo);
  const llegada = llegar(movido, { lugar: sitio.lugar, rasgo: sitio.rasgo, puertoPrincipal: sitio.puertoPrincipal }, dados);
  const eventos = [...llegada.eventos];

  // 3. Eventos.
  if (!llegada.estado.mundo.finPartida) {
    for (const marca of llegada.estado.mundo.marcas) {
      if (marca.tipo === 'evento' && marca.evento && mismaCasilla(marca, casilla)) eventos.push(marca.evento);
    }
    const zonaDeBarcos = aBordo && casillaEn(mapaDeLaPartida(movido), casilla.col, casilla.fila)!.eventosDeBarco === true;
    if (sitio.guaridaSinExplorar) {
      eventos.push('guarida_pirata');
    } else if (zonaDeBarcos) {
      if (dados.probabilidad(AJUSTES.probabilidadEventoAlViajar / 100)) eventos.push('barco');
    } else {
      const evento = eventoAleatorio(obtenerListaEventos(sitio.terreno), AJUSTES.probabilidadEventoAlViajar, dados);
      if (evento) eventos.push(evento);
    }
  }

  // 4. Toca comer (salvo que la partida haya terminado al llegar).
  const final = llegada.estado.mundo.finPartida
    ? { ...llegada.estado, mundo: { ...llegada.estado.mundo, estadoDados: dados.obtenerEstado() } }
    : cerrarFaseDeAccion(llegada.estado, dados);
  return { estado: final, cambios: llegada.cambios, eventos, puertoNuevo: llegada.puertoNuevo };
}
