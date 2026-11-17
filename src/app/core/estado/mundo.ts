import type { Fase } from './fase';
import type { FinPartida } from './fin-partida';

// ACCIONES A MEDIAS. Algunas acciones tienen varios pasos: primero se tira o se entra, y después
// el jugador decide (ir al mercado, contratar marineros, buscar un seguidor). Lo que salió se guarda
// aquí para que no se pueda volver a tirar hasta que guste, y para que un guardado a mitad lo conserve.
// Mientras hay una acción a medias, no se puede hacer otra acción ni usar objetos: hay que terminarla.

// Visita al mercado. rastrillo: lo que hay hoy (se saca al entrar y no cambia durante la visita);
// null = ya lo ha comprado (o el rastrillo está vacío).
export interface VisitaMercado {
  tipo: 'mercado';
  rastrillo: { objeto: string; precio: number } | null;
}

// Contratar marineros: cuántos hay disponibles hoy (falta decir cuántos se contratan).
export interface MarinerosDisponibles {
  tipo: 'marineros';
  disponibles: number;
}

// Buscar un seguidor: el que ha salido en la tabla, esperando a que el jugador lo contrate o no.
// seguidor = id del TIPO en el catálogo ("forzudo"); precio = lo que pide.
export interface SeguidorEnEspera {
  tipo: 'seguidor';
  seguidor: string;
  precio: number;
}

export type AccionEnCurso = VisitaMercado | MarinerosDisponibles | SeguidorEnEspera;

// MARCAS: cosas que quedan en una casilla concreta del mapa.
//   evento:           al entrar en esa casilla salta ese evento (un tesoro señalado en un mapa...). Lleva "evento".
//   tesoro_enterrado: el jugador enterró aquí un tesoro (no se puede enterrar otro ni desenterrarlo).
// Irán llegando más tipos (casillas bloqueadas, aldeas ofendidas...).
export const TIPOS_DE_MARCA = ['evento', 'tesoro_enterrado'] as const;
export type TipoDeMarca = (typeof TIPOS_DE_MARCA)[number];

export interface Marca {
  col: number;
  fila: number;
  tipo: TipoDeMarca;
  evento?: string; // solo en las marcas de tipo "evento"
}

export interface Mundo {
  // Identificador del mapa en el que se encuentra el jugador.
  // Es null mientras todavía no se haya asignado ningún mapa.
  mapaId: string | null;

  // Posición actual del jugador en el mapa hexagonal.
  // col = columna y fila = fila del hexágono.
  // Es null si todavía no se ha establecido una posición.
  posicion: {
    col: number;
    fila: number;
  } | null;

  // Día actual de la aventura.
  dia: number;

  // Momento del día en el que está la partida (ver fase.ts).
  // Sirve para que, al cargar una partida guardada a mitad de turno,
  // el juego sepa qué toca: no se puede repetir la acción ni saltarse la comida.
  fase: Fase;

  // Banderas: recuerdan acontecimientos o condiciones de la aventura.
  // Por ejemplo, si se ha visitado un puerto importante.
  // Pueden almacenar valores booleanos, números o textos.
  banderas: Record<string, boolean | number | string>;

  // Marcas: recuerdan elementos situados en posiciones concretas del mapa.
  // Por ejemplo, un tesoro que se encuentra en un hexágono.
  marcas: Marca[];

  // Pila de eventos: guarda los eventos que están pendientes de continuar
  // y el paso concreto en el que se encuentra cada uno.
  // Nos permitirá retomar eventos que tengan varias partes.
  pilaEventos: {
    evento: string;
    paso: string;
  }[];

  // IDs de los puertos importantes que el jugador ya ha visitado.
  // Se utilizarán para comprobar una de las condiciones de victoria.
  puertosVisitados: string[];

  // Estado interno del generador de números aleatorios.
  // Se obtiene mediante Dados.obtenerEstado() y permite continuar
  // la misma secuencia de tiradas al cargar una partida.
  estadoDados: number;

  // Si la partida ha terminado, cómo y por qué. null mientras se sigue jugando.
  finPartida: FinPartida | null;

  // La acción a medias (ver AccionEnCurso arriba). null si no hay ninguna.
  accionEnCurso: AccionEnCurso | null;

  // true = el grupo tiene ya pagada la noche en el monasterio: lo apunta la acción "Descansar en el
  // monasterio" (su precio incluye dormir allí esa noche, todo el grupo). Vuelve a false al acabar el día.
  nochePagada: boolean;
}
