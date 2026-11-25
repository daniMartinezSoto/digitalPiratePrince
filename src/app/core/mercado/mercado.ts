import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from '../acciones/accion';
import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Dados } from '../dados/dados';
import { aplicarEfectos, type CatalogosEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import type { VisitaMercado } from '../estado/mundo';
import { espaciosQueFaltan, motivoParaNoSoltar } from '../objetos/consultas';
import type { Efecto } from '../tablas/efecto';
import { esPuerto } from '../turno/lugar';
import { RASTRILLO } from './cargar-rastrillo';
import type { Rastrillo } from './rastrillo';

// ACCIÓN: IR AL MERCADO (solo en puertos). Lo que gasta el día es ENTRAR. Dentro, cada cosa
// es un botón aparte y se puede pulsar tantas veces como se quiera, hasta "Salir del mercado":
//   comprarComida:        1 reserva por clic (AJUSTES.precioComprarComida).
//   venderComida:         1 reserva por clic (AJUSTES.precioVenderComida).
//   venderObjeto:         uno a uno, a su precio de venta.
//   comprarEnRastrillo:   el objeto del día (se saca al entrar); una vez comprado, ya no hay más.
//   salirDelMercado:      termina la acción: toca comer.
// Mientras está dentro no puede hacer otra acción ni usar objetos.
// Todo pasa por aplicarEfectos: ganar oro al vender cuenta como ganar oro (el contable gana su 1d6).

const CATALOGOS_DEL_JUEGO: CatalogosEfectos = { objetos: OBJETOS, condiciones: CONDICIONES };

/** Lo que devuelve cada botón de dentro del mercado. */
export interface ResultadoMercado {
  estado: Estado;
  cambios: Cambio[];
}

/**
 * Entra en el mercado: gasta la acción del día (la partida sigue en "accion" hasta salir).
 * Saca el objeto del rastrillo de hoy, al azar con pesos (gasta un número del generador;
 * ninguno si el rastrillo está vacío). Error si no está en un puerto.
 */
export function irAlMercado(estado: Estado, sitio: Sitio, dados: Dados, rastrillo: Rastrillo = RASTRILLO): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'irAlMercado');
  if (!esPuerto(sitio.lugar)) {
    throw new Error(`irAlMercado: el mercado solo está en los puertos (está en "${sitio.lugar}")`);
  }

  const elegido = rastrillo.objetos.length > 0 ? dados.elegirPonderado(rastrillo.objetos) : null;
  const visita: VisitaMercado = { tipo: 'mercado', rastrillo: elegido ? { objeto: elegido.objeto, precio: elegido.precio } : null };

  return { estado: conVisita(estado, visita, dados), cambios: [], eventos: [] };
}

/** Compra UNA reserva de comida. Error si no le llega el oro o ya tiene la comida al máximo. */
export function comprarComida(estado: Estado, dados: Dados): ResultadoMercado {
  const visita = comprobarQueEstaEnElMercado(estado, 'comprarComida');
  const motivo = motivoParaNoComprarComida(estado);
  if (motivo) {
    throw new Error(`comprarComida: no se puede (${motivo})`);
  }
  return aplicarYSeguir(estado, visita, [{ tipo: 'oro', cantidad: -AJUSTES.precioComprarComida }, { tipo: 'comida', cantidad: 1 }], dados);
}

/** Vende UNA reserva de comida. Error si no tiene comida. */
export function venderComida(estado: Estado, dados: Dados): ResultadoMercado {
  const visita = comprobarQueEstaEnElMercado(estado, 'venderComida');
  if (estado.jugador.comida < 1) {
    throw new Error('venderComida: no tiene comida que vender');
  }
  return aplicarYSeguir(estado, visita, [{ tipo: 'comida', cantidad: -1 }, { tipo: 'oro', cantidad: AJUSTES.precioVenderComida }], dados);
}

/** Vende el objeto de esa posición del inventario, a su precio de venta. */
export function venderObjeto(estado: Estado, posicion: number, dados: Dados, catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO): ResultadoMercado {
  const visita = comprobarQueEstaEnElMercado(estado, 'venderObjeto');
  const llevado = estado.jugador.inventario[posicion];
  if (!llevado) {
    throw new Error(`venderObjeto: no hay ningún objeto en la posición ${posicion} del inventario`);
  }
  if (motivoParaNoSoltar(estado.jugador, posicion, catalogos.objetos)) {
    throw new Error('venderObjeto: sin la mochila sin fondo no te cabe lo que llevas; primero vende o tira otras cosas');
  }
  const ficha = fichaDe(llevado.id, catalogos);
  const efectos: Efecto[] = [{ tipo: 'vender_objeto', posicion }, { tipo: 'oro', cantidad: ficha.precioVenta }];
  if (ficha.banderaAlVender) {
    efectos.push({ tipo: 'bandera', bandera: ficha.banderaAlVender }); // el juego recordará que lo vendió
  }
  return aplicarYSeguir(estado, visita, efectos, dados, catalogos);
}

/**
 * Compra el objeto del rastrillo.
 *   - Si no cabe, el juego pregunta antes qué tira y lo pasa en "tirar" (posiciones, como en ganar_objeto).
 *     Si ni así cabe, no se compra (ni se cobra) y el rastrillo sigue igual: el cambio dice "objeto_no_cabe".
 *   - Si entra, se cobra y el rastrillo se queda vacío hasta otra visita.
 * Error si ya no hay nada en el rastrillo o no le llega el oro.
 */
export function comprarEnRastrillo(
  estado: Estado,
  dados: Dados,
  tirar?: number[],
  catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO,
): ResultadoMercado {
  const visita = comprobarQueEstaEnElMercado(estado, 'comprarEnRastrillo');
  const oferta = visita.rastrillo;
  if (!oferta) {
    throw new Error('comprarEnRastrillo: hoy ya no queda nada en el rastrillo');
  }
  if (estado.jugador.oro < oferta.precio) {
    throw new Error(`comprarEnRastrillo: cuesta ${oferta.precio} y solo tiene ${estado.jugador.oro} de oro`);
  }

  const conObjeto = aplicarEfectos(
    estado,
    [tirar === undefined ? { tipo: 'ganar_objeto', objeto: oferta.objeto } : { tipo: 'ganar_objeto', objeto: oferta.objeto, tirar }],
    dados,
    catalogos,
  );
  if (!conObjeto.cambios.some(c => c.tipo === 'objeto_ganado')) {
    return { estado: conVisita(conObjeto.estado, visita, dados), cambios: conObjeto.cambios }; // no cabía: ni se compra ni se cobra
  }

  const pagado = aplicarEfectos(conObjeto.estado, [{ tipo: 'oro', cantidad: -oferta.precio }], dados, catalogos);
  return { estado: conVisita(pagado.estado, { tipo: 'mercado', rastrillo: null }, dados), cambios: [...conObjeto.cambios, ...pagado.cambios] };
}

/** Sale del mercado: termina la acción del día y toca comer. */
export function salirDelMercado(estado: Estado, dados: Dados): ResultadoMercado {
  comprobarQueEstaEnElMercado(estado, 'salirDelMercado');
  const fuera: Estado = { ...estado, mundo: { ...estado.mundo, accionEnCurso: null } };
  return { estado: cerrarFaseDeAccion(fuera, dados), cambios: [] };
}

// ---------------------------------------------------------------------------
// Para la interfaz: qué botones están activos dentro del mercado
// ---------------------------------------------------------------------------

/** Por qué un botón del mercado sale desactivado. */
export type MotivoMercado = 'sin_oro' | 'comida_al_maximo' | 'sin_comida' | 'ya_comprado';

export interface BotonMercado {
  precio: number;
  disponible: boolean;
  motivo?: MotivoMercado;
}

export interface OpcionesMercado {
  comprarComida: BotonMercado;
  venderComida: BotonMercado;
  // Lo que puede vender: cada objeto del inventario con su posición y su precio.
  // motivo "mochila_llena": es la mochila sin fondo y sin ella no te cabe lo demás (sale desactivado).
  venderObjetos: { posicion: number; objeto: string; precio: number; motivo?: 'mochila_llena' }[];
  // Lo de hoy en el rastrillo. espaciosQueFaltan > 0 = no cabe: hay que preguntar qué tira.
  // null si el rastrillo está vacío desde el principio.
  rastrillo: (BotonMercado & { objeto: string; espaciosQueFaltan: number }) | null;
}

/** Solo consulta: los botones de dentro del mercado, con su precio y, si están desactivados, por qué. */
export function opcionesDelMercado(estado: Estado, catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO): OpcionesMercado {
  const visita = comprobarQueEstaEnElMercado(estado, 'opcionesDelMercado');
  const jugador = estado.jugador;
  const motivoComprar = motivoParaNoComprarComida(estado);

  return {
    comprarComida: boton(AJUSTES.precioComprarComida, motivoComprar),
    venderComida: boton(AJUSTES.precioVenderComida, jugador.comida < 1 ? 'sin_comida' : undefined),
    venderObjetos: jugador.inventario.map((llevado, posicion) => {
      const motivo = motivoParaNoSoltar(jugador, posicion, catalogos.objetos);
      return { posicion, objeto: llevado.id, precio: fichaDe(llevado.id, catalogos).precioVenta, ...(motivo ? { motivo } : {}) };
    }),
    rastrillo: rastrilloParaLaInterfaz(estado, visita, catalogos),
  };
}

function rastrilloParaLaInterfaz(estado: Estado, visita: VisitaMercado, catalogos: CatalogosEfectos): OpcionesMercado['rastrillo'] {
  if (visita.rastrillo === null) {
    return null;
  }
  const { objeto, precio } = visita.rastrillo;
  const faltan = espaciosQueFaltan(estado.jugador, objeto, catalogos.objetos);
  return { ...boton(precio, estado.jugador.oro < precio ? 'sin_oro' : undefined), objeto, espaciosQueFaltan: faltan };
}

// ---------------------------------------------------------------------------

function boton(precio: number, motivo: MotivoMercado | undefined): BotonMercado {
  return motivo ? { precio, disponible: false, motivo } : { precio, disponible: true };
}

function motivoParaNoComprarComida(estado: Estado): MotivoMercado | undefined {
  if (estado.jugador.oro < AJUSTES.precioComprarComida) {
    return 'sin_oro';
  }
  if (estado.jugador.comida >= AJUSTES.comidaMaxima) {
    return 'comida_al_maximo';
  }
  return undefined;
}

/** Los botones de dentro solo funcionan con la partida en marcha, en la fase de acción y dentro del mercado. */
function comprobarQueEstaEnElMercado(estado: Estado, que: string): VisitaMercado {
  if (estado.mundo.finPartida) {
    throw new Error(`${que}: la partida ya ha terminado`);
  }
  const enCurso = estado.mundo.accionEnCurso;
  if (estado.mundo.fase !== 'accion' || enCurso?.tipo !== 'mercado') {
    throw new Error(`${que}: no está dentro del mercado`);
  }
  return enCurso;
}

/** Aplica los efectos de un botón y sigue dentro del mercado (la misma visita). */
function aplicarYSeguir(
  estado: Estado,
  visita: VisitaMercado,
  efectos: Parameters<typeof aplicarEfectos>[1],
  dados: Dados,
  catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO,
): ResultadoMercado {
  const resultado = aplicarEfectos(estado, efectos, dados, catalogos);
  return { estado: conVisita(resultado.estado, visita, dados), cambios: resultado.cambios };
}

/** El estado con esa visita al mercado apuntada y por dónde van los dados. */
function conVisita(estado: Estado, visita: VisitaMercado, dados: Dados): Estado {
  return { ...estado, mundo: { ...estado.mundo, accionEnCurso: visita, estadoDados: dados.obtenerEstado() } };
}

function fichaDe(id: string, catalogos: CatalogosEfectos) {
  const ficha = catalogos.objetos.find(o => o.id === id);
  if (!ficha) {
    throw new Error(`No existe el objeto "${id}" en el catálogo`);
  }
  return ficha;
}
