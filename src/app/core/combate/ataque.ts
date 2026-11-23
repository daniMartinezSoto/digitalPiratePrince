import { AJUSTES } from '../ajustes/ajustes';
import type { Dados } from '../dados/dados';

// LAS TIRADAS DE ATAQUE DEL COMBATE (Sprint 7, paso 2). Solo calculan: no tocan el estado.
// Las reglas son las del papel (sección 4.8 del CLAUDE.md):
//
//   JUGADOR (ataqueDelJugador): 1d6. Con un 1 falla. Con 2-5 hace ese daño. Con un 6 hace 6 y EL JUGADOR
//   DECIDE si vuelve a tirar sumando (Sprint 11, decidido por el autor: antes se repetía solo), tantas
//   veces como salga 6; pero si en CUALQUIER momento sale un 1, todo el ataque falla y no hace nada
//   (6, 6, 1 = 0 de daño: ¡pifia!). ataqueDelJugador tira solo el primer dado; los siguientes los
//   añade el combate (volverATirar) y tiradaDelJugador calcula el resultado con todos los dados.
//
//   ENEMIGOS Y SEGUIDORES (ataqueBasico): 1d6. Con 1-2 fallan. Con 3-5 hacen su ataque. Con un 6, su
//   ataque +1. Si "no pueden fallar" (tras una huida fallida), un 1-2 cuenta como golpe normal.
//
// BONIFICADORES Y HAMBRE: el dado decide si se acierta (el 1, el 6 que repite); después se suma el
// bonificador de combate (id de tirada "ataque": estoque +1, maleficio del pirata −1...) y se resta el
// castigo por hambre (castigoPorHambre). El daño nunca baja de 0. El hambre afecta al jugador y a sus
// seguidores, no a los enemigos.
// PIEL DE PIEDRA: la aplica quien RECIBE el golpe, con reducirDano.

/** Lo que ha pasado en un ataque. Son datos para enseñarlos: la interfaz pinta los dados y el "−2 por hambre". */
export interface TiradaDeAtaque {
  dados: number[];         // lo que ha salido, en orden (el jugador puede tirar varios: [6, 6, 3])
  acierta: boolean;        // false = ha fallado (un 1 del jugador, un 1-2 de enemigos y seguidores)
  danoSinCastigo: number;  // el daño de los dados, antes de bonificadores y hambre (0 si falla)
  bonificador: number;     // lo que suman (o restan) objetos y condiciones si acierta (0 si falla)
  castigoHambre: number;   // lo que se ha restado por hambre (0 si falla o si no hay hambre)
  dano: number;            // el daño final: danoSinCastigo + bonificador − castigoHambre, nunca menos de 0
}

/** Castigo al daño por los días sin comer: −1 por día, hasta AJUSTES.castigoHambreMaximo (3). */
export function castigoPorHambre(diasSinComer: number): number {
  return Math.min(Math.max(0, diasSinComer), AJUSTES.castigoHambreMaximo);
}

/**
 * Primer dado del ataque del jugador. Gasta UN número del generador (los seises que se arriesgan
 * los tira el combate, cuando el jugador lo decide).
 * castigo = castigoPorHambre(jugador.diasSinComer); bonificador = calcularModificador(jugador, 'ataque').
 */
export function ataqueDelJugador(castigo: number, dados: Dados, bonificador = 0): TiradaDeAtaque {
  return tiradaDelJugador([dados.tirar('1d6').total], castigo, bonificador);
}

/**
 * El ataque del jugador con los dados que lleva sacados: [6, 4] = 10; [6, 6, 1] = falla todo; [6] = 6
 * (se ha quedado con su 6). Solo calcula.
 */
export function tiradaDelJugador(caras: readonly number[], castigo: number, bonificador = 0): TiradaDeAtaque {
  if (caras.length === 0) {
    throw new Error('tiradaDelJugador: hace falta al menos un dado');
  }
  if (caras.includes(1)) {
    return resultado([...caras], false, 0, castigo);
  }
  return resultado([...caras], true, caras.reduce((suma, cara) => suma + cara, 0), castigo, bonificador);
}

/** ¿Puede arriesgarse a tirar otra vez? Solo si el último dado es un 6 (y, claro, no ha fallado). */
export function puedeVolverATirar(tirada: TiradaDeAtaque): boolean {
  return tirada.acierta && tirada.dados[tirada.dados.length - 1] === 6;
}

/**
 * Ataque de un enemigo o de un seguidor. Gasta exactamente un número del generador.
 * castigo: el hambre (solo seguidores; los enemigos, 0). noPuedeFallar: tras una huida fallida.
 * aciertaCon: el dado mínimo para acertar (3 normalmente; 5 el cangrejo gigante). Con un 6, siempre ataque +1.
 */
export function ataqueBasico(ataque: number, castigo: number, dados: Dados, noPuedeFallar = false, aciertaCon = 3): TiradaDeAtaque {
  const cara = dados.tirar('1d6').total;
  if (cara < aciertaCon && !noPuedeFallar) {
    return resultado([cara], false, 0, castigo);
  }
  return resultado([cara], true, cara === 6 ? ataque + 1 : ataque, castigo);
}

/**
 * Daño que recibe de verdad quien tiene una reducción (piel de piedra: 1).
 * Si el golpe no ha hecho nada, sigue en 0. Si ha hecho algo, resta la reducción pero deja al menos 1:
 * un golpe de 3 hace 2, y uno de 1 sigue haciendo 1.
 */
export function reducirDano(dano: number, reduccion: number): number {
  if (dano <= 0) {
    return 0;
  }
  return Math.max(1, dano - Math.max(0, reduccion));
}

function resultado(dados: number[], acierta: boolean, danoSinCastigo: number, castigo: number, bonificador = 0): TiradaDeAtaque {
  const castigoHambre = acierta ? castigo : 0;
  const extra = acierta ? bonificador : 0;
  return { dados, acierta, danoSinCastigo, bonificador: extra, castigoHambre, dano: Math.max(0, danoSinCastigo + extra - castigoHambre) };
}
