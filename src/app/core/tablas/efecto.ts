import type { CategoriaCondicion } from '../catalogos/condicion';

// Valores numéricos del jugador que una tabla (o un evento) puede modificar:
// recursos (oro, comida...) y características (fuerza, ingenio, vida máxima).
// Es un array (y de él sale el tipo) para poder recorrerlo en el test que valida las tablas.
export const RECURSOS = ['oro', 'comida', 'tripulacion', 'vida', 'fama', 'fuerza', 'ingenio', 'vidaMax'] as const;
export type TipoRecurso = (typeof RECURSOS)[number];

// Características: nunca bajan de 1 (con fuerza 0 nunca pasarías un chequeo). Por eso
// no admiten "todo" (dejarlas a 0) ni fijarlas por debajo de 1. El resto de recursos baja como mucho a 0.
export const CARACTERISTICAS: readonly TipoRecurso[] = ['fuerza', 'ingenio', 'vidaMax'];

// Qué se hace con el recurso. Si no se escribe, es "sumar".
//   sumar  → suma la cantidad (negativa = perder):        { "tipo": "oro", "cantidad": 20 }
//   fijar  → deja el recurso en ese valor:                 { "tipo": "vida", "operacion": "fijar", "cantidad": 1 }
//   mitad  → lo deja en la mitad (te roban medio oro):     { "tipo": "oro", "operacion": "mitad" }
//   maximo → lo sube a su máximo (curarse del todo):       { "tipo": "vida", "operacion": "maximo" }
//   todo   → lo pierde entero (te lo quitan todo):         { "tipo": "comida", "operacion": "todo" }
// mitad, maximo y todo dependen de cuánto tienes, así que los resuelve aplicarEfectos (Sprint 4).
export const OPERACIONES = ['sumar', 'fijar', 'mitad', 'maximo', 'todo'] as const;
export type Operacion = (typeof OPERACIONES)[number];

// Los únicos recursos que tienen máximo (y por tanto admiten "maximo").
export const RECURSOS_CON_MAXIMO: readonly TipoRecurso[] = ['vida', 'tripulacion', 'comida'];

// A quién afecta. Si no se escribe, es "jugador". Solo tiene sentido para la vida
// (los seguidores no tienen oro, comida ni fama).
//   todos             → el jugador y todos los seguidores ("todo el grupo pierde 2 PV")
//   seguidor_azar     → un seguidor al azar
//   seguidor_elegido  → un seguidor que elige el jugador
// Con "seguidor_azar" se puede añadir "siNoHay": los efectos que pasan EN SU LUGAR si no hay
// ningún seguidor (escorbuto: muere un seguidor; si no tienes, pierdes 1d6 de tripulación):
//   { "tipo": "vida", "operacion": "todo", "destino": "seguidor_azar",
//     "siNoHay": [{ "tipo": "tripulacion", "cantidad": "-1d6" }] }
export const DESTINOS = ['jugador', 'todos', 'seguidor_azar', 'seguidor_elegido'] as const;
export type Destino = (typeof DESTINOS)[number];

// Efectos que terminan la partida: muertes, "pierdes la partida" y las victorias
// alternativas (la isla misteriosa, la ciudad perdida).
export const FINES_DE_PARTIDA = ['ganar_partida', 'perder_partida'] as const;
export type FinDePartida = (typeof FINES_DE_PARTIDA)[number];

// Efectos que no son números del jugador: objetos, condiciones, turnos perdidos y banderas.
//   { "tipo": "ganar_objeto", "objeto": "mano_de_mono" }
//   { "tipo": "perder_objeto", "objeto": "idolo_dorado" }
//   { "tipo": "poner_condicion", "condicion": "tormenta", "turnos": 2 }   (turnos opcional: sin él, dura hasta que algo la quite)
//   { "tipo": "poner_condicion", "condicion": "amuleto_maldito", "partes": ["fuerza_letal", "hambre_insaciable"] }
//                                                                          (partes: las condiciones que lleva DENTRO; se van con ella)
//   { "tipo": "quitar_condicion", "condicion": "escorbuto" }              (una condición concreta)
//   { "tipo": "quitar_condicion", "categoria": "maldicion" }              (una de esa categoría, la que sea)
//   { "tipo": "perder_turnos", "cantidad": 1 }                            (fases de acción perdidas)
//   { "tipo": "bandera", "bandera": "emporio_bob_derrotado" }              (un hecho general que el juego recuerda)
//   { "tipo": "ganar_seguidor", "seguidor": "nativo" }                     (se une un seguidor de ese tipo del catálogo)
//   { "tipo": "ganar_seguidor", "seguidor": "bruja_vudu", "inseparable": true }   (uno que nunca se marchará por su cuenta)
// Aquí solo se describen; quien los aplica al estado es aplicarEfectos.
export const OTROS_EFECTOS = [
  'ganar_objeto',
  'perder_objeto',
  'poner_condicion',
  'quitar_condicion',
  'perder_turnos',
  'bandera',
  'ganar_seguidor',
] as const;

// En el JSON la cantidad es un número fijo (8, -1) o una expresión de dados
// ("2d6", "1d6x10", "1d6+1", "-1d6"). El signo menos delante = se pierde.
export type CantidadDefinicion = number | string;

// Efectos INTERNOS: los usa el propio juego cuando el jugador hace algo con su inventario.
// NO se escriben en el JSON (el revisor los rechaza). "posicion" = el lugar del objeto en el
// inventario (0 = el primero) en el momento de aplicar el efecto.
//   gastar_uso:   gasta un uso de ese objeto; a 0 usos se tira solo (core/objetos/usar-objeto.ts).
//   tirar_objeto: el jugador tira ese objeto (core/objetos/tirar-objeto.ts).
//   vender_objeto: el jugador lo vende en el mercado: sale del inventario (el oro va en otro efecto).
//   herir_seguidor: el combate le quita "cantidad" de resistencia a un seguidor concreto (su id en la partida).
export const EFECTOS_INTERNOS = ['gastar_uso', 'tirar_objeto', 'vender_objeto', 'herir_seguidor'] as const;

// Efectos que son iguales en el JSON y ya resueltos (no llevan dados).
type EfectoSinDados =
  | { tipo: FinDePartida }
  // tirar NO se escribe en el JSON: lo añade el juego cuando el objeto no cabe y el jugador elige
  // qué tira para hacerle sitio (posiciones en el inventario; pueden ser varias: el ídolo ocupa 4).
  | { tipo: 'ganar_objeto'; objeto: string; tirar?: number[] }
  | { tipo: 'perder_objeto'; objeto: string }
  | { tipo: 'quitar_condicion'; condicion: string }
  | { tipo: 'quitar_condicion'; categoria: CategoriaCondicion }
  | { tipo: 'bandera'; bandera: string }
  // seguidor = id del TIPO en el catálogo ("forzudo"). El nombre propio se le pone al unirse.
  // despedir NO se escribe en el JSON: lo añade el juego cuando el grupo está lleno y el jugador
  // elige a quién despide para hacer sitio (es el id del seguidor en la partida, p. ej. "forzudo_1").
  // nombre TAMPOCO se escribe en el JSON: es el nombre propio ya elegido al buscar seguidor en un puerto.
  | { tipo: 'ganar_seguidor'; seguidor: string; inseparable?: boolean; despedir?: string; nombre?: string };

// Efecto tal como se escribe en el JSON.
export type EfectoDefinicion =
  | EfectoSinDados
  | { tipo: TipoRecurso; operacion: 'mitad' | 'maximo' | 'todo'; destino?: Destino; siNoHay?: EfectoDefinicion[] }
  | { tipo: TipoRecurso; operacion?: 'sumar' | 'fijar'; cantidad: CantidadDefinicion; destino?: Destino; siNoHay?: EfectoDefinicion[] }
  | { tipo: 'poner_condicion'; condicion: string; turnos?: CantidadDefinicion; partes?: string[] }
  | { tipo: 'perder_turnos'; cantidad: CantidadDefinicion };

// Efecto ya resuelto por resolverTabla: igual que en el JSON, pero las cantidades y los turnos
// son siempre números concretos (en los recursos: positivo = ganar, negativo = perder).
// Incluye los efectos internos, que solo crea el juego.
export type Efecto =
  | EfectoSinDados
  | { tipo: 'gastar_uso'; posicion: number }
  | { tipo: 'tirar_objeto'; posicion: number }
  | { tipo: 'vender_objeto'; posicion: number }
  | { tipo: 'herir_seguidor'; seguidor: string; cantidad: number }
  | { tipo: TipoRecurso; operacion: 'mitad' | 'maximo' | 'todo'; destino?: Destino; siNoHay?: Efecto[] }
  | { tipo: TipoRecurso; operacion?: 'sumar' | 'fijar'; cantidad: number; destino?: Destino; siNoHay?: Efecto[] }
  | { tipo: 'poner_condicion'; condicion: string; turnos?: number; partes?: string[] }
  | { tipo: 'perder_turnos'; cantidad: number };
