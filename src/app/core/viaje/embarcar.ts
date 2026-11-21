import { hayCombate } from '../combate/hay-combate';
import type { Dados } from '../dados/dados';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import { mapaDeLaPartida, vasABordo } from '../mapa/donde-estas';
import { mismaCasilla, sonVecinas, vecinas } from '../mapa/hexagonos';
import { casillaEn, type Coordenada } from '../mapa/mapa';
import { casillaBloqueada, rasgoEn, sitioEn } from '../mapa/sitio-actual';
import { esAgua } from '../turno/lugar';
import { llegar } from './llegar';

// DESEMBARCAR Y EMBARCAR (Sprint 9, paso 6; reglas cerradas por el autor el 20-nov).
//   - NO gasta la acción ni lanza eventos de viaje (no es viajar).
//   - Solo en la fase de acción, ANTES de elegir la acción (sin combate ni acción a medias).
//   - UNA vez por turno: o bajas, o subes (mundo.diaDeEmbarque guarda el día en que se usó).
//   - Desembarcar: del barco a una casilla vecina de tierra, MENOS jungla profunda (cambiado por el
//     autor el 21-nov: hay islas sin playa; antes era solo playa o puerto). Una casilla con puerto
//     siempre vale. Nunca a casillas bloqueadas.
//   - Embarcar: desde cualquier casilla vecina del barco donde se pueda atracar (la misma regla).
//   - Ya no existe "volver al barco gastando reservas" (era del papel): se vuelve viajando.
// Bajar a tierra cuenta como LLEGAR (llegar.ts): el escorbuto se cura, un puerto principal queda
// visitado y, si toca, es la victoria. También saltan los eventos señalados en esa casilla y, en una
// guarida pirata sin explorar, su evento (E038), igual que al llegar viajando.

export type MotivoSinEmbarque = 'no_es_momento' | 'ya_usado_hoy' | 'lejos_del_barco' | 'aqui_no_se_atraca' | 'sin_sitio_para_bajar';

/**
 * Solo consulta: las casillas donde se puede embarcar o desembarcar AHORA (para marcarlas en amarillo
 * en el mapa): las de bajar si vas a bordo, o la del barco si puedes subir. Vacío si no se puede.
 */
export function casillasDeEmbarque(estado: Estado): Coordenada[] {
  const opciones = opcionesDeEmbarque(estado);
  return opciones.embarcar ? [{ ...estado.mundo.posicionBarco }] : opciones.desembarcar;
}

export interface OpcionesDeEmbarque {
  /** Casillas a las que se puede desembarcar ahora (vacío si no se puede). */
  desembarcar: Coordenada[];
  embarcar: boolean;
  /** Por qué no se puede (para enseñarlo), si no se puede ni bajar ni subir. */
  motivo?: MotivoSinEmbarque;
}

export interface ResultadoEmbarque {
  estado: Estado;
  cambios: Cambio[];
  eventos: string[];
  puertoNuevo: boolean;
}

/** ¿Se puede atracar en esta casilla? Cualquier tierra menos la jungla profunda; un puerto, siempre. */
export function sePuedeAtracar(estado: Estado, c: Coordenada): boolean {
  const casilla = casillaEn(mapaDeLaPartida(estado), c.col, c.fila);
  if (!casilla || esAgua(casilla.terreno)) return false;
  return casilla.terreno !== 'jungla_profunda' || rasgoEn(estado, c) === 'puerto';
}

function esMomento(estado: Estado): boolean {
  return !estado.mundo.finPartida && estado.mundo.fase === 'accion' && !estado.mundo.accionEnCurso && !hayCombate(estado);
}

/** Solo consulta: qué se puede hacer ahora con el barco. */
export function opcionesDeEmbarque(estado: Estado): OpcionesDeEmbarque {
  const nada = (motivo: MotivoSinEmbarque): OpcionesDeEmbarque => ({ desembarcar: [], embarcar: false, motivo });
  if (!esMomento(estado)) return nada('no_es_momento');
  if (estado.mundo.diaDeEmbarque === estado.mundo.dia) return nada('ya_usado_hoy');
  const { posicion, posicionBarco } = estado.mundo;
  if (vasABordo(estado)) {
    const desembarcar = vecinas(mapaDeLaPartida(estado), posicionBarco).filter(c => sePuedeAtracar(estado, c) && !casillaBloqueada(estado, c));
    return desembarcar.length > 0 ? { desembarcar, embarcar: false } : nada('sin_sitio_para_bajar');
  }
  if (!sonVecinas(posicion, posicionBarco)) return nada('lejos_del_barco');
  if (!sePuedeAtracar(estado, posicion)) return nada('aqui_no_se_atraca');
  return { desembarcar: [], embarcar: true };
}

export function desembarcar(estado: Estado, destino: Coordenada, dados: Dados): ResultadoEmbarque {
  const opciones = opcionesDeEmbarque(estado);
  if (!opciones.desembarcar.some(c => mismaCasilla(c, destino))) {
    throw new Error(`desembarcar: no se puede bajar a ${destino.col},${destino.fila} (${opciones.motivo ?? 'no es una playa ni un puerto junto al barco'})`);
  }
  const casilla = { col: destino.col, fila: destino.fila };
  const movido: Estado = { ...estado, mundo: { ...estado.mundo, posicion: casilla, diaDeEmbarque: estado.mundo.dia } };
  const sitio = sitioEn(movido, casilla, false);
  const llegada = llegar(movido, { lugar: sitio.lugar, rasgo: sitio.rasgo, puertoPrincipal: sitio.puertoPrincipal }, dados);
  const eventos = [...llegada.eventos];
  if (!llegada.estado.mundo.finPartida) {
    for (const marca of llegada.estado.mundo.marcas) {
      if (marca.tipo === 'evento' && marca.evento && mismaCasilla(marca, casilla)) eventos.push(marca.evento);
    }
    if (sitio.guaridaSinExplorar) eventos.push('guarida_pirata');
  }
  const final = { ...llegada.estado, mundo: { ...llegada.estado.mundo, estadoDados: dados.obtenerEstado() } };
  return { estado: final, cambios: llegada.cambios, eventos, puertoNuevo: llegada.puertoNuevo };
}

export function embarcar(estado: Estado): ResultadoEmbarque {
  const opciones = opcionesDeEmbarque(estado);
  if (!opciones.embarcar) {
    throw new Error(`embarcar: no se puede subir al barco (${opciones.motivo ?? 'ya vas a bordo'})`);
  }
  const final: Estado = {
    ...estado,
    mundo: { ...estado.mundo, posicion: { ...estado.mundo.posicionBarco }, diaDeEmbarque: estado.mundo.dia },
  };
  return { estado: final, cambios: [], eventos: [], puertoNuevo: false };
}
