import type { Modificadores } from '../modificadores/id-tirada';
import type { EfectoDefinicion } from '../tablas/efecto';

// Categorías de condición. Las reglas hablan muchas veces de la categoría, no de una
// condición concreta: "el monasterio quita UNA MALDICIÓN", "la biblia te libra de una maldición".
export const CATEGORIAS_CONDICION = ['maldicion', 'bendicion', 'enfermedad', 'clima', 'otra'] as const;
export type CategoriaCondicion = (typeof CATEGORIAS_CONDICION)[number];

// Cosas que una condición puede IMPEDIR mientras dura. Lista cerrada: así no se puede
// escribir en el JSON una prohibición que el juego no entienda ("viajarr").
//   viajar:              la tormenta no te deja moverte.
//   enterrar_tesoro:     "avaricioso" (amuleto maldito).
//   nuevos_seguidores:   "hedor nauseabundo" (amuleto maldito).
// Cada una se hará cumplir cuando exista su acción (viajar: Sprint 9; seguidores y enterrar tesoro: Sprint 6).
// Las audiencias no se prohíben nunca (decidido por el autor: son llamativas y ya están limitadas).
export const PROHIBICIONES = ['viajar', 'enterrar_tesoro', 'nuevos_seguidores'] as const;
export type Prohibicion = (typeof PROHIBICIONES)[number];

// Reglas con número que una condición CAMBIA mientras dura. Se suman a la regla normal:
//   famaObjetivo: 2      -> necesitas 2 puntos de fama más para ganar ("ambición desmedida").
//   comidaPorDia: 1      -> gastas 1 reserva más al día ("hambre insaciable").
//   fuerza: 1            -> +1 de fuerza ("fuerza letal").
//   ingenio: 2           -> +2 de ingenio ("súper cerebro").
//   vidaMax: 4           -> +4 de vida máxima ("gran fortaleza").
//   maximoSeguidores: 1  -> puedes llevar 1 seguidor más ("carisma").
//   reduccionDano: 1     -> en combate, cada golpe que te aciertan te hace 1 menos, pero
//                           siempre al menos 1 ("piel de piedra"; Sprint 7).
// No se guardan en el personaje: se calculan mirando las condiciones activas (fuerzaActual,
// vidaMaxActual... en condiciones/consultas.ts), así que al quitarse la condición la regla
// vuelve sola a su valor. La hoja del personaje guarda solo SU valor, sin las condiciones.
export const AJUSTES_DE_CONDICION = ['famaObjetivo', 'comidaPorDia', 'fuerza', 'ingenio', 'vidaMax', 'maximoSeguidores', 'reduccionDano'] as const;
export type AjusteDeCondicion = (typeof AJUSTES_DE_CONDICION)[number];
export type AjustesDeCondicion = Partial<Record<AjusteDeCondicion, number>>;

// Tipos de lugar a los que se puede "llegar" para que una condición termine (ver alLlegar).
//   tierra:    cualquier casilla de tierra (el escorbuto se cura al tocar tierra).
//   puerto, aldea, naufragio: una casilla con ese rasgo (la carta de la hija del gobernador, en un puerto).
export const LUGARES_DE_LLEGADA = ['tierra', 'puerto', 'aldea', 'naufragio'] as const;
export type LugarDeLlegada = (typeof LUGARES_DE_LLEGADA)[number];

// Lo que hace una condición al EMPEZAR CADA TURNO, mientras dura. Puede llevar las dos cosas:
//   efectos: pasan siempre (el mal está a bordo: -1 de tripulación).
//   tabla:   después se tira en esa tabla (data/tablas/). Una fila puede acabar con la condición
//            con el efecto "quitar_condicion" (la tormenta amaina).
export interface CadaTurno {
  efectos?: EfectoDefinicion[];
  tabla?: string;
}

// Lo que pasa AL LLEGAR a un tipo de lugar: la condición SE QUITA siempre y, además, puede
// dar unos efectos (+100 de oro al vender los esclavos) o lanzar un evento (la audiencia con la hija).
export interface AlLlegar {
  lugar: LugarDeLlegada;
  efectos?: EfectoDefinicion[];
  evento?: string;
}

// Ficha de catálogo de una condición (data/condiciones.json): algo que DURA y afecta al jugador
// (maldiciones, escorbuto, tormenta...). Lo que pasa una sola vez ("tu oro se convierte en ceniza")
// no es una condición: es un efecto normal.
// La partida solo guarda una CondicionActiva (el id y los turnos que le quedan).
// La ficha solo DESCRIBE: quien ejecuta cadaTurno y alLlegar es el ciclo de turno (Sprint 5).
export interface Condicion {
  // Identificador único, p. ej. "escorbuto".
  id: string;

  nombre: string;
  descripcion: string;

  // Ruta del dibujo. Opcional.
  imagen?: string;

  categoria: CategoriaCondicion;

  // Bonificadores a tiradas mientras dura, igual que objetos y sobrenombres.
  modificadores?: Modificadores;

  // Lo que no se puede hacer mientras dura, p. ej. ["viajar"]. Sin ponerlo = no impide nada.
  prohibe?: Prohibicion[];

  // Reglas que cambian mientras dura, p. ej. { "famaObjetivo": 2 }. Sin ponerlo = no cambia ninguna.
  ajustes?: AjustesDeCondicion;

  // Qué pasa al empezar cada turno mientras dura. Sin ponerlo = nada.
  cadaTurno?: CadaTurno;

  // Al llegar a ese tipo de lugar, la condición se quita (y puede pasar algo más). Sin ponerlo = no depende del lugar.
  alLlegar?: AlLlegar;
}
