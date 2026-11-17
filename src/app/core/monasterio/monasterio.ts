import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from '../acciones/accion';
import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import type { Condicion } from '../catalogos/condicion';
import { vidaMaxActual } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import type { Efecto } from '../tablas/efecto';

// EL MONASTERIO (solo en casillas de monasterio). Dos acciones, cada una gasta el día:
//   rezar:                   te purificas: se quitan TODAS tus maldiciones (el amuleto maldito entero,
//                            el mal está a bordo, el maleficio del pirata...).
//   descansar_en_monasterio: descansa TODO el grupo (o nadie). Cuesta AJUSTES.precioDescansarMonasterio
//                            + AJUSTES.precioDescansarMonasterioPorSeguidor por cada seguidor; todos
//                            recuperan TODA la vida y esa noche duermen allí sin pagar (mundo.nochePagada;
//                            ver opcionesDeDescanso).

/** Ids de las maldiciones apuntadas del jugador (las que se quitarían al rezar), en su orden. */
export function maldicionesApuntadas(estado: Estado, condiciones: readonly Condicion[] = CONDICIONES): string[] {
  return estado.jugador.condiciones
    .filter(activa => condiciones.find(c => c.id === activa.id)?.categoria === 'maldicion')
    .map(activa => activa.id);
}

/**
 * ACCIÓN: REZAR. Se quitan todas las maldiciones del jugador. Después, toca comer.
 * Error si no está en un monasterio o no tiene ninguna maldición (la interfaz la enseña desactivada).
 */
export function rezar(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'rezar');
  exigirMonasterio(sitio, 'rezar');
  const maldiciones = maldicionesApuntadas(estado);
  if (maldiciones.length === 0) {
    throw new Error('rezar: no tiene ninguna maldición');
  }
  const resultado = aplicarEfectos(estado, maldiciones.map(id => ({ tipo: 'quitar_condicion', condicion: id }) as Efecto), dados);
  return { estado: cerrarFaseDeAccion(resultado.estado, dados), cambios: resultado.cambios, eventos: [] };
}

/** Oro que cuesta "Descansar en el monasterio" con el grupo que lleva: 20 + 5 por seguidor. */
export function precioDescansoEnMonasterio(estado: Estado): number {
  return AJUSTES.precioDescansarMonasterio + AJUSTES.precioDescansarMonasterioPorSeguidor * estado.jugador.seguidores.length;
}

/** ¿Alguien del grupo tiene menos vida que su máximo? (Con gran fortaleza, el tope del jugador es 19.) */
export function alguienHerido(estado: Estado): boolean {
  const jugador = estado.jugador;
  return jugador.vida < vidaMaxActual(jugador) || jugador.seguidores.some(s => s.resistencia < s.resistenciaMaxima);
}

/** Por qué una acción del monasterio no se puede hacer ahora (para accionesDisponibles). */
export type MotivoMonasterio = 'sin_maldiciones' | 'nadie_herido' | 'sin_oro';

export function motivoParaNoRezar(estado: Estado): MotivoMonasterio | undefined {
  return maldicionesApuntadas(estado).length === 0 ? 'sin_maldiciones' : undefined;
}

export function motivoParaNoDescansarEnMonasterio(estado: Estado): MotivoMonasterio | undefined {
  if (!alguienHerido(estado)) {
    return 'nadie_herido';
  }
  if (estado.jugador.oro < precioDescansoEnMonasterio(estado)) {
    return 'sin_oro';
  }
  return undefined;
}

/**
 * ACCIÓN: DESCANSAR EN EL MONASTERIO. Todo el grupo: paga precioDescansoEnMonasterio, el jugador y
 * cada seguidor recuperan toda la vida, y esa noche duermen allí sin pagar (mundo.nochePagada).
 * Después, toca comer.
 * Error si no está en un monasterio, nadie está herido o no le llega el oro (la interfaz la enseña desactivada).
 */
export function descansarEnMonasterio(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'descansarEnMonasterio');
  exigirMonasterio(sitio, 'descansarEnMonasterio');
  const motivo = motivoParaNoDescansarEnMonasterio(estado);
  if (motivo) {
    throw new Error(`descansarEnMonasterio: no se puede (${motivo})`);
  }

  const efectos: Efecto[] = [
    { tipo: 'oro', cantidad: -precioDescansoEnMonasterio(estado) },
    { tipo: 'vida', operacion: 'maximo', destino: 'todos' },
  ];
  const resultado = aplicarEfectos(estado, efectos, dados);
  const conNoche: Estado = { ...resultado.estado, mundo: { ...resultado.estado.mundo, nochePagada: true } };
  return { estado: cerrarFaseDeAccion(conNoche, dados), cambios: resultado.cambios, eventos: [] };
}

function exigirMonasterio(sitio: Sitio, que: string): void {
  if (sitio.lugar !== 'monasterio') {
    throw new Error(`${que}: solo se puede en un monasterio (está en "${sitio.lugar}")`);
  }
}
