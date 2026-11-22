import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import type { Condicion } from '../catalogos/condicion';
import type { Objeto } from '../catalogos/objeto';
import type { TipoSeguidor } from '../catalogos/tipo-seguidor';
import { estaProhibido, maximoSeguidoresActual, vidaMaxActual } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { FinPartida } from '../estado/fin-partida';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { espaciosOcupados } from '../objetos/consultas';
import { crearSeguidor } from '../seguidores/crear-seguidor';
import { LISTAS_DE_NOMBRES } from '../seguidores/nombres';
import { CARACTERISTICAS, SEGUIDOR_AL_AZAR, type Efecto, type TipoRecurso } from '../tablas/efecto';
import type { Cambio, MotivoDeRecurso } from './cambio';

/** Catálogos en los que buscar las fichas. Por defecto, los del juego; los tests pueden pasar otros. */
export interface CatalogosEfectos {
  objetos: readonly Objeto[];
  condiciones: readonly Condicion[];
  // Fichas de seguidores y listas de nombres propios. Sin ponerlas = las del juego.
  seguidores?: readonly TipoSeguidor[];
  nombres?: Readonly<Record<string, readonly string[]>>;
}

const CATALOGOS_DEL_JUEGO: CatalogosEfectos = { objetos: OBJETOS, condiciones: CONDICIONES };

/** Lo que devuelve aplicarEfectos: el estado nuevo y la lista de cambios reales (el "chivato"). */
export interface ResultadoEfectos {
  estado: Estado;
  cambios: Cambio[];
}

/**
 * Apunta los efectos en la hoja del personaje. Es el ÚNICO sitio que modifica el estado.
 *
 * NO toca el estado que recibe: hace una copia, cambia la copia y la devuelve.
 * Aplica los efectos en orden, uno detrás de otro, respetando las reglas:
 *   - Topes: vida ≤ vida máxima ACTUAL (con gran fortaleza, +4), tripulación ≤ tripulación máxima,
 *     comida ≤ AJUSTES.comidaMaxima.
 *   - Ningún recurso baja de 0; las características (fuerza, ingenio, vidaMax) nunca bajan de 1.
 *   - Objetos: solo entran si caben; los mágicos dan +1 de fama. Si no caben, entran solo si el efecto
 *     dice qué se tira para hacerles sitio (lo ha elegido el jugador antes) y con eso ya caben.
 *     Efectos internos del inventario: gastar un uso (a 0 se tira solo) y tirar un objeto.
 *   - Condiciones, turnos perdidos y banderas. Al quitar una condición o perder un objeto, si los topes
 *     bajan (se va el amuleto con gran fortaleza o carisma), la vida baja al tope nuevo y, si sobran
 *     seguidores, se marcha uno al azar (nunca un inseparable).
 *   - Seguidores nuevos: entran si hay sitio (maximoSeguidoresActual: 3, o 4 con carisma) y ninguna condición lo prohíbe.
 *     Con el grupo lleno solo entran si el efecto dice a quién se despide (nunca a un inseparable).
 *   - "Un seguidor al azar" sin seguidores: no pasa nada, salvo que el efecto traiga "siNoHay".
 *   - El contable: cada vez que gana oro, gana 1d6 más.
 *   - Fin de partida: vida o tripulación a 0 (derrota), la muerte de un seguidor "vital" (derrota),
 *     o un efecto ganar_partida / perder_partida.
 *     Cuando la partida termina, los efectos que quedan ya no se aplican.
 * Devuelve también la lista de cambios reales, para avisar al jugador.
 * Los dados se usan para "un seguidor al azar", para el contable, para el nombre de un seguidor nuevo
 * y para elegir qué seguidor se marcha al perder el carisma.
 */
export function aplicarEfectos(
  estado: Estado,
  efectos: readonly Efecto[],
  dados: Dados,
  catalogos: CatalogosEfectos = CATALOGOS_DEL_JUEGO,
): ResultadoEfectos {
  const nuevo = structuredClone(estado);
  const cambios: Cambio[] = [];

  for (const efecto of efectos) {
    if (nuevo.mundo.finPartida) {
      break; // la partida ya ha terminado
    }
    aplicarUno(nuevo, efecto, dados, catalogos, cambios);
    comprobarDerrota(nuevo, cambios);
  }

  return { estado: nuevo, cambios };
}

/** Si la vida o la tripulación han llegado a 0, la partida termina con derrota. */
function comprobarDerrota(estado: Estado, cambios: Cambio[]): void {
  if (estado.mundo.finPartida) {
    return;
  }
  if (estado.jugador.vida <= 0) {
    terminarPartida(estado, { resultado: 'derrota', motivo: 'vida' }, cambios);
  } else if (estado.jugador.tripulacion <= 0) {
    terminarPartida(estado, { resultado: 'derrota', motivo: 'tripulacion' }, cambios);
  }
}

function terminarPartida(estado: Estado, fin: FinPartida, cambios: Cambio[]): void {
  estado.mundo.finPartida = fin;
  cambios.push({ tipo: 'fin_partida', fin });
}

/** Aplica un efecto sobre la copia (aquí sí se modifica: es nuestra copia). */
function aplicarUno(estado: Estado, efecto: Efecto, dados: Dados, catalogos: CatalogosEfectos, cambios: Cambio[]): void {
  const jugador = estado.jugador;

  switch (efecto.tipo) {
    case 'ganar_objeto':
      ganarObjeto(jugador, efecto.objeto, efecto.tirar, catalogos, cambios);
      ajustarALosTopes(jugador, dados, catalogos.condiciones, cambios);
      return;
    case 'gastar_uso':
      gastarUso(jugador, efecto.posicion, catalogos.objetos, cambios);
      ajustarALosTopes(jugador, dados, catalogos.condiciones, cambios);
      return;
    case 'tirar_objeto':
      tirarObjeto(jugador, efecto.posicion, cambios);
      ajustarALosTopes(jugador, dados, catalogos.condiciones, cambios);
      return;
    case 'vender_objeto': {
      comprobarPosiciones(jugador, [efecto.posicion]);
      const [vendido] = jugador.inventario.splice(efecto.posicion, 1);
      cambios.push({ tipo: 'objeto_vendido', objeto: vendido.id });
      ajustarALosTopes(jugador, dados, catalogos.condiciones, cambios);
      return;
    }
    case 'herir_seguidor': {
      const seguidor = jugador.seguidores.find(s => s.id === efecto.seguidor);
      if (!seguidor) {
        throw new Error(`aplicarEfectos: no hay ningún seguidor "${efecto.seguidor}" en el grupo`);
      }
      cambiarResistencia(seguidor, { tipo: 'vida', cantidad: -Math.max(0, efecto.cantidad) }, cambios);
      retirarSeguidoresMuertos(estado, cambios);
      return;
    }
    case 'perder_objeto':
      perderObjeto(jugador, efecto.objeto, cambios);
      ajustarALosTopes(jugador, dados, catalogos.condiciones, cambios);
      return;
    case 'poner_condicion':
      ponerCondicion(jugador, efecto.condicion, efecto.turnos, efecto.partes, catalogos.condiciones, cambios);
      return;
    case 'quitar_condicion':
      if ('condicion' in efecto) {
        quitarCondicion(jugador, jugador.condiciones.findIndex(c => c.id === efecto.condicion), cambios);
      } else {
        quitarUnaDeCategoria(jugador, efecto.categoria, catalogos.condiciones, cambios);
      }
      ajustarALosTopes(jugador, dados, catalogos.condiciones, cambios);
      return;
    case 'perder_turnos':
      jugador.fasesAccionPerdidas += efecto.cantidad;
      cambios.push({ tipo: 'turnos_perdidos', cantidad: efecto.cantidad });
      return;
    case 'bandera':
      estado.mundo.banderas[efecto.bandera] = true;
      cambios.push({ tipo: 'bandera', bandera: efecto.bandera });
      return;
    case 'ganar_seguidor':
      ganarSeguidor(jugador, efecto, dados, catalogos, cambios);
      return;
    case 'ganar_partida':
      terminarPartida(estado, { resultado: 'victoria', motivo: 'evento' }, cambios);
      return;
    case 'victoria_normal':
      terminarPartida(estado, { resultado: 'victoria', motivo: 'fama_y_puertos' }, cambios);
      return;
    case 'perder_partida':
      terminarPartida(estado, { resultado: 'derrota', motivo: 'evento' }, cambios);
      return;
    default:
      aplicarARecurso(estado, efecto, dados, catalogos, cambios);
  }
}

// ---------------------------------------------------------------------------
// Recursos y características
// ---------------------------------------------------------------------------

type EfectoDeRecurso = Extract<Efecto, { tipo: TipoRecurso }>;

function aplicarARecurso(estado: Estado, efecto: EfectoDeRecurso, dados: Dados, catalogos: CatalogosEfectos, cambios: Cambio[]): void {
  const destino = efecto.destino ?? 'jugador';
  const jugador = estado.jugador;

  if (destino === 'jugador') {
    cambiarRecursoDelJugador(jugador, efecto, catalogos.condiciones, cambios);
    aplicarContable(jugador, efecto, dados, catalogos.condiciones, cambios);
    return;
  }

  // A partir de aquí, el efecto es sobre la vida y afecta a seguidores (lo garantiza el revisor de tablas).
  if (destino === 'todos') {
    cambiarRecursoDelJugador(jugador, efecto, catalogos.condiciones, cambios);
    for (const seguidor of jugador.seguidores) {
      cambiarResistencia(seguidor, efecto, cambios);
    }
  } else if (destino === 'seguidor_azar') {
    if (jugador.seguidores.length > 0) {
      const elegido = jugador.seguidores[dados.entero(0, jugador.seguidores.length - 1)];
      cambiarResistencia(elegido, efecto, cambios);
    } else {
      // No hay a quién afectar: si el efecto trae "siNoHay", pasan esos efectos en su lugar.
      aplicarReemplazo(estado, efecto.siNoHay ?? [], dados, catalogos, cambios);
    }
  } else {
    // seguidor_elegido: el jugador tiene que elegir, y eso lo pregunta el motor de eventos (Sprint 10).
    throw new Error('aplicarEfectos: "seguidor_elegido" todavía no está disponible (llegará con el motor de eventos)');
  }

  retirarSeguidoresMuertos(estado, cambios);
}

/** Los seguidores que se quedan sin resistencia mueren y salen del grupo; si era el vital, se pierde la partida. */
function retirarSeguidoresMuertos(estado: Estado, cambios: Cambio[]): void {
  const jugador = estado.jugador;
  const muertos = jugador.seguidores.filter(s => s.resistencia <= 0);
  for (const muerto of muertos) {
    cambios.push({ tipo: 'seguidor_muerto', seguidor: muerto.id });
  }
  jugador.seguidores = jugador.seguidores.filter(s => s.resistencia > 0);

  // Si ha muerto un seguidor "vital" (el de "el hermano"), el jugador pierde la partida.
  if (muertos.some(s => s.vital) && !estado.mundo.finPartida) {
    terminarPartida(estado, { resultado: 'derrota', motivo: 'seguidor' }, cambios);
  }
}

/** Los efectos de "siNoHay", uno detrás de otro, con las mismas reglas que cualquier efecto. */
function aplicarReemplazo(estado: Estado, efectos: readonly Efecto[], dados: Dados, catalogos: CatalogosEfectos, cambios: Cambio[]): void {
  for (const efecto of efectos) {
    if (estado.mundo.finPartida) {
      break; // la partida ya ha terminado
    }
    aplicarUno(estado, efecto, dados, catalogos, cambios);
    comprobarDerrota(estado, cambios);
  }
}

/**
 * El contable: cada vez que GANA oro (sumar con cantidad positiva), gana 1d6 más (antes 2d6: decidido por el autor, 18-nov).
 * No cuenta "fijar": eso no es ganar, es quedarse con una cantidad.
 */
function aplicarContable(jugador: Jugador, efecto: EfectoDeRecurso, dados: Dados, condiciones: readonly Condicion[], cambios: Cambio[]): void {
  if (oroGanado(efecto) === 0 || jugador.sobrenombre !== 'el_contable') {
    return;
  }
  const extra = dados.tirar('1d6').total;
  apuntarRecurso(jugador, 'oro', jugador.oro + extra, condiciones, cambios, 'contable');
}

/** Oro que GANA con ese efecto (sumar con cantidad positiva). 0 si no es ganar oro ("fijar" no es ganar). */
function oroGanado(efecto: EfectoDeRecurso): number {
  const esGanarOro = efecto.tipo === 'oro' && (efecto.operacion ?? 'sumar') === 'sumar' && 'cantidad' in efecto && efecto.cantidad > 0;
  return esGanarOro && 'cantidad' in efecto ? efecto.cantidad : 0;
}

function cambiarRecursoDelJugador(jugador: Jugador, efecto: EfectoDeRecurso, condiciones: readonly Condicion[], cambios: Cambio[]): void {
  const tipo = efecto.tipo;
  const { maximo } = limitesDe(jugador, tipo, condiciones);

  apuntarRecurso(jugador, tipo, nuevoValor(jugador[tipo], efecto, maximo), condiciones, cambios);

  // Si baja la vida máxima por debajo de la vida actual, la vida baja con ella.
  if (tipo === 'vidaMax') {
    apuntarRecurso(jugador, 'vida', jugador.vida, condiciones, cambios);
  }
}

/** Pone un recurso en un valor (recortado a sus límites) y, si cambia de verdad, lo apunta en el chivato. */
function apuntarRecurso(
  jugador: Jugador,
  tipo: TipoRecurso,
  valor: number,
  condiciones: readonly Condicion[],
  cambios: Cambio[],
  motivo?: MotivoDeRecurso,
): void {
  const { minimo, maximo } = limitesDe(jugador, tipo, condiciones);
  const antes = jugador[tipo];
  const despues = recortar(valor, minimo, maximo);
  jugador[tipo] = despues;
  if (despues !== antes) {
    cambios.push(motivo ? { tipo: 'recurso', recurso: tipo, antes, despues, motivo } : { tipo: 'recurso', recurso: tipo, antes, despues });
  }
}

function cambiarResistencia(seguidor: Seguidor, efecto: EfectoDeRecurso, cambios: Cambio[]): void {
  const maximo = seguidor.resistenciaMaxima;
  const antes = seguidor.resistencia;
  seguidor.resistencia = recortar(nuevoValor(antes, efecto, maximo), 0, maximo);
  if (seguidor.resistencia !== antes) {
    cambios.push({ tipo: 'resistencia_seguidor', seguidor: seguidor.id, antes, despues: seguidor.resistencia });
  }
}

/** El valor tras la operación, SIN recortar todavía a los límites. */
function nuevoValor(actual: number, efecto: EfectoDeRecurso, maximo: number): number {
  switch (efecto.operacion) {
    case 'fijar':
      return efecto.cantidad;
    case 'mitad':
      return Math.floor(actual / 2); // 15 de oro → 7
    case 'maximo':
      return maximo;
    case 'todo':
      return 0;
    default:
      return actual + efecto.cantidad; // sumar (también con cantidad negativa = perder)
  }
}

/**
 * Mínimo y máximo de cada recurso. Infinity = sin tope (oro, fama...).
 * El tope de la vida es la vida máxima ACTUAL (la de la hoja + gran fortaleza, si la tiene).
 * Ojo: fuerza, ingenio y vidaMax son aquí los valores de la HOJA (sin condiciones): un efecto
 * "+1 de fuerza" cambia la hoja; lo que da el amuleto se suma aparte al consultar (fuerzaActual...).
 */
function limitesDe(jugador: Jugador, tipo: TipoRecurso, condiciones: readonly Condicion[]): { minimo: number; maximo: number } {
  const minimo = CARACTERISTICAS.includes(tipo) ? 1 : 0;
  switch (tipo) {
    case 'vida':
      return { minimo, maximo: vidaMaxActual(jugador, condiciones) };
    case 'tripulacion':
      return { minimo, maximo: jugador.tripulacionMax };
    case 'comida':
      return { minimo, maximo: AJUSTES.comidaMaxima };
    default:
      return { minimo, maximo: Infinity };
  }
}

function recortar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

/**
 * Consigue un objeto.
 *   - Si cabe, entra (aunque el efecto diga que se tire algo: no hace falta, no se tira nada).
 *   - Si no cabe, se tiran los objetos de "tirar" (posiciones que ha elegido el jugador) y entra.
 *     Si ni tirándolos cabe (o no ha elegido nada), no se tira nada y el objeto no entra.
 */
function ganarObjeto(
  jugador: Jugador,
  idObjeto: string,
  tirar: readonly number[] | undefined,
  catalogos: CatalogosEfectos,
  cambios: Cambio[],
): void {
  const objetos = catalogos.objetos;
  const ficha = buscarFicha(objetos, idObjeto, 'objeto');
  const espacios = ficha.espacios ?? 1;
  const libres = jugador.capacidadInventario - espaciosOcupados(jugador, objetos);

  if (espacios > libres) {
    const posiciones = comprobarPosiciones(jugador, tirar ?? []);
    const liberados = posiciones.reduce((total, p) => total + (buscarFicha(objetos, jugador.inventario[p].id, 'objeto').espacios ?? 1), 0);
    if (espacios > libres + liberados) {
      cambios.push({ tipo: 'objeto_no_cabe', objeto: ficha.id });
      return;
    }
    // De la última posición a la primera, para que al quitar uno no se muevan los demás.
    for (const posicion of [...posiciones].sort((a, b) => b - a)) {
      tirarObjeto(jugador, posicion, cambios);
    }
  }

  jugador.inventario.push(ficha.usosMaximos === undefined ? { id: ficha.id } : { id: ficha.id, usosRestantes: ficha.usosMaximos });
  cambios.push({ tipo: 'objeto_ganado', objeto: ficha.id });

  // Conseguir un objeto mágico da +1 de fama.
  if (ficha.magico) {
    apuntarRecurso(jugador, 'fama', jugador.fama + 1, catalogos.condiciones, cambios, 'objeto_magico');
  }
}

function perderObjeto(jugador: Jugador, idObjeto: string, cambios: Cambio[]): void {
  // Si lleva varios iguales, se pierde uno. Si no lleva ninguno, no pasa nada.
  const posicion = jugador.inventario.findIndex(o => o.id === idObjeto);
  if (posicion !== -1) {
    jugador.inventario.splice(posicion, 1);
    cambios.push({ tipo: 'objeto_perdido', objeto: idObjeto });
  }
}

/** El jugador tira el objeto de esa posición del inventario. */
function tirarObjeto(jugador: Jugador, posicion: number, cambios: Cambio[]): void {
  comprobarPosiciones(jugador, [posicion]);
  const [tirado] = jugador.inventario.splice(posicion, 1);
  cambios.push({ tipo: 'objeto_tirado', objeto: tirado.id });
}

/** Gasta un uso del objeto de esa posición. Si se queda sin usos, se tira solo (se ha agotado). */
function gastarUso(jugador: Jugador, posicion: number, objetos: readonly Objeto[], cambios: Cambio[]): void {
  comprobarPosiciones(jugador, [posicion]);
  const llevado = jugador.inventario[posicion];
  if (llevado.usosRestantes === undefined) {
    throw new Error(`aplicarEfectos: "${llevado.id}" no tiene usos que gastar (es permanente)`);
  }
  buscarFicha(objetos, llevado.id, 'objeto'); // comprueba que existe
  const quedan = llevado.usosRestantes - 1;
  cambios.push({ tipo: 'objeto_usado', objeto: llevado.id, usosRestantes: quedan });
  if (quedan <= 0) {
    jugador.inventario.splice(posicion, 1);
    cambios.push({ tipo: 'objeto_agotado', objeto: llevado.id });
  } else {
    llevado.usosRestantes = quedan;
  }
}

/** Las posiciones tienen que existir en el inventario y no repetirse. Si no, es un fallo del programa: error. */
function comprobarPosiciones(jugador: Jugador, posiciones: readonly number[]): readonly number[] {
  for (const posicion of posiciones) {
    if (!Number.isInteger(posicion) || posicion < 0 || posicion >= jugador.inventario.length) {
      throw new Error(`aplicarEfectos: no hay ningún objeto en la posición ${posicion} del inventario`);
    }
  }
  if (new Set(posiciones).size !== posiciones.length) {
    throw new Error(`aplicarEfectos: hay posiciones repetidas en el inventario: ${posiciones.join(', ')}`);
  }
  return posiciones;
}

// ---------------------------------------------------------------------------
// Condiciones
// ---------------------------------------------------------------------------

function ponerCondicion(
  jugador: Jugador,
  idCondicion: string,
  turnos: number | undefined,
  partes: readonly string[] | undefined,
  condiciones: readonly Condicion[],
  cambios: Cambio[],
): void {
  buscarFicha(condiciones, idCondicion, 'condición'); // comprueba que existe
  for (const parte of partes ?? []) {
    buscarFicha(condiciones, parte, 'condición'); // y las que lleva dentro, también
  }

  const yaActiva = jugador.condiciones.find(c => c.id === idCondicion);
  if (!yaActiva) {
    // Solo se apuntan los campos que tiene: sin turnos = para siempre; sin partes = no lleva nada dentro.
    jugador.condiciones.push({
      id: idCondicion,
      ...(turnos === undefined ? {} : { turnosRestantes: turnos }),
      ...(partes === undefined ? {} : { partes: [...partes] }),
    });
    cambios.push({
      tipo: 'condicion_puesta',
      condicion: idCondicion,
      ...(turnos === undefined ? {} : { turnos }),
      ...(partes === undefined ? {} : { partes: [...partes] }),
    });
    return;
  }

  // Si la nueva lleva cosas dentro (un segundo amuleto maldito), no entra: se queda con el suyo
  // y se avisa, porque la bendición y la maldición del nuevo se pierden.
  if (partes !== undefined) {
    cambios.push({ tipo: 'condicion_no_puesta', condicion: idCondicion, motivo: 'ya_la_tiene' });
    return;
  }

  // Ya la tiene: no se duplica, se queda la que dure más (sin turnos = dura para siempre).
  if (yaActiva.turnosRestantes !== undefined && (turnos === undefined || turnos > yaActiva.turnosRestantes)) {
    if (turnos === undefined) {
      delete yaActiva.turnosRestantes;
    } else {
      yaActiva.turnosRestantes = turnos;
    }
  }
}

/** "Quita una maldición": quita UNA de esa categoría, la más antigua. */
function quitarUnaDeCategoria(jugador: Jugador, categoria: string, condiciones: readonly Condicion[], cambios: Cambio[]): void {
  const posicion = jugador.condiciones.findIndex(c => buscarFicha(condiciones, c.id, 'condición').categoria === categoria);
  quitarCondicion(jugador, posicion, cambios);
}

/** Quita la condición que está en esa posición de la lista (-1 = no la tiene: no pasa nada). */
function quitarCondicion(jugador: Jugador, posicion: number, cambios: Cambio[]): void {
  if (posicion !== -1) {
    const [quitada] = jugador.condiciones.splice(posicion, 1);
    cambios.push({ tipo: 'condicion_quitada', condicion: quitada.id });
  }
}

/**
 * Después de quitar una condición o perder un objeto, los topes pueden haber bajado
 * (se va el amuleto maldito con "gran fortaleza" o con "carisma"). Entonces:
 *   - Si tiene más vida que su vida máxima nueva, la vida baja hasta ella.
 *   - Si lleva más seguidores de los que puede, se marcha UNO AL AZAR (gasta un número del generador)
 *     y se repite mientras sobren. Los inseparables no entran en el sorteo; si solo quedan
 *     inseparables, se quedan todos.
 * Si nada ha bajado, no hace nada (ni gasta dados).
 */
function ajustarALosTopes(jugador: Jugador, dados: Dados, condiciones: readonly Condicion[], cambios: Cambio[]): void {
  apuntarRecurso(jugador, 'vida', jugador.vida, condiciones, cambios); // recorta al tope si hace falta

  while (jugador.seguidores.length > maximoSeguidoresActual(jugador, condiciones)) {
    const candidatos = jugador.seguidores.filter(s => !s.inseparable);
    if (candidatos.length === 0) {
      return;
    }
    const seMarcha = candidatos[dados.entero(0, candidatos.length - 1)];
    jugador.seguidores = jugador.seguidores.filter(s => s !== seMarcha);
    cambios.push({ tipo: 'seguidor_se_marcha', seguidor: seMarcha.id, motivo: 'carisma_perdido' });
  }
}

// ---------------------------------------------------------------------------
// Seguidores
// ---------------------------------------------------------------------------

type EfectoGanarSeguidor = Extract<Efecto, { tipo: 'ganar_seguidor' }>;

/**
 * Se une un seguidor nuevo (el polizón nativo, el forzudo que contratas...).
 *   1. Si una condición prohíbe nuevos seguidores, no entra.
 *   2. Si el grupo está lleno, solo entra si el efecto dice a quién se despide para hacerle sitio
 *      (lo ha elegido el jugador antes). A un inseparable no se le puede despedir.
 *   3. Si entra, crearSeguidor le pone nombre (gasta un número del generador; si no entra, ninguno).
 * Con "al_azar", antes de todo se sortea el tipo (un número del generador, entre o no).
 */
function ganarSeguidor(jugador: Jugador, efecto: EfectoGanarSeguidor, dados: Dados, catalogos: CatalogosEfectos, cambios: Cambio[]): void {
  const tipos = catalogos.seguidores ?? TIPOS_SEGUIDOR;
  // "al_azar": primero se sortea el tipo entre TODOS los del catálogo (gasta un número), y a partir
  // de aquí es como si el efecto hubiera dicho ese tipo.
  if (efecto.seguidor === SEGUIDOR_AL_AZAR) {
    efecto = { ...efecto, seguidor: tipos[dados.entero(0, tipos.length - 1)].id };
  }
  if (!tipos.some(t => t.id === efecto.seguidor)) {
    throw new Error(`aplicarEfectos: no existe el tipo de seguidor "${efecto.seguidor}" en el catálogo`);
  }

  if (estaProhibido(jugador, 'nuevos_seguidores', catalogos.condiciones)) {
    cambios.push({ tipo: 'seguidor_no_se_une', tipoSeguidor: efecto.seguidor, motivo: 'prohibido' });
    return;
  }

  if (jugador.seguidores.length >= maximoSeguidoresActual(jugador, catalogos.condiciones)) {
    if (efecto.despedir === undefined) {
      cambios.push({ tipo: 'seguidor_no_se_une', tipoSeguidor: efecto.seguidor, motivo: 'grupo_lleno' });
      return;
    }
    despedirSeguidor(jugador, efecto.despedir, cambios);
  }
  // (Si había sitio, no se despide a nadie aunque el efecto lo diga: no hace falta.)

  const nuevo = crearSeguidor(
    efecto.seguidor,
    jugador.seguidores,
    dados,
    { inseparable: efecto.inseparable, nombre: efecto.nombre },
    { tipos, nombres: catalogos.nombres ?? LISTAS_DE_NOMBRES },
  );
  jugador.seguidores.push(nuevo);
  cambios.push({ tipo: 'seguidor_se_une', seguidor: nuevo.id });
}

/** El jugador despide a ese seguidor (por su id en la partida) para hacer sitio. */
function despedirSeguidor(jugador: Jugador, idSeguidor: string, cambios: Cambio[]): void {
  const posicion = jugador.seguidores.findIndex(s => s.id === idSeguidor);
  if (posicion === -1) {
    throw new Error(`aplicarEfectos: no se puede despedir a "${idSeguidor}": no está en el grupo`);
  }
  if (jugador.seguidores[posicion].inseparable) {
    throw new Error(`aplicarEfectos: no se puede despedir a "${idSeguidor}": es inseparable`);
  }
  jugador.seguidores.splice(posicion, 1);
  cambios.push({ tipo: 'seguidor_despedido', seguidor: idSeguidor });
}

// ---------------------------------------------------------------------------

function buscarFicha<T extends { id: string }>(catalogo: readonly T[], id: string, que: string): T {
  const ficha = catalogo.find(f => f.id === id);
  if (!ficha) {
    throw new Error(`aplicarEfectos: no existe ${que === 'objeto' ? 'el objeto' : 'la condición'} "${id}" en el catálogo`);
  }
  return ficha;
}
