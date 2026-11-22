import type { Coordenada, RasgoDelMapa } from '../mapa/mapa';
import type { CombateEnCurso } from './combate';
import type { CombateNavalEnCurso } from './combate-naval';
import type { Fase } from './fase';
import type { FinPartida } from './fin-partida';
import type { MarcoEvento } from './pila-eventos';

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
  // Su nombre propio, sorteado al salir (se enseña antes de contratarlo). Opcional solo por las
  // partidas guardadas antes de existir: si falta, se sortea al contratarlo.
  nombre?: string;
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
//   Del mapa (Sprint 9, paso 4; las pondrán los eventos del Sprint 10):
//   rasgo_cambiado:      la casilla tiene otro rasgo PARA EL RESTO DE LA PARTIDA (decidido por el autor el
//                        20-nov): un evento crea una aldea o un puerto (E004, E055), unas ruinas son una ciudad
//                        pirata, una guarida estaba abandonada ("ninguno": queda solo su terreno)... Lleva
//                        "rasgo". Si hay varias en la misma casilla, manda la última.
//   guarida_neutral:     la guarida de esta casilla es neutral (lo decidió E038 al entrar): funciona como un
//                        puerto pirata (lugar "guarida").
//   casilla_bloqueada:   no se puede entrar (camino bloqueado de E047, guarida hostil...). En el mapa, una roca.
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
  'rasgo_cambiado',
  'guarida_neutral',
  'casilla_bloqueada',
] as const;
export type TipoDeMarca = (typeof TIPOS_DE_MARCA)[number];

export interface Marca {
  col: number;
  fila: number;
  tipo: TipoDeMarca;
  evento?: string; // solo en las marcas de tipo "evento"
  dia?: number; // solo en las que caducan: el día en que se puso (audiencia_aplazada)
  rasgo?: RasgoDelMapa | 'ninguno'; // solo en las de tipo "rasgo_cambiado": el rasgo nuevo de la casilla
}

export interface Mundo {
  // Identificador del mapa de la partida (data/mapas/<id>.json). Desde el Sprint 9 siempre tiene uno.
  mapaId: string;

  // Dónde está el jugador (col = columna, fila = fila del hexágono). Al empezar, la casilla de inicio.
  posicion: Coordenada;

  // Dónde está el barco (Sprint 9). Si el jugador está en la misma casilla, va a bordo; si no, a pie
  // (consulta vasABordo en core/mapa/donde-estas.ts). Al empezar, en el agua junto a La Habana.
  posicionBarco: Coordenada;

  // Día en que se desembarcó o embarcó por última vez (Sprint 9, paso 6): solo se puede una vez por
  // turno. Sin poner = nunca. Es opcional a propósito: las partidas guardadas antes no lo tienen.
  diaDeEmbarque?: number;

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

  // Pila de eventos (Sprint 10): los eventos en marcha, cada uno con el paso en el que va y lo que
  // espera. El de arriba es el que se juega. Vacía = no hay ningún evento. Ver estado/pila-eventos.ts.
  pilaEventos: MarcoEvento[];

  // IDs de los puertos importantes que el jugador ya ha visitado.
  // Se utilizarán para comprobar una de las condiciones de victoria.
  puertosVisitados: string[];

  // Semilla con la que empezó la partida (Sprint 8). No cambia nunca: es la "identidad" de la
  // partida. El jugador podrá verla (durante la partida y en la crónica) para repetirla o retar
  // a otro con la misma. No confundir con estadoDados, que avanza con cada tirada.
  semilla: number;

  // Estado interno del generador de números aleatorios.
  // Se obtiene mediante Dados.obtenerEstado() y permite continuar
  // la misma secuencia de tiradas al cargar una partida.
  estadoDados: number;

  // Si la partida ha terminado, cómo y por qué. null mientras se sigue jugando.
  finPartida: FinPartida | null;

  // La acción a medias (ver AccionEnCurso arriba). null si no hay ninguna.
  accionEnCurso: AccionEnCurso | null;

  // El combate que se está jugando (core/estado/combate.ts, Sprint 7). null si no hay ninguno.
  // Mientras hay uno, no se puede hacer nada más (ni acciones, ni comer, ni dormir, ni usar objetos).
  combate: CombateEnCurso | null;

  // El combate naval que se está jugando (core/estado/combate-naval.ts, Sprint 7). null si no hay ninguno.
  // Bloquea lo mismo que el combate normal. Durante el abordaje existen los dos a la vez.
  combateNaval: CombateNavalEnCurso | null;

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
