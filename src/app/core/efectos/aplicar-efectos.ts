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

/** Catálogos en los que buscar las fichas. Por defecto, los del juego; los tests pueden pasar otros. */
export interface CatalogosEfectos {
  objetos: readonly Objeto[];
  condiciones: readonly Condicion[];
}

const CATALOGOS_DEL_JUEGO: CatalogosEfectos = { objetos: OBJETOS, condiciones: CONDICIONES };

/**
 * Apunta los efectos en la hoja del personaje. Es el ÚNICO sitio que modifica el estado.
 *
 * NO toca el estado que recibe: hace una copia, cambia la copia y la devuelve.
 * Aplica los efectos en orden, uno detrás de otro, respetando las reglas:
 *   - Topes: vida ≤ vida máxima, tripulación ≤ tripulación máxima, comida ≤ AJUSTES.comidaMaxima.
 *   - Ningún recurso baja de 0; las características (fuerza, ingenio, vidaMax) nunca bajan de 1.
 *   - Objetos: solo entran si caben; los mágicos dan +1 de fama.
 *   - Condiciones, turnos perdidos y banderas.
 * Los dados solo se usan para "un seguidor al azar".
 *
 * Pendiente (siguientes pasos del Sprint 4): el contable y el afortunado, el fin de partida
 * (ganar_partida, perder_partida, vida o tripulación a 0) y la lista de cambios reales.
 */
export function aplicarEfectos(
  estado: Estado,
  efectos: readonly Efecto[],
  dados: Dados,
  catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO,
): Estado {
  const nuevo = structuredClone(estado);
  for (const efecto of efectos) {
    aplicarUno(nuevo, efecto, dados, catalogos);
  }
  return nuevo;
}

/** Aplica un efecto sobre la copia (aquí sí se modifica: es nuestra copia). */
function aplicarUno(estado: Estado, efecto: Efecto, dados: Dados, catalogos: CatalogosEfectos): void {
  const jugador = estado.jugador;

  switch (efecto.tipo) {
    case 'ganar_objeto':
      ganarObjeto(jugador, efecto.objeto, catalogos.objetos);
      return;
    case 'perder_objeto':
      perderObjeto(jugador, efecto.objeto);
      return;
    case 'poner_condicion':
      ponerCondicion(jugador, efecto.condicion, efecto.turnos, catalogos.condiciones);
      return;
    case 'quitar_condicion':
      if ('condicion' in efecto) {
        jugador.condiciones = jugador.condiciones.filter(c => c.id !== efecto.condicion);
      } else {
        quitarUnaDeCategoria(jugador, efecto.categoria, catalogos.condiciones);
      }
      return;
    case 'perder_turnos':
      jugador.fasesAccionPerdidas += efecto.cantidad;
      return;
    case 'bandera':
      estado.mundo.banderas[efecto.bandera] = true;
      return;
    case 'ganar_partida':
    case 'perder_partida':
      // Paso 8 del Sprint 4 (fin de partida). De momento no hace nada.
      return;
    default:
      aplicarARecurso(estado, efecto, dados);
  }
}

// ---------------------------------------------------------------------------
// Recursos y características
// ---------------------------------------------------------------------------

type EfectoDeRecurso = Extract<Efecto, { tipo: TipoRecurso }>;

function aplicarARecurso(estado: Estado, efecto: EfectoDeRecurso, dados: Dados): void {
  const destino = efecto.destino ?? 'jugador';
  const jugador = estado.jugador;

  if (destino === 'jugador') {
    cambiarRecursoDelJugador(jugador, efecto);
    return;
  }

  // A partir de aquí, el efecto es sobre la vida y afecta a seguidores (lo garantiza el revisor de tablas).
  if (destino === 'todos') {
    cambiarRecursoDelJugador(jugador, efecto);
    for (const seguidor of jugador.seguidores) {
      cambiarResistencia(seguidor, efecto);
    }
  } else if (destino === 'seguidor_azar') {
    if (jugador.seguidores.length > 0) {
      const elegido = jugador.seguidores[dados.entero(0, jugador.seguidores.length - 1)];
      cambiarResistencia(elegido, efecto);
    }
  } else {
    // seguidor_elegido: el jugador tiene que elegir, y eso lo pregunta el motor de eventos (Sprint 10).
    throw new Error('aplicarEfectos: "seguidor_elegido" todavía no está disponible (llegará con el motor de eventos)');
  }

  // Los seguidores que se quedan sin resistencia mueren y salen del grupo.
  jugador.seguidores = jugador.seguidores.filter(s => s.resistencia > 0);
}

function cambiarRecursoDelJugador(jugador: Jugador, efecto: EfectoDeRecurso): void {
  const tipo = efecto.tipo;
  const actual = jugador[tipo];
  const { minimo, maximo } = limitesDe(jugador, tipo);

  jugador[tipo] = recortar(nuevoValor(actual, efecto, maximo), minimo, maximo);

  // Si baja la vida máxima por debajo de la vida actual, la vida baja con ella.
  if (tipo === 'vidaMax' && jugador.vida > jugador.vidaMax) {
    jugador.vida = jugador.vidaMax;
  }
}

function cambiarResistencia(seguidor: Seguidor, efecto: EfectoDeRecurso): void {
  const maximo = seguidor.resistenciaMaxima;
  seguidor.resistencia = recortar(nuevoValor(seguidor.resistencia, efecto, maximo), 0, maximo);
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

function ganarObjeto(jugador: Jugador, idObjeto: string, objetos: readonly Objeto[]): void {
  const ficha = buscarFicha(objetos, idObjeto, 'objeto');
  const espacios = ficha.espacios ?? 1;

  // Si no cabe, no entra. (Elegir qué tirar para hacerle sitio llegará en el Sprint 6.)
  if (espaciosOcupados(jugador, objetos) + espacios > jugador.capacidadInventario) {
    return;
  }

  jugador.inventario.push(ficha.usosMaximos === undefined ? { id: ficha.id } : { id: ficha.id, usosRestantes: ficha.usosMaximos });

  // Conseguir un objeto mágico da +1 de fama.
  if (ficha.magico) {
    jugador.fama += 1;
  }
}

function perderObjeto(jugador: Jugador, idObjeto: string): void {
  // Si lleva varios iguales, se pierde uno. Si no lleva ninguno, no pasa nada.
  const posicion = jugador.inventario.findIndex(o => o.id === idObjeto);
  if (posicion !== -1) {
    jugador.inventario.splice(posicion, 1);
  }
}

function espaciosOcupados(jugador: Jugador, objetos: readonly Objeto[]): number {
  return jugador.inventario.reduce((total, llevado) => total + (buscarFicha(objetos, llevado.id, 'objeto').espacios ?? 1), 0);
}

// ---------------------------------------------------------------------------
// Condiciones
// ---------------------------------------------------------------------------

function ponerCondicion(jugador: Jugador, idCondicion: string, turnos: number | undefined, condiciones: readonly Condicion[]): void {
  buscarFicha(condiciones, idCondicion, 'condición'); // comprueba que existe

  const yaActiva = jugador.condiciones.find(c => c.id === idCondicion);
  if (!yaActiva) {
    jugador.condiciones.push(turnos === undefined ? { id: idCondicion } : { id: idCondicion, turnosRestantes: turnos });
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
function quitarUnaDeCategoria(jugador: Jugador, categoria: string, condiciones: readonly Condicion[]): void {
  const posicion = jugador.condiciones.findIndex(c => buscarFicha(condiciones, c.id, 'condición').categoria === categoria);
  if (posicion !== -1) {
    jugador.condiciones.splice(posicion, 1);
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
