import { cerrarCombate, iniciarCombate } from '../combate/combate';
import { cerrarCombateNaval, iniciarCombateNaval } from '../combate-naval/combate-naval';
import { chequeo } from '../chequeos/chequeo';
import { estaProhibido } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import { rangoDeTirada } from '../dados/tirada';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { ResultadoCombate } from '../estado/combate';
import type { Estado } from '../estado/estado';
import type { Lectura, MarcoEvento, Siguiente } from '../estado/pila-eventos';
import { resolverEfecto } from '../tablas/rangos/resolver-tabla';
import type { EfectoDefinicion } from '../tablas/efecto';
import { grupoLleno } from '../seguidores/consultas';
import { EVENTOS } from './cargar-eventos';
import { PASO_INICIAL, type Evento, type FilaDeEvento, type Opcion, type Paso, type Rama } from './evento';

// EL MOTOR DE EVENTOS (Sprint 10, paso 2). Solo reglas: no sabe nada de la pantalla.
//
// Cómo funciona, en pocas palabras:
//   1. Alguien lanza uno o varios eventos (lanzarEventos): se meten en la pila del estado.
//   2. La pantalla pregunta qué enseñar (vistaDelEvento): título, texto, lo que ha cambiado y los
//      botones (opciones, "Tirar dados", "Hacer el chequeo", "Luchar" o "Continuar").
//   3. Cada botón es una función de aquí (elegirOpcion, tirarDadosDelEvento, hacerChequeo,
//      empezarCombateDelEvento, continuarEvento...). Todas devuelven el estado nuevo; nunca tocan
//      el que reciben.
//   4. Después de cada botón, el motor avanza solo todo lo que no necesita al jugador (pasos sin
//      nada que leer, saltos a otros eventos...) y se para en cuanto hay algo que leer o decidir.
//   5. Cuando la pila se vacía, se acabaron los eventos ("terminado").
//
// Regla de oro (decidida por el autor el 21-nov): el jugador SIEMPRE ve qué ha pasado antes de
// que el juego le lleve a otro sitio. Por eso, si hay algo que leer, se espera a "Continuar".
//
// Eventos que todavía no existen: no rompen nada. Se saltan como si hubieran terminado en el acto
// y se devuelven en "pendientes" para que la pantalla apunte "Evento: X (pendiente)".
//
// Qué NO hace todavía (pasos siguientes): enganchar con las acciones, el viaje, la noche, etc. (paso 4);
// mientras haya un evento, impedir todo lo demás (paso 4); la pantalla (paso 5).

/** Más eventos encadenados que esto es casi seguro un bucle mal escrito. */
export const PROFUNDIDAD_MAXIMA = 20;

/** Más pasos automáticos seguidos que esto es un bucle (p. ej. dos pasos que se mandan entre sí sin texto). */
const PASOS_AUTOMATICOS_MAXIMOS = 500;

/** El objeto que evita un evento (al empezar) y el que deja elegir el resultado del dado. */
export const OBJETO_EVITAR_EVENTO = 'mano_de_mono';
export const OBJETO_ELEGIR_RESULTADO = 'amuleto_del_destino';

/** Lo que devuelve cada botón del motor. */
export interface ResultadoMotor {
  estado: Estado;

  // Todos los cambios reales que han pasado con este botón (también los de pasos automáticos).
  cambios: Cambio[];

  // Eventos a los que se ha intentado ir y todavía no están programados.
  pendientes: string[];

  // true = la pila ha quedado vacía: no queda ningún evento en marcha.
  terminado: boolean;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** ¿Hay algún evento en marcha (o esperando su turno)? */
export function hayEventoEnCurso(estado: Estado): boolean {
  return estado.mundo.pilaEventos.length > 0;
}

/** La bandera que recuerda que un evento de una sola vez ya ha salido. */
export function banderaDeEventoOcurrido(idEvento: string): string {
  return `evento_ocurrido_${idEvento}`;
}

/** ¿Es un evento de una sola vez que ya ha salido en esta partida? (Entonces no vuelve a salir.) */
export function eventoYaOcurrido(estado: Estado, idEvento: string, eventos: readonly Evento[] = EVENTOS): boolean {
  const evento = eventos.find(e => e.id === idEvento);
  return evento?.unaVez === true && estado.mundo.banderas[banderaDeEventoOcurrido(idEvento)] === true;
}

/** Una opción tal como la enseña la pantalla. */
export interface OpcionVisible {
  texto: string;
  disponible: boolean;
  // Por qué no se puede elegir: ya llevas ese objeto, el grupo está lleno, algo prohíbe nuevos
  // seguidores (hedor nauseabundo) o ese evento (de una sola vez) ya ocurrió.
  motivo?: 'ya_lo_tienes' | 'grupo_lleno' | 'prohibido' | 'ya_ocurrio';
}

/**
 * Lo que la ventana de eventos tiene que enseñar ahora. Qué botones salen lo dice "modo":
 *   empezar:          el evento acaba de aparecer y llevas la mano de mono: "Evitar el evento" o "Seguir".
 *   opciones:         los botones de "opciones" (los que no se pueden, desactivados con su motivo).
 *   tirada:           "Tirar dados" (y, con el amuleto del destino, "Elegir el resultado").
 *   chequeo:          "Hacer el chequeo de Fuerza / Ingenio".
 *   combate:          "Luchar" (empieza el combate normal).
 *   combate_naval:    "Luchar" (empieza el combate naval).
 *   en_combate:       la ventana se aparta: se está jugando el combate que lanzó el evento.
 *   continuar:        hay algo que leer; "Continuar".
 */
export interface VistaDelEvento {
  modo: 'empezar' | 'opciones' | 'tirada' | 'chequeo' | 'combate' | 'combate_naval' | 'en_combate' | 'continuar';
  titulo: string;
  imagen?: string;

  // La miga de pan: los títulos de los eventos en marcha, del primero al actual
  // ("Taberna clandestina › Pelea con un borracho").
  miga: string[];

  // El texto del paso (o de la rama a la que se ha llegado) y lo que ha pasado.
  texto?: string;
  lectura: Lectura | null;

  opciones?: OpcionVisible[];
  tirada?: { dado: string; modificador: number; minimo: number; maximo: number; puedeElegir: boolean };
  chequeo?: { caracteristica: 'fuerza' | 'ingenio'; modificador: number };
  combate?: { enemigos: { enemigo: string; cantidad?: number | string }[] };
  combateNaval?: { barco: string };

  // Usos que le quedan a la mano de mono (solo en el modo "empezar").
  manoDeMono?: number;
}

/** Qué enseñar ahora; null si no hay ningún evento en marcha. */
export function vistaDelEvento(estado: Estado, eventos: readonly Evento[] = EVENTOS): VistaDelEvento | null {
  const pila = estado.mundo.pilaEventos;
  const marco = pila[pila.length - 1];
  if (!marco) return null;

  const evento = buscarEvento(eventos, marco.evento);
  const base = {
    titulo: evento.titulo,
    ...(evento.imagen !== undefined ? { imagen: evento.imagen } : {}),
    miga: pila.filter((m, i) => !m.porEmpezar || i === pila.length - 1).map(m => buscarEvento(eventos, m.evento).titulo),
    lectura: marco.lectura,
  };

  if (marco.porEmpezar) {
    // Solo se para aquí un evento lanzado por el juego cuando llevas la mano de mono.
    const inicio = evento.pasos[PASO_INICIAL];
    return { ...base, modo: 'empezar', texto: inicio.texto, manoDeMono: usosDe(estado, OBJETO_EVITAR_EVENTO) };
  }

  const paso = pasoDe(evento, marco.paso);
  if (marco.esperando) {
    return { ...base, modo: 'en_combate', texto: paso.texto };
  }
  if (marco.siguiente !== null) {
    return { ...base, modo: 'continuar', texto: marco.lectura?.texto };
  }

  // El paso espera al jugador.
  const texto = paso.texto;
  if (paso.opciones) {
    return { ...base, modo: 'opciones', texto, opciones: paso.opciones.map(o => opcionVisible(estado, o, eventos)) };
  }
  if (paso.tirada) {
    const rango = rangoDeTirada(paso.tirada.dado);
    return {
      ...base,
      modo: 'tirada',
      texto,
      tirada: {
        dado: paso.tirada.dado,
        modificador: paso.tirada.modificador ?? 0,
        minimo: rango.min,
        maximo: rango.max,
        puedeElegir: usosDe(estado, OBJETO_ELEGIR_RESULTADO) > 0,
      },
    };
  }
  if (paso.chequeo) {
    return { ...base, modo: 'chequeo', texto, chequeo: { caracteristica: paso.chequeo.caracteristica, modificador: paso.chequeo.modificador ?? 0 } };
  }
  if (paso.combate) {
    return { ...base, modo: 'combate', texto, combate: { enemigos: paso.combate.enemigos.map(e => ({ enemigo: e.enemigo, ...(e.cantidad !== undefined ? { cantidad: e.cantidad } : {}) })) } };
  }
  if (paso.combateNaval) {
    return { ...base, modo: 'combate_naval', texto, combateNaval: { barco: paso.combateNaval.barco } };
  }
  // No debería pasar: un paso sin elección siempre tiene "siguiente".
  throw new Error(`vistaDelEvento: el paso "${marco.paso}" de "${marco.evento}" no espera nada`);
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

/**
 * Lanza uno o varios eventos (en ese orden: el primero se juega primero). Los usa el juego (viajar,
 * una acción, la noche...), así que cuentan como eventos "raíz" (se pueden evitar con la mano de mono).
 * Si ya había eventos en marcha, los nuevos se juegan antes que los que esperaban su turno.
 * Los que no existen salen en "pendientes"; los de una sola vez que ya ocurrieron se ignoran.
 */
export function lanzarEventos(estado: Estado, ids: readonly string[], dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  comprobarQueSigueLaPartida(estado, 'lanzarEventos');
  const t = trabajo(estado, eventos);
  const nuevos = filtrarEventos(t, ids);
  for (const id of [...nuevos].reverse()) {
    apilar(t, { evento: id, paso: PASO_INICIAL, porEmpezar: true, raiz: true, lectura: null, siguiente: null });
  }
  return avanzar(t, dados);
}

/** Pulsa la opción número "indice" (0 = la primera) del paso actual. */
export function elegirOpcion(estado: Estado, indice: number, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'elegirOpcion');
  const paso = pasoActual(t);
  const opcion = paso.opciones?.[indice];
  if (!paso.opciones) throw new Error('elegirOpcion: este paso no tiene opciones');
  if (!opcion) throw new Error(`elegirOpcion: no hay opción ${indice}`);
  const visible = opcionVisible(t.estado, opcion, eventos);
  if (!visible.disponible) throw new Error(`elegirOpcion: la opción "${opcion.texto}" no se puede elegir (${visible.motivo})`);

  llegarARama(t, { ...opcion, texto: undefined }, dados);
  return avanzar(t, dados);
}

/**
 * Pulsa "Tirar dados" en el paso actual. Con "resultadoElegido" se usa el amuleto del destino:
 * el dado saca ese número (entre el mínimo y el máximo del dado) y el amuleto gasta un uso.
 * El bonificador de la tirada se suma igual.
 */
export function tirarDadosDelEvento(
  estado: Estado,
  dados: Dados,
  opciones: { resultadoElegido?: number } = {},
  eventos: readonly Evento[] = EVENTOS,
): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'tirarDadosDelEvento');
  const tirada = pasoActual(t).tirada;
  if (!tirada) throw new Error('tirarDadosDelEvento: este paso no tiene tirada');

  const elegido = opciones.resultadoElegido;
  if (elegido !== undefined) {
    const rango = rangoDeTirada(tirada.dado);
    if (!Number.isInteger(elegido) || elegido < rango.min || elegido > rango.max) {
      throw new Error(`tirarDadosDelEvento: con "${tirada.dado}" solo se puede elegir del ${rango.min} al ${rango.max}`);
    }
    gastarUso(t, OBJETO_ELEGIR_RESULTADO, dados);
  }

  const modificador = tirada.modificador ?? 0;
  // Si la fila lleva a un evento de una sola vez que ya ocurrió, se vuelve a tirar (con un tope).
  // Con el resultado elegido no: el jugador ha elegido esa fila.
  let sacados: number[] = [];
  let total = 0;
  let fila: FilaDeEvento;
  for (let intento = 0; ; intento++) {
    sacados = elegido !== undefined ? [elegido] : dados.tirar(tirada.dado).dados;
    const suma = elegido !== undefined ? elegido : sacados.reduce((a, b) => a + b, 0);
    total = suma + modificador;
    fila = filaDe(tirada.filas, total);
    if (elegido !== undefined || intento >= 20 || !llevaAEventoYaOcurrido(t, fila)) break;
  }

  const tiradaLeida = { dados: sacados, modificador, total, ...(elegido !== undefined ? { elegida: true } : {}) };
  llegarARama(t, fila, dados, { tirada: tiradaLeida }, fila.volverATirar ? { tipo: 'repetir' } : undefined);
  return avanzar(t, dados);
}

/** Pulsa "Hacer el chequeo" en el paso actual. */
export function hacerChequeo(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'hacerChequeo');
  const definicion = pasoActual(t).chequeo;
  if (!definicion) throw new Error('hacerChequeo: este paso no tiene chequeo');

  const resultado = chequeo(t.estado.jugador, definicion.caracteristica, definicion.modificador ?? 0, dados);
  llegarARama(t, resultado.superado ? definicion.exito : definicion.fallo, dados, { chequeo: resultado });
  return avanzar(t, dados);
}

/** Pulsa "Luchar": empieza el combate (normal o naval) del paso actual. La ventana se aparta. */
export function empezarCombateDelEvento(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'empezarCombateDelEvento');
  const paso = pasoActual(t);
  const marco = cima(t);
  if (paso.combate) {
    const { enemigos, puedeHuir, noMortal, sorpresa } = paso.combate;
    t.estado = iniciarCombate(t.estado, enemigos, dados, {
      ...(puedeHuir !== undefined ? { puedeHuir } : {}),
      ...(noMortal !== undefined ? { noMortal } : {}),
      ...(sorpresa !== undefined ? { sorpresa } : {}),
    });
    marco.esperando = 'combate';
  } else if (paso.combateNaval) {
    t.estado = iniciarCombateNaval(t.estado, paso.combateNaval.barco, dados);
    marco.esperando = 'combate_naval';
  } else {
    throw new Error('empezarCombateDelEvento: este paso no tiene combate');
  }
  marco.lectura = null;
  return terminar(t, dados);
}

/**
 * Cuando el combate que lanzó el evento ha terminado: lo cierra (cerrarCombate o cerrarCombateNaval:
 * recompensas, etc.) y sigue por la salida que toque (victoria, huida o derrota). Si el combate
 * lanza sus propios eventos (la maldición del chamán, los cofres de un barco, el daño en la bodega
 * al huir), se juegan antes de seguir.
 */
export function cerrarCombateDelEvento(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  comprobarQueSigueLaPartida(estado, 'cerrarCombateDelEvento');
  const t = trabajo(estado, eventos);
  const marco = t.pila[t.pila.length - 1];
  if (!marco?.esperando) throw new Error('cerrarCombateDelEvento: el evento no está esperando ningún combate');

  const paso = pasoActual(t);
  let resultado: ResultadoCombate;
  let eventosDelCombate: string[];
  if (marco.esperando === 'combate') {
    const cierre = cerrarCombate(t.estado, dados);
    t.estado = cierre.estado;
    t.cambios.push(...cierre.cambios);
    resultado = cierre.resultado;
    eventosDelCombate = cierre.eventos;
  } else {
    const cierre = cerrarCombateNaval(t.estado, dados);
    t.estado = cierre.estado;
    t.cambios.push(...cierre.cambios);
    resultado = cierre.resultado;
    eventosDelCombate = cierre.eventos;
  }
  delete marco.esperando;
  // Los cambios del cierre (recompensas) también se enseñan.
  const cambiosDelCierre = [...t.cambios];

  if (t.estado.mundo.finPartida) return terminar(t, dados);

  // La salida que toca según cómo acabó (en un combate naval no hay "derrota": perderlo es perder la partida).
  const salidas: { victoria?: Rama; huida?: Rama; derrota?: Rama } = paso.combate ?? paso.combateNaval ?? {};
  const rama: Rama = salidas[resultado] ?? {};
  llegarARama(t, rama, dados, { combate: resultado, cambios: cambiosDelCierre }, undefined, eventosDelCombate);
  return avanzar(t, dados);
}

/** Pulsa "Continuar": sigue por donde toque tras leer el resultado. */
export function continuarEvento(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  comprobarQueSigueLaPartida(estado, 'continuarEvento');
  const t = trabajo(estado, eventos);
  const marco = t.pila[t.pila.length - 1];
  if (!marco || marco.porEmpezar || marco.esperando || marco.siguiente === null) {
    throw new Error('continuarEvento: ahora no hay nada que continuar');
  }
  marco.lectura = null;
  return avanzar(t, dados);
}

/** Mano de mono: evita el evento que acaba de aparecer (gasta un uso). */
export function evitarEvento(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEmpezando(estado, eventos, 'evitarEvento');
  gastarUso(t, OBJETO_EVITAR_EVENTO, dados);
  t.pila.pop();
  return avanzar(t, dados);
}

/** Con la mano de mono en la mano, el jugador decide NO evitar el evento: empieza normal. */
export function seguirConElEvento(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEmpezando(estado, eventos, 'seguirConElEvento');
  entrarEnEvento(t, cima(t), dados);
  return avanzar(t, dados);
}

// ---------------------------------------------------------------------------
// Por dentro
// ---------------------------------------------------------------------------

/** Lo que se va modificando durante un botón: una copia del estado, de la pila y lo que pasa. */
interface Trabajo {
  estado: Estado;
  pila: MarcoEvento[];
  cambios: Cambio[];
  pendientes: string[];
  eventos: readonly Evento[];
}

function trabajo(estado: Estado, eventos: readonly Evento[]): Trabajo {
  // Copia profunda de la pila: así nunca se toca la del estado recibido.
  return { estado, pila: structuredClone(estado.mundo.pilaEventos), cambios: [], pendientes: [], eventos };
}

/** Para los botones de un paso que espera al jugador (elegir, tirar, chequeo, luchar). */
function trabajoEsperando(estado: Estado, eventos: readonly Evento[], quien: string): Trabajo {
  comprobarQueSigueLaPartida(estado, quien);
  const t = trabajo(estado, eventos);
  const marco = t.pila[t.pila.length - 1];
  if (!marco || marco.porEmpezar || marco.esperando || marco.siguiente !== null) {
    throw new Error(`${quien}: ahora el evento no espera eso`);
  }
  return t;
}

/** Para los botones de la mano de mono (el evento acaba de aparecer). */
function trabajoEmpezando(estado: Estado, eventos: readonly Evento[], quien: string): Trabajo {
  comprobarQueSigueLaPartida(estado, quien);
  const t = trabajo(estado, eventos);
  const marco = t.pila[t.pila.length - 1];
  if (!marco?.porEmpezar || !marco.raiz) {
    throw new Error(`${quien}: no hay ningún evento esperando a empezar`);
  }
  return t;
}

/**
 * Avanza todo lo que no necesita al jugador y se para en cuanto hay algo que leer o decidir,
 * un combate, o la pila se vacía.
 */
function avanzar(t: Trabajo, dados: Dados): ResultadoMotor {
  for (let vueltas = 0; ; vueltas++) {
    if (vueltas > PASOS_AUTOMATICOS_MAXIMOS) {
      throw new Error('Motor de eventos: demasiados pasos seguidos sin parar (¿un bucle entre pasos?)');
    }
    if (t.estado.mundo.finPartida) break;
    const marco = t.pila[t.pila.length - 1];
    if (!marco) break;

    if (marco.porEmpezar) {
      // Un evento lanzado por el juego se puede evitar con la mano de mono: se espera la decisión.
      if (marco.raiz && usosDe(t.estado, OBJETO_EVITAR_EVENTO) > 0) break;
      entrarEnEvento(t, marco, dados);
      continue;
    }
    if (marco.esperando || marco.siguiente === null) break;
    if (hayAlgoQueLeer(marco.lectura)) break;

    const siguiente = marco.siguiente;
    marco.lectura = null;
    seguir(t, marco, siguiente, dados);
  }
  return terminar(t, dados);
}

/** Ejecuta un "siguiente" sobre el marco de arriba. */
function seguir(t: Trabajo, marco: MarcoEvento, siguiente: Siguiente, dados: Dados): void {
  switch (siguiente.tipo) {
    case 'paso':
      entrarEnPaso(t, marco, siguiente.paso, dados);
      return;
    case 'repetir':
      // Otra vez la misma tirada: el paso vuelve a esperar al jugador (sin volver a aplicar sus efectos).
      marco.siguiente = null;
      return;
    case 'fin':
      t.pila.pop();
      return;
    case 'evento': {
      // Este evento termina y lo sustituye el nuevo (la pila no crece).
      t.pila.pop();
      const [nuevo] = filtrarEventos(t, [siguiente.evento]);
      if (nuevo) apilar(t, { evento: nuevo, paso: PASO_INICIAL, porEmpezar: true, lectura: null, siguiente: null });
      return;
    }
    case 'llamar': {
      // El evento se queda esperando (seguirá por "despues") y encima se ponen los llamados.
      marco.siguiente = siguiente.despues;
      for (const id of [...filtrarEventos(t, siguiente.eventos)].reverse()) {
        apilar(t, { evento: id, paso: PASO_INICIAL, porEmpezar: true, lectura: null, siguiente: null });
      }
      return;
    }
  }
}

/** Empieza un evento: apunta que ha ocurrido (si es de una sola vez) y entra en su paso "inicio". */
function entrarEnEvento(t: Trabajo, marco: MarcoEvento, dados: Dados): void {
  delete marco.porEmpezar;
  const evento = buscarEvento(t.eventos, marco.evento);
  if (evento.unaVez) {
    t.estado = {
      ...t.estado,
      mundo: { ...t.estado.mundo, banderas: { ...t.estado.mundo.banderas, [banderaDeEventoOcurrido(evento.id)]: true } },
    };
  }
  entrarEnPaso(t, marco, PASO_INICIAL, dados);
}

/** Entra en un paso: aplica sus efectos y deja preparado lo que se lee y por dónde se sigue. */
function entrarEnPaso(t: Trabajo, marco: MarcoEvento, nombre: string, dados: Dados): void {
  marco.paso = nombre;
  const paso = pasoDe(buscarEvento(t.eventos, marco.evento), nombre);
  const cambios = aplicar(t, paso.efectos, dados);
  marco.lectura = { ...(paso.texto !== undefined ? { texto: paso.texto } : {}), cambios };
  marco.siguiente = esperaAlJugador(paso) ? null : siguienteDe(paso);
}

/**
 * Se ha llegado a una rama (una opción, una fila de la tirada, el éxito o el fallo de un chequeo,
 * la salida de un combate): se aplican sus efectos, se apunta lo que hay que leer y por dónde seguir.
 * extra = lo que se añade a la lectura (los dados, el chequeo, el combate y sus cambios).
 * forzado = un "siguiente" que manda sobre el de la rama ("vuelve a tirar").
 * antes = eventos que se juegan primero, antes de seguir (los que lanza el combate).
 */
function llegarARama(
  t: Trabajo,
  rama: Rama,
  dados: Dados,
  extra: Partial<Lectura> = {},
  forzado?: Siguiente,
  antes: string[] = [],
): void {
  const marco = cima(t);
  const cambios = [...(extra.cambios ?? []), ...aplicar(t, rama.efectos, dados)];
  marco.lectura = { ...extra, ...(rama.texto !== undefined ? { texto: rama.texto } : {}), cambios };
  const despues = forzado ?? siguienteDe(rama);
  marco.siguiente = antes.length > 0 ? { tipo: 'llamar', eventos: antes, despues } : despues;
}

/** Por dónde se sigue después de una rama (o de un paso que no espera al jugador). */
function siguienteDe(rama: Rama): Siguiente {
  if (rama.evento !== undefined) return { tipo: 'evento', evento: rama.evento };
  const despues: Siguiente = rama.paso !== undefined ? { tipo: 'paso', paso: rama.paso } : { tipo: 'fin' };
  if (rama.llamar !== undefined) return { tipo: 'llamar', eventos: [rama.llamar], despues };
  return despues;
}

function esperaAlJugador(paso: Paso): boolean {
  return paso.opciones !== undefined || paso.tirada !== undefined || paso.chequeo !== undefined || paso.combate !== undefined || paso.combateNaval !== undefined;
}

/** Resuelve los dados de los efectos y los aplica. Devuelve los cambios reales. */
function aplicar(t: Trabajo, efectos: readonly EfectoDefinicion[] | undefined, dados: Dados): Cambio[] {
  if (!efectos || efectos.length === 0) return [];
  const resueltos = efectos.map(e => resolverEfecto(e, dados));
  const aplicado = aplicarEfectos(t.estado, resueltos, dados);
  t.estado = aplicado.estado;
  t.cambios.push(...aplicado.cambios);
  return aplicado.cambios;
}

/** Gasta un uso de un objeto de evento (mano de mono, amuleto del destino). */
function gastarUso(t: Trabajo, idObjeto: string, dados: Dados): void {
  const posicion = t.estado.jugador.inventario.findIndex(o => o.id === idObjeto && (o.usosRestantes ?? 0) > 0);
  if (posicion === -1) throw new Error(`Motor de eventos: no llevas "${idObjeto}" (o no le quedan usos)`);
  const aplicado = aplicarEfectos(t.estado, [{ tipo: 'gastar_uso', posicion }], dados);
  t.estado = aplicado.estado;
  t.cambios.push(...aplicado.cambios);
}

/** Quita de una lista los eventos que no existen (a "pendientes") y los de una sola vez que ya ocurrieron. */
function filtrarEventos(t: Trabajo, ids: readonly string[]): string[] {
  const quedan: string[] = [];
  for (const id of ids) {
    if (!t.eventos.some(e => e.id === id)) {
      t.pendientes.push(id);
    } else if (!eventoYaOcurrido(t.estado, id, t.eventos) && !yaEnLaPilaDeUnaVez(t, id)) {
      quedan.push(id);
    }
  }
  return quedan;
}

/** Un evento de una sola vez que ya está en la pila esperando su turno tampoco se repite. */
function yaEnLaPilaDeUnaVez(t: Trabajo, id: string): boolean {
  const evento = t.eventos.find(e => e.id === id);
  return evento?.unaVez === true && t.pila.some(m => m.evento === id);
}

function apilar(t: Trabajo, marco: MarcoEvento): void {
  if (t.pila.length >= PROFUNDIDAD_MAXIMA) {
    throw new Error(`Motor de eventos: más de ${PROFUNDIDAD_MAXIMA} eventos encadenados (¿un bucle entre eventos?)`);
  }
  t.pila.push(marco);
}

/** Mete la pila en el estado, apunta los dados y monta el resultado. */
function terminar(t: Trabajo, dados: Dados): ResultadoMotor {
  // Si la partida ha terminado (has muerto, has ganado), ya no queda ningún evento que jugar.
  const pila = t.estado.mundo.finPartida ? [] : t.pila;
  const estado: Estado = { ...t.estado, mundo: { ...t.estado.mundo, pilaEventos: pila, estadoDados: dados.obtenerEstado() } };
  return { estado, cambios: t.cambios, pendientes: t.pendientes, terminado: pila.length === 0 };
}

function hayAlgoQueLeer(lectura: Lectura | null): boolean {
  if (!lectura) return false;
  return lectura.texto !== undefined || lectura.cambios.length > 0 || lectura.tirada !== undefined || lectura.chequeo !== undefined || lectura.combate !== undefined;
}

function opcionVisible(estado: Estado, opcion: Opcion, eventos: readonly Evento[]): OpcionVisible {
  const sinObjeto = opcion.requiere?.sinObjeto;
  if (sinObjeto !== undefined && estado.jugador.inventario.some(o => o.id === sinObjeto)) {
    return { texto: opcion.texto, disponible: false, motivo: 'ya_lo_tienes' };
  }
  if (opcion.requiere?.puedeGanarSeguidor) {
    if (estaProhibido(estado.jugador, 'nuevos_seguidores')) return { texto: opcion.texto, disponible: false, motivo: 'prohibido' };
    if (grupoLleno(estado.jugador)) return { texto: opcion.texto, disponible: false, motivo: 'grupo_lleno' };
  }
  const destino = opcion.evento ?? opcion.llamar;
  if (destino !== undefined && eventoYaOcurrido(estado, destino, eventos)) {
    return { texto: opcion.texto, disponible: false, motivo: 'ya_ocurrio' };
  }
  return { texto: opcion.texto, disponible: true };
}

function llevaAEventoYaOcurrido(t: Trabajo, fila: FilaDeEvento): boolean {
  const destino = fila.evento ?? fila.llamar;
  return destino !== undefined && eventoYaOcurrido(t.estado, destino, t.eventos);
}

/** La fila que corresponde a un total; si se sale por arriba o por abajo, la última o la primera. */
function filaDe(filas: readonly FilaDeEvento[], total: number): FilaDeEvento {
  const ordenadas = [...filas].sort((a, b) => a.min - b.min);
  if (total < ordenadas[0].min) return ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  if (total > ultima.max) return ultima;
  const fila = ordenadas.find(f => total >= f.min && total <= f.max);
  if (!fila) throw new Error(`Motor de eventos: ninguna fila para el ${total} (¿un hueco en la tirada?)`);
  return fila;
}

function usosDe(estado: Estado, idObjeto: string): number {
  return estado.jugador.inventario.filter(o => o.id === idObjeto).reduce((suma, o) => suma + (o.usosRestantes ?? 0), 0);
}

function cima(t: Trabajo): MarcoEvento {
  return t.pila[t.pila.length - 1];
}

function pasoActual(t: Trabajo): Paso {
  const marco = cima(t);
  return pasoDe(buscarEvento(t.eventos, marco.evento), marco.paso);
}

function buscarEvento(eventos: readonly Evento[], id: string): Evento {
  const evento = eventos.find(e => e.id === id);
  if (!evento) throw new Error(`Motor de eventos: el evento "${id}" no existe`);
  return evento;
}

function pasoDe(evento: Evento, nombre: string): Paso {
  const paso = evento.pasos[nombre];
  if (!paso) throw new Error(`Motor de eventos: el evento "${evento.id}" no tiene el paso "${nombre}"`);
  return paso;
}

function comprobarQueSigueLaPartida(estado: Estado, quien: string): void {
  if (estado.mundo.finPartida) throw new Error(`${quien}: la partida ya ha terminado`);
}
