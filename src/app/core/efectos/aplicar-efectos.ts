import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Condicion } from '../catalogos/condicion';
import type { Objeto } from '../catalogos/objeto';
import type { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { CARACTERISTICAS, type Efecto, type TipoRecurso } from '../tablas/efecto';
import type { Cambio } from './cambio';

/** Catálogos en los que buscar las fichas. Por defecto, los del juego; los tests pueden pasar otros. */
export interface CatalogosEfectos {
  objetos: readonly Objeto[];
  condiciones: readonly Condicion[];
}

const CATALOGOS_DEL_JUEGO: CatalogosEfectos = { objetos: OBJETOS, condiciones: CONDICIONES };

/** Lo que devuelve aplicarEfectos: el estado nuevo y la lista de cambios reales (el "chivato"). */
export interface ResultadoEfectos {
  estado: Estado;
  cambios: Cambio[];
}

/**
 * Apunta los efectos en la hoja del personaje. Es el ÚNICO sitio que modifica el estado.
 *
 * NO toca el estado que recibe: hace una copia, cambia la copia y la devuelve.
 * Aplica los efectos en orden, uno detrás de otro, respetando las reglas:
 *   - Topes: vida ≤ vida máxima, tripulación ≤ tripulación máxima, comida ≤ AJUSTES.comidaMaxima.
 *   - Ningún recurso baja de 0; las características (fuerza, ingenio, vidaMax) nunca bajan de 1.
 *   - Objetos: solo entran si caben; los mágicos dan +1 de fama.
 *   - Condiciones, turnos perdidos y banderas.
 *   - "Un seguidor al azar" sin seguidores: no pasa nada, salvo que el efecto traiga "siNoHay".
 *   - El contable: cada vez que gana oro, gana 2d6 más.
 *   - Fin de partida: vida o tripulación a 0 (derrota), o un efecto ganar_partida / perder_partida.
 *     Cuando la partida termina, los efectos que quedan ya no se aplican.
 * Devuelve también la lista de cambios reales, para avisar al jugador.
 * Los dados se usan para "un seguidor al azar" y para el contable.
 */
export function aplicarEfectos(
  estado: Estado,
  efectos: readonly Efecto[],
  dados: Dados,
  catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO,
): ResultadoEfectos {
  const nuevo = structuredClone(estado);
  const cambios: Cambio[] = [];

  for (const efecto of efectos) {
    if (nuevo.mundo.finPartida) {
      break; // la partida ya ha terminado
    }
    aplicarUno(nuevo, efecto, dados, catalogos, cambios);
    comprobarDerrota(nuevo, cambios);
  }

  return { estado: nuevo, cambios };
}

/** Si la vida o la tripulación han llegado a 0, la partida termina con derrota. */
function comprobarDerrota(estado: Estado, cambios: Cambio[]): void {
  if (estado.mundo.finPartida) {
    return;
  }
  if (estado.jugador.vida <= 0) {
    terminarPartida(estado, { resultado: 'derrota', motivo: 'vida' }, cambios);
  } else if (estado.jugador.tripulacion <= 0) {
    terminarPartida(estado, { resultado: 'derrota', motivo: 'tripulacion' }, cambios);
  }
}

function terminarPartida(estado: Estado, fin: { resultado: 'victoria' | 'derrota'; motivo: 'vida' | 'tripulacion' | 'evento' }, cambios: Cambio[]): void {
  estado.mundo.finPartida = fin;
  cambios.push({ tipo: 'fin_partida', fin });
}

/** Aplica un efecto sobre la copia (aquí sí se modifica: es nuestra copia). */
function aplicarUno(estado: Estado, efecto: Efecto, dados: Dados, catalogos: CatalogosEfectos, cambios: Cambio[]): void {
  const jugador = estado.jugador;

  switch (efecto.tipo) {
    case 'ganar_objeto':
      ganarObjeto(jugador, efecto.objeto, catalogos.objetos, cambios);
      return;
    case 'perder_objeto':
      perderObjeto(jugador, efecto.objeto, cambios);
      return;
    case 'poner_condicion':
      ponerCondicion(jugador, efecto.condicion, efecto.turnos, catalogos.condiciones, cambios);
      return;
    case 'quitar_condicion':
      if ('condicion' in efecto) {
        quitarCondicion(jugador, jugador.condiciones.findIndex(c => c.id === efecto.condicion), cambios);
      } else {
        quitarUnaDeCategoria(jugador, efecto.categoria, catalogos.condiciones, cambios);
      }
      return;
    case 'perder_turnos':
      jugador.fasesAccionPerdidas += efecto.cantidad;
      cambios.push({ tipo: 'turnos_perdidos', cantidad: efecto.cantidad });
      return;
    case 'bandera':
      estado.mundo.banderas[efecto.bandera] = true;
      cambios.push({ tipo: 'bandera', bandera: efecto.bandera });
      return;
    case 'ganar_partida':
      terminarPartida(estado, { resultado: 'victoria', motivo: 'evento' }, cambios);
      return;
    case 'perder_partida':
      terminarPartida(estado, { resultado: 'derrota', motivo: 'evento' }, cambios);
      return;
    default:
      aplicarARecurso(estado, efecto, dados, catalogos, cambios);
  }
}

// ---------------------------------------------------------------------------
// Recursos y características
// ---------------------------------------------------------------------------

type EfectoDeRecurso = Extract<Efecto, { tipo: TipoRecurso }>;

function aplicarARecurso(estado: Estado, efecto: EfectoDeRecurso, dados: Dados, catalogos: CatalogosEfectos, cambios: Cambio[]): void {
  const destino = efecto.destino ?? 'jugador';
  const jugador = estado.jugador;

  if (destino === 'jugador') {
    cambiarRecursoDelJugador(jugador, efecto, cambios);
    aplicarContable(jugador, efecto, dados, cambios);
    return;
  }

  // A partir de aquí, el efecto es sobre la vida y afecta a seguidores (lo garantiza el revisor de tablas).
  if (destino === 'todos') {
    cambiarRecursoDelJugador(jugador, efecto, cambios);
    for (const seguidor of jugador.seguidores) {
      cambiarResistencia(seguidor, efecto, cambios);
    }
  } else if (destino === 'seguidor_azar') {
    if (jugador.seguidores.length > 0) {
      const elegido = jugador.seguidores[dados.entero(0, jugador.seguidores.length - 1)];
      cambiarResistencia(elegido, efecto, cambios);
    } else {
      // No hay a quién afectar: si el efecto trae "siNoHay", pasan esos efectos en su lugar.
      aplicarReemplazo(estado, efecto.siNoHay ?? [], dados, catalogos, cambios);
    }
  } else {
    // seguidor_elegido: el jugador tiene que elegir, y eso lo pregunta el motor de eventos (Sprint 10).
    throw new Error('aplicarEfectos: "seguidor_elegido" todavía no está disponible (llegará con el motor de eventos)');
  }

  // Los seguidores que se quedan sin resistencia mueren y salen del grupo.
  for (const muerto of jugador.seguidores.filter(s => s.resistencia <= 0)) {
    cambios.push({ tipo: 'seguidor_muerto', seguidor: muerto.id });
  }
  jugador.seguidores = jugador.seguidores.filter(s => s.resistencia > 0);
}

/** Los efectos de "siNoHay", uno detrás de otro, con las mismas reglas que cualquier efecto. */
function aplicarReemplazo(estado: Estado, efectos: readonly Efecto[], dados: Dados, catalogos: CatalogosEfectos, cambios: Cambio[]): void {
  for (const efecto of efectos) {
    if (estado.mundo.finPartida) {
      break; // la partida ya ha terminado
    }
    aplicarUno(estado, efecto, dados, catalogos, cambios);
    comprobarDerrota(estado, cambios);
  }
}

/**
 * El contable: cada vez que GANA oro (sumar con cantidad positiva), gana 2d6 más.
 * No cuenta "fijar": eso no es ganar, es quedarse con una cantidad.
 */
function aplicarContable(jugador: Jugador, efecto: EfectoDeRecurso, dados: Dados, cambios: Cambio[]): void {
  const esGanarOro = efecto.tipo === 'oro' && (efecto.operacion ?? 'sumar') === 'sumar' && 'cantidad' in efecto && efecto.cantidad > 0;
  if (!esGanarOro || jugador.sobrenombre !== 'el_contable') {
    return;
  }
  const extra = dados.tirar('2d6').total;
  apuntarRecurso(jugador, 'oro', jugador.oro + extra, cambios, 'contable');
}

function cambiarRecursoDelJugador(jugador: Jugador, efecto: EfectoDeRecurso, cambios: Cambio[]): void {
  const tipo = efecto.tipo;
  const { maximo } = limitesDe(jugador, tipo);

  apuntarRecurso(jugador, tipo, nuevoValor(jugador[tipo], efecto, maximo), cambios);

  // Si baja la vida máxima por debajo de la vida actual, la vida baja con ella.
  if (tipo === 'vidaMax' && jugador.vida > jugador.vidaMax) {
    apuntarRecurso(jugador, 'vida', jugador.vidaMax, cambios);
  }
}

/** Pone un recurso en un valor (recortado a sus límites) y, si cambia de verdad, lo apunta en el chivato. */
function apuntarRecurso(jugador: Jugador, tipo: TipoRecurso, valor: number, cambios: Cambio[], motivo?: 'contable' | 'objeto_magico'): void {
  const { minimo, maximo } = limitesDe(jugador, tipo);
  const antes = jugador[tipo];
  const despues = recortar(valor, minimo, maximo);
  jugador[tipo] = despues;
  if (despues !== antes) {
    cambios.push(motivo ? { tipo: 'recurso', recurso: tipo, antes, despues, motivo } : { tipo: 'recurso', recurso: tipo, antes, despues });
  }
}

function cambiarResistencia(seguidor: Seguidor, efecto: EfectoDeRecurso, cambios: Cambio[]): void {
  const maximo = seguidor.resistenciaMaxima;
  const antes = seguidor.resistencia;
  seguidor.resistencia = recortar(nuevoValor(antes, efecto, maximo), 0, maximo);
  if (seguidor.resistencia !== antes) {
    cambios.push({ tipo: 'resistencia_seguidor', seguidor: seguidor.id, antes, despues: seguidor.resistencia });
  }
}

/** El valor tras la operación, SIN recortar todavía a los límites. */
function nuevoValor(actual: number, efecto: EfectoDeRecurso, maximo: number): number {
  switch (efecto.operacion) {
    case 'fijar':
      return efecto.cantidad;
    case 'mitad':
      return Math.floor(actual / 2); // 15 de oro → 7
    case 'maximo':
      return maximo;
    case 'todo':
      return 0;
    default:
      return actual + efecto.cantidad; // sumar (también con cantidad negativa = perder)
  }
}

/** Mínimo y máximo de cada recurso. Infinity = sin tope (oro, fama...). */
function limitesDe(jugador: Jugador, tipo: TipoRecurso): { minimo: number; maximo: number } {
  const minimo = CARACTERISTICAS.includes(tipo) ? 1 : 0;
  switch (tipo) {
    case 'vida':
      return { minimo, maximo: jugador.vidaMax };
    case 'tripulacion':
      return { minimo, maximo: jugador.tripulacionMax };
    case 'comida':
      return { minimo, maximo: AJUSTES.comidaMaxima };
    default:
      return { minimo, maximo: Infinity };
  }
}

function recortar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

function ganarObjeto(jugador: Jugador, idObjeto: string, objetos: readonly Objeto[], cambios: Cambio[]): void {
  const ficha = buscarFicha(objetos, idObjeto, 'objeto');
  const espacios = ficha.espacios ?? 1;

  // Si no cabe, no entra. (Elegir qué tirar para hacerle sitio llegará en el Sprint 6.)
  if (espaciosOcupados(jugador, objetos) + espacios > jugador.capacidadInventario) {
    cambios.push({ tipo: 'objeto_no_cabe', objeto: ficha.id });
    return;
  }

  jugador.inventario.push(ficha.usosMaximos === undefined ? { id: ficha.id } : { id: ficha.id, usosRestantes: ficha.usosMaximos });
  cambios.push({ tipo: 'objeto_ganado', objeto: ficha.id });

  // Conseguir un objeto mágico da +1 de fama.
  if (ficha.magico) {
    apuntarRecurso(jugador, 'fama', jugador.fama + 1, cambios, 'objeto_magico');
  }
}

function perderObjeto(jugador: Jugador, idObjeto: string, cambios: Cambio[]): void {
  // Si lleva varios iguales, se pierde uno. Si no lleva ninguno, no pasa nada.
  const posicion = jugador.inventario.findIndex(o => o.id === idObjeto);
  if (posicion !== -1) {
    jugador.inventario.splice(posicion, 1);
    cambios.push({ tipo: 'objeto_perdido', objeto: idObjeto });
  }
}

function espaciosOcupados(jugador: Jugador, objetos: readonly Objeto[]): number {
  return jugador.inventario.reduce((total, llevado) => total + (buscarFicha(objetos, llevado.id, 'objeto').espacios ?? 1), 0);
}

// ---------------------------------------------------------------------------
// Condiciones
// ---------------------------------------------------------------------------

function ponerCondicion(
  jugador: Jugador,
  idCondicion: string,
  turnos: number | undefined,
  condiciones: readonly Condicion[],
  cambios: Cambio[],
): void {
  buscarFicha(condiciones, idCondicion, 'condición'); // comprueba que existe

  const yaActiva = jugador.condiciones.find(c => c.id === idCondicion);
  if (!yaActiva) {
    jugador.condiciones.push(turnos === undefined ? { id: idCondicion } : { id: idCondicion, turnosRestantes: turnos });
    cambios.push(turnos === undefined ? { tipo: 'condicion_puesta', condicion: idCondicion } : { tipo: 'condicion_puesta', condicion: idCondicion, turnos });
    return;
  }

  // Ya la tiene: no se duplica, se queda la que dure más (sin turnos = dura para siempre).
  if (yaActiva.turnosRestantes !== undefined && (turnos === undefined || turnos > yaActiva.turnosRestantes)) {
    if (turnos === undefined) {
      delete yaActiva.turnosRestantes;
    } else {
      yaActiva.turnosRestantes = turnos;
    }
  }
}

/** "Quita una maldición": quita UNA de esa categoría, la más antigua. */
function quitarUnaDeCategoria(jugador: Jugador, categoria: string, condiciones: readonly Condicion[], cambios: Cambio[]): void {
  const posicion = jugador.condiciones.findIndex(c => buscarFicha(condiciones, c.id, 'condición').categoria === categoria);
  quitarCondicion(jugador, posicion, cambios);
}

/** Quita la condición que está en esa posición de la lista (-1 = no la tiene: no pasa nada). */
function quitarCondicion(jugador: Jugador, posicion: number, cambios: Cambio[]): void {
  if (posicion !== -1) {
    const [quitada] = jugador.condiciones.splice(posicion, 1);
    cambios.push({ tipo: 'condicion_quitada', condicion: quitada.id });
  }
}

// ---------------------------------------------------------------------------

function buscarFicha<T extends { id: string }>(catalogo: readonly T[], id: string, que: string): T {
  const ficha = catalogo.find(f => f.id === id);
  if (!ficha) {
    throw new Error(`aplicarEfectos: no existe ${que === 'objeto' ? 'el objeto' : 'la condición'} "${id}" en el catálogo`);
  }
  return ficha;
}
