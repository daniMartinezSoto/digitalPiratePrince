import type { Barco } from '../catalogos/barco';
import { BARCOS } from '../catalogos/cargar-barcos';
import { cerrarCombate, iniciarCombate } from '../combate/combate';
import { hayCombate } from '../combate/hay-combate';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import { reduccionDanoNavalActual } from '../condiciones/consultas';
import type { Cambio } from '../efectos/cambio';
import type { CombateNavalEnCurso, ResultadoCombateNaval } from '../estado/combate-naval';
import type { Estado } from '../estado/estado';
import { calcularModificador, type CatalogosModificadores } from '../modificadores/calcular-modificador';
import { resolverEfecto } from '../tablas/rangos/resolver-tabla';

// EL COMBATE NAVAL (Sprint 7, diseño decidido por el autor el 19-nov; sección 3.13 del CLAUDE.md).
//
// DUELO DE CAÑONES. Cada ronda tiras 1d6 + tus bonificadores (tirada "disparo_naval") y el barco
// enemigo tira 1d6, sin bonificador:
//   - si sacas más, le quitas 1 de resistencia (a 0, lo hundes: victoria);
//   - si sacas menos, pierdes tanta tripulación como su daño (a 0, pierdes la partida: derrota);
//   - si empatáis, se vuelve a tirar en la misma ronda.
// HUIR: a partir de la segunda ronda, 1d6 + "huida_naval": con 3-6 huyes (y salta el daño en la
//   bodega, E006); con 1-2 no pasa nada, pero hay que disparar otra ronda antes de volver a probar.
// ABORDAR: cuando su resistencia ha bajado a la mitad (redondeando hacia arriba), empieza un combate
//   normal contra su tripulación (el "abordaje" de su ficha), sin poder huir. Ganarlo es victoria.
//
// Se gana hundiendo el barco o ganando el abordaje. Al terminar, cerrarCombateNaval cobra lo que
// toca y devuelve el RESUMEN para la pantalla de resultados.
//
// Orden de los dados (importa para la reproducibilidad): al empezar, el daño del barco si es con
// dados ("1d6"); en cada duelo, primero tu dado y después el suyo (y otra pareja por cada empate);
// al huir, un dado; al abordar, los del combate normal (cantidades y parejas); al cerrar, la
// recompensa y, si abordaste, el botín y después la tirada de tesoro (un número del 1 al 100).

/** Id del evento del tesoro (E036) y del daño en la bodega (E006): pendientes hasta que existan. */
export const EVENTO_TESORO = 'tesoro';
export const EVENTO_DANO_EN_LA_BODEGA = 'dano_en_la_bodega';

/** Huir sale bien con este número o más en 1d6 (decidido por el autor: 3-6). */
export const DADO_PARA_HUIR = 3;

// ---------------------------------------------------------------------------
// Empezar
// ---------------------------------------------------------------------------

/**
 * Empieza un combate naval contra el barco con ese id. Si su daño es con dados (el barco pirata,
 * "1d6"), lo tira ya, una sola vez para todo el combate.
 * No mira la fase del día, como el combate normal: un evento puede lanzarlo en cualquier momento.
 */
export function iniciarCombateNaval(estado: Estado, idBarco: string, dados: Dados, barcos: readonly Barco[] = BARCOS): Estado {
  if (estado.mundo.finPartida) {
    throw new Error('iniciarCombateNaval: la partida ya ha terminado');
  }
  if (hayCombate(estado)) {
    throw new Error('iniciarCombateNaval: ya hay un combate en curso');
  }
  const barco = fichaDelBarco(idBarco, barcos, 'iniciarCombateNaval');

  const dano = typeof barco.dano === 'string' ? dados.tirar(barco.dano).total : barco.dano;
  const combateNaval: CombateNavalEnCurso = {
    barco: barco.id,
    nombre: barco.nombre,
    dano,
    resistencia: barco.resistencia,
    resistenciaMaxima: barco.resistencia,
    ronda: 0,
    tripulacionPerdida: 0,
    acabasDeFallarLaHuida: false,
    abordaje: null,
    resultado: null,
  };
  return { ...estado, mundo: { ...estado.mundo, combateNaval, estadoDados: dados.obtenerEstado() } };
}

// ---------------------------------------------------------------------------
// Qué se puede hacer (los botones)
// ---------------------------------------------------------------------------

/** Por qué no se puede huir ahora. */
export type MotivoNoHuirNaval =
  | 'primera_ronda'       // hay que disparar al menos una ronda antes
  | 'acabas_de_fallar'    // ya lo intentaste: toca disparar otra ronda antes de volver a probar
  | 'abordaje_en_curso';  // se está peleando en la cubierta enemiga

/** Por qué no se puede abordar ahora. */
export type MotivoNoAbordar =
  | 'resistencia_alta'    // al barco le queda más de la mitad: "podrás abordar cuando le quede X"
  | 'abordaje_en_curso';

/** Lo que la interfaz necesita para pintar los botones del combate naval. */
export interface OpcionesDelCombateNaval {
  disparar: boolean;
  huir: { disponible: boolean; motivo?: MotivoNoHuirNaval };
  // resistenciaParaAbordar: se puede abordar cuando al barco le quede esto o menos.
  abordar: { disponible: boolean; motivo?: MotivoNoAbordar; resistenciaParaAbordar: number };
}

/** Resistencia a la que se puede abordar: la mitad de la máxima, redondeando hacia arriba (5 → 3, 4 → 2, 1 → 1). */
export function resistenciaParaAbordar(resistenciaMaxima: number): number {
  return Math.ceil(resistenciaMaxima / 2);
}

/** Solo consulta: qué se puede hacer ahora en el combate naval. Sin combate o ya terminado, nada. */
export function opcionesDeCombateNaval(estado: Estado): OpcionesDelCombateNaval {
  const combate = estado.mundo.combateNaval;
  if (!combate || combate.resultado || estado.mundo.finPartida) {
    return { disparar: false, huir: { disponible: false }, abordar: { disponible: false, resistenciaParaAbordar: 0 } };
  }
  const limite = resistenciaParaAbordar(combate.resistenciaMaxima);
  const noHuir = motivoParaNoHuir(combate);
  const noAbordar = motivoParaNoAbordar(combate);
  return {
    disparar: !combate.abordaje,
    huir: noHuir ? { disponible: false, motivo: noHuir } : { disponible: true },
    abordar: noAbordar ? { disponible: false, motivo: noAbordar, resistenciaParaAbordar: limite } : { disponible: true, resistenciaParaAbordar: limite },
  };
}

function motivoParaNoHuir(combate: CombateNavalEnCurso): MotivoNoHuirNaval | undefined {
  if (combate.abordaje) return 'abordaje_en_curso';
  if (combate.ronda === 0) return 'primera_ronda';
  if (combate.acabasDeFallarLaHuida) return 'acabas_de_fallar';
  return undefined;
}

function motivoParaNoAbordar(combate: CombateNavalEnCurso): MotivoNoAbordar | undefined {
  if (combate.abordaje) return 'abordaje_en_curso';
  if (combate.resistencia > resistenciaParaAbordar(combate.resistenciaMaxima)) return 'resistencia_alta';
  return undefined;
}

// ---------------------------------------------------------------------------
// Disparar
// ---------------------------------------------------------------------------

/** Una pareja de dados del duelo. total = tu dado + tu bonificador. */
export interface TiradaNaval {
  tuDado: number;
  bonificador: number;
  total: number;
  suDado: number;
}

/** Lo que pasó en una ronda de disparos. */
export interface Duelo {
  // Todas las parejas tiradas, en orden: las de los empates y la última, la que decide.
  tiradas: TiradaNaval[];
  // Quién ganó el duelo.
  ganador: 'jugador' | 'barco';
  // Resistencia que le has quitado al barco (1 si ganas, 0 si no).
  danoAlBarco: number;
  // Si pierdes: cuánto te ha ahorrado el casco reforzado (para enseñar "−1 casco reforzado"). 0 si nada.
  reduccionCasco: number;
  // Tripulación que has perdido de verdad (si te quedaban 3 y su daño es 5, pierdes 3).
  tripulacionPerdida: number;
}

/** Lo que devuelve disparar. */
export interface ResultadoDisparo {
  estado: Estado;
  duelo: Duelo;
  cambios: Cambio[];
}

/**
 * Juega una ronda: un duelo de cañones (con sus empates, que se repiten en la misma ronda).
 * catalogos: dónde buscar los bonificadores (por defecto, los del juego; los tests pueden pasar otros).
 */
export function disparar(estado: Estado, dados: Dados, catalogos?: CatalogosModificadores): ResultadoDisparo {
  const combate = comprobarCombateNavalAbierto(estado, 'disparar');
  if (combate.abordaje) {
    throw new Error('disparar: se está abordando el barco; primero hay que terminar el abordaje');
  }
  const bonificador = calcularModificador(estado.jugador, 'disparo_naval', catalogos);

  const tiradas: TiradaNaval[] = [];
  let tirada: TiradaNaval;
  do {
    const tuDado = dados.tirar('1d6').total;
    const suDado = dados.tirar('1d6').total;
    tirada = { tuDado, bonificador, total: tuDado + bonificador, suDado };
    tiradas.push(tirada);
  } while (tirada.total === tirada.suDado);

  // Tras disparar, se puede volver a intentar huir.
  const ronda = combate.ronda + 1;
  const base: CombateNavalEnCurso = { ...combate, ronda, acabasDeFallarLaHuida: false };

  // Ganas el duelo: el barco pierde 1 de resistencia.
  if (tirada.total > tirada.suDado) {
    const resistencia = combate.resistencia - 1;
    const nuevo: CombateNavalEnCurso = { ...base, resistencia, resultado: resistencia <= 0 ? 'victoria' : null };
    return {
      estado: conCombateNaval(estado, nuevo, dados),
      duelo: { tiradas, ganador: 'jugador', danoAlBarco: 1, reduccionCasco: 0, tripulacionPerdida: 0 },
      cambios: [],
    };
  }

  // Pierdes el duelo: pierdes tanta tripulación como su daño (la chalupa, con 0, no te quita nada).
  // El casco reforzado quita 1, pero si el barco hace daño, siempre pierdes al menos 1.
  const reduccion = reduccionDanoNavalActual(estado.jugador, catalogos?.condiciones);
  const dano = combate.dano > 0 ? Math.max(1, combate.dano - reduccion) : 0;
  const reduccionCasco = combate.dano - dano;
  const antes = estado.jugador.tripulacion;
  const aplicado = dano > 0 ? aplicarEfectos(estado, [{ tipo: 'tripulacion', cantidad: -dano }], dados) : { estado, cambios: [] };
  const perdida = antes - aplicado.estado.jugador.tripulacion;
  const nuevo: CombateNavalEnCurso = {
    ...base,
    tripulacionPerdida: combate.tripulacionPerdida + perdida,
    resultado: aplicado.estado.mundo.finPartida ? 'derrota' : null,
  };
  return {
    estado: conCombateNaval(aplicado.estado, nuevo, dados),
    duelo: { tiradas, ganador: 'barco', danoAlBarco: 0, reduccionCasco, tripulacionPerdida: perdida },
    cambios: aplicado.cambios,
  };
}

// ---------------------------------------------------------------------------
// Huir
// ---------------------------------------------------------------------------

/** Lo que devuelve huirDelCombateNaval. */
export interface ResultadoHuidaNaval {
  estado: Estado;
  dado: number;
  bonificador: number;
  total: number;
  huye: boolean;
}

/**
 * Intento de huida: 1d6 + "huida_naval"; con 3 o más, el combate termina en "huida" (al cerrarlo
 * salta el daño en la bodega). Si falla, no pasa nada más: hay que disparar otra ronda antes de
 * volver a intentarlo. Gasta un número del generador.
 */
export function huirDelCombateNaval(estado: Estado, dados: Dados, catalogos?: CatalogosModificadores): ResultadoHuidaNaval {
  const combate = comprobarCombateNavalAbierto(estado, 'huirDelCombateNaval');
  const motivo = motivoParaNoHuir(combate);
  if (motivo) {
    throw new Error(`huirDelCombateNaval: ahora no se puede huir (${motivo})`);
  }
  const bonificador = calcularModificador(estado.jugador, 'huida_naval', catalogos);
  const dado = dados.tirar('1d6').total;
  const total = dado + bonificador;
  const huye = total >= DADO_PARA_HUIR;
  const nuevo: CombateNavalEnCurso = huye ? { ...combate, resultado: 'huida' } : { ...combate, acabasDeFallarLaHuida: true };
  return { estado: conCombateNaval(estado, nuevo, dados), dado, bonificador, total, huye };
}

// ---------------------------------------------------------------------------
// Abordar
// ---------------------------------------------------------------------------

/**
 * Aborda el barco: empieza un combate normal (mundo.combate) contra su tripulación, sin poder huir.
 * El combate naval espera mientras tanto. Se pelea con atacar (core/combate/combate.ts) y, cuando
 * termine, cerrarCombateNaval cierra los dos.
 */
export function abordar(estado: Estado, dados: Dados, barcos: readonly Barco[] = BARCOS): Estado {
  const combate = comprobarCombateNavalAbierto(estado, 'abordar');
  const motivo = motivoParaNoAbordar(combate);
  if (motivo) {
    throw new Error(`abordar: ahora no se puede abordar (${motivo})`);
  }
  const barco = fichaDelBarco(combate.barco, barcos, 'abordar');

  const abordaje = {
    vida: estado.jugador.vida,
    seguidores: estado.jugador.seguidores.map(s => ({ id: s.id, nombre: s.nombre })),
  };
  const conAbordaje: Estado = { ...estado, mundo: { ...estado.mundo, combateNaval: { ...combate, abordaje } } };
  return iniciarCombate(conAbordaje, barco.abordaje, dados, { puedeHuir: false });
}

// ---------------------------------------------------------------------------
// Cerrar y resumen
// ---------------------------------------------------------------------------

/** Cómo se ganó: hundiendo el barco a cañonazos o ganando el abordaje. null si no se ganó. */
export type FormaDeVictoria = 'hundido' | 'abordado';

/** Lo que enseña la pantalla de resultados del combate naval. Ya contado: la interfaz solo lo pinta. */
export interface ResumenCombateNaval {
  barco: string;          // id de la ficha (para el dibujo)
  nombre: string;         // "Fragata de la marina"
  resultado: ResultadoCombateNaval;
  forma: FormaDeVictoria | null;
  tripulacionPerdida: number;
  // Lo que costó el abordaje (0 y [] si no hubo): vida del jugador y seguidores que cayeron.
  vidaPerdida: number;
  seguidoresCaidos: { id: string; nombre: string }[];
  // Lo ganado al cerrar (con su signo; incluye el 1d6 del contable si lo hay).
  oroGanado: number;
  famaGanada: number;
  comidaGanada: number;
  // Lo que pasa a continuación: cofre, tesoro, amuleto fantasmal, daño en la bodega...
  eventos: string[];
}

/** Lo que devuelve cerrarCombateNaval: el contrato del combate naval (sección 8) y el resumen para la pantalla. */
export interface CierreDeCombateNaval {
  estado: Estado;
  resultado: ResultadoCombateNaval;
  tripulacionPerdida: number;
  cambios: Cambio[];
  // Eventos que saltan ahora: pendientes hasta el motor de eventos.
  eventos: string[];
  resumen: ResumenCombateNaval;
}

/**
 * Recoge el resultado de un combate naval terminado y lo quita del estado (mundo.combateNaval vuelve a null).
 * Si se estaba abordando y el abordaje ha terminado, cierra también ese combate:
 * ganarlo es la victoria; caer en él, la derrota.
 *   - Victoria: la recompensa del barco y sus eventos; abordando, además, su botín y la tirada de tesoro.
 *   - Huida: el daño en la bodega (E006).
 *   - Partida perdida: ni recompensas ni eventos.
 */
export function cerrarCombateNaval(estado: Estado, dados: Dados, barcos: readonly Barco[] = BARCOS): CierreDeCombateNaval {
  const combate = estado.mundo.combateNaval;
  if (!combate) {
    throw new Error('cerrarCombateNaval: no hay ningún combate naval');
  }

  // 1. Si se estaba abordando, primero se cierra el combate de la cubierta.
  let actual = estado;
  let resultado = combate.resultado;
  const cambios: Cambio[] = [];
  const eventos: string[] = [];
  if (combate.abordaje && !resultado) {
    const abordaje = estado.mundo.combate;
    if (!abordaje?.resultado) {
      throw new Error('cerrarCombateNaval: el abordaje todavía no ha terminado');
    }
    const cierre = cerrarCombate(estado, dados);
    actual = cierre.estado;
    cambios.push(...cierre.cambios);
    eventos.push(...cierre.eventos);
    resultado = cierre.resultado === 'victoria' && !actual.mundo.finPartida ? 'victoria' : 'derrota';
  }
  if (!resultado) {
    throw new Error('cerrarCombateNaval: el combate naval todavía no ha terminado');
  }
  const forma: FormaDeVictoria | null = resultado === 'victoria' ? (combate.abordaje ? 'abordado' : 'hundido') : null;

  // 2. Lo que se gana (o se paga) al terminar.
  actual = { ...actual, mundo: { ...actual.mundo, combateNaval: null } };
  if (!actual.mundo.finPartida) {
    if (resultado === 'victoria') {
      const barco = fichaDelBarco(combate.barco, barcos, 'cerrarCombateNaval');
      const definiciones = [...(barco.recompensa ?? []), ...(forma === 'abordado' ? (barco.botinAbordaje?.efectos ?? []) : [])];
      const aplicado = aplicarEfectos(actual, definiciones.map(definicion => resolverEfecto(definicion, dados)), dados);
      actual = aplicado.estado;
      cambios.push(...aplicado.cambios);
      eventos.push(...(barco.eventosAlGanar ?? []));
      const probabilidadTesoro = forma === 'abordado' ? (barco.botinAbordaje?.probabilidadTesoro ?? 0) : 0;
      if (probabilidadTesoro > 0 && dados.entero(1, 100) <= probabilidadTesoro) {
        eventos.push(EVENTO_TESORO);
      }
    } else if (resultado === 'huida') {
      eventos.push(EVENTO_DANO_EN_LA_BODEGA);
    }
  }
  actual = { ...actual, mundo: { ...actual.mundo, estadoDados: dados.obtenerEstado() } };

  const resumen: ResumenCombateNaval = {
    barco: combate.barco,
    nombre: combate.nombre,
    resultado,
    forma,
    tripulacionPerdida: combate.tripulacionPerdida,
    vidaPerdida: combate.abordaje ? Math.max(0, combate.abordaje.vida - actual.jugador.vida) : 0,
    seguidoresCaidos: combate.abordaje ? combate.abordaje.seguidores.filter(s => !actual.jugador.seguidores.some(v => v.id === s.id)) : [],
    oroGanado: ganado(cambios, 'oro'),
    famaGanada: ganado(cambios, 'fama'),
    comidaGanada: ganado(cambios, 'comida'),
    eventos: [...eventos],
  };
  return { estado: actual, resultado, tripulacionPerdida: combate.tripulacionPerdida, cambios, eventos, resumen };
}

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

/** Suma lo que ha cambiado un recurso en la lista de cambios (después − antes). */
function ganado(cambios: readonly Cambio[], recurso: 'oro' | 'fama' | 'comida'): number {
  return cambios.reduce((total, c) => (c.tipo === 'recurso' && c.recurso === recurso ? total + c.despues - c.antes : total), 0);
}

function fichaDelBarco(id: string, barcos: readonly Barco[], funcion: string): Barco {
  const barco = barcos.find(b => b.id === id);
  if (!barco) {
    throw new Error(`${funcion}: no existe el barco "${id}"`);
  }
  return barco;
}

function comprobarCombateNavalAbierto(estado: Estado, funcion: string): CombateNavalEnCurso {
  const combate = estado.mundo.combateNaval;
  if (!combate) {
    throw new Error(`${funcion}: no hay ningún combate naval en curso`);
  }
  if (combate.resultado || estado.mundo.finPartida) {
    throw new Error(`${funcion}: el combate naval ya ha terminado`);
  }
  return combate;
}

function conCombateNaval(estado: Estado, combateNaval: CombateNavalEnCurso, dados: Dados): Estado {
  return { ...estado, mundo: { ...estado.mundo, combateNaval, estadoDados: dados.obtenerEstado() } };
}
