import type { Caracteristica } from '../chequeos/chequeo';
import type { EnemigoPedido, OpcionesDeCombate } from '../combate/combate';
import type { EfectoDefinicion } from '../tablas/efecto';

// FORMATO DE UN EVENTO (Sprint 10, paso 1). Cada evento vive en su propio archivo,
// data/eventos/<id>.json, y se carga en core/eventos/cargar-eventos.ts.
//
// Un evento es una mini-historia hecha de PASOS CON NOMBRE. Se empieza por el paso "inicio".
// Cada paso puede tener un texto y unos efectos, y luego UNA forma de seguir:
//
//   (nada)          → el evento termina (si hay algo que leer, sale "Continuar" antes).
//   "paso"          → continuar en otro paso de este evento:      "paso": "huida"
//   "evento"        → saltar a OTRO evento, sin volver:           "evento": "piratas_hostiles"
//   "llamar"        → resolver otro evento y VOLVER aquí; al volver se sigue en "paso" (si lo hay)
//                     o se termina:                                "llamar": "dano_en_la_bodega", "paso": "nada"
//   "opciones"      → el jugador elige (botones).
//   "tirada"        → se tiran dados y la fila que sale decide.
//   "chequeo"       → chequeo de Fuerza o Ingenio, con una salida si lo superas y otra si no.
//   "combate"       → combate normal; según cómo acabe (victoria, huida, derrota) se sigue por un lado u otro.
//   "combateNaval"  → combate naval contra un barco del catálogo.
//
// "opciones", "tirada", "chequeo", "combate" y "combateNaval" ya llevan dentro por dónde se sigue, así
// que no se pueden mezclar entre sí ni con "paso", "evento" o "llamar". El revisor lo comprueba.
//
// Las RAMAS (cada fila de una tirada, el éxito y el fallo de un chequeo, cómo acaba un combate) se
// escriben igual que un paso sencillo: texto, efectos y paso / evento / llamar.
//
// Ejemplo (un trozo del islote, E002):
//   "inicio": { "texto": "Navegando, descubres un pequeño islote...",
//               "opciones": [ { "texto": "Acercarte a explorarlo", "paso": "explorar" },
//                             { "texto": "Seguir navegando" } ] },
//   "explorar": { "tirada": { "dado": "2d6", "filas": [
//       { "min": 2, "max": 2, "texto": "Uy, parece que no es un islote...", "evento": "monstruo" },
//       { "min": 3, "max": 3, "texto": "Dañas tu embarcación.", "llamar": "dano_en_la_bodega", "paso": "nada" },
//       { "min": 11, "max": 11, "texto": "Un montón de fruta.", "efectos": [{ "tipo": "comida", "cantidad": "1d6x2" }] },
//       ... ] } },
//   "nada": { "texto": "En el islote no había nada." }

/** Lo que pasa al llegar a una rama: texto, efectos y por dónde se sigue. */
export interface Rama {
  // Lo que se cuenta al jugador ("El guardia te atrapa y te lleva a la prisión").
  texto?: string;

  // Efectos, escritos como en las tablas: [{ "tipo": "oro", "cantidad": "1d6x10" }].
  efectos?: EfectoDefinicion[];

  // Continuar en este paso del mismo evento.
  paso?: string;

  // Saltar a otro evento sin volver (el evento actual termina y lo sustituye el nuevo).
  evento?: string;

  // Resolver otro evento y volver: al volver se sigue en "paso" o, sin "paso", se termina.
  llamar?: string;
}

/** Un paso del evento: una rama que, además, puede pedir algo al jugador. */
export interface Paso extends Rama {
  opciones?: Opcion[];
  tirada?: TiradaDeEvento;
  chequeo?: ChequeoDeEvento;
  combate?: CombateDeEvento;
  combateNaval?: CombateNavalDeEvento;
}

/** Un botón de una elección. Al pulsarlo se aplican sus efectos y se sigue por donde diga. */
export interface Opcion {
  // Lo que pone el botón ("Deseo de riqueza. +200 monedas de oro").
  texto: string;

  // Condiciones para poder elegirla. Si no se cumplen, el botón sale desactivado con el motivo.
  requiere?: Requisitos;

  efectos?: EfectoDefinicion[];
  paso?: string;
  evento?: string;
  llamar?: string;
}

/**
 * Lo que hace falta para elegir una opción. Todas las que se escriban se tienen que cumplir.
 * Se irán añadiendo según las pidan los eventos (lista cerrada: el revisor rechaza las que no existen).
 */
export interface Requisitos {
  // No llevar este objeto ("Obtén el ídolo antediluviano": si ya lo tienes, no se puede elegir).
  sinObjeto?: string;

  // Poder ganar un seguidor: que el grupo no esté lleno y que nada lo prohíba (hedor nauseabundo).
  // Decidido por el autor (22-nov) para el deseo de amistad: si no puede entrar, la opción sale desactivada.
  puedeGanarSeguidor?: true;
}

export const REQUISITOS = ['sinObjeto', 'puedeGanarSeguidor'] as const;

/** Una tirada del evento: se tira "dado" (más el bonificador) y manda la fila que sale. */
export interface TiradaDeEvento {
  dado: string;

  // Número fijo que se suma ("+1 si vienes de la visión de la isla" se escribirá en su rama).
  modificador?: number;

  // Las filas, como en las tablas: sin huecos ni solapes y cubriendo lo que saca el dado.
  // Si el resultado se sale (con bonificadores), cuenta la primera o la última fila.
  filas: FilaDeEvento[];
}

/** Una fila de una tirada: un rango del dado y su rama. */
export interface FilaDeEvento extends Rama {
  min: number;
  max: number;

  // "Vuelve a tirar": tras enseñar esta fila (y aplicar sus efectos), se tira otra vez en la misma tirada.
  volverATirar?: boolean;
}

/** Chequeo: 1d6 (+ modificador) ≤ la característica actual. */
export interface ChequeoDeEvento {
  caracteristica: Caracteristica;

  // Se suma AL DADO: −1 lo hace más fácil, +1 más difícil (como en el pulso).
  modificador?: number;

  exito: Rama;
  fallo: Rama;
}

/**
 * Un combate normal con enemigos del bestiario. Se puede ajustar cada enemigo (ataque, resistencia,
 * cuántos, recompensa por cada uno) y el combate (si se puede huir, si es no mortal, sorpresa).
 * Si una salida no se escribe, el evento termina por ahí.
 */
export interface CombateDeEvento extends OpcionesDeCombate {
  enemigos: EnemigoPedido[];
  victoria?: Rama;
  huida?: Rama;

  // Solo en combates no mortales ("noMortal": true): si caes, te quedas con 1 PV y sigues por aquí.
  // En uno normal, caer es perder la partida y no hay por dónde seguir.
  derrota?: Rama;
}

/** Un combate naval contra un barco del catálogo (data/barcos.json). */
export interface CombateNavalDeEvento {
  barco: string;
  victoria?: Rama;

  // Huir de un combate naval ya lanza el daño en la bodega (E006) él solo; aquí, lo que pase después.
  huida?: Rama;
}

export interface Evento {
  // Identificador con nombre ("deseo"), el mismo que usan las tablas y las listas de terreno.
  id: string;

  // Lo que sale arriba de la ventana ("Deseo").
  titulo: string;

  // Ruta del dibujo. Opcional mientras no haya dibujos.
  imagen?: string;

  // true = solo puede salir una vez por partida. Después desaparece de las listas de terreno y
  // de las tiradas de otros eventos.
  unaVez?: boolean;

  // Los pasos, por su nombre. Tiene que haber uno llamado "inicio".
  pasos: Record<string, Paso>;

  // Solo para cotejar con el libro de papel ("E041").
  libro?: string;
}

/** El paso por el que empieza todo evento. */
export const PASO_INICIAL = 'inicio';
