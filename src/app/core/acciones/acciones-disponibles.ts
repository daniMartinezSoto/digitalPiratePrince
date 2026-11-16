import type { Estado } from '../estado/estado';
import type { IdAccion, Sitio } from './accion';

// Por qué una acción no se puede hacer aquí:
//   sin_agua:    para pescar hay que estar a bordo o en tierra junto al agua.
//   solo_salvaje: cazar es solo en tierra salvaje (ni a bordo, ni en puertos, aldeas o monasterios).
export type MotivoNoDisponible = 'sin_agua' | 'solo_salvaje';

/** Una acción tal como la enseña la interfaz: si no está disponible, sale desactivada con su motivo. */
export interface AccionDisponible {
  accion: IdAccion;
  disponible: boolean;
  motivo?: MotivoNoDisponible;
}

/** Pescar: a bordo, o en tierra si hay agua en una casilla de al lado. */
export function sePuedePescar(sitio: Sitio): boolean {
  return sitio.lugar === 'barco' || sitio.juntoAlAgua === true;
}

/** Cazar: en tierra salvaje (playa, jungla, jungla profunda). Ni a bordo ni donde vive gente. */
export function sePuedeCazar(sitio: Sitio): boolean {
  return sitio.lugar === 'intemperie';
}

/**
 * Solo consulta: las acciones que el jugador ve en la fase de acción estando en ese sitio.
 * Salen todas; las que no se pueden hacer aquí, desactivadas y con el motivo.
 * (Más adelante se engancharán aquí "audiencia bloqueada en este puerto" o
 * "buscar información: falta 1 día".)
 */
export function accionesDisponibles(_estado: Estado, sitio: Sitio): AccionDisponible[] {
  return [
    sePuedePescar(sitio) ? { accion: 'pescar', disponible: true } : { accion: 'pescar', disponible: false, motivo: 'sin_agua' },
    sePuedeCazar(sitio) ? { accion: 'cazar', disponible: true } : { accion: 'cazar', disponible: false, motivo: 'solo_salvaje' },
    { accion: 'reposar', disponible: true }, // reposar se puede en cualquier sitio
  ];
}
