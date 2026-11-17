import type { Fase } from './fase';
import type { FinPartida } from './fin-partida';

// Una visita al mercado en curso (acción "Ir al mercado"). Mientras dura, el jugador puede
// comprar y vender cosas de una en una; al salir, se borra y termina la acción del día.
export interface VisitaMercado {
  // Lo que hay hoy en el rastrillo: se saca al entrar y no cambia durante la visita.
  // null = ya lo ha comprado (o el rastrillo está vacío).
  rastrillo: { objeto: string; precio: number } | null;
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
  marcas: {
    col: number;
    fila: number;
    evento: string;
  }[];

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

  // La visita al mercado en curso. null si no está en el mercado.
  // Va en el estado para que, si se guarda a mitad de la visita, siga dentro con el mismo rastrillo.
  mercado: VisitaMercado | null;
}
