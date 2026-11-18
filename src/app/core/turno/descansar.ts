import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Condicion } from '../catalogos/condicion';
import type { Objeto } from '../catalogos/objeto';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import type { Efecto } from '../tablas/efecto';
import { obtenerListaEventos } from '../tablas/listas-eventos/cargar-listas-eventos';
import { eventoAleatorio } from '../tablas/listas-eventos/elegir-evento';
import type { ListaEventos } from '../tablas/listas-eventos/lista-eventos';
import { esPuerto, type Lugar } from './lugar';

/** Catálogos y listas que usa el descanso. Por defecto, los del juego; los tests pueden pasar otros. */
export interface CatalogosDescanso {
  objetos: readonly Objeto[];
  condiciones: readonly Condicion[];
  eventosNocturnos: ListaEventos;
}

const CATALOGOS_DEL_JUEGO: CatalogosDescanso = {
  objetos: OBJETOS,
  condiciones: CONDICIONES,
  eventosNocturnos: obtenerListaEventos('nocturnos'),
};

// Dónde pasa la noche el jugador:
//   a_bordo:     en el barco. Gratis. Si duerme genial, cura 1 PV al jugador y a sus seguidores.
//   techo_solo:  paga su cama (posada en un puerto, celda en un monasterio). Si duerme genial, cura 1 PV solo al jugador.
//   techo_todos: paga su cama y la de cada seguidor. Si duermen genial, cura 1 PV a todos.
//   intemperie:  al raso. Gratis. No cura nunca. Fuera de los puertos puede haber un evento nocturno.
// "Dormir genial" no es seguro: pasa con AJUSTES.probabilidadDormirGenial (una tirada para todo el grupo).
// Para curarse seguro está la ACCIÓN "Reposar" (core/acciones/reposar.ts), que gasta el día.
export const ELECCIONES_DE_DESCANSO = ['a_bordo', 'techo_solo', 'techo_todos', 'intemperie'] as const;
export type EleccionDeDescanso = (typeof ELECCIONES_DE_DESCANSO)[number];

/** Una opción que la interfaz enseña en la fase de descanso. */
export interface OpcionDeDescanso {
  eleccion: EleccionDeDescanso;
  precio: number;        // oro que cuesta (0 = gratis)
  alcanzaElOro: boolean; // false = el botón sale, pero no se puede pulsar
}

/** Lo que devuelve descansar. Son datos, no mensajes: la interfaz decide cómo contarlo. */
export interface ResultadoDescanso {
  estado: Estado;
  cambios: Cambio[];  // cambios reales (oro pagado, vida curada...)
  // true = "Has dormido genial (+1 PV)"; false = noche normal, sin curar.
  // No aparece si ha dormido a la intemperie (ahí no se tira: nunca se duerme genial).
  haDormidoGenial?: boolean;
  eventos: string[];  // id del evento nocturno, si ha saltado alguno
}

/**
 * Solo consulta: dónde puede dormir el jugador estando en ese lugar, y cuánto cuesta.
 *   barco:               a bordo.
 *   puerto (o guarida pirata) y monasterio: bajo techo solo él, bajo techo todos (si tiene seguidores) o a la intemperie.
 *   Con la noche ya pagada (mundo.nochePagada: descansar en el monasterio, o la fiesta de una aldea),
 *     en el monasterio o la aldea solo hay una opción: "techo_todos", gratis (todo el grupo duerme allí).
 *   aldea e intemperie:  a la intemperie. (Convencer a los aldeanos: Sprint 6, con su tabla.)
 */
export function opcionesDeDescanso(estado: Estado, lugar: Lugar): OpcionDeDescanso[] {
  const oro = estado.jugador.oro;
  const opcion = (eleccion: EleccionDeDescanso, precio: number): OpcionDeDescanso => ({ eleccion, precio, alcanzaElOro: oro >= precio });

  if (lugar === 'barco') {
    return [opcion('a_bordo', 0)];
  }

  if ((lugar === 'monasterio' || lugar === 'aldea') && estado.mundo.nochePagada) {
    return [opcion('techo_todos', 0)];
  }

  const opciones: OpcionDeDescanso[] = [];
  if (esPuerto(lugar) || lugar === 'monasterio') {
    const porPersonaje = esPuerto(lugar) ? AJUSTES.precioPosada : AJUSTES.precioMonasterio;
    const personajes = 1 + estado.jugador.seguidores.length;
    opciones.push(opcion('techo_solo', porPersonaje));
    if (personajes > 1) {
      opciones.push(opcion('techo_todos', porPersonaje * personajes));
    }
  }
  opciones.push(opcion('intemperie', 0));
  return opciones;
}

/**
 * FASE DE DESCANSO. Solo se puede llamar con la partida en la fase "descanso".
 *
 * 1. Cobra según la elección (ver ELECCIONES_DE_DESCANSO). La elección tiene que ser
 *    una de las de opcionesDeDescanso y, si cuesta oro, tiene que llegar (si no, error:
 *    la interfaz no debe dejar pulsar el botón).
 *    A bordo o bajo techo: tira si duerme genial (AJUSTES.probabilidadDormirGenial); solo entonces cura 1 PV.
 * 2. A la intemperie, salvo en un puerto: puede saltar un evento nocturno
 *    (AJUSTES.probabilidadEventoNocturno), elegido de la lista de eventos nocturnos.
 *    Se devuelve como evento pendiente.
 * 3. SE ACABA EL DÍA: el día sube en 1, la partida vuelve a la fase "inicio" y se olvidan la noche
 *    pagada y la comida gratis (mundo.nochePagada, mundo.comidaGratis).
 *
 * NO toca el estado que recibe: devuelve uno nuevo.
 * Dados: a bordo o bajo techo, 1 número (dormir genial). A la intemperie fuera de un puerto,
 * 1 número si no pasa nada y 2 si hay evento. A la intemperie en un puerto, ninguno.
 */
export function descansar(
  estado: Estado,
  eleccion: EleccionDeDescanso,
  lugar: Lugar,
  dados: Dados,
  catalogos: CatalogosDescanso = CATALOGOS_DEL_JUEGO,
): ResultadoDescanso {
  if (estado.mundo.finPartida) {
    throw new Error('descansar: la partida ya ha terminado');
  }
  if (estado.mundo.fase !== 'descanso') {
    throw new Error(`descansar: solo se puede descansar en la fase "descanso" (la partida está en "${estado.mundo.fase}")`);
  }

  const opcion = opcionesDeDescanso(estado, lugar).find(o => o.eleccion === eleccion);
  if (!opcion) {
    throw new Error(`descansar: en "${lugar}" no se puede elegir "${eleccion}"`);
  }
  if (!opcion.alcanzaElOro) {
    throw new Error(`descansar: "${eleccion}" cuesta ${opcion.precio} de oro y el jugador solo tiene ${estado.jugador.oro}`);
  }

  // 1. Cobrar y, si duerme genial, curar.
  const efectos: Efecto[] = [];
  if (opcion.precio > 0) {
    efectos.push({ tipo: 'oro', cantidad: -opcion.precio });
  }
  let haDormidoGenial: boolean | undefined;
  if (eleccion !== 'intemperie') {
    haDormidoGenial = dados.probabilidad(AJUSTES.probabilidadDormirGenial / 100);
    if (haDormidoGenial) {
      efectos.push(eleccion === 'techo_solo' ? { tipo: 'vida', cantidad: 1 } : { tipo: 'vida', cantidad: 1, destino: 'todos' });
    }
  }
  const resultado = aplicarEfectos(estado, efectos, dados, catalogos);

  // 2. ¿Evento nocturno?
  const eventos: string[] = [];
  if (eleccion === 'intemperie' && !esPuerto(lugar)) {
    const evento = eventoAleatorio(catalogos.eventosNocturnos, AJUSTES.probabilidadEventoNocturno, dados);
    if (evento !== null) {
      eventos.push(evento);
    }
  }

  // 3. Se acaba el día.
  const nuevo: Estado = {
    ...resultado.estado,
    mundo: {
      ...resultado.estado.mundo,
      dia: resultado.estado.mundo.dia + 1,
      fase: 'inicio',
      nochePagada: false,
      comidaGratis: false,
      estadoDados: dados.obtenerEstado(),
    },
  };

  return haDormidoGenial === undefined
    ? { estado: nuevo, cambios: resultado.cambios, eventos }
    : { estado: nuevo, cambios: resultado.cambios, haDormidoGenial, eventos };
}
