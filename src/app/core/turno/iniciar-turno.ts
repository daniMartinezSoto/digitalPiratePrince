import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Condicion } from '../catalogos/condicion';
import type { Objeto } from '../catalogos/objeto';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import { calcularModificador } from '../modificadores/calcular-modificador';
import { IDS_TIRADA, type IdTirada } from '../modificadores/id-tirada';
import type { Efecto } from '../tablas/efecto';
import { TABLAS } from '../tablas/rangos/cargar-tablas';
import { resolverEfecto, resolverTabla } from '../tablas/rangos/resolver-tabla';
import type { Tabla } from '../tablas/rangos/tabla';
import { hayCombate } from '../combate/hay-combate';
import { hayEventoEnCurso } from '../eventos/una-vez';

/** Catálogos en los que buscar las fichas. Por defecto, los del juego; los tests pueden pasar otros. */
export interface CatalogosTurno {
  objetos: readonly Objeto[];
  condiciones: readonly Condicion[];
  tablas: readonly Tabla[];
}

const CATALOGOS_DEL_JUEGO: CatalogosTurno = { objetos: OBJETOS, condiciones: CONDICIONES, tablas: TABLAS };

/** La tirada diaria de una condición, para enseñársela al jugador. */
export interface TiradaDeCondicion {
  tabla: string;       // id de la tabla
  dados: number[];     // dados sacados
  modificador: number; // bonificador aplicado
  total: number;       // dados + modificador
  texto?: string;      // texto de la fila ("La tormenta amaina.")
}

/** Lo que ha hecho UNA condición esta mañana. */
export interface ParteDeCondicion {
  condicion: string;          // id de la condición
  tirada?: TiradaDeCondicion; // si ha tirado en su tabla
  cambios: Cambio[];          // cambios reales en el estado (el chivato de aplicarEfectos)
}

/** Lo que devuelve iniciarTurno. Son datos, no mensajes: la interfaz decide cómo contarlo. */
export interface ResultadoInicioTurno {
  estado: Estado;
  parte: ParteDeCondicion[]; // una entrada por cada condición que ha hecho algo, en orden
  eventos: string[];         // ids de los eventos a los que mandan las tiradas (los resolverá el motor de eventos)
  accionPerdida: boolean;    // true = hoy no hay fase de acción (se pasa directo a la comida)
}

/**
 * AMANECE: empieza el turno. Solo se puede llamar con la partida en la fase "inicio".
 *
 * 1. Cada condición activa hace lo suyo, de la más antigua a la más nueva:
 *      a) sus efectos fijos de cadaTurno (el mal está a bordo: -1 de tripulación),
 *      b) su tirada diaria (la tormenta: ¿amaina?),
 *      c) si tiene los turnos contados, se le resta uno; al llegar a 0 se quita.
 *    Una condición que ya no está (se la llevó otra antes) no hace nada.
 *    Si la partida termina a mitad (vida o tripulación a 0), se para ahí.
 * 2. Si hay fases de acción perdidas, se gasta una y el día pasa directo a la comida.
 *    Si no, pasa a la fase de acción.
 *
 * NO toca el estado que recibe: devuelve uno nuevo.
 * Orden en que se gastan los dados (no cambiarlo: afecta a las partidas guardadas):
 * condición a condición; en cada una, primero sus efectos fijos y luego su tabla.
 */
export function iniciarTurno(
  estado: Estado,
  dados: Dados,
  catalogos: CatalogosTurno = CATALOGOS_DEL_JUEGO,
): ResultadoInicioTurno {
  if (estado.mundo.finPartida) {
    throw new Error('iniciarTurno: la partida ya ha terminado');
  }
  if (hayCombate(estado)) {
    throw new Error('iniciarTurno: hay un combate en curso; primero hay que terminarlo');
  }
  if (hayEventoEnCurso(estado)) {
    throw new Error('iniciarTurno: hay un evento en curso; primero hay que terminarlo');
  }
  if (estado.mundo.fase !== 'inicio') {
    throw new Error(`iniciarTurno: solo se puede empezar el turno en la fase "inicio" (la partida está en "${estado.mundo.fase}")`);
  }

  let actual = estado;
  const parte: ParteDeCondicion[] = [];
  const eventos: string[] = [];

  // Foto de las condiciones que hay AL AMANECER: las que aparezcan durante la mañana
  // (las pistas sobre la criatura) empiezan a contar mañana.
  const idsAlAmanecer = estado.jugador.condiciones.map(c => c.id);

  for (const id of idsAlAmanecer) {
    if (actual.mundo.finPartida) {
      break;
    }
    if (!actual.jugador.condiciones.some(c => c.id === id)) {
      continue; // otra condición se la ha llevado esta misma mañana
    }

    const ficha = buscarCondicion(catalogos, id);
    const entrada: ParteDeCondicion = { condicion: id, cambios: [] };

    // a) Efectos fijos de cada turno.
    if (ficha.cadaTurno?.efectos) {
      const efectos = ficha.cadaTurno.efectos.map(definicion => resolverEfecto(definicion, dados));
      actual = aplicar(actual, efectos, dados, catalogos, entrada);
    }

    // b) Tirada diaria en su tabla.
    if (ficha.cadaTurno?.tabla !== undefined && !actual.mundo.finPartida) {
      const tabla = buscarTabla(catalogos, ficha.cadaTurno.tabla);
      const modificador = modificadorDeTabla(actual, tabla.id, catalogos);
      const resultado = resolverTabla(tabla, modificador, dados);

      entrada.tirada = { tabla: tabla.id, dados: resultado.dados, modificador, total: resultado.total };
      if (resultado.texto !== undefined) {
        entrada.tirada.texto = resultado.texto;
      }

      actual = aplicar(actual, resultado.efectos, dados, catalogos, entrada);
      if (resultado.evento !== undefined && !actual.mundo.finPartida) {
        eventos.push(resultado.evento);
      }
    }

    // c) Turnos contados: un día menos.
    if (!actual.mundo.finPartida) {
      actual = restarUnTurno(actual, id, dados, catalogos, entrada);
    }

    // Solo sale en el parte si ha hecho algo.
    if (entrada.tirada !== undefined || entrada.cambios.length > 0) {
      parte.push(entrada);
    }
  }

  // 2. ¿Hay fase de acción hoy? (Si la partida ha terminado, la fase se queda como está.)
  let accionPerdida = false;
  if (!actual.mundo.finPartida) {
    accionPerdida = actual.jugador.fasesAccionPerdidas > 0;
    actual = {
      ...actual,
      jugador: {
        ...actual.jugador,
        fasesAccionPerdidas: accionPerdida ? actual.jugador.fasesAccionPerdidas - 1 : 0,
      },
      mundo: { ...actual.mundo, fase: accionPerdida ? 'comida' : 'accion' },
    };
  }

  // Apuntar por dónde van los dados, para que una partida guardada continúe la misma secuencia.
  actual = { ...actual, mundo: { ...actual.mundo, estadoDados: dados.obtenerEstado() } };

  return { estado: actual, parte, eventos, accionPerdida };
}

/** Aplica efectos con aplicarEfectos y apunta los cambios en el parte de esa condición. */
function aplicar(estado: Estado, efectos: readonly Efecto[], dados: Dados, catalogos: CatalogosTurno, entrada: ParteDeCondicion): Estado {
  const resultado = aplicarEfectos(estado, efectos, dados, catalogos);
  entrada.cambios.push(...resultado.cambios);
  return resultado.estado;
}

/**
 * Si la condición sigue activa y tiene los turnos contados, le resta uno.
 * Al llegar a 0 se quita (con el mismo efecto "quitar_condicion" de siempre, para que quede en el parte).
 */
function restarUnTurno(estado: Estado, id: string, dados: Dados, catalogos: CatalogosTurno, entrada: ParteDeCondicion): Estado {
  const activa = estado.jugador.condiciones.find(c => c.id === id);
  if (!activa || activa.turnosRestantes === undefined) {
    return estado; // ya no está, o dura hasta que algo la quite
  }

  const quedan = activa.turnosRestantes - 1;
  if (quedan <= 0) {
    return aplicar(estado, [{ tipo: 'quitar_condicion', condicion: id }], dados, catalogos, entrada);
  }

  return {
    ...estado,
    jugador: {
      ...estado.jugador,
      condiciones: estado.jugador.condiciones.map(c => (c.id === id ? { ...c, turnosRestantes: quedan } : c)),
    },
  };
}

/**
 * Bonificador de la tirada diaria. Si la tabla tiene un id de tirada con su mismo nombre
 * ("el_mal"), se suman los bonificadores del jugador (las pistas sobre la criatura: +1).
 * Si no (la tormenta), se tira sin bonificador.
 */
function modificadorDeTabla(estado: Estado, idTabla: string, catalogos: CatalogosTurno): number {
  const tiradas: readonly string[] = IDS_TIRADA;
  return tiradas.includes(idTabla) ? calcularModificador(estado.jugador, idTabla as IdTirada, catalogos) : 0;
}

function buscarCondicion(catalogos: CatalogosTurno, id: string): Condicion {
  const ficha = catalogos.condiciones.find(c => c.id === id);
  if (!ficha) {
    throw new Error(`iniciarTurno: el jugador tiene la condición "${id}", que no está en el catálogo`);
  }
  return ficha;
}

function buscarTabla(catalogos: CatalogosTurno, id: string): Tabla {
  const tabla = catalogos.tablas.find(t => t.id === id);
  if (!tabla) {
    throw new Error(`iniciarTurno: no existe la tabla "${id}"`);
  }
  return tabla;
}
