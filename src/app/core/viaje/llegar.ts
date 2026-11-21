import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Condicion, LugarDeLlegada } from '../catalogos/condicion';
import { famaObjetivoActual } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import { resolverEfecto } from '../tablas/rangos/resolver-tabla';
import type { Efecto } from '../tablas/efecto';
import type { Lugar, Rasgo } from '../turno/lugar';
import { esPuertoPrincipal, puertosPrincipalesDe, todosLosPuertosVisitados, type PuertoPrincipal } from './puertos-principales';

// LLEGAR A UN SITIO (tras el Sprint 8, para la pantalla de pruebas; lo usará viajar con el mapa).
// Lo que pasa al llegar, en este orden:
//   1. Las condiciones con "alLlegar" a este tipo de lugar se quitan (y dan sus efectos o su evento):
//      el escorbuto se cura al tocar tierra.
//   2. Si es uno de los puertos principales, queda apuntado en mundo.puertosVisitados.
//   3. VICTORIA (decidido por el autor el 20-nov): al llegar a CUALQUIER puerto con los 4 puertos
//      principales visitados y la fama objetivo actual, se gana la partida ("regreso triunfal").
// No toca el estado que recibe.

export interface Llegada {
  lugar: Lugar;
  rasgo?: Rasgo;
  // Si el puerto al que se llega es uno de los principales, su id ("tortuga").
  puertoPrincipal?: string;
}

export interface ResultadoLlegada {
  estado: Estado;
  cambios: Cambio[];
  eventos: string[];
  // true = era un puerto principal que aún no había visitado.
  puertoNuevo: boolean;
}

/** A qué "tipos de lugar" de alLlegar cuenta como llegar: a tierra, a un puerto, a una aldea, a un naufragio. */
export function lugaresDeLlegada(llegada: Llegada): LugarDeLlegada[] {
  const lugares: LugarDeLlegada[] = [];
  if (llegada.lugar !== 'barco') lugares.push('tierra');
  if (llegada.lugar === 'puerto') lugares.push('puerto');
  if (llegada.lugar === 'aldea') lugares.push('aldea');
  if (llegada.rasgo === 'naufragio') lugares.push('naufragio');
  return lugares;
}

export function llegar(
  estado: Estado,
  llegada: Llegada,
  dados: Dados,
  condiciones: readonly Condicion[] = CONDICIONES,
  puertos: readonly PuertoPrincipal[] = puertosPrincipalesDe(estado),
): ResultadoLlegada {
  if (llegada.puertoPrincipal !== undefined) {
    if (llegada.lugar !== 'puerto') {
      throw new Error(`llegar: "${llegada.puertoPrincipal}" es un puerto principal, pero se llega a "${llegada.lugar}"`);
    }
    if (!esPuertoPrincipal(llegada.puertoPrincipal, puertos)) {
      throw new Error(`llegar: "${llegada.puertoPrincipal}" no es un puerto principal`);
    }
  }

  // 1. Condiciones que terminan al llegar.
  const lugares = lugaresDeLlegada(llegada);
  const efectos: Efecto[] = [];
  const eventos: string[] = [];
  for (const activa of estado.jugador.condiciones) {
    const alLlegar = condiciones.find(c => c.id === activa.id)?.alLlegar;
    if (alLlegar && lugares.includes(alLlegar.lugar)) {
      efectos.push({ tipo: 'quitar_condicion', condicion: activa.id });
      efectos.push(...(alLlegar.efectos ?? []).map(e => resolverEfecto(e, dados)));
      if (alLlegar.evento) eventos.push(alLlegar.evento);
    }
  }
  const tras = efectos.length > 0 ? aplicarEfectos(estado, efectos, dados, { objetos: OBJETOS, condiciones }) : { estado, cambios: [] };
  let actual = tras.estado;
  const cambios = [...tras.cambios];

  // 2. Puerto principal nuevo.
  const puerto = llegada.puertoPrincipal;
  const puertoNuevo = puerto !== undefined && !actual.mundo.puertosVisitados.includes(puerto);
  if (puertoNuevo) {
    actual = { ...actual, mundo: { ...actual.mundo, puertosVisitados: [...actual.mundo.puertosVisitados, puerto] } };
  }

  // 3. ¿Regreso triunfal?
  if (
    !actual.mundo.finPartida &&
    llegada.lugar === 'puerto' &&
    todosLosPuertosVisitados(actual, puertos) &&
    actual.jugador.fama >= famaObjetivoActual(actual.jugador, condiciones)
  ) {
    const victoria = aplicarEfectos(actual, [{ tipo: 'victoria_normal' }], dados, { objetos: OBJETOS, condiciones });
    actual = victoria.estado;
    cambios.push(...victoria.cambios);
  }

  return { estado: actual, cambios, eventos, puertoNuevo };
}
