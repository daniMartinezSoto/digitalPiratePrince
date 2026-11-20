import type { ResultadoAccion } from '../acciones/accion';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar } from '../acciones/accion';
import { AJUSTES } from '../ajustes/ajustes';
import { condicionesQueProhiben } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import { obtenerListaEventos } from '../tablas/listas-eventos/cargar-listas-eventos';
import { eventoAleatorio } from '../tablas/listas-eventos/elegir-evento';
import { esAgua, type Lugar, type Rasgo, type Terreno } from '../turno/lugar';
import { llegar } from './llegar';

// VIAJAR SIN MAPA (pantalla de pruebas, tras el Sprint 8). Mientras no exista el mapa (Sprint 9),
// quien llama dice A DÓNDE se llega (el terreno de la casilla y lo que hay en ella). Con el mapa,
// el destino será una casilla vecina de verdad, y esto se adaptará; lo de llegar (llegar.ts) y el
// evento del terreno se quedan igual.
// ACCIÓN: gasta la acción del día. En orden:
//   1. Llegada (core/viaje/llegar.ts): condiciones que terminan al llegar, puerto principal y victoria.
//   2. Si la partida sigue, posible evento: AJUSTES.probabilidadEventoAlViajar (50 %) en la lista del
//      terreno de destino (data/eventos-terreno/), como evento pendiente.
//   3. Toca comer.
// Una condición que prohíbe viajar (la tormenta) lo impide.

export interface Destino {
  terreno: Terreno;
  // Qué hay en la casilla: en el agua, siempre "barco"; en tierra, intemperie, puerto, aldea...
  lugar: Lugar;
  rasgo?: Rasgo;
  // Si es uno de los puertos principales, su id ("tortuga").
  puertoPrincipal?: string;
}

export interface ResultadoViaje extends ResultadoAccion {
  puertoNuevo: boolean;
}

/** Solo consulta: si no se puede viajar, las condiciones que lo impiden (["tormenta"]); si se puede, []. */
export function condicionesQueImpidenViajar(estado: Estado): string[] {
  return condicionesQueProhiben(estado.jugador, 'viajar');
}

export function viajar(estado: Estado, destino: Destino, dados: Dados): ResultadoViaje {
  comprobarQueSePuedeActuar(estado, 'viajar');
  const impiden = condicionesQueImpidenViajar(estado);
  if (impiden.length > 0) {
    throw new Error(`viajar: no se puede viajar (${impiden.join(', ')})`);
  }
  if (esAgua(destino.terreno) !== (destino.lugar === 'barco')) {
    throw new Error(`viajar: en "${destino.terreno}" no se puede estar en "${destino.lugar}" (en el agua se va a bordo; en tierra, no)`);
  }

  const llegada = llegar(estado, { lugar: destino.lugar, rasgo: destino.rasgo, puertoPrincipal: destino.puertoPrincipal }, dados);
  const eventos = [...llegada.eventos];
  if (!llegada.estado.mundo.finPartida) {
    const evento = eventoAleatorio(obtenerListaEventos(destino.terreno), AJUSTES.probabilidadEventoAlViajar, dados);
    if (evento) eventos.push(evento);
  }
  const final = llegada.estado.mundo.finPartida
    ? { ...llegada.estado, mundo: { ...llegada.estado.mundo, estadoDados: dados.obtenerEstado() } }
    : cerrarFaseDeAccion(llegada.estado, dados);
  return { estado: final, cambios: llegada.cambios, eventos, puertoNuevo: llegada.puertoNuevo };
}
