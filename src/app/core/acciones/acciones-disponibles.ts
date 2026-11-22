import { aldeaOfendida } from '../mapa/sitio-actual';
import { AJUSTES } from '../ajustes/ajustes';
import { condicionesQueProhiben, maximoSeguidoresActual } from '../condiciones/consultas';
import type { Estado } from '../estado/estado';
import { motivoParaNoDescansarEnMonasterio, motivoParaNoRezar } from '../monasterio/monasterio';
import { motivoParaNoJugarALosDados } from '../guarida/dados';
import { motivoParaNoEcharPulso } from '../guarida/pulso';
import { motivoParaNoPedirAudiencia } from './audiencia';
import { motivoParaNoBuscar } from './buscar-informacion';
import { motivoParaNoEnterrar } from './enterrar-tesoro';
import { motivoParaNoExplorar } from './explorar';
import { motivoParaNoMendigar } from './mendigar';
import { esPuerto } from '../turno/lugar';
import type { IdAccion, Sitio } from './accion';
import { hayCombate } from '../combate/hay-combate';
import { hayEventoEnCurso } from '../eventos/una-vez';

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
//   solo_puerto_o_aldea: buscar información solo en puertos y aldeas.
//   espera:        buscó información hace poco (en "faltanDias", cuántos días faltan).
//   solo_puerto_aldea_o_guarida: solicitar audiencia solo donde hay alguien que mande.
//   audiencia_ya_concedida: aquí ya te concedieron audiencia ("Ya te concedieron audiencia aquí").
//   audiencia_vetada: aquí ofendiste ("Aquí no quieren volver a verte").
//   solo_guarida:  jugar a los dados y echar un pulso, solo en guaridas piratas.
//   sin_naufragio, sin_ruinas: aquí no hay naufragio / ruinas.
//   ya_explorado:  este naufragio o estas ruinas ya se exploraron ("Ya has registrado estas ruinas").
//   sin_artista:   mendigar necesita un artista en el grupo.
//   no_es_momento: no es la fase de acción (o la partida ha terminado): ninguna acción se puede.
//   accion_a_medias: ya hay una acción empezada (mercado, mesa de dados...): primero hay que terminarla.
//   debes_salir:   estás en una aldea ofendida (te echaron u ofendiste al jefe): solo puedes viajar (Sprint 9).
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
  | 'tesoro_ya_enterrado'
  | 'solo_puerto_o_aldea'
  | 'espera'
  | 'solo_puerto_aldea_o_guarida'
  | 'audiencia_ya_concedida'
  | 'audiencia_vetada'
  | 'solo_guarida'
  | 'sin_naufragio'
  | 'sin_ruinas'
  | 'ya_explorado'
  | 'sin_artista'
  | 'no_es_momento'
  | 'combate_en_curso'
  | 'evento_en_curso'
  | 'accion_a_medias'
  | 'debes_salir';

/** Una acción tal como la enseña la interfaz: si no está disponible, sale desactivada con su motivo. */
export interface AccionDisponible {
  accion: IdAccion;
  disponible: boolean;
  motivo?: MotivoNoDisponible;
  // Solo con motivo "prohibido": ids de las condiciones que lo impiden, para decir cuáles.
  condiciones?: string[];
  // Solo con motivo "espera": días que faltan para poder usarla ("falta 1 día").
  faltanDias?: number;
}

/**
 * Pescar: a bordo, en un puerto o una guarida pirata (siempre están junto al agua: decidido por el
 * autor el 19-nov), o en otro sitio de tierra si hay agua en una casilla de al lado.
 */
export function sePuedePescar(sitio: Sitio): boolean {
  return sitio.lugar === 'barco' || esPuerto(sitio.lugar) || sitio.juntoAlAgua === true;
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
  const todas = accionesSegunElSitio(estado, sitio);
  // Protección: fuera de la fase de acción, o con una acción a medias, no se puede empezar ninguna.
  const bloqueo: MotivoNoDisponible | undefined =
    estado.mundo.finPartida || estado.mundo.fase !== 'accion'
      ? 'no_es_momento'
      : hayCombate(estado)
        ? 'combate_en_curso'
        : hayEventoEnCurso(estado)
          ? 'evento_en_curso'
          : estado.mundo.accionEnCurso
            ? 'accion_a_medias'
            : sitio.hex && aldeaOfendida(estado, sitio.hex)
              ? 'debes_salir'
              : undefined;
  return bloqueo ? todas.map(a => ({ accion: a.accion, disponible: false, motivo: bloqueo })) : todas;
}

/** Las acciones según el sitio y el jugador (sin mirar la fase del día). */
function accionesSegunElSitio(estado: Estado, sitio: Sitio): AccionDisponible[] {
  const enPuerto = esPuerto(sitio.lugar);
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
    disponibilidadDeBuscar(estado, sitio),
    disponibleONo('solicitar_audiencia', motivoParaNoPedirAudiencia(estado, sitio)),
    disponibleONo('jugar_a_los_dados', motivoParaNoJugarALosDados(estado, sitio)),
    disponibleONo('echar_un_pulso', motivoParaNoEcharPulso(estado, sitio)),
    disponibleONo('investigar_naufragio', motivoParaNoExplorar(estado, sitio, 'investigar_naufragio')),
    disponibleONo('registrar_ruinas', motivoParaNoExplorar(estado, sitio, 'registrar_ruinas')),
    disponibleONo('mendigar', motivoParaNoMendigar(estado, sitio)),
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

function disponibilidadDeBuscar(estado: Estado, sitio: Sitio): AccionDisponible {
  const noSePuede = motivoParaNoBuscar(estado, sitio);
  if (!noSePuede) {
    return { accion: 'buscar_informacion', disponible: true };
  }
  return noSePuede.motivo === 'espera'
    ? { accion: 'buscar_informacion', disponible: false, motivo: 'espera', faltanDias: noSePuede.faltanDias }
    : { accion: 'buscar_informacion', disponible: false, motivo: noSePuede.motivo };
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
