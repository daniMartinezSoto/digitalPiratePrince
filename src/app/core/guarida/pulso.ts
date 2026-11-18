import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from '../acciones/accion';
import { chequeo, type ResultadoChequeo } from '../chequeos/chequeo';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { conMarca, hayMarca } from '../estado/marcas';
import type { Efecto } from '../tablas/efecto';
import { cantidadApostada, puedeApostar, type Apuesta } from './apuestas';

// ACCIÓN: ECHAR UN PULSO (solo en guaridas piratas; un intento por día, porque gasta el día).
// Sacada de la taberna clandestina (E081). Se apuesta y 1d6 dice quién se sienta enfrente:
//   1-2 un borracho (−1 al dado) · 3-4 un parroquiano (tirada normal) · 5-6 el campeón de pulsos (+1 al dado).
// Después, chequeo de Fuerza con ese modificador: si lo superas ganas lo apostado; si no, lo pierdes.
// Si ganas al campeón, además +1 de fama, y queda la marca "campeon_vencido" en la guarida:
// el campeón ya no vuelve a salir allí y el 3-4 pasa a ser 3-6 (decidido por el autor, contra el abuso).

export type RivalDePulso = 'borracho' | 'parroquiano' | 'campeon';

const MODIFICADOR_DEL_RIVAL: Record<RivalDePulso, number> = { borracho: -1, parroquiano: 0, campeon: 1 };

export interface ResultadoPulso extends ResultadoAccion {
  rival: RivalDePulso;
  dadoRival: number; // el 1d6 que decidió quién se sentaba
  chequeo: ResultadoChequeo;
  apostado: number;
}

/** Por qué no se puede echar un pulso. */
export type MotivoParaNoEcharPulso = 'solo_guarida' | 'sin_oro';

export function motivoParaNoEcharPulso(estado: Estado, sitio: Sitio): MotivoParaNoEcharPulso | undefined {
  if (sitio.lugar !== 'guarida') {
    return 'solo_guarida';
  }
  return puedeApostar(estado) ? undefined : 'sin_oro';
}

/** Quién se sienta, según el dado. Con el campeón ya vencido en esta guarida, el 5-6 también es un parroquiano. */
export function rivalDePulso(dado: number, campeonVencido: boolean): RivalDePulso {
  if (dado <= 2) {
    return 'borracho';
  }
  return dado >= 5 && !campeonVencido ? 'campeon' : 'parroquiano';
}

/**
 * ACCIÓN: ECHAR UN PULSO con esa apuesta (un botón de opcionesDeApuesta). Después, toca comer.
 * Dados: 1 para el rival y 1 para el chequeo de Fuerza.
 */
export function echarUnPulso(estado: Estado, sitio: Sitio, apuesta: Apuesta, dados: Dados): ResultadoPulso {
  comprobarQueSePuedeActuar(estado, 'echarUnPulso');
  const motivo = motivoParaNoEcharPulso(estado, sitio);
  if (motivo) {
    throw new Error(`echarUnPulso: no se puede (${motivo})`);
  }
  const apostado = cantidadApostada(estado, apuesta, 'echarUnPulso');

  const dadoRival = dados.tirar('1d6').total;
  const rival = rivalDePulso(dadoRival, hayMarca(estado, 'campeon_vencido', sitio.hex));
  const resultadoChequeo = chequeo(estado.jugador, 'fuerza', MODIFICADOR_DEL_RIVAL[rival], dados);

  const gana = resultadoChequeo.superado;
  const efectos: Efecto[] = [{ tipo: 'oro', cantidad: gana ? apostado : -apostado }];
  if (gana && rival === 'campeon') {
    efectos.push({ tipo: 'fama', cantidad: 1 });
  }
  const resultado = aplicarEfectos(estado, efectos, dados);
  const actual = gana && rival === 'campeon' ? conMarca(resultado.estado, 'campeon_vencido', sitio.hex) : resultado.estado;

  return {
    estado: cerrarFaseDeAccion(actual, dados),
    cambios: resultado.cambios,
    eventos: [],
    rival,
    dadoRival,
    chequeo: resultadoChequeo,
    apostado,
  };
}
