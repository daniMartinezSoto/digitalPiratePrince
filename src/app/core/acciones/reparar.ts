import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { tripulacionMaxActual } from '../condiciones/consultas';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';

// ACCIÓN: REPARAR EL BARCO. La da el kit de cabos, tablones y herramientas (E017; decidido por el
// autor el 25-nov: no es un objeto que se usa, es un objeto que te da una acción nueva). Gasta la
// acción del día: +1d6 de tripulación. Solo a bordo de tu barco. Después hay que esperar DIAS_ENTRE_REPARACIONES días.
// El día desde el que vuelve a estar lista se apunta en el propio kit ("listoElDia" del inventario).

export const OBJETO_KIT = 'kit_de_reparaciones';
export const DIAS_ENTRE_REPARACIONES = 3;

/** Por qué no se puede reparar: sin el kit, con la tripulación al máximo o esperando (y cuántos días faltan). */
export type NoSePuedeReparar = { motivo: 'sin_kit' | 'solo_a_bordo' | 'tripulacion_al_maximo' } | { motivo: 'espera'; faltanDias: number };

export function motivoParaNoReparar(estado: Estado, sitio: Sitio): NoSePuedeReparar | undefined {
  const kits = estado.jugador.inventario.filter(o => o.id === OBJETO_KIT);
  if (kits.length === 0) {
    return { motivo: 'sin_kit' };
  }
  // El barco se repara estando en él.
  if (sitio.lugar !== 'barco') {
    return { motivo: 'solo_a_bordo' };
  }
  // Con varios kits, vale el que antes esté listo.
  const listo = Math.min(...kits.map(k => k.listoElDia ?? 0));
  if (estado.mundo.dia < listo) {
    return { motivo: 'espera', faltanDias: listo - estado.mundo.dia };
  }
  if (estado.jugador.tripulacion >= tripulacionMaxActual(estado.jugador)) {
    return { motivo: 'tripulacion_al_maximo' };
  }
  return undefined;
}

/** ACCIÓN: REPARAR EL BARCO. +1d6 de tripulación y el kit espera 3 días. Después, toca comer. */
export function reparar(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'reparar');
  const noSePuede = motivoParaNoReparar(estado, sitio);
  if (noSePuede) {
    throw new Error(`reparar: no se puede (${noSePuede.motivo})`);
  }

  const tirada = dados.tirar('1d6');
  const aplicado = aplicarEfectos(estado, [{ tipo: 'tripulacion', cantidad: tirada.total }], dados);
  // Se apunta en el kit listo (el primero) desde qué día se puede volver a reparar.
  const posicion = aplicado.estado.jugador.inventario.findIndex(o => o.id === OBJETO_KIT && (o.listoElDia ?? 0) <= estado.mundo.dia);
  const inventario = aplicado.estado.jugador.inventario.map((o, i) => (i === posicion ? { ...o, listoElDia: estado.mundo.dia + DIAS_ENTRE_REPARACIONES } : o));
  const actual: Estado = { ...aplicado.estado, jugador: { ...aplicado.estado.jugador, inventario } };

  return {
    estado: cerrarFaseDeAccion(actual, dados),
    cambios: aplicado.cambios,
    tirada: { dados: tirada.dados, modificador: 0, total: tirada.total },
    eventos: [],
  };
}
