import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import { comidaPorDia } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import { aplicarEfectos, type CatalogosEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import type { Efecto } from '../tablas/efecto';
import { tieneVinculoNativo } from '../personaje/vinculo-nativo';
import type { Jugador } from '../estado/jugador';
import { esPuerto, type Lugar } from './lugar';
import { hayCombate } from '../combate/hay-combate';

const CATALOGOS_DEL_JUEGO: CatalogosEfectos = { objetos: OBJETOS, condiciones: CONDICIONES };

// Id de la condición que se ve (con su icono) mientras el jugador pasa hambre.
export const CONDICION_HAMBRE = 'hambre';

// Lo que elige el jugador en la fase de comida:
//   reservas: gastar sus reservas de comida.
//   pagar:    pagar con oro. En un puerto es "comer en la taberna"; en una aldea, "intercambiar oro por comida".
//   invitado: hoy le invitan (fiesta de bienvenida en una aldea: mundo.comidaGratis). No gasta nada.
export const ELECCIONES_DE_COMIDA = ['reservas', 'pagar', 'invitado'] as const;
export type EleccionDeComida = (typeof ELECCIONES_DE_COMIDA)[number];

/** Lo que la interfaz necesita para pintar la fase de comida (qué botones hay y cuáles se pueden pulsar). */
export interface OpcionesDeComida {
  necesarias: number;         // reservas que hacen falta hoy (1; con hambre insaciable, 2)
  reservas: number;           // reservas que tiene el jugador
  alcanzanLasReservas: boolean;
  // null = aquí no se puede pagar con oro. Si se puede: cuánto cuesta hoy y si al jugador le llega.
  // Si se puede pagar pero no le llega el oro, el botón sale, pero no se puede pulsar.
  pago: { precio: number; alcanzaElOro: boolean } | null;
  // true = hoy le invitan a comer (mundo.comidaGratis): sale el botón "invitado".
  invitado: boolean;
}

/** Lo que devuelve comer. Son datos, no mensajes: la interfaz decide cómo contarlo. */
export interface ResultadoComida {
  estado: Estado;
  haComido: boolean;       // false = hoy ha pasado hambre
  cambios: Cambio[];       // cambios reales (comida, oro, vida, seguidores que se marchan...)
  tiradaDeMuerte?: number; // el 1d6 que se tira si el hambre le dejaría sin vida (con 1, muere)
  eventos: string[];       // ids de eventos pendientes ("motin")
}

/** Solo consulta: qué puede hacer el jugador en la fase de comida estando en ese lugar. */
export function opcionesDeComida(estado: Estado, lugar: Lugar, catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO): OpcionesDeComida {
  const necesarias = comidaPorDia(estado.jugador, catalogos.condiciones);
  const precio = necesarias * AJUSTES.precioTaberna;
  return {
    necesarias,
    reservas: estado.jugador.comida,
    alcanzanLasReservas: estado.jugador.comida >= necesarias,
    pago: sePuedePagarConOro(estado.jugador, lugar) ? { precio, alcanzaElOro: estado.jugador.oro >= precio } : null,
    invitado: estado.mundo.comidaGratis,
  };
}

/**
 * ¿Aquí se puede comer pagando con oro en vez de gastar reservas?
 *   puerto (o guarida pirata): siempre (la taberna).
 *   aldea:  los nativos no aceptan monedas, salvo que el jugador tenga vínculo nativo
 *           (sobrenombre "el nativo", amuleto kalinago o un seguidor nativo).
 *   resto:  no.
 */
export function sePuedePagarConOro(jugador: Jugador, lugar: Lugar): boolean {
  return esPuerto(lugar) || (lugar === 'aldea' && tieneVinculoNativo(jugador));
}

/**
 * FASE DE COMIDA. Solo se puede llamar con la partida en la fase "comida". Comer es obligatorio.
 *
 *   "reservas": gasta las reservas que hacen falta hoy. Si no llegan, gasta las que haya y pasa hambre.
 *   "invitado": hoy le invitan (mundo.comidaGratis): come todo el grupo sin gastar nada. Si hoy no
 *               le invitan, error.
 *   "pagar":    paga AJUSTES.precioTaberna de oro por cada reserva que haría falta. Solo donde se
 *               puede (ver sePuedePagarConOro) y si llega el oro (si no, error: la interfaz no debe
 *               dejar pulsar el botón).
 *
 * Si ha comido del todo: los días sin comer vuelven a 0 y se quita la condición "hambre".
 * Si no, HAMBRE:
 *   - sube "diasSinComer" y se pone la condición "hambre";
 *   - pierde tantos PV como días lleva sin comer (1, 2, 3...). Si eso le dejaría sin vida:
 *     1d6, con 1 muere; con 2 o más se queda con 1 PV;
 *   - cada seguidor que no sea inseparable se marcha con probabilidad 10 + 10 x días % (tope 100);
 *   - con esa misma probabilidad hay motín (se devuelve como evento pendiente).
 * Después, la partida pasa a la fase "descanso".
 *
 * NO toca el estado que recibe: devuelve uno nuevo.
 * Orden en que se gastan los dados (no cambiarlo): la tirada de muerte (si toca),
 * una probabilidad por cada seguidor no inseparable, en orden, y la del motín.
 */
export function comer(
  estado: Estado,
  eleccion: EleccionDeComida,
  lugar: Lugar,
  dados: Dados,
  catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO,
): ResultadoComida {
  if (estado.mundo.finPartida) {
    throw new Error('comer: la partida ya ha terminado');
  }
  if (hayCombate(estado)) {
    throw new Error('comer: hay un combate en curso; primero hay que terminarlo');
  }
  if (estado.mundo.fase !== 'comida') {
    throw new Error(`comer: solo se puede comer en la fase "comida" (la partida está en "${estado.mundo.fase}")`);
  }

  const opciones = opcionesDeComida(estado, lugar, catalogos);
  const teniaHambre = estado.jugador.condiciones.some(c => c.id === CONDICION_HAMBRE);
  const efectos: Efecto[] = [];
  let haComido: boolean;

  // 1. Pagar la comida.
  if (eleccion === 'invitado') {
    if (!opciones.invitado) {
      throw new Error('comer: hoy no le invitan a comer');
    }
    haComido = true;
  } else if (eleccion === 'pagar') {
    if (!opciones.pago) {
      throw new Error(`comer: en "${lugar}" no se puede pagar la comida con oro`);
    }
    if (!opciones.pago.alcanzaElOro) {
      throw new Error(`comer: la comida cuesta ${opciones.pago.precio} de oro y el jugador solo tiene ${estado.jugador.oro}`);
    }
    efectos.push({ tipo: 'oro', cantidad: -opciones.pago.precio });
    haComido = true;
  } else {
    const gastadas = Math.min(opciones.reservas, opciones.necesarias);
    if (gastadas > 0) {
      efectos.push({ tipo: 'comida', cantidad: -gastadas });
    }
    haComido = opciones.alcanzanLasReservas;
  }

  // 2. Ha comido: se acabó el hambre.
  if (haComido) {
    if (teniaHambre) {
      efectos.push({ tipo: 'quitar_condicion', condicion: CONDICION_HAMBRE });
    }
    const resultado = aplicarEfectos(conDiasSinComer(estado, 0), efectos, dados, catalogos);
    return { estado: cerrarFase(resultado.estado, dados), haComido, cambios: resultado.cambios, eventos: [] };
  }

  // 3. No ha comido lo suficiente: hambre.
  const dias = estado.jugador.diasSinComer + 1;
  if (!teniaHambre) {
    efectos.push({ tipo: 'poner_condicion', condicion: CONDICION_HAMBRE });
  }

  // Pierde tantos PV como días lleva. Si eso le dejaría sin vida, se la juega a un dado.
  let tiradaDeMuerte: number | undefined;
  if (estado.jugador.vida - dias > 0) {
    efectos.push({ tipo: 'vida', cantidad: -dias });
  } else {
    tiradaDeMuerte = dados.tirar('1d6').total;
    efectos.push(tiradaDeMuerte === 1 ? { tipo: 'vida', operacion: 'todo' } : { tipo: 'vida', operacion: 'fijar', cantidad: 1 });
  }

  const resultado = aplicarEfectos(conDiasSinComer(estado, dias), efectos, dados, catalogos);
  let actual = resultado.estado;
  const cambios = resultado.cambios;
  const eventos: string[] = [];

  if (!actual.mundo.finPartida) {
    const probabilidad = Math.min(100, 10 + 10 * dias) / 100;

    // Cada seguidor decide si se marcha (los inseparables ni se lo plantean).
    const seQuedan = actual.jugador.seguidores.filter(seguidor => {
      if (seguidor.inseparable || !dados.probabilidad(probabilidad)) {
        return true;
      }
      cambios.push({ tipo: 'seguidor_se_marcha', seguidor: seguidor.id });
      return false;
    });
    actual = { ...actual, jugador: { ...actual.jugador, seguidores: seQuedan } };

    // La tripulación también puede hartarse.
    if (dados.probabilidad(probabilidad)) {
      eventos.push('motin');
    }
  }

  const final: ResultadoComida = { estado: cerrarFase(actual, dados), haComido, cambios, eventos };
  if (tiradaDeMuerte !== undefined) {
    final.tiradaDeMuerte = tiradaDeMuerte;
  }
  return final;
}

function conDiasSinComer(estado: Estado, dias: number): Estado {
  return { ...estado, jugador: { ...estado.jugador, diasSinComer: dias } };
}

/** Pasa al descanso (si la partida no ha terminado) y apunta por dónde van los dados. */
function cerrarFase(estado: Estado, dados: Dados): Estado {
  return {
    ...estado,
    mundo: {
      ...estado.mundo,
      fase: estado.mundo.finPartida ? estado.mundo.fase : 'descanso',
      estadoDados: dados.obtenerEstado(),
    },
  };
}
