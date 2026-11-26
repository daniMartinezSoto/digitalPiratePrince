import type { IdTirada } from '../modificadores/id-tirada';
import type { Caracteristica } from '../chequeos/chequeo';
import type { EnemigoPedido, OpcionesDeCombate } from '../combate/combate';
import type { EfectoDefinicion } from '../tablas/efecto';
import type { Direccion } from '../mapa/hexagonos';

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
//   "segun"         → según DÓNDE estés (a bordo, en un puerto o en otro sitio) se sigue por una rama u
//                     otra. Lo decide el juego solo: no hay botón.
//
// CANTIDAD DEL EVENTO (paso 7b): un paso puede llevar "cantidad": "1d6x5". Al entrar en él se tira y
// el número se guarda mientras dure el evento (cada vez que sale el evento, se vuelve a tirar). Se usa:
//   - en los textos (del paso, de las ramas y de los botones), escribiendo {cantidad};
//   - en los efectos, con "cantidad": "cantidad" (ganar esa cantidad) o "-cantidad" (perderla);
//   - en el requisito "oro": "cantidad" (tener al menos ese oro).
// Ejemplo (el guardia, E057): "Aceptará un soborno de {cantidad} monedas de oro".
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

  // true = recibes un amuleto maldito (E027), después de los efectos: tira bendición y maldición
  // (recibirAmuletoMaldito). Si ya llevas uno, no pasa nada. Si sale el deseo, se resuelve antes de seguir.
  amuletoMaldito?: boolean;

  // Mueve al jugador (con el barco, si va a bordo) en línea recta, después de los efectos (E011, las
  // velas dañadas: { "direccion": "NE", "pasos": 3 }). Usa desviar (core/viaje/mover.ts): a bordo solo
  // por agua y a pie solo por tierra; se para antes de lo que no valga o del borde. Lo que salte al
  // llegar (una condición que termina, una marca del mapa) se juega antes de seguir. "Al azar" = una
  // tirada de 1d6 con una fila por dirección (libro: 1 SE · 2 S · 3 NE · 4 SO · 5 NO · 6 N).
  desviar?: { direccion: Direccion; pasos: number };

  // Continuar en este paso del mismo evento.
  paso?: string;

  // Saltar a otro evento sin volver (el evento actual termina y lo sustituye el nuevo).
  evento?: string;

  // Solo con "evento": la primera tirada de ese evento se tira sola y no se enseña; se ve directamente
  // lo que toca (el 2 del tesoro mágico → un tesoro normal, decidido por el autor el 25-nov).
  tiradaOculta?: boolean;

  // Resolver otro evento y volver: al volver se sigue en "paso" o, sin "paso", se termina.
  llamar?: string;

  // El mensaje si los efectos de aquí te matan ("Das un último traspié..."). Si no lo tiene, se usa el
  // del evento; si tampoco, uno general según la causa.
  muerte?: string;

  // true = al ir a otro paso, se para en "Continuar" antes de enseñarlo. Sin esto, lo leído se queda
  // arriba y el paso siguiente sale debajo, en la misma pantalla (decidido por el autor el 22-nov).
  pausa?: boolean;
}

/** Un paso del evento: una rama que, además, puede pedir algo al jugador. */
export interface Paso extends Rama {
  opciones?: Opcion[];
  tirada?: TiradaDeEvento;
  chequeo?: ChequeoDeEvento;
  combate?: CombateDeEvento;
  combateNaval?: CombateNavalDeEvento;
  segun?: SegunDondeEstes;

  // Según si LLEVAS algo (un objeto del inventario o una condición, como "saltarSiTiene"): se sigue solo
  // por "si" o por "no" (la que no está escrita = termina). Las sirenas (E015, decidido por el autor el
  // 26-nov): con la lira de las sirenas, te ofrecen curarte o llevarte hasta un cofre.
  //   "siTiene": { "id": "lira_de_las_sirenas", "si": { "paso": "la_lira" }, "no": { "paso": "el_canto" } }
  siTiene?: { id: string; si?: Rama; no?: Rama };

  // Se tira al entrar en el paso y se guarda mientras dure el evento (ver arriba).
  cantidad?: string;
}

/**
 * Según dónde estés: a bordo de tu barco, en un puerto (la guarida cuenta como puerto) o en cualquier
 * otro sitio. La rama que no se escriba es "no pasa nada": el evento termina.
 */
export interface SegunDondeEstes {
  barco?: Rama;
  puerto?: Rama;
  otro?: Rama;
}

/** Lo que se escribe en efectos y requisitos para usar la cantidad del evento. */
export const CANTIDAD_DEL_EVENTO = 'cantidad';

/** Un botón de una elección. Al pulsarlo se aplican sus efectos y se sigue por donde diga. */
export interface Opcion {
  // Lo que pone el botón ("Deseo de riqueza. +200 monedas de oro").
  texto: string;

  // Condiciones para poder elegirla. Si no se cumplen, el botón sale desactivado con el motivo.
  requiere?: Requisitos;

  // true = "Hacerle sitio despidiendo a alguien" (decidido por el autor el 26-nov). Solo sale con el
  // grupo lleno y alguien a quien se pueda despedir (los inseparables no). Al elegirla, el jugador ve
  // sus seguidores ("Despedir a Bruno") y "Mejor no" (vuelve a las opciones). Al despedir a uno, se
  // aplican los efectos con ese "despedir" en el ganar_seguidor (lleva uno, y solo uno) y se sigue.
  hacerSitio?: boolean;

  efectos?: EfectoDefinicion[];
  paso?: string;
  evento?: string;
  llamar?: string;
  muerte?: string;
  pausa?: boolean;
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

  // Que esa característica no esté ya al máximo (5, con el amuleto incluido): "+1 a fuerza" no se
  // puede elegir con fuerza 5 (decidido por el autor el 22-nov).
  puedeSubir?: 'fuerza' | 'ingenio';

  // Tener al menos este oro: un número fijo o "cantidad" (la cantidad del evento: el soborno del guardia).
  oro?: number | typeof CANTIDAD_DEL_EVENTO;
}

export const REQUISITOS = ['sinObjeto', 'puedeGanarSeguidor', 'puedeSubir', 'oro'] as const;

/** Una tirada del evento: se tira "dado" (más el bonificador) y manda la fila que sale. */
export interface TiradaDeEvento {
  dado: string;

  // Lo que pone el botón, con sabor (pedido por el autor el 22-nov: nunca "Tirar dados"):
  // "¿Aquel mentecato te está mirando mal?". La pantalla añade el dado: "(1d6)". Obligatorio.
  boton: string;

  // Número fijo que se suma ("+1 si vienes de la visión de la isla" se escribirá en su rama).
  modificador?: number;

  // Nombre de la tirada (los de IDS_TIRADA): suma además los bonificadores del jugador para esa tirada
  // (sobrenombre, objetos, seguidores, condiciones). El tesoro: "tesoro" (la muy mala suerte, −3).
  idTirada?: IdTirada;

  // Lo que pasa si, con los bonificadores, el total queda por debajo de 1 (0 o negativo). Sin él,
  // cuenta la primera fila. El tesoro con muy mala suerte: { "evento": "trampa" } (E029).
  siSaleMenosDe1?: Rama;

  // La tirada decide la CANTIDAD del evento, a la vista: el total por este número se guarda como
  // {cantidad} (el soborno del guardia: "1d6" con 5 = 5 a 30 monedas). Así se ve rodar el dado.
  guardarCantidad?: number;

  // true = se tira sola al llegar a este paso, sin botón ni dados a la vista: se ve directamente lo que
  // toca (la fiesta, E007: después, 1d6 y con 5-6 aparece el borracho; decidido por el autor el 26-nov).
  // El "boton" se escribe igual (lo pide el revisor y lo usa la pantalla de pruebas si hiciera falta).
  oculta?: boolean;

  // true = aquí no se puede usar el amuleto del destino (elegir el resultado). El amuleto maldito
  // (E027): sus dos dados son la bendición y la maldición; elegir un total no tiene sentido (26-nov).
  sinAmuletoDelDestino?: boolean;

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

  // Id de una condición o de un objeto: si el jugador YA lo tiene, esta fila no cuenta y pasa a la
  // siguiente (y así hasta una que valga; si es la última, a la anterior). La maldición (E022): si ya
  // tienes el maleficio del pirata y sale el 1, cuenta el 2. El tesoro mágico: el ídolo y la lira, uno solo.
  saltarSiTiene?: string;

  // Un seguidor te libra de esta fila (E011, decidido por el autor el 26-nov: siempre, y si valen
  // varios, el primero de tu grupo). Si llevas uno de estos tipos, se lee el texto de la fila (el
  // problema que venía) y después el de "salvaSi", con {seguidor} cambiado por su nombre; y ahí se
  // termina: nada de los efectos, el movimiento ni por dónde seguía la fila.
  //   "salvaSi": { "seguidores": ["navegante", "cartografo"],
  //                "texto": "Pero {seguidor} mira las estrellas... {seguidor} te ha librado de «¡Perdidos!»." }
  salvaSi?: { seguidores: string[]; texto: string };

  // true = esta fila solo cuenta si el DADO, sin bonificadores, cae en ella; si se llega con ellos,
  // cuenta la fila anterior. El paso rocoso (E012, decidido por el autor el 26-nov): la fama, solo con
  // un 6 natural; un 5 con +1 cuenta como 5.
  soloNatural?: boolean;
}

/** Chequeo: 1d6 (+ modificador) ≤ la característica actual. */
export interface ChequeoDeEvento {
  caracteristica: Caracteristica;

  // Lo que pone el botón. Sin él: "Chequeo de Fuerza" / "Chequeo de Ingenio".
  boton?: string;

  // Se suma AL DADO: −1 lo hace más fácil, +1 más difícil (como en el pulso).
  modificador?: number;

  exito: Rama;
  fallo: Rama;
}

/**
 * Un combate normal con enemigos del bestiario (o un encuentro). Se puede ajustar cada enemigo (ataque, resistencia,
 * cuántos, recompensa por cada uno) y el combate (si se puede huir, si es no mortal, sorpresa).
 * Si una salida no se escribe, el evento termina por ahí.
 */
export interface CombateDeEvento extends OpcionesDeCombate {
  // Contra quién se lucha: una lista fija de enemigos o un ENCUENTRO (una tablita de enemigos posibles,
  // data/encuentros.json: se tira el dado y sale con quién). Uno de los dos, nunca ambos.
  enemigos?: EnemigoPedido[];
  encuentro?: string;

  // Lo que pone el botón de luchar (sin él: "Luchar") y el de la tirada del encuentro (sin él:
  // "¿Contra quién luchas?"; la pantalla añade el dado).
  boton?: string;
  botonDelEncuentro?: string;

  victoria?: Rama;
  huida?: Rama;

  // Solo en combates no mortales ("noMortal": true): si caes, te quedas con 1 PV y sigues por aquí.
  // En uno normal, caer es perder la partida y no hay por dónde seguir.
  derrota?: Rama;
}

/** Un combate naval contra un barco del catálogo (data/barcos.json). */
export interface CombateNavalDeEvento {
  barco: string;
  // Lo que pone el botón de luchar (sin él: "Luchar").
  boton?: string;
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

  // El mensaje si mueres en este evento y la rama no trae el suyo.
  muerte?: string;
}

/** El paso por el que empieza todo evento. */
export const PASO_INICIAL = 'inicio';
