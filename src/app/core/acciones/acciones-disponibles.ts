import { AJUSTES } from '../ajustes/ajustes';
import { condicionesQueProhiben, maximoSeguidoresActual } from '../condiciones/consultas';
import type { Estado } from '../estado/estado';
import { motivoParaNoDescansarEnMonasterio, motivoParaNoRezar } from '../monasterio/monasterio';
import { motivoParaNoEnterrar } from './enterrar-tesoro';
import type { IdAccion, Sitio } from './accion';

// REGLA DE LA INTERFAZ (decidida por el autor): una acción que no se puede hacer SIEMPRE se ve,
// desactivada (más clara) y con el motivo. Nunca se esconde.

// Por qué una acción no se puede hacer aquí:
//   sin_agua:      para pescar hay que estar a bordo o en tierra junto al agua.
//   solo_salvaje:  cazar es solo en tierra salvaje (ni a bordo, ni en puertos, aldeas o monasterios).
//   solo_puerto:   el mercado y contratar solo están en los puertos.
//   prohibido:     una condición lo impide (en "condiciones" va cuál: "Hedor nauseabundo").
//   tripulacion_al_maximo: ya tiene toda la tripulación que cabe en el barco.
//   sin_oro:       no le llega el oro ni para lo más barato.
//   grupo_lleno:   el grupo está lleno y no puede despedir a nadie (todos son inseparables).
//   solo_monasterio: rezar y descansar en el monasterio solo en un monasterio.
//   sin_maldiciones: rezar sin tener ninguna maldición ("No tienes ninguna maldición").
//   nadie_herido:  descansar en el monasterio con todo el grupo con la vida al máximo ("Nadie necesita descansar").
//   tesoro_ya_enterrado: en esta casilla ya enterró un tesoro ("Ya has enterrado un tesoro aquí").
export type MotivoNoDisponible =
  | 'sin_agua'
  | 'solo_salvaje'
  | 'solo_puerto'
  | 'prohibido'
  | 'tripulacion_al_maximo'
  | 'sin_oro'
  | 'grupo_lleno'
  | 'solo_monasterio'
  | 'sin_maldiciones'
  | 'nadie_herido'
  | 'tesoro_ya_enterrado';

/** Una acción tal como la enseña la interfaz: si no está disponible, sale desactivada con su motivo. */
export interface AccionDisponible {
  accion: IdAccion;
  disponible: boolean;
  motivo?: MotivoNoDisponible;
  // Solo con motivo "prohibido": ids de las condiciones que lo impiden, para decir cuáles.
  condiciones?: string[];
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
export function accionesDisponibles(estado: Estado, sitio: Sitio): AccionDisponible[] {
  const enPuerto = sitio.lugar === 'puerto';
  const enMonasterio = sitio.lugar === 'monasterio';
  return [
    sePuedePescar(sitio) ? { accion: 'pescar', disponible: true } : { accion: 'pescar', disponible: false, motivo: 'sin_agua' },
    sePuedeCazar(sitio) ? { accion: 'cazar', disponible: true } : { accion: 'cazar', disponible: false, motivo: 'solo_salvaje' },
    { accion: 'reposar', disponible: true }, // reposar se puede en cualquier sitio
    enPuerto ? { accion: 'ir_al_mercado', disponible: true } : { accion: 'ir_al_mercado', disponible: false, motivo: 'solo_puerto' },
    enPuerto ? { accion: 'dar_discurso', disponible: true } : { accion: 'dar_discurso', disponible: false, motivo: 'solo_puerto' },
    enPuerto ? disponibleONo('contratar_marineros', motivoParaNoContratarMarineros(estado)) : noEnPuerto('contratar_marineros'),
    enPuerto ? disponibilidadDeBuscarSeguidor(estado) : noEnPuerto('buscar_seguidor'),
    enMonasterio ? disponibleONo('rezar', motivoParaNoRezar(estado)) : noEnMonasterio('rezar'),
    enMonasterio ? disponibleONo('descansar_en_monasterio', motivoParaNoDescansarEnMonasterio(estado)) : noEnMonasterio('descansar_en_monasterio'),
    disponibilidadDeEnterrar(estado, sitio),
  ];
}

/** Contratar marineros: no si ya tiene toda la tripulación o no le llega ni para uno. */
export function motivoParaNoContratarMarineros(estado: Estado): MotivoNoDisponible | undefined {
  if (estado.jugador.tripulacion >= estado.jugador.tripulacionMax) {
    return 'tripulacion_al_maximo';
  }
  if (estado.jugador.oro < AJUSTES.precioMarinero) {
    return 'sin_oro';
  }
  return undefined;
}

/**
 * Buscar seguidor: no si una condición prohíbe tener seguidores nuevos (hedor nauseabundo), ni si
 * el grupo está lleno y no puede despedir a nadie para hacer sitio (todos son inseparables).
 * Con el grupo lleno pero alguien despedible, SÍ se puede (al contratar se le pregunta a quién despide).
 */
export function disponibilidadDeBuscarSeguidor(estado: Estado): AccionDisponible {
  const prohiben = condicionesQueProhiben(estado.jugador, 'nuevos_seguidores');
  if (prohiben.length > 0) {
    return { accion: 'buscar_seguidor', disponible: false, motivo: 'prohibido', condiciones: prohiben };
  }
  const { seguidores } = estado.jugador;
  if (seguidores.length >= maximoSeguidoresActual(estado.jugador) && seguidores.every(s => s.inseparable)) {
    return { accion: 'buscar_seguidor', disponible: false, motivo: 'grupo_lleno' };
  }
  return { accion: 'buscar_seguidor', disponible: true };
}

function disponibilidadDeEnterrar(estado: Estado, sitio: Sitio): AccionDisponible {
  const noSePuede = motivoParaNoEnterrar(estado, sitio);
  if (!noSePuede) {
    return { accion: 'enterrar_tesoro', disponible: true };
  }
  return noSePuede.motivo === 'prohibido'
    ? { accion: 'enterrar_tesoro', disponible: false, motivo: 'prohibido', condiciones: noSePuede.condiciones }
    : { accion: 'enterrar_tesoro', disponible: false, motivo: noSePuede.motivo };
}

function disponibleONo(accion: IdAccion, motivo: MotivoNoDisponible | undefined): AccionDisponible {
  return motivo ? { accion, disponible: false, motivo } : { accion, disponible: true };
}

function noEnPuerto(accion: IdAccion): AccionDisponible {
  return { accion, disponible: false, motivo: 'solo_puerto' };
}

function noEnMonasterio(accion: IdAccion): AccionDisponible {
  return { accion, disponible: false, motivo: 'solo_monasterio' };
}
