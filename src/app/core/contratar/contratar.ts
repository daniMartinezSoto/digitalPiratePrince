import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio, type TiradaDeAccion } from '../acciones/accion';
import { disponibilidadDeBuscarSeguidor, motivoParaNoContratarMarineros } from '../acciones/acciones-disponibles';
import { AJUSTES } from '../ajustes/ajustes';
import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import type { AccionEnCurso, MarinerosDisponibles, SeguidorEnEspera } from '../estado/mundo';
import { hayMarca, sinMarca } from '../estado/marcas';
import { calcularModificador } from '../modificadores/calcular-modificador';
import { seguidoresDespedibles } from '../seguidores/consultas';
import type { Efecto } from '../tablas/efecto';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { resolverTabla } from '../tablas/rangos/resolver-tabla';
import type { ResultadoTabla } from '../tablas/rangos/resultado-tabla';
import { maximoSeguidoresActual } from '../condiciones/consultas';

// CONTRATAR (solo en puertos). Tres formas, y cada una es una ACCIÓN distinta (cada día, solo una):
//   dar_discurso:        1d6 en la tabla "discurso" (data/tablas/discurso.json). Se resuelve en el acto.
//   contratar_marineros: dos pasos. 1) contratarMarineros tira cuántos hay hoy (AJUSTES.marinerosDisponibles).
//                        2) pagarMarineros: el jugador elige cuántos (0 = ninguno), a AJUSTES.precioMarinero cada uno.
//   buscar_seguidor:     dos pasos. 1) buscarSeguidor tira 2d6 en la tabla "contratar_seguidor".
//                        2) contratarSeguidor (paga su precio) o rechazarSeguidor.
// Entre los dos pasos, lo que salió queda guardado en mundo.accionEnCurso: no se puede volver a tirar.

const EVENTO_ARRESTADO = 'arrestado';

// ---------------------------------------------------------------------------
// Dar un discurso
// ---------------------------------------------------------------------------

/**
 * ACCIÓN: DAR UN DISCURSO. 1d6 en la tabla "discurso" (con los bonificadores de la tirada "discurso").
 * Si tiene amigos en esta casilla (marca "amigos", de buscar información), +1 y la marca se gasta.
 * Regla de la multa (fila 1): si no le llega el oro para pagarla, le quitan TODO su oro y lo arrestan
 * (el evento "arrestado" queda pendiente hasta el motor de eventos).
 * Después, toca comer.
 */
export function darDiscurso(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'darDiscurso');
  exigirPuerto(sitio, 'darDiscurso');

  const amigos = hayMarca(estado, 'amigos', sitio.hex);
  const tirada = resolverTabla(obtenerTabla('discurso'), calcularModificador(estado.jugador, 'discurso') + (amigos ? 1 : 0), dados);
  const eventos: string[] = tirada.evento ? [tirada.evento] : [];
  let efectos: Efecto[] = tirada.efectos;

  const multa = -efectos.reduce((suma, e) => suma + (e.tipo === 'oro' && 'cantidad' in e && e.cantidad < 0 ? e.cantidad : 0), 0);
  if (multa > estado.jugador.oro) {
    efectos = [{ tipo: 'oro', operacion: 'todo' }];
    eventos.push(EVENTO_ARRESTADO);
  }

  const resultado = aplicarEfectos(amigos ? sinMarca(estado, 'amigos', sitio.hex) : estado, efectos, dados);
  return { estado: cerrarFaseDeAccion(resultado.estado, dados), cambios: resultado.cambios, tirada: paraEnsenar(tirada), eventos };
}

// ---------------------------------------------------------------------------
// Contratar marineros
// ---------------------------------------------------------------------------

/**
 * ACCIÓN: CONTRATAR MARINEROS, paso 1. Tira cuántos hay disponibles hoy y lo guarda.
 * Error si no puede (tripulación al máximo o sin oro ni para uno): la interfaz la enseña desactivada.
 */
export function contratarMarineros(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'contratarMarineros');
  exigirPuerto(sitio, 'contratarMarineros');
  const motivo = motivoParaNoContratarMarineros(estado);
  if (motivo) {
    throw new Error(`contratarMarineros: no se puede (${motivo})`);
  }

  const tirada = dados.tirar(AJUSTES.marinerosDisponibles);
  const enCurso: MarinerosDisponibles = { tipo: 'marineros', disponibles: tirada.total };
  return {
    estado: conAccionEnCurso(estado, enCurso, dados),
    cambios: [],
    tirada: { dados: tirada.dados, modificador: 0, total: tirada.total },
    eventos: [],
  };
}

/** Lo que la interfaz necesita para preguntar "¿cuántos contratas?". maximo = los que puede pagar y le caben. */
export interface OpcionesMarineros {
  disponibles: number;
  precio: number;
  maximo: number;
}

/** Solo consulta: cuántos marineros hay, a qué precio y cuántos puede contratar como mucho. */
export function opcionesDeMarineros(estado: Estado): OpcionesMarineros {
  const { disponibles } = enCursoDeTipo(estado, 'marineros', 'opcionesDeMarineros');
  const jugador = estado.jugador;
  const maximo = Math.max(
    0,
    Math.min(disponibles, Math.floor(jugador.oro / AJUSTES.precioMarinero), jugador.tripulacionMax - jugador.tripulacion),
  );
  return { disponibles, precio: AJUSTES.precioMarinero, maximo };
}

/**
 * CONTRATAR MARINEROS, paso 2: contrata esa cantidad (0 = ninguno) y termina la acción (toca comer).
 * Error si la cantidad no es un entero entre 0 y el máximo de opcionesDeMarineros.
 */
export function pagarMarineros(estado: Estado, cantidad: number, dados: Dados): ResultadoAccion {
  const { maximo } = opcionesDeMarineros(estado);
  if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > maximo) {
    throw new Error(`pagarMarineros: puede contratar entre 0 y ${maximo} (ha pedido ${cantidad})`);
  }
  const efectos: Efecto[] =
    cantidad === 0
      ? []
      : [
          { tipo: 'oro', cantidad: -cantidad * AJUSTES.precioMarinero },
          { tipo: 'tripulacion', cantidad },
        ];
  const resultado = aplicarEfectos(estado, efectos, dados);
  return { estado: terminar(resultado.estado, dados), cambios: resultado.cambios, eventos: [] };
}

// ---------------------------------------------------------------------------
// Buscar un seguidor
// ---------------------------------------------------------------------------

/**
 * ACCIÓN: BUSCAR UN SEGUIDOR, paso 1. 2d6 en la tabla "contratar_seguidor".
 *   - Si sale un seguidor, queda esperando a que el jugador lo contrate o no (con su precio).
 *   - Si sale el cartógrafo (un evento), la acción termina y el evento queda pendiente.
 * Error si no puede (hedor nauseabundo, o grupo lleno de inseparables): la interfaz la enseña desactivada.
 */
export function buscarSeguidor(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'buscarSeguidor');
  exigirPuerto(sitio, 'buscarSeguidor');
  const disponibilidad = disponibilidadDeBuscarSeguidor(estado);
  if (!disponibilidad.disponible) {
    throw new Error(`buscarSeguidor: no se puede (${disponibilidad.motivo})`);
  }

  const tirada = resolverTabla(obtenerTabla('contratar_seguidor'), calcularModificador(estado.jugador, 'contratar_seguidor'), dados);
  const sale = tirada.efectos.find(e => e.tipo === 'ganar_seguidor');

  if (!sale || sale.tipo !== 'ganar_seguidor') {
    // El cartógrafo: un evento en lugar de un seguidor. La acción termina aquí.
    return { estado: cerrarFaseDeAccion(estado, dados), cambios: [], tirada: paraEnsenar(tirada), eventos: tirada.evento ? [tirada.evento] : [] };
  }

  const enCurso: SeguidorEnEspera = { tipo: 'seguidor', seguidor: sale.seguidor, precio: precioDe(sale.seguidor) };
  return { estado: conAccionEnCurso(estado, enCurso, dados), cambios: [], tirada: paraEnsenar(tirada), eventos: [] };
}

/** Lo que la interfaz necesita para enseñar al seguidor que espera. */
export interface OpcionesSeguidor {
  seguidor: string; // id del tipo ("forzudo")
  precio: number;
  disponible: boolean;
  motivo?: 'sin_oro';
  // true = el grupo está lleno: al contratarlo hay que decir a quién se despide (seguidoresDespedibles).
  hayQueDespedir: boolean;
}

/** Solo consulta: el seguidor que espera, su precio y si se puede contratar. */
export function opcionesDelSeguidor(estado: Estado): OpcionesSeguidor {
  const { seguidor, precio } = enCursoDeTipo(estado, 'seguidor', 'opcionesDelSeguidor');
  const hayQueDespedir = estado.jugador.seguidores.length >= maximoSeguidoresActual(estado.jugador);
  return estado.jugador.oro < precio
    ? { seguidor, precio, disponible: false, motivo: 'sin_oro', hayQueDespedir }
    : { seguidor, precio, disponible: true, hayQueDespedir };
}

/**
 * BUSCAR UN SEGUIDOR, paso 2: lo contrata, paga su precio y termina la acción (toca comer).
 *   - Con el grupo lleno, "despedir" dice a quién se despide (su id en la partida). Si no se despide a
 *     nadie, no entra: ni se paga ni termina la acción (puede despedir a alguien o rechazarlo).
 * Error si no le llega el oro o el despedido no se puede despedir.
 */
export function contratarSeguidor(estado: Estado, dados: Dados, despedir?: string): ResultadoAccion {
  const { seguidor, precio } = enCursoDeTipo(estado, 'seguidor', 'contratarSeguidor');
  if (estado.jugador.oro < precio) {
    throw new Error(`contratarSeguidor: pide ${precio} y solo tiene ${estado.jugador.oro} de oro`);
  }
  if (despedir !== undefined && !seguidoresDespedibles(estado.jugador).some(s => s.id === despedir)) {
    throw new Error(`contratarSeguidor: no se puede despedir a "${despedir}"`);
  }

  const unirse = aplicarEfectos(
    estado,
    [despedir === undefined ? { tipo: 'ganar_seguidor', seguidor } : { tipo: 'ganar_seguidor', seguidor, despedir }],
    dados,
  );
  if (!unirse.cambios.some(c => c.tipo === 'seguidor_se_une')) {
    // No ha entrado (grupo lleno sin despedir a nadie): sigue esperando, sin pagar.
    return { estado: conAccionEnCurso(unirse.estado, estado.mundo.accionEnCurso!, dados), cambios: unirse.cambios, eventos: [] };
  }

  const pago = precio > 0 ? aplicarEfectos(unirse.estado, [{ tipo: 'oro', cantidad: -precio }], dados) : { estado: unirse.estado, cambios: [] };
  return { estado: terminar(pago.estado, dados), cambios: [...unirse.cambios, ...pago.cambios], eventos: [] };
}

/** BUSCAR UN SEGUIDOR, paso 2 (alternativa): no lo contrata. La acción termina igual (toca comer). */
export function rechazarSeguidor(estado: Estado, dados: Dados): ResultadoAccion {
  enCursoDeTipo(estado, 'seguidor', 'rechazarSeguidor');
  return { estado: terminar(estado, dados), cambios: [], eventos: [] };
}

// ---------------------------------------------------------------------------

function exigirPuerto(sitio: Sitio, que: string): void {
  if (sitio.lugar !== 'puerto') {
    throw new Error(`${que}: solo se puede contratar en los puertos (está en "${sitio.lugar}")`);
  }
}

/** Precio del tipo de seguidor en el catálogo. Un seguidor de la tabla sin precio es un error de los datos. */
function precioDe(idTipo: string): number {
  const precio = TIPOS_SEGUIDOR.find(t => t.id === idTipo)?.precio;
  if (precio === undefined) {
    throw new Error(`El seguidor "${idTipo}" sale en la tabla de contratar pero no tiene precio en data/seguidores.json`);
  }
  return precio;
}

/** La acción a medias de ese tipo. Si no es la que toca (o no hay), error. */
function enCursoDeTipo<T extends AccionEnCurso['tipo']>(estado: Estado, tipo: T, que: string): Extract<AccionEnCurso, { tipo: T }> {
  const enCurso = estado.mundo.accionEnCurso;
  if (estado.mundo.finPartida) {
    throw new Error(`${que}: la partida ya ha terminado`);
  }
  if (estado.mundo.fase !== 'accion' || enCurso?.tipo !== tipo) {
    throw new Error(`${que}: no hay ninguna acción "${tipo}" a medias`);
  }
  return enCurso as Extract<AccionEnCurso, { tipo: T }>;
}

function conAccionEnCurso(estado: Estado, enCurso: AccionEnCurso, dados: Dados): Estado {
  return { ...estado, mundo: { ...estado.mundo, accionEnCurso: enCurso, estadoDados: dados.obtenerEstado() } };
}

/** Borra la acción a medias y cierra la fase de acción: toca comer. */
function terminar(estado: Estado, dados: Dados): Estado {
  return cerrarFaseDeAccion({ ...estado, mundo: { ...estado.mundo, accionEnCurso: null } }, dados);
}

function paraEnsenar(tirada: ResultadoTabla): TiradaDeAccion {
  return { dados: tirada.dados, modificador: tirada.modificador, total: tirada.total, ...(tirada.texto ? { texto: tirada.texto } : {}) };
}
