import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from '../acciones/accion';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import { cantidadApostada, puedeApostar, type Apuesta } from './apuestas';

// ACCIÓN: JUGAR A LOS DADOS (solo en guaridas piratas). Sacada de la taberna clandestina (E081).
// Sentarse a la mesa gasta el día; después se apuesta tantas veces como se quiera, hasta levantarse.
// Cada partida: un dado para ti y otro para tu rival. Si el tuyo es mayor, ganas lo apostado; si es
// menor, lo pierdes; si empatan, se vuelve a tirar hasta que haya ganador (2 números por tirada).
// Ganar cuenta como ganar oro (el contable gana sus 2d6).

/** Una tirada de la partida: tu dado y el del rival. */
export interface TiradaDeDados {
  tuyo: number;
  suyo: number;
}

export interface ResultadoPartidaDeDados {
  estado: Estado;
  cambios: Cambio[];
  tiradas: TiradaDeDados[]; // todas, incluidos los empates
  ganada: boolean;
  apostado: number;
}

/** Por qué no se puede jugar a los dados. */
export type MotivoParaNoJugar = 'solo_guarida' | 'sin_oro';

export function motivoParaNoJugarALosDados(estado: Estado, sitio: Sitio): MotivoParaNoJugar | undefined {
  if (sitio.lugar !== 'guarida') {
    return 'solo_guarida';
  }
  return puedeApostar(estado) ? undefined : 'sin_oro';
}

/** ACCIÓN: se sienta a la mesa de dados. Gasta el día (la partida sigue en "accion" hasta levantarse). */
export function sentarseALosDados(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'sentarseALosDados');
  const motivo = motivoParaNoJugarALosDados(estado, sitio);
  if (motivo) {
    throw new Error(`sentarseALosDados: no se puede (${motivo})`);
  }
  return { estado: { ...estado, mundo: { ...estado.mundo, accionEnCurso: { tipo: 'dados' }, estadoDados: dados.obtenerEstado() } }, cambios: [], eventos: [] };
}

/** Una partida a los dados con esa apuesta (un botón de opcionesDeApuesta). Sigue sentado a la mesa. */
export function apostarALosDados(estado: Estado, apuesta: Apuesta, dados: Dados): ResultadoPartidaDeDados {
  comprobarQueEstaEnLaMesa(estado, 'apostarALosDados');
  const apostado = cantidadApostada(estado, apuesta, 'apostarALosDados');

  const tiradas: TiradaDeDados[] = [];
  let tirada: TiradaDeDados;
  do {
    tirada = { tuyo: dados.tirar('1d6').total, suyo: dados.tirar('1d6').total };
    tiradas.push(tirada);
  } while (tirada.tuyo === tirada.suyo);

  const ganada = tirada.tuyo > tirada.suyo;
  const resultado = aplicarEfectos(estado, [{ tipo: 'oro', cantidad: ganada ? apostado : -apostado }], dados);
  const estadoNuevo: Estado = { ...resultado.estado, mundo: { ...resultado.estado.mundo, estadoDados: dados.obtenerEstado() } };
  return { estado: estadoNuevo, cambios: resultado.cambios, tiradas, ganada, apostado };
}

/** Se levanta de la mesa: termina la acción del día y toca comer. */
export function levantarseDeLaMesa(estado: Estado, dados: Dados): ResultadoAccion {
  comprobarQueEstaEnLaMesa(estado, 'levantarseDeLaMesa');
  return { estado: cerrarFaseDeAccion({ ...estado, mundo: { ...estado.mundo, accionEnCurso: null } }, dados), cambios: [], eventos: [] };
}

function comprobarQueEstaEnLaMesa(estado: Estado, que: string): void {
  if (estado.mundo.finPartida) {
    throw new Error(`${que}: la partida ya ha terminado`);
  }
  if (estado.mundo.fase !== 'accion' || estado.mundo.accionEnCurso?.tipo !== 'dados') {
    throw new Error(`${que}: no está sentado a la mesa de dados`);
  }
}
