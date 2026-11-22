import type { ResultadoChequeo } from '../chequeos/chequeo';
import type { Cambio } from '../efectos/cambio';
import type { ResultadoCombate } from './combate';

// LA PILA DE EVENTOS (Sprint 10, paso 2). Va dentro del estado (mundo.pilaEventos), así que un
// guardado a mitad de un evento lo conserva: al volver, la ventana sale exactamente donde estaba.
//
// Cada nivel de la pila es un MARCO: un evento y el paso en el que va. El de arriba es el que se
// está jugando. Los de debajo esperan:
//   - un evento que ha LLAMADO a otro ("llamar") y volverá cuando ese termine;
//   - eventos que el juego ha lanzado a la vez (al viajar: la marca de la casilla y el del terreno)
//     y que todavía no han empezado ("porEmpezar"): salen uno detrás de otro.
// Pila vacía = no hay ningún evento en marcha.
//
// Solo datos (se guarda tal cual): nada de funciones ni clases.

/** Lo que el jugador tiene que leer ahora: un texto, lo que ha cambiado, los dados... */
export interface Lectura {
  texto?: string;

  // Los cambios reales (el "chivato" de aplicarEfectos), para enseñarlos: "+200 de oro".
  cambios: Cambio[];

  // Si ha habido tirada: los dados, el bonificador y el total. elegida = la eligió el amuleto del destino.
  tirada?: { dados: number[]; modificador: number; total: number; elegida?: boolean };

  // Si ha habido chequeo de Fuerza o Ingenio.
  chequeo?: ResultadoChequeo;

  // Si se viene de un combate (normal o naval): cómo acabó.
  combate?: ResultadoCombate;
}

/**
 * Por dónde se sigue al pulsar "Continuar" (o solo, si no hay nada que leer):
 *   paso:    a otro paso del mismo evento.
 *   evento:  este evento termina y en su lugar empieza otro (sin volver).
 *   llamar:  se juegan estos eventos, uno detrás de otro, y al acabar se sigue por "despues".
 *   repetir: "vuelve a tirar": otra vez la misma tirada del mismo paso.
 *   fin:     el evento termina.
 */
export type Siguiente =
  | { tipo: 'paso'; paso: string }
  | { tipo: 'evento'; evento: string }
  | { tipo: 'llamar'; eventos: string[]; despues: Siguiente }
  | { tipo: 'repetir' }
  | { tipo: 'fin' };

export interface MarcoEvento {
  evento: string;
  paso: string;

  // true = aún no ha empezado (espera su turno). Al llegarle, se entra en su paso "inicio".
  porEmpezar?: boolean;

  // true = lo lanzó el juego (viajar, una acción, la noche...), no otro evento. Solo estos se
  // pueden evitar con la mano de mono (decidido por el autor: los encadenados, no).
  raiz?: boolean;

  // Lo que se enseña ahora (null = nada que leer).
  lectura: Lectura | null;

  // null = el paso espera al jugador (elegir, tirar, hacer el chequeo, luchar).
  // Si no es null, sale "Continuar" (o se sigue solo si no hay nada que leer).
  siguiente: Siguiente | null;

  // Hay un combate lanzado por este paso: la partida enseña el combate y, al terminar, se sigue aquí.
  esperando?: 'combate' | 'combate_naval';
}
