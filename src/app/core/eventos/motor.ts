import { cerrarCombate, iniciarCombate } from '../combate/combate';
import { cerrarCombateNaval, iniciarCombateNaval } from '../combate-naval/combate-naval';
import { chequeo } from '../chequeos/chequeo';
import { AJUSTES } from '../ajustes/ajustes';
import { estaProhibido, fuerzaActual, ingenioActual } from '../condiciones/consultas';
import { tieneCondicion } from '../condiciones/condiciones-vigentes';
import { calcularModificador } from '../modificadores/calcular-modificador';
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
import { ENCUENTROS } from '../encuentros/cargar-encuentros';
import type { Encuentro } from '../encuentros/encuentro';
import type { EnemigoPedido } from '../combate/combate';
import { banderaDeEventoOcurrido, eventoYaOcurrido } from './una-vez';
import { sitioActual } from '../mapa/sitio-actual';
import { esPuerto } from '../turno/lugar';
import { conCausaDeMuerte } from '../efectos/causa-de-muerte';
import { recibirAmuletoMaldito } from '../amuleto-maldito/recibir-amuleto-maldito';
import { CANTIDAD_DEL_EVENTO, PASO_INICIAL, type Evento, type FilaDeEvento, type Opcion, type Paso, type Rama, type TiradaDeEvento } from './evento';

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

// hayEventoEnCurso, banderaDeEventoOcurrido y eventoYaOcurrido viven en una-vez.ts (no dependen del
// motor y así los pueden usar las acciones sin importar todo esto); se reexportan aquí por comodidad.
export { banderaDeEventoOcurrido, eventoYaOcurrido, hayEventoEnCurso } from './una-vez';

/** ¿El evento de arriba está esperando a que termine un combate que él lanzó? (Entonces el combate se cierra con cerrarCombateDelEvento.) */
export function eventoEsperaUnCombate(estado: Estado): boolean {
  const pila = estado.mundo.pilaEventos;
  return pila.length > 0 && pila[pila.length - 1].esperando !== undefined;
}

/** Una opción tal como la enseña la pantalla. */
export interface OpcionVisible {
  texto: string;
  disponible: boolean;
  // Por qué no se puede elegir: ya llevas ese objeto, el grupo está lleno, algo prohíbe nuevos
  // seguidores (hedor nauseabundo), ya estás al máximo, ese evento (de una sola vez) ya ocurrió o no
  // tienes oro suficiente.
  motivo?: 'ya_lo_tienes' | 'grupo_lleno' | 'prohibido' | 'al_maximo' | 'ya_ocurrio' | 'sin_oro';
}

/**
 * Lo que la ventana de eventos tiene que enseñar ahora. Qué botones salen lo dice "modo":
 *   empezar:          el evento acaba de aparecer y llevas la mano de mono: "Evitar el evento" o "Seguir".
 *   opciones:         los botones de "opciones" (los que no se pueden, desactivados con su motivo).
 *   tirada:           "Tirar dados" (y, con el amuleto del destino, "Usar el amuleto del destino").
 *   elegir_resultado: el amuleto ya se ha gastado: se ven los resultados de la tabla y hay que elegir uno.
 *   chequeo:          "Hacer el chequeo de Fuerza / Ingenio".
 *   combate:          "Luchar" (empieza el combate normal).
 *   combate_naval:    "Luchar" (empieza el combate naval).
 *   en_combate:       la ventana se aparta: se está jugando el combate que lanzó el evento.
 *   continuar:        hay algo que leer; "Continuar".
 *   muerte:           la partida ha terminado en mitad del evento (has muerto): se lee lo que ha pasado
 *                     y por qué has muerto; la pantalla pone "Ver el final".
 */
export interface VistaDelEvento {
  modo: 'muerte' | 'empezar' | 'opciones' | 'tirada' | 'elegir_resultado' | 'chequeo' | 'combate' | 'combate_naval' | 'en_combate' | 'continuar';
  titulo: string;
  imagen?: string;

  // La miga de pan: los títulos de los eventos en marcha, del primero al actual
  // ("Taberna clandestina › Pelea con un borracho").
  miga: string[];

  // El texto del paso (o de la rama a la que se ha llegado) y lo que ha pasado.
  texto?: string;
  lectura: Lectura | null;

  // Lo leído en los pasos anteriores, que se enseña encima (del más antiguo al más nuevo). Va antes que
  // el texto y la lectura de ahora.
  anteriores: Lectura[];

  opciones?: OpcionVisible[];

  // Con el amuleto del destino: los resultados posibles de la tabla, para elegir uno.
  resultados?: ResultadoPosible[];
  // paraEncuentro = la tirada es la del encuentro de un combate (para ver contra quién se lucha).
  // boton = el texto del botón escrito en el evento (sin él, la pantalla pone el suyo).
  tirada?: { dado: string; modificador: number; minimo: number; maximo: number; puedeElegir: boolean; paraEncuentro?: boolean; boton?: string };
  chequeo?: { caracteristica: 'fuerza' | 'ingenio'; modificador: number; boton?: string };
  combate?: { enemigos: { enemigo: string; cantidad?: number | string }[]; boton?: string };
  combateNaval?: { barco: string; boton?: string };

  // Usos que le quedan a la mano de mono (solo en el modo "empezar").
  manoDeMono?: number;
}

/**
 * Un resultado de la tabla, tal como se enseña al elegir con el amuleto del destino. La pantalla
 * escribe la etiqueta con lo que haya: el texto de la fila; si no tiene, el evento al que lleva
 * (su título si ya existe); si no, sus efectos o sus enemigos.
 */
export interface ResultadoPosible {
  // El número que se elige (el primero del rango) y el rango ("2-3").
  numero: number;
  min: number;
  max: number;
  texto?: string;
  evento?: { id: string; titulo?: string };
  efectos?: EfectoDefinicion[];
  enemigos?: EnemigoPedido[];
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
    anteriores: marco.anteriores ?? [],
  };

  if (marco.porEmpezar) {
    // Solo se para aquí un evento lanzado por el juego cuando llevas la mano de mono.
    // La cantidad todavía no se ha tirado (se tira al empezar de verdad).
    const inicio = evento.pasos[PASO_INICIAL];
    return { ...base, modo: 'empezar', texto: conCantidad(inicio.texto, undefined), manoDeMono: usosDe(estado, OBJETO_EVITAR_EVENTO) };
  }

  if (estado.mundo.finPartida) {
    // Has muerto (o ganado) en mitad del evento: se lee lo que ha pasado y "Ver el final".
    return { ...base, modo: 'muerte', texto: marco.lectura?.texto };
  }

  const paso = pasoDe(evento, marco.paso);
  const texto = conCantidad(paso.texto, marco.cantidad);
  if (marco.esperando) {
    return { ...base, modo: 'en_combate', texto };
  }
  if (marco.siguiente !== null) {
    return { ...base, modo: 'continuar', texto: marco.lectura?.texto };
  }

  // El paso espera al jugador.
  if (marco.eligiendoResultado) {
    return { ...base, modo: 'elegir_resultado', texto, resultados: resultadosPosibles(paso, eventos) };
  }
  if (paso.opciones) {
    return { ...base, modo: 'opciones', texto, opciones: paso.opciones.map(o => opcionVisible(estado, o, eventos, marco.cantidad)) };
  }
  if (paso.tirada) {
    const rango = rangoDeTirada(paso.tirada.dado);
    return {
      ...base,
      modo: 'tirada',
      texto,
      tirada: {
        dado: paso.tirada.dado,
        modificador: modificadorDeTirada(estado, paso.tirada),
        minimo: rango.min,
        maximo: rango.max,
        puedeElegir: usosDe(estado, OBJETO_ELEGIR_RESULTADO) > 0,
        boton: paso.tirada.boton,
      },
    };
  }
  if (paso.chequeo) {
    const { caracteristica, modificador, boton } = paso.chequeo;
    return { ...base, modo: 'chequeo', texto, chequeo: { caracteristica, modificador: modificador ?? 0, ...(boton !== undefined ? { boton } : {}) } };
  }
  if (paso.combate) {
    // Un encuentro: primero hay que tirar para ver contra quién se lucha.
    if (paso.combate.encuentro !== undefined && !marco.enemigosDelEncuentro) {
      const encuentro = buscarEncuentro(paso.combate.encuentro);
      const rango = rangoDeTirada(encuentro.dado);
      return {
        ...base,
        modo: 'tirada',
        texto,
        tirada: { dado: encuentro.dado, modificador: 0, minimo: rango.min, maximo: rango.max, puedeElegir: usosDe(estado, OBJETO_ELEGIR_RESULTADO) > 0, paraEncuentro: true, ...(paso.combate.botonDelEncuentro !== undefined ? { boton: paso.combate.botonDelEncuentro } : {}) },
      };
    }
    // Ya se sabe contra quién: el texto del paso y el de la fila del encuentro, y "Luchar".
    const enemigos = marco.enemigosDelEncuentro ?? paso.combate.enemigos ?? [];
    const textoConEncuentro = [texto, marco.enemigosDelEncuentro ? marco.lectura?.texto : undefined].filter(t => t !== undefined).join('\n\n');
    return {
      ...base,
      modo: 'combate',
      ...(textoConEncuentro !== '' ? { texto: textoConEncuentro } : {}),
      combate: {
        enemigos: enemigos.map(e => ({ enemigo: e.enemigo, ...(e.cantidad !== undefined ? { cantidad: e.cantidad } : {}) })),
        ...(paso.combate.boton !== undefined ? { boton: paso.combate.boton } : {}),
      },
    };
  }
  if (paso.combateNaval) {
    return { ...base, modo: 'combate_naval', texto, combateNaval: { barco: paso.combateNaval.barco, ...(paso.combateNaval.boton !== undefined ? { boton: paso.combateNaval.boton } : {}) } };
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
  const visible = opcionVisible(t.estado, opcion, eventos, cima(t).cantidad);
  if (!visible.disponible) throw new Error(`elegirOpcion: la opción "${opcion.texto}" no se puede elegir (${visible.motivo})`);

  llegarARama(t, { ...opcion, texto: undefined }, dados);
  return avanzar(t, dados);
}

/**
 * Pulsa "Tirar dados" en el paso actual. "resultadoElegido" = el que se elige tras usar el amuleto del
 * destino (usarAmuletoDelDestino, que ya lo ha gastado): el dado saca ese número (entre el mínimo y el
 * máximo del dado).
 * "resultadoTrucado" es lo mismo, pero SOLO para la trampa de prueba "fijar la próxima tirada":
 * no gasta nada. El bonificador de la tirada se suma igual.
 */
export function tirarDadosDelEvento(
  estado: Estado,
  dados: Dados,
  opciones: { resultadoElegido?: number; resultadoTrucado?: number } = {},
  eventos: readonly Evento[] = EVENTOS,
): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'tirarDadosDelEvento');
  const paso = pasoActual(t);
  const marcoActual = cima(t);
  if (opciones.resultadoElegido !== undefined && !marcoActual.eligiendoResultado) {
    throw new Error('tirarDadosDelEvento: para elegir el resultado primero hay que usar el amuleto del destino');
  }
  if (opciones.resultadoElegido === undefined && marcoActual.eligiendoResultado) {
    throw new Error('tirarDadosDelEvento: el amuleto del destino ya está gastado: elige uno de los resultados');
  }
  delete marcoActual.eligiendoResultado;
  if (paso.combate?.encuentro !== undefined && !marcoActual.enemigosDelEncuentro) {
    tirarEncuentro(t, buscarEncuentro(paso.combate.encuentro), dados, opciones);
    return terminar(t, dados);
  }
  const tirada = paso.tirada;
  if (!tirada) throw new Error('tirarDadosDelEvento: este paso no tiene tirada');

  const elegido = opciones.resultadoElegido ?? opciones.resultadoTrucado;
  if (elegido !== undefined) {
    const rango = rangoDeTirada(tirada.dado);
    if (!Number.isInteger(elegido) || elegido < rango.min || elegido > rango.max) {
      throw new Error(`tirarDadosDelEvento: con "${tirada.dado}" solo se puede elegir del ${rango.min} al ${rango.max}`);
    }
  }

  const modificador = modificadorDeTirada(t.estado, tirada);
  // Si la fila lleva a un evento de una sola vez que ya ocurrió, se vuelve a tirar (con un tope).
  // Con el resultado elegido no: el jugador ha elegido esa fila.
  let sacados: number[] = [];
  let total = 0;
  let fila: FilaDeEvento;
  for (let intento = 0; ; intento++) {
    sacados = elegido !== undefined ? [elegido] : dados.tirar(tirada.dado).dados;
    const suma = elegido !== undefined ? elegido : sacados.reduce((a, b) => a + b, 0);
    // Con el amuleto del destino se elige la FILA: sale esa, sin sumar el bonificador.
    total = opciones.resultadoElegido !== undefined ? suma : suma + modificador;
    // Por debajo de 1 con los bonificadores (la muy mala suerte en el tesoro): su rama, si la tiene.
    // Con el amuleto del destino no: se elige una fila de verdad.
    fila = total < 1 && tirada.siSaleMenosDe1 && opciones.resultadoElegido === undefined
      ? { min: total, max: total, ...tirada.siSaleMenosDe1 }
      : saltarFilasQueYaTiene(t.estado, tirada.filas, filaDe(tirada.filas, total));
    if (elegido !== undefined || intento >= 20 || !llevaAEventoYaOcurrido(t, fila)) break;
  }

  const marca = opciones.resultadoElegido !== undefined ? { elegida: true } : opciones.resultadoTrucado !== undefined ? { trucada: true } : {};
  const tiradaLeida = { dados: sacados, modificador: opciones.resultadoElegido !== undefined ? 0 : modificador, total, ...marca };
  llegarARama(t, fila, dados, { tirada: tiradaLeida }, fila.volverATirar ? { tipo: 'repetir' } : undefined);
  return avanzar(t, dados);
}

/** Lo que se suma a una tirada: su número fijo y, si tiene nombre, los bonificadores del jugador para ella. */
function modificadorDeTirada(estado: Estado, tirada: TiradaDeEvento): number {
  return (tirada.modificador ?? 0) + (tirada.idTirada !== undefined ? calcularModificador(estado.jugador, tirada.idTirada) : 0);
}

/**
 * Filas con "saltarSiTiene": si el jugador ya tiene esa condición o ese objeto, cuenta la fila siguiente
 * (y así hasta una que valga). Si no queda ninguna por delante, se busca hacia atrás.
 */
function saltarFilasQueYaTiene(estado: Estado, filas: readonly FilaDeEvento[], fila: FilaDeEvento): FilaDeEvento {
  const yaLaTiene = (f: FilaDeEvento): boolean =>
    f.saltarSiTiene !== undefined &&
    (tieneCondicion(estado.jugador, f.saltarSiTiene) || estado.jugador.inventario.some(o => o.id === f.saltarSiTiene));
  const inicio = filas.indexOf(fila);
  for (let i = inicio; i < filas.length; i++) if (!yaLaTiene(filas[i])) return filas[i];
  for (let i = inicio - 1; i >= 0; i--) if (!yaLaTiene(filas[i])) return filas[i];
  return fila;
}

/**
 * Pulsa "Usar el amuleto del destino" en una tirada (decidido por el autor el 22-nov): el amuleto SE
 * GASTA YA y el paso pasa a enseñar los resultados de la tabla para elegir uno (tirarDadosDelEvento con
 * resultadoElegido). Queda apuntado en el estado: recargar no sirve para verlos y no usarlo.
 */
export function usarAmuletoDelDestino(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'usarAmuletoDelDestino');
  const paso = pasoActual(t);
  const marco = cima(t);
  const tieneTirada = paso.tirada !== undefined || (paso.combate?.encuentro !== undefined && !marco.enemigosDelEncuentro);
  if (!tieneTirada) throw new Error('usarAmuletoDelDestino: este paso no tiene ninguna tirada');
  if (marco.eligiendoResultado) throw new Error('usarAmuletoDelDestino: el amuleto ya está gastado en esta tirada');
  gastarUso(t, OBJETO_ELEGIR_RESULTADO, dados);
  marco.eligiendoResultado = true;
  return terminar(t, dados);
}

/**
 * Pulsa "Hacer el chequeo" en el paso actual. "dadoTrucado" (1-6) es SOLO para la trampa de prueba
 * "fijar la próxima tirada": el dado del chequeo saca ese número.
 */
export function hacerChequeo(
  estado: Estado,
  dados: Dados,
  opciones: { dadoTrucado?: number } = {},
  eventos: readonly Evento[] = EVENTOS,
): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'hacerChequeo');
  const definicion = pasoActual(t).chequeo;
  if (!definicion) throw new Error('hacerChequeo: este paso no tiene chequeo');
  const trucado = opciones.dadoTrucado;
  if (trucado !== undefined && (!Number.isInteger(trucado) || trucado < 1 || trucado > 6)) {
    throw new Error('hacerChequeo: el dado de un chequeo solo puede sacar del 1 al 6');
  }

  const resultado = chequeo(t.estado.jugador, definicion.caracteristica, definicion.modificador ?? 0, dados, trucado);
  llegarARama(t, resultado.superado ? definicion.exito : definicion.fallo, dados, { chequeo: resultado });
  return avanzar(t, dados);
}

/** Pulsa "Luchar": empieza el combate (normal o naval) del paso actual. La ventana se aparta. */
export function empezarCombateDelEvento(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEsperando(estado, eventos, 'empezarCombateDelEvento');
  const paso = pasoActual(t);
  const marco = cima(t);
  if (paso.combate) {
    const { puedeHuir, noMortal, sorpresa } = paso.combate;
    if (paso.combate.encuentro !== undefined && !marco.enemigosDelEncuentro) {
      throw new Error('empezarCombateDelEvento: primero hay que tirar el dado del encuentro');
    }
    const enemigos = marco.enemigosDelEncuentro ?? paso.combate.enemigos ?? [];
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
  delete marco.enemigosDelEncuentro;
  // Los cambios del cierre (recompensas) también se enseñan.
  const cambiosDelCierre = [...t.cambios];

  if (t.estado.mundo.finPartida) {
    marco.lectura = { combate: resultado, cambios: cambiosDelCierre };
    return terminar(t, dados);
  }

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
  delete marco.anteriores;
  return avanzar(t, dados);
}

/** Mano de mono: evita el evento que acaba de aparecer (gasta un uso). */
export function evitarEvento(estado: Estado, dados: Dados, eventos: readonly Evento[] = EVENTOS): ResultadoMotor {
  const t = trabajoEmpezando(estado, eventos, 'evitarEvento');
  const antes = t.cambios.length;
  gastarUso(t, OBJETO_EVITAR_EVENTO, dados);
  // No se cierra de golpe: se enseña que se ha evitado (y, si era el último uso, el texto de la mano
  // de mono) y, al continuar, el evento termina sin haber ocurrido.
  const marco = cima(t);
  delete marco.porEmpezar;
  marco.lectura = { evitado: true, cambios: t.cambios.slice(antes) };
  marco.siguiente = { tipo: 'fin' };
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
  // El jugador ya ha leído lo de antes: al pulsar se borra.
  delete marco.anteriores;
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
    if (hayAlgoQueLeer(marco.lectura) || (marco.anteriores?.length ?? 0) > 0) {
      // Al pasar a otro paso del mismo evento no hace falta "Continuar": lo leído se queda arriba.
      // A otro evento, al final o con "pausa", sí (la regla de oro: siempre se ve qué ha pasado).
      if (!seSigueSinParar(marco.siguiente)) break;
      if (hayAlgoQueLeer(marco.lectura)) marco.anteriores = [...(marco.anteriores ?? []), marco.lectura!];
    }

    const siguiente = marco.siguiente;
    marco.lectura = null;
    seguir(t, marco, siguiente, dados);
  }
  return terminar(t, dados);
}

/** ¿Se sigue sin pulsar "Continuar"? Sí al ir a otro paso del mismo evento (sin "pausa") o al volver a tirar. */
function seSigueSinParar(siguiente: Siguiente): boolean {
  return (siguiente.tipo === 'paso' && !siguiente.pausa) || siguiente.tipo === 'repetir';
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
      if (nuevo) apilar(t, { evento: nuevo, paso: PASO_INICIAL, porEmpezar: true, lectura: null, siguiente: null, ...(siguiente.tiradaOculta ? { tiradaOculta: true } : {}) });
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
  delete marco.enemigosDelEncuentro;
  const paso = pasoDe(buscarEvento(t.eventos, marco.evento), nombre);
  // La cantidad del evento se tira al entrar en el paso que la define (antes de sus efectos y su texto).
  if (paso.cantidad !== undefined) marco.cantidad = dados.tirar(paso.cantidad).total;
  const { cambios, llamarAntes } = aplicarConAmuleto(t, paso, dados, paso.muerte);
  const texto = conCantidad(paso.texto, marco.cantidad);

  if (paso.segun) {
    // Según dónde estés: se sigue solo por la rama que toque (la que no está escrita = termina).
    // Se lee el texto del paso y el de la rama, juntos.
    const rama: Rama = paso.segun[dondeEstas(t.estado)] ?? {};
    const deLaRama = aplicarConAmuleto(t, rama, dados, rama.muerte ?? paso.muerte);
    const textos = [texto, conCantidad(rama.texto, marco.cantidad)].filter((x): x is string => x !== undefined);
    marco.lectura = { ...(textos.length > 0 ? { texto: textos.join('\n\n') } : {}), cambios: [...cambios, ...deLaRama.cambios] };
    marco.siguiente = conLlamadas([...llamarAntes, ...deLaRama.llamarAntes], siguienteDe(rama));
    return;
  }

  marco.lectura = { ...(texto !== undefined ? { texto } : {}), cambios };
  // (Un paso que espera al jugador no lleva amuleto: lo impide el revisor.)
  marco.siguiente = esperaAlJugador(paso) ? null : conLlamadas(llamarAntes, siguienteDe(paso));

  // Tirada oculta: se tira ya, sin botón ni dados a la vista, y se llega a la fila que toque.
  if (marco.tiradaOculta && paso.tirada) {
    delete marco.tiradaOculta;
    tirarAOcultas(t, paso.tirada, dados);
  }
}

/** La tirada oculta: los dados (con los bonificadores) deciden la fila, pero no se enseñan. */
function tirarAOcultas(t: Trabajo, tirada: TiradaDeEvento, dados: Dados): void {
  const total = dados.tirar(tirada.dado).total + modificadorDeTirada(t.estado, tirada);
  const fila: FilaDeEvento = total < 1 && tirada.siSaleMenosDe1
    ? { min: total, max: total, ...tirada.siSaleMenosDe1 }
    : saltarFilasQueYaTiene(t.estado, tirada.filas, filaDe(tirada.filas, total));
  llegarARama(t, fila, dados, {}, fila.volverATirar ? { tipo: 'repetir' } : undefined);
}

/** Si hay eventos que llamar antes (el deseo del amuleto), se llaman y luego se sigue por "despues". */
function conLlamadas(eventos: string[], despues: Siguiente): Siguiente {
  return eventos.length > 0 ? { tipo: 'llamar', eventos, despues } : despues;
}

/**
 * Aplica los efectos de una rama (o de un paso) y, si lleva "amuletoMaldito", da el amuleto (E027):
 * sus dos tiradas. Si sale el deseo, lo devuelve en "llamarAntes" para resolverlo antes de seguir.
 */
function aplicarConAmuleto(t: Trabajo, rama: Rama, dados: Dados, muerte?: string): { cambios: Cambio[]; llamarAntes: string[] } {
  const cambios = aplicar(t, rama.efectos, dados, muerte);
  if (!rama.amuletoMaldito || t.estado.mundo.finPartida) {
    return { cambios, llamarAntes: [] };
  }
  const amuleto = recibirAmuletoMaldito(t.estado, dados);
  t.estado = amuleto.estado;
  return { cambios: [...cambios, ...amuleto.cambios], llamarAntes: amuleto.eventos };
}

/** Para los pasos "segun": a bordo de tu barco, en un puerto (o la guarida) o en otro sitio. */
function dondeEstas(estado: Estado): 'barco' | 'puerto' | 'otro' {
  const lugar = sitioActual(estado).lugar;
  if (lugar === 'barco') return 'barco';
  return esPuerto(lugar) ? 'puerto' : 'otro';
}

/** Cambia {cantidad} por la cantidad del evento (o por "unas cuantas" si todavía no se ha tirado). */
function conCantidad(texto: string | undefined, cantidad: number | undefined): string | undefined {
  if (texto === undefined) return undefined;
  return texto.split(`{${CANTIDAD_DEL_EVENTO}}`).join(cantidad !== undefined ? String(cantidad) : 'unas cuantas');
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
  const aplicado = aplicarConAmuleto(t, rama, dados, rama.muerte);
  const cambios = [...(extra.cambios ?? []), ...aplicado.cambios];
  const texto = conCantidad(rama.texto, marco.cantidad);
  marco.lectura = { ...extra, ...(texto !== undefined ? { texto } : {}), cambios };
  marco.siguiente = conLlamadas([...antes, ...aplicado.llamarAntes], forzado ?? siguienteDe(rama));
}

/** Por dónde se sigue después de una rama (o de un paso que no espera al jugador). */
function siguienteDe(rama: Rama): Siguiente {
  if (rama.evento !== undefined) return { tipo: 'evento', evento: rama.evento, ...(rama.tiradaOculta ? { tiradaOculta: true } : {}) };
  const despues: Siguiente = rama.paso !== undefined ? { tipo: 'paso', paso: rama.paso, ...(rama.pausa ? { pausa: true } : {}) } : { tipo: 'fin' };
  if (rama.llamar !== undefined) return { tipo: 'llamar', eventos: [rama.llamar], despues };
  return despues;
}

function esperaAlJugador(paso: Paso): boolean {
  return paso.opciones !== undefined || paso.tirada !== undefined || paso.chequeo !== undefined || paso.combate !== undefined || paso.combateNaval !== undefined;
}

/**
 * Resuelve los dados de los efectos y los aplica. Devuelve los cambios reales.
 * muerte = el mensaje si estos efectos te matan (el de la rama; si no tiene, se usa el del evento).
 */
function aplicar(t: Trabajo, efectos: readonly EfectoDefinicion[] | undefined, dados: Dados, muerte?: string): Cambio[] {
  if (!efectos || efectos.length === 0) return [];
  const marco = cima(t);
  const cantidad = marco?.cantidad;
  const resueltos = efectos.map(e => resolverEfecto(conCantidadEnEfecto(e, cantidad), dados));
  const aplicado = aplicarEfectos(t.estado, resueltos, dados);
  t.estado = aplicado.estado;
  if (t.estado.mundo.finPartida && marco) {
    const texto = muerte ?? buscarEvento(t.eventos, marco.evento).muerte;
    t.estado = conCausaDeMuerte(t.estado, { tipo: 'evento', evento: marco.evento, ...(texto !== undefined ? { texto } : {}) });
  }
  t.cambios.push(...aplicado.cambios);
  return aplicado.cambios;
}

/** "cantidad": "cantidad" / "-cantidad" → el número de la cantidad del evento (en positivo o en negativo). */
function conCantidadEnEfecto(efecto: EfectoDefinicion, cantidad: number | undefined): EfectoDefinicion {
  if (!('cantidad' in efecto) || typeof efecto.cantidad !== 'string') return efecto;
  const signo = efecto.cantidad === CANTIDAD_DEL_EVENTO ? 1 : efecto.cantidad === `-${CANTIDAD_DEL_EVENTO}` ? -1 : 0;
  if (signo === 0) return efecto;
  if (cantidad === undefined) throw new Error('Motor de eventos: un efecto usa la cantidad del evento, pero ningún paso la ha tirado');
  return { ...efecto, cantidad: signo * cantidad } as EfectoDefinicion;
}

/**
 * Tira el dado de un encuentro: la fila que sale dice contra quién se lucha. Se guardan sus enemigos
 * en el marco (con la recompensa del encuentro si el pedido no trae otra) y su texto en la lectura.
 * El paso sigue esperando al jugador: ahora, "Luchar".
 */
function tirarEncuentro(t: Trabajo, encuentro: Encuentro, dados: Dados, opciones: { resultadoElegido?: number; resultadoTrucado?: number }): void {
  const elegido = opciones.resultadoElegido ?? opciones.resultadoTrucado;
  const rango = rangoDeTirada(encuentro.dado);
  if (elegido !== undefined && (!Number.isInteger(elegido) || elegido < rango.min || elegido > rango.max)) {
    throw new Error(`tirarDadosDelEvento: con "${encuentro.dado}" solo se puede elegir del ${rango.min} al ${rango.max}`);
  }

  const sacados = elegido !== undefined ? [elegido] : dados.tirar(encuentro.dado).dados;
  const total = sacados.reduce((a, b) => a + b, 0);
  const fila = filaDe(encuentro.filas, total);
  const marca = opciones.resultadoElegido !== undefined ? { elegida: true } : opciones.resultadoTrucado !== undefined ? { trucada: true } : {};

  const marco = cima(t);
  marco.enemigosDelEncuentro = fila.enemigos.map(
    (pedido): EnemigoPedido => (pedido.recompensa === undefined && encuentro.recompensaPorEnemigo ? { ...pedido, recompensa: encuentro.recompensaPorEnemigo } : { ...pedido }),
  );
  marco.lectura = { texto: fila.texto, cambios: [...(marco.lectura?.cambios ?? [])], tirada: { dados: sacados, modificador: 0, total, ...marca } };
}

/** Los resultados de la tirada del paso (o de su encuentro), para elegir con el amuleto del destino. */
function resultadosPosibles(paso: Paso, eventos: readonly Evento[]): ResultadoPosible[] {
  if (paso.combate?.encuentro !== undefined) {
    return buscarEncuentro(paso.combate.encuentro).filas.map(f => ({ numero: f.min, min: f.min, max: f.max, texto: f.texto, enemigos: f.enemigos }));
  }
  return (paso.tirada?.filas ?? []).map(f => {
    const destino = f.evento ?? f.llamar;
    const titulo = destino !== undefined ? eventos.find(e => e.id === destino)?.titulo : undefined;
    return {
      numero: f.min,
      min: f.min,
      max: f.max,
      ...(f.texto !== undefined ? { texto: f.texto } : {}),
      ...(destino !== undefined ? { evento: { id: destino, ...(titulo !== undefined ? { titulo } : {}) } } : {}),
      ...(f.efectos !== undefined ? { efectos: f.efectos } : {}),
    };
  });
}

function buscarEncuentro(id: string): Encuentro {
  const encuentro = ENCUENTROS.find(e => e.id === id);
  if (!encuentro) throw new Error(`Motor de eventos: el encuentro "${id}" no existe`);
  return encuentro;
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
  // Si la partida ha terminado (has muerto, has ganado), la pila se queda como estaba: la ventana
  // enseña lo que ha pasado y por qué has muerto (modo "muerte") hasta que el jugador pulsa "Ver el final".
  const pila = t.pila;
  const estado: Estado = { ...t.estado, mundo: { ...t.estado.mundo, pilaEventos: pila, estadoDados: dados.obtenerEstado() } };
  return { estado, cambios: t.cambios, pendientes: t.pendientes, terminado: pila.length === 0 || t.estado.mundo.finPartida !== null };
}

function hayAlgoQueLeer(lectura: Lectura | null): boolean {
  if (!lectura) return false;
  return (
    lectura.texto !== undefined ||
    lectura.cambios.length > 0 ||
    lectura.tirada !== undefined ||
    lectura.chequeo !== undefined ||
    lectura.combate !== undefined ||
    lectura.evitado === true
  );
}

function opcionVisible(estado: Estado, opcionOriginal: Opcion, eventos: readonly Evento[], cantidad: number | undefined): OpcionVisible {
  const opcion = { ...opcionOriginal, texto: conCantidad(opcionOriginal.texto, cantidad) ?? opcionOriginal.texto };
  const sinObjeto = opcion.requiere?.sinObjeto;
  if (sinObjeto !== undefined && estado.jugador.inventario.some(o => o.id === sinObjeto)) {
    return { texto: opcion.texto, disponible: false, motivo: 'ya_lo_tienes' };
  }
  const oro = opcion.requiere?.oro;
  if (oro !== undefined) {
    const necesario = oro === CANTIDAD_DEL_EVENTO ? (cantidad ?? 0) : oro;
    if (estado.jugador.oro < necesario) return { texto: opcion.texto, disponible: false, motivo: 'sin_oro' };
  }
  const puedeSubir = opcion.requiere?.puedeSubir;
  if (puedeSubir !== undefined) {
    const actual = puedeSubir === 'fuerza' ? fuerzaActual(estado.jugador) : ingenioActual(estado.jugador);
    if (actual >= AJUSTES.caracteristicaMaxima) return { texto: opcion.texto, disponible: false, motivo: 'al_maximo' };
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
function filaDe<F extends { min: number; max: number }>(filas: readonly F[], total: number): F {
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
