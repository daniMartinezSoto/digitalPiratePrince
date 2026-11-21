import { casillaActual } from '../mapa/donde-estas';
import { echarAVecinaAlAzar } from '../viaje/mover';
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
import { chequeo, type ResultadoChequeo } from '../chequeos/chequeo';
import { conMarca, hayMarca } from '../estado/marcas';
import { tieneVinculoNativo } from '../personaje/vinculo-nativo';
import { esPuerto, TERRENO_POR_DEFECTO, type Lugar, type TerrenoAlRaso } from './lugar';
import { hayCombate } from '../combate/hay-combate';

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
//   intemperie:  al raso. Gratis. No cura nunca. Fuera de los puertos puede haber un evento nocturno
//               (AJUSTES.probabilidadEventoNocturno, según el terreno).
//   tienda:      al raso, en la tienda de campaña (hay que llevarla; no en puertos ni a bordo). Gratis.
//               Todo el grupo duerme bajo techo (puede dormir genial) y la probabilidad de evento
//               nocturno baja AJUSTES.reduccionEventoNocturnoTienda puntos.
//   convencer_nativos: solo en una aldea. Chequeo de Ingenio para que los nativos os dejen dormir allí
//               SOLO esta noche. Si lo supera: como bajo techo (todo el grupo, gratis, puede dormir genial,
//               sin eventos). Si falla: le echan (marca "echado_de_la_aldea": no puede volver a intentarlo
//               en esa aldea) y duerme a la intemperie, con su posible evento nocturno.
// "Dormir genial" no es seguro: pasa con AJUSTES.probabilidadDormirGenial (una tirada para todo el grupo).
// Para curarse seguro está la ACCIÓN "Reposar" (core/acciones/reposar.ts), que gasta el día.
export const ELECCIONES_DE_DESCANSO = ['a_bordo', 'techo_solo', 'techo_todos', 'intemperie', 'tienda', 'convencer_nativos'] as const;

/** Id del objeto que permite dormir en tienda de campaña. */
export const ID_TIENDA_DE_CAMPANA = 'tienda_de_campana';
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
  // Solo al intentar convencer a los nativos: el chequeo de Ingenio y si le han echado.
  chequeo?: ResultadoChequeo;
  echado?: boolean;
  // Si le echaron: la casilla vecina donde ha acabado (Sprint 9).
  expulsadoA?: { col: number; fila: number };
}

/**
 * Solo consulta: dónde puede dormir el jugador estando en ese lugar, y cuánto cuesta.
 *   barco:               a bordo.
 *   puerto (o guarida pirata) y monasterio: bajo techo solo él, bajo techo todos (si tiene seguidores) o a la intemperie.
 *   Con la noche ya pagada (mundo.nochePagada: descansar en el monasterio, o la fiesta de una aldea),
 *     en el monasterio o la aldea solo hay una opción: "techo_todos", gratis (todo el grupo duerme allí).
 *   aldea:               a la intemperie, y además (si no le han echado de esta aldea; "hex" es la casilla):
 *                        con vínculo nativo, dormir en la aldea ("techo_todos", gratis, sin chequeo);
 *                        sin él, intentar convencer a los nativos (chequeo de Ingenio).
 *   intemperie:          a la intemperie.
 * Además, fuera de los puertos y del barco, si lleva la tienda de campaña: dormir en la tienda.
 */
export function opcionesDeDescanso(estado: Estado, lugar: Lugar, hex?: { col: number; fila: number }): OpcionDeDescanso[] {
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
  if (!esPuerto(lugar) && estado.jugador.inventario.some(o => o.id === ID_TIENDA_DE_CAMPANA)) {
    opciones.push(opcion('tienda', 0));
  }
  if (lugar === 'aldea' && !hayMarca(estado, 'echado_de_la_aldea', hex) && !hayMarca(estado, 'audiencia_vetada', hex)) {
    // Con vínculo nativo, los nativos os acogen sin más: dormir en la aldea, gratis y sin chequeo.
    // Sin él, hay que convencerlos (chequeo de Ingenio).
    opciones.push(tieneVinculoNativo(estado.jugador) ? opcion('techo_todos', 0) : opcion('convencer_nativos', 0));
  }
  return opciones;
}

/**
 * FASE DE DESCANSO. Solo se puede llamar con la partida en la fase "descanso".
 *
 * 1. Cobra según la elección (ver ELECCIONES_DE_DESCANSO). La elección tiene que ser
 *    una de las de opcionesDeDescanso y, si cuesta oro, tiene que llegar (si no, error:
 *    la interfaz no debe dejar pulsar el botón).
 *    A bordo o bajo techo: tira si duerme genial (AJUSTES.probabilidadDormirGenial); solo entonces cura 1 PV.
 * 2. Al raso (a la intemperie o en la tienda), salvo en un puerto: puede saltar un evento nocturno
 *    (AJUSTES.probabilidadEventoNocturno del terreno; en la tienda, menos), elegido de la lista de
 *    eventos nocturnos. Se devuelve como evento pendiente. "terreno" lo dirá el mapa; sin él, jungla.
 * 3. SE ACABA EL DÍA: el día sube en 1, la partida vuelve a la fase "inicio" y se olvidan la noche
 *    pagada y la comida gratis (mundo.nochePagada, mundo.comidaGratis).
 *
 * NO toca el estado que recibe: devuelve uno nuevo.
 * Dados: convencer a los nativos, primero 1 número (el chequeo) y luego como bajo techo o a la intemperie.
 * A bordo o bajo techo, 1 número (dormir genial). A la intemperie fuera de un puerto,
 * 1 número si no pasa nada y 2 si hay evento. A la intemperie en un puerto, ninguno.
 * En la tienda: primero el de dormir genial y después los del evento nocturno.
 */
export function descansar(
  estado: Estado,
  eleccion: EleccionDeDescanso,
  lugar: Lugar,
  dados: Dados,
  catalogos: CatalogosDescanso = CATALOGOS_DEL_JUEGO,
  hex?: { col: number; fila: number },
  terreno: TerrenoAlRaso = TERRENO_POR_DEFECTO,
): ResultadoDescanso {
  if (estado.mundo.finPartida) {
    throw new Error('descansar: la partida ya ha terminado');
  }
  if (hayCombate(estado)) {
    throw new Error('descansar: hay un combate en curso; primero hay que terminarlo');
  }
  if (estado.mundo.fase !== 'descanso') {
    throw new Error(`descansar: solo se puede descansar en la fase "descanso" (la partida está en "${estado.mundo.fase}")`);
  }

  const opcion = opcionesDeDescanso(estado, lugar, hex).find(o => o.eleccion === eleccion);
  if (!opcion) {
    throw new Error(`descansar: en "${lugar}" no se puede elegir "${eleccion}"`);
  }
  if (!opcion.alcanzaElOro) {
    throw new Error(`descansar: "${eleccion}" cuesta ${opcion.precio} de oro y el jugador solo tiene ${estado.jugador.oro}`);
  }

  // 0. Convencer a los nativos: un chequeo de Ingenio decide si duermen bajo techo o al raso.
  let chequeoNativos: ResultadoChequeo | undefined;
  let duermeAlRaso = eleccion === 'intemperie';
  if (eleccion === 'convencer_nativos') {
    chequeoNativos = chequeo(estado.jugador, 'ingenio', 0, dados);
    duermeAlRaso = !chequeoNativos.superado;
  }

  // 1. Cobrar y, si duerme genial, curar.
  const efectos: Efecto[] = [];
  if (opcion.precio > 0) {
    efectos.push({ tipo: 'oro', cantidad: -opcion.precio });
  }
  let haDormidoGenial: boolean | undefined;
  if (!duermeAlRaso) {
    haDormidoGenial = dados.probabilidad(AJUSTES.probabilidadDormirGenial / 100);
    if (haDormidoGenial) {
      efectos.push(eleccion === 'techo_solo' ? { tipo: 'vida', cantidad: 1 } : { tipo: 'vida', cantidad: 1, destino: 'todos' });
    }
  }
  const resultado = aplicarEfectos(estado, efectos, dados, catalogos);
  const echado = chequeoNativos !== undefined && !chequeoNativos.superado;
  let trasLaNoche = echado ? conMarca(resultado.estado, 'echado_de_la_aldea', hex) : resultado.estado;
  const cambios = [...resultado.cambios];

  // 1b. Si le echan de la aldea (Sprint 9): la aldea queda bloqueada y aparece en una casilla de
  //     tierra vecina al azar (1 número si hay varias), donde duerme al raso (con su terreno).
  let expulsadoA: { col: number; fila: number } | undefined;
  if (echado) {
    const fuera = echarAVecinaAlAzar(trasLaNoche, dados);
    if (fuera.destino) {
      expulsadoA = fuera.destino;
      trasLaNoche = fuera.estado;
      cambios.push(...fuera.cambios);
      const nuevoTerreno = casillaActual(trasLaNoche).terreno;
      if (nuevoTerreno === 'playa' || nuevoTerreno === 'jungla' || nuevoTerreno === 'jungla_profunda') terreno = nuevoTerreno;
    }
  }

  // 2. ¿Evento nocturno?
  const eventos: string[] = [];
  if ((duermeAlRaso || eleccion === 'tienda') && !esPuerto(lugar)) {
    const reduccion = eleccion === 'tienda' ? AJUSTES.reduccionEventoNocturnoTienda : 0;
    const probabilidad = Math.max(0, AJUSTES.probabilidadEventoNocturno[terreno] - reduccion);
    const evento = eventoAleatorio(catalogos.eventosNocturnos, probabilidad, dados);
    if (evento !== null) {
      eventos.push(evento);
    }
  }

  // 3. Se acaba el día.
  const nuevo: Estado = {
    ...trasLaNoche,
    mundo: {
      ...trasLaNoche.mundo,
      dia: trasLaNoche.mundo.dia + 1,
      fase: 'inicio',
      nochePagada: false,
      comidaGratis: false,
      estadoDados: dados.obtenerEstado(),
    },
  };

  return {
    estado: nuevo,
    cambios,
    ...(haDormidoGenial === undefined ? {} : { haDormidoGenial }),
    eventos,
    ...(chequeoNativos ? { chequeo: chequeoNativos, echado } : {}),
    ...(expulsadoA ? { expulsadoA } : {}),
  };
}
