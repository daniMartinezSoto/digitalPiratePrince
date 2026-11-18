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

// Sentado a la mesa de dados en una guarida: puede apostar tantas veces como quiera hasta levantarse.
export interface MesaDeDados {
  tipo: 'dados';
}

export type AccionEnCurso = VisitaMercado | MarinerosDisponibles | SeguidorEnEspera | MesaDeDados;

// MARCAS: cosas que quedan en una casilla concreta del mapa.
//   evento:           al entrar en esa casilla salta ese evento (un tesoro señalado en un mapa...). Lleva "evento".
//   tesoro_enterrado: el jugador enterró aquí un tesoro (no se puede enterrar otro ni desenterrarlo).
//   amigos:           "haces amigos" al buscar información: +1 la próxima vez que busques información
//                     (o des un discurso) aquí. Se quita al usarla.
//   cubil_saqueado:   ya saqueó el cubil de contrabandistas de aquí: si vuelve a salir, está vacío.
//   audiencia_concedida: aquí ya le concedieron audiencia (una por sitio y partida).
//   audiencia_vetada:    aquí ofendió (o le reconoció un guardia): no puede volver a pedir audiencia.
//   audiencia_aplazada:  aquí le dijeron "hoy no": +1 si la pide al día siguiente (lleva "dia").
//   campeon_vencido:     en esta guarida ya venció al campeón de pulsos: no vuelve a salir.
//   naufragio_investigado, ruinas_registradas: ya se exploraron (solo se puede una vez).
//   echado_de_la_aldea:  falló al convencer a los nativos para dormir allí: le echaron y no puede
//                        volver a intentarlo (bloquear la casilla y mandarle a un vecino, con el mapa).
// Irán llegando más tipos (casillas bloqueadas, aldeas ofendidas...).
export const TIPOS_DE_MARCA = [
  'evento',
  'tesoro_enterrado',
  'amigos',
  'cubil_saqueado',
  'audiencia_concedida',
  'audiencia_vetada',
  'audiencia_aplazada',
  'campeon_vencido',
  'naufragio_investigado',
  'ruinas_registradas',
  'echado_de_la_aldea',
] as const;
export type TipoDeMarca = (typeof TIPOS_DE_MARCA)[number];

export interface Marca {
  col: number;
  fila: number;
  tipo: TipoDeMarca;
  evento?: string; // solo en las marcas de tipo "evento"
  dia?: number; // solo en las que caducan: el día en que se puso (audiencia_aplazada)
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

  // true = el grupo tiene ya pagada la noche donde está (monasterio o aldea): lo apuntan la acción
  // "Descansar en el monasterio" (su precio incluye dormir allí) y la fiesta de bienvenida de una aldea.
  // Esa noche solo hay una opción: dormir allí todos, gratis. Vuelve a false al acabar el día.
  nochePagada: boolean;

  // true = hoy come gratis (la fiesta de bienvenida de una aldea): en la fase de comida no gasta
  // reservas ni oro. Vuelve a false al acabar el día.
  comidaGratis: boolean;

  // Día en que buscó información por última vez (null = nunca). Tras buscar, hay que esperar
  // AJUSTES.diasEntreBusquedas días para volver a hacerlo, en cualquier sitio.
  ultimaBusquedaInformacion: number | null;
}
