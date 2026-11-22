import { BARCOS } from '../catalogos/cargar-barcos';
import { OBJETOS } from '../catalogos/cargar-objetos';
import { validarPedidosDeEnemigos } from '../catalogos/validar-barco';
import { ENCUENTROS } from '../encuentros/cargar-encuentros';
import { rangoDeTirada } from '../dados/tirada';
import { validarEfecto } from '../tablas/rangos/validar-tabla';
import { PASO_INICIAL, REQUISITOS, type Evento } from './evento';

// REVISOR DE EVENTOS (Sprint 10, paso 1). Revisa lo que se escribe en data/eventos/ y devuelve
// los errores en castellano, todos a la vez. Lista vacía = está bien. No lanza errores.
// Se usa en los tests (el del cargador revisa TODOS los eventos), no durante la partida.
//
// Qué comprueba:
//   - el evento: id, título, "inicio", campos que sobran, ids repetidos;
//   - cada paso: que no esté vacío, que tenga UNA sola forma de seguir, que los pasos a los que
//     salta existan y que se pueda llegar a él desde "inicio";
//   - opciones, tiradas (sin huecos ni solapes, como las tablas), chequeos y combates;
//   - los efectos, con el revisor de siempre (objetos, condiciones y seguidores del catálogo).
// Lo que NO puede comprobar todavía: que los eventos a los que se salta existan. Mientras falten,
// el juego los enseña como "pendientes". La lista de los que faltan la da eventosQueFaltan.

const FORMATO_ID = /^[a-z][a-z0-9_]*$/;
const FORMATO_LIBRO = /^E\d{3}$/;

const CAMPOS_EVENTO = ['id', 'titulo', 'imagen', 'unaVez', 'pasos', 'libro'];
const CAMPOS_RAMA = ['texto', 'efectos', 'paso', 'evento', 'llamar'];
const SALIDAS_CON_ELECCION = ['opciones', 'tirada', 'chequeo', 'combate', 'combateNaval'];
const CAMPOS_PASO = [...CAMPOS_RAMA, ...SALIDAS_CON_ELECCION];
const CAMPOS_OPCION = ['texto', 'requiere', 'efectos', 'paso', 'evento', 'llamar'];
const CAMPOS_TIRADA = ['dado', 'modificador', 'filas'];
const CAMPOS_FILA = ['min', 'max', 'volverATirar', ...CAMPOS_RAMA];
const CAMPOS_CHEQUEO = ['caracteristica', 'modificador', 'exito', 'fallo'];
const CAMPOS_COMBATE = ['enemigos', 'encuentro', 'puedeHuir', 'noMortal', 'sorpresa', 'victoria', 'huida', 'derrota'];
const CAMPOS_COMBATE_NAVAL = ['barco', 'victoria', 'huida'];
const SORPRESAS = ['nuestra', 'suya'];
const CARACTERISTICAS = ['fuerza', 'ingenio'];

type Objeto = Record<string, unknown>;

/** Revisa una lista de eventos completa (ids repetidos y cada evento). */
export function validarEventos(eventos: readonly Evento[]): string[] {
  const errores: string[] = [];
  const vistos = new Set<string>();
  for (const evento of eventos) {
    if (vistos.has(evento.id)) {
      errores.push(`El evento "${evento.id}" está repetido.`);
    }
    vistos.add(evento.id);
  }
  for (const evento of eventos) {
    errores.push(...validarEvento(evento));
  }
  return errores;
}

/** Revisa un evento suelto. Lo mira como objeto genérico: en el JSON puede venir cualquier cosa. */
export function validarEvento(evento: Evento): string[] {
  const e = evento as unknown as Objeto;
  const nombre = `Evento "${String(e['id'])}"`;
  const errores: string[] = [];

  if (typeof e['id'] !== 'string' || !FORMATO_ID.test(e['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "taberna_clandestina").`);
  }
  if (!esTexto(e['titulo'])) {
    errores.push(`${nombre}: le falta el título.`);
  }
  if (e['imagen'] !== undefined && !esTexto(e['imagen'])) {
    errores.push(`${nombre}: la imagen debe ser la ruta del dibujo (un texto).`);
  }
  if (e['unaVez'] !== undefined && typeof e['unaVez'] !== 'boolean') {
    errores.push(`${nombre}: "unaVez" debe ser true o false.`);
  }
  if (e['libro'] !== undefined && (typeof e['libro'] !== 'string' || !FORMATO_LIBRO.test(e['libro']))) {
    errores.push(`${nombre}: "libro" debe ser el código del libro de papel (p. ej. "E041").`);
  }
  errores.push(...camposQueSobran(e, CAMPOS_EVENTO, nombre));

  const pasos = e['pasos'];
  if (!esObjeto(pasos) || Object.keys(pasos).length === 0) {
    errores.push(`${nombre}: le faltan los pasos.`);
    return errores;
  }
  if (!(PASO_INICIAL in pasos)) {
    errores.push(`${nombre}: no tiene el paso "${PASO_INICIAL}" (todo evento empieza por ahí).`);
  }

  const contexto: Contexto = { idEvento: String(e['id']), nombresDePasos: new Set(Object.keys(pasos)) };
  for (const [nombreDelPaso, paso] of Object.entries(pasos)) {
    const donde = `${nombre}, paso "${nombreDelPaso}"`;
    if (!FORMATO_ID.test(nombreDelPaso)) {
      errores.push(`${donde}: el nombre del paso debe ir en minúsculas y con guiones bajos.`);
    }
    errores.push(...validarPaso(paso, donde, contexto));
  }

  // Pasos a los que nunca se llega: casi siempre, un salto mal escrito.
  if (PASO_INICIAL in pasos) {
    const alcanzables = pasosAlcanzables(pasos as Record<string, unknown>);
    for (const nombreDelPaso of Object.keys(pasos)) {
      if (!alcanzables.has(nombreDelPaso)) {
        errores.push(`${nombre}, paso "${nombreDelPaso}": no se llega a él desde "${PASO_INICIAL}" (¿falta un "paso" que lleve aquí?).`);
      }
    }
  }

  return errores;
}

/**
 * Los eventos a los que saltan los eventos escritos ("evento" o "llamar") y que todavía no existen.
 * No es un error: el juego los enseña como pendientes. Sirve para saber qué falta por escribir.
 */
export function eventosQueFaltan(eventos: readonly Evento[]): string[] {
  const existentes = new Set(eventos.map(e => e.id));
  const faltan = new Set<string>();
  for (const evento of eventos) {
    for (const id of eventosALosQueSalta(evento)) {
      if (!existentes.has(id)) faltan.add(id);
    }
  }
  return [...faltan].sort();
}

/** Todos los ids de evento que aparecen en "evento" o "llamar" dentro de un evento, sin repetir. */
export function eventosALosQueSalta(evento: Evento): string[] {
  const ids = new Set<string>();
  recorrer(evento.pasos, valor => {
    if (esObjeto(valor)) {
      for (const campo of ['evento', 'llamar']) {
        if (typeof valor[campo] === 'string') ids.add(valor[campo] as string);
      }
    }
  });
  return [...ids];
}

// ---------------------------------------------------------------------------
// Pasos y ramas
// ---------------------------------------------------------------------------

interface Contexto {
  idEvento: string;
  nombresDePasos: Set<string>;
}

function validarPaso(paso: unknown, donde: string, contexto: Contexto): string[] {
  if (!esObjeto(paso)) {
    return [`${donde}: debe ser un objeto con texto, efectos y por dónde se sigue.`];
  }
  const errores: string[] = [...camposQueSobran(paso, CAMPOS_PASO, donde)];

  const conEleccion = SALIDAS_CON_ELECCION.filter(campo => paso[campo] !== undefined);
  if (conEleccion.length > 1) {
    errores.push(`${donde}: tiene ${conEleccion.map(c => `"${c}"`).join(' y ')}; un paso solo puede tener una de ellas (separa el resto en otro paso).`);
  }
  if (conEleccion.length > 0) {
    const sueltos = ['paso', 'evento', 'llamar'].filter(campo => paso[campo] !== undefined);
    if (sueltos.length > 0) {
      errores.push(
        `${donde}: "${conEleccion[0]}" ya dice por dónde se sigue, así que sobra ${sueltos.map(c => `"${c}"`).join(' y ')} (ponlo dentro de cada salida).`,
      );
    }
  }

  if (paso['texto'] === undefined && paso['efectos'] === undefined && conEleccion.length === 0 && paso['paso'] === undefined && paso['evento'] === undefined && paso['llamar'] === undefined) {
    errores.push(`${donde}: está vacío (necesita al menos texto, efectos o por dónde se sigue).`);
  }

  errores.push(...validarRama(paso, donde, contexto, false));

  if (paso['opciones'] !== undefined) errores.push(...validarOpciones(paso['opciones'], donde, contexto));
  if (paso['tirada'] !== undefined) errores.push(...validarTirada(paso['tirada'], `${donde}, tirada`, contexto));
  if (paso['chequeo'] !== undefined) errores.push(...validarChequeo(paso['chequeo'], `${donde}, chequeo`, contexto));
  if (paso['combate'] !== undefined) errores.push(...validarCombate(paso['combate'], `${donde}, combate`, contexto));
  if (paso['combateNaval'] !== undefined) errores.push(...validarCombateNaval(paso['combateNaval'], `${donde}, combate naval`, contexto));

  return errores;
}

/**
 * Lo común de pasos, ramas y opciones: texto, efectos y paso / evento / llamar.
 * conCampos = revisar también los campos que sobran (los pasos y las filas lo hacen ellos, con su lista).
 */
function validarRama(rama: Objeto, donde: string, contexto: Contexto, conCampos: boolean): string[] {
  const errores: string[] = conCampos ? camposQueSobran(rama, CAMPOS_RAMA, donde) : [];

  if (rama['texto'] !== undefined && !esTexto(rama['texto'])) {
    errores.push(`${donde}: el texto debe ser un texto con algo escrito (si no tiene, no lo pongas).`);
  }

  const efectos = rama['efectos'];
  if (efectos !== undefined) {
    if (!Array.isArray(efectos) || efectos.length === 0) {
      errores.push(`${donde}: "efectos" debe ser una lista de efectos (si no tiene ninguno, no la pongas).`);
    } else {
      efectos.forEach((efecto, i) => errores.push(...validarEfecto(efecto, `${donde}, efecto ${i + 1}`)));
    }
  }

  const paso = rama['paso'];
  if (paso !== undefined) {
    if (typeof paso !== 'string' || !contexto.nombresDePasos.has(paso)) {
      errores.push(`${donde}: el paso "${String(paso)}" no existe en este evento.`);
    } else if (rama['evento'] !== undefined) {
      errores.push(`${donde}: "evento" salta a otro evento sin volver, así que no puede llevar también "paso" (¿querías "llamar"?).`);
    }
  }

  if (rama['evento'] !== undefined && rama['llamar'] !== undefined) {
    errores.push(`${donde}: lleva "evento" y "llamar"; elige uno (evento = sin volver, llamar = y volver).`);
  }
  for (const campo of ['evento', 'llamar']) {
    const id = rama[campo];
    if (id === undefined) continue;
    if (typeof id !== 'string' || !FORMATO_ID.test(id)) {
      errores.push(`${donde}: el evento "${String(id)}" debe ir en minúsculas y con guiones bajos.`);
    } else if (id === contexto.idEvento) {
      errores.push(`${donde}: salta a su propio evento; para repetir algo, usa "paso".`);
    }
  }

  return errores;
}

function validarOpciones(opciones: unknown, donde: string, contexto: Contexto): string[] {
  if (!Array.isArray(opciones) || opciones.length === 0) {
    return [`${donde}: "opciones" debe ser una lista con al menos una opción.`];
  }
  const errores: string[] = [];
  opciones.forEach((opcion, i) => {
    const dondeOpcion = `${donde}, opción ${i + 1}`;
    if (!esObjeto(opcion)) {
      errores.push(`${dondeOpcion}: debe ser un objeto con su "texto".`);
      return;
    }
    errores.push(...camposQueSobran(opcion, CAMPOS_OPCION, dondeOpcion));
    if (!esTexto(opcion['texto'])) {
      errores.push(`${dondeOpcion}: le falta el texto del botón.`);
    }
    // El texto de una opción es el del botón; el resto se revisa como una rama.
    errores.push(...validarRama({ ...opcion, texto: undefined }, dondeOpcion, contexto, false));
    if (opcion['requiere'] !== undefined) {
      errores.push(...validarRequisitos(opcion['requiere'], dondeOpcion));
    }
  });
  return errores;
}

function validarRequisitos(requiere: unknown, donde: string): string[] {
  if (!esObjeto(requiere) || Object.keys(requiere).length === 0) {
    return [`${donde}: "requiere" debe tener al menos un requisito (si no tiene, no lo pongas).`];
  }
  const errores: string[] = [];
  for (const [clave, valor] of Object.entries(requiere)) {
    if (!(REQUISITOS as readonly string[]).includes(clave)) {
      errores.push(`${donde}: el requisito "${clave}" no existe (válidos: ${REQUISITOS.join(', ')}).`);
    } else if (clave === 'sinObjeto' && (typeof valor !== 'string' || !OBJETOS.some(o => o.id === valor))) {
      errores.push(`${donde}: el objeto "${String(valor)}" de "sinObjeto" no existe en el catálogo de objetos (data/objetos.json).`);
    } else if (clave === 'puedeSubir' && valor !== 'fuerza' && valor !== 'ingenio') {
      errores.push(`${donde}: "puedeSubir" debe ser "fuerza" o "ingenio".`);
    } else if (clave === 'puedeGanarSeguidor' && valor !== true) {
      errores.push(`${donde}: "puedeGanarSeguidor" solo puede ser true (si no hace falta, no lo pongas).`);
    }
  }
  return errores;
}

function validarTirada(tirada: unknown, donde: string, contexto: Contexto): string[] {
  if (!esObjeto(tirada)) {
    return [`${donde}: debe ser un objeto con "dado" y "filas".`];
  }
  const errores: string[] = [...camposQueSobran(tirada, CAMPOS_TIRADA, donde)];

  let rango: { min: number; max: number } | null = null;
  try {
    rango = rangoDeTirada(String(tirada['dado']));
  } catch {
    errores.push(`${donde}: el dado "${String(tirada['dado'])}" no es válido (ejemplos: "1d6", "2d6", "1d6+1").`);
  }
  if (tirada['modificador'] !== undefined && !Number.isInteger(tirada['modificador'])) {
    errores.push(`${donde}: el modificador debe ser un número entero.`);
  }

  const filas = tirada['filas'];
  if (!Array.isArray(filas) || filas.length === 0) {
    errores.push(`${donde}: no tiene filas.`);
    return errores;
  }

  const buenas: { min: number; max: number }[] = [];
  for (const fila of filas) {
    if (!esObjeto(fila)) {
      errores.push(`${donde}: cada fila debe ser un objeto con "min" y "max".`);
      continue;
    }
    const dondeFila = `${donde}, fila ${String(fila['min'])}-${String(fila['max'])}`;
    errores.push(...camposQueSobran(fila, CAMPOS_FILA, dondeFila));
    if (!Number.isInteger(fila['min']) || !Number.isInteger(fila['max'])) {
      errores.push(`${dondeFila}: "min" y "max" deben ser números enteros.`);
    } else if ((fila['min'] as number) > (fila['max'] as number)) {
      errores.push(`${dondeFila}: "min" es mayor que "max".`);
    } else {
      buenas.push({ min: fila['min'] as number, max: fila['max'] as number });
    }
    if (fila['texto'] === undefined && fila['efectos'] === undefined && fila['paso'] === undefined && fila['evento'] === undefined && fila['llamar'] === undefined && fila['volverATirar'] === undefined) {
      errores.push(`${dondeFila}: está vacía (necesita al menos texto, efectos o por dónde se sigue).`);
    }
    if (fila['volverATirar'] !== undefined) {
      if (fila['volverATirar'] !== true) {
        errores.push(`${dondeFila}: "volverATirar" solo puede ser true (si no se vuelve a tirar, no lo pongas).`);
      } else if (fila['paso'] !== undefined || fila['evento'] !== undefined || fila['llamar'] !== undefined) {
        errores.push(`${dondeFila}: si se vuelve a tirar, no puede saltar a otro sitio ("paso", "evento" o "llamar").`);
      }
    }
    errores.push(...validarRama(fila, dondeFila, contexto, false));
  }

  // Las filas juntas: sin huecos ni solapes y cubriendo exactamente lo que saca el dado.
  const ordenadas = [...buenas].sort((a, b) => a.min - b.min);
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const actual = ordenadas[i];
    if (actual.min > anterior.max + 1) {
      errores.push(`${donde}: hay un hueco entre ${anterior.max} y ${actual.min}.`);
    }
    if (actual.min <= anterior.max) {
      errores.push(`${donde}: las filas ${anterior.min}-${anterior.max} y ${actual.min}-${actual.max} se pisan.`);
    }
  }
  if (rango && ordenadas.length > 0) {
    const primera = ordenadas[0].min;
    const ultima = Math.max(...ordenadas.map(f => f.max));
    if (primera !== rango.min) {
      errores.push(`${donde}: "${String(tirada['dado'])}" saca como mínimo ${rango.min}, pero la primera fila empieza en ${primera}.`);
    }
    if (ultima !== rango.max) {
      errores.push(`${donde}: "${String(tirada['dado'])}" saca como máximo ${rango.max}, pero la última fila acaba en ${ultima}.`);
    }
  }

  return errores;
}

function validarChequeo(chequeo: unknown, donde: string, contexto: Contexto): string[] {
  if (!esObjeto(chequeo)) {
    return [`${donde}: debe ser un objeto con "caracteristica", "exito" y "fallo".`];
  }
  const errores: string[] = [...camposQueSobran(chequeo, CAMPOS_CHEQUEO, donde)];
  if (typeof chequeo['caracteristica'] !== 'string' || !CARACTERISTICAS.includes(chequeo['caracteristica'])) {
    errores.push(`${donde}: la característica debe ser "fuerza" o "ingenio".`);
  }
  if (chequeo['modificador'] !== undefined && !Number.isInteger(chequeo['modificador'])) {
    errores.push(`${donde}: el modificador debe ser un número entero.`);
  }
  for (const salida of ['exito', 'fallo']) {
    errores.push(...validarSalida(chequeo[salida], `${donde}, ${salida === 'exito' ? 'éxito' : 'fallo'}`, contexto, true));
  }
  return errores;
}

function validarCombate(combate: unknown, donde: string, contexto: Contexto): string[] {
  if (!esObjeto(combate)) {
    return [`${donde}: debe ser un objeto con sus "enemigos".`];
  }
  const errores: string[] = [...camposQueSobran(combate, CAMPOS_COMBATE, donde)];

  const enemigos = combate['enemigos'];
  const encuentro = combate['encuentro'];
  if (enemigos !== undefined && encuentro !== undefined) {
    errores.push(`${donde}: tiene "enemigos" y "encuentro"; pon solo uno (enemigos fijos o un encuentro al azar).`);
  } else if (encuentro !== undefined) {
    if (typeof encuentro !== 'string' || !ENCUENTROS.some(e => e.id === encuentro)) {
      errores.push(`${donde}: el encuentro "${String(encuentro)}" no existe (data/encuentros.json).`);
    }
  } else if (!Array.isArray(enemigos) || enemigos.length === 0) {
    errores.push(`${donde}: le faltan los enemigos (o un "encuentro").`);
  } else {
    errores.push(...validarPedidosDeEnemigos(enemigos, `${donde}, enemigo`));
  }
  for (const campo of ['puedeHuir', 'noMortal']) {
    if (combate[campo] !== undefined && typeof combate[campo] !== 'boolean') {
      errores.push(`${donde}: "${campo}" debe ser true o false.`);
    }
  }
  if (combate['sorpresa'] !== undefined && !SORPRESAS.includes(String(combate['sorpresa']))) {
    errores.push(`${donde}: la sorpresa debe ser "nuestra" (emboscáis vosotros) o "suya" (¡emboscada!).`);
  }
  if (combate['huida'] !== undefined && combate['puedeHuir'] === false) {
    errores.push(`${donde}: tiene "huida", pero de este combate no se puede huir ("puedeHuir": false).`);
  }
  if (combate['derrota'] !== undefined && combate['noMortal'] !== true) {
    errores.push(`${donde}: tiene "derrota", pero caer en un combate normal es perder la partida; solo vale con "noMortal": true.`);
  }
  for (const salida of ['victoria', 'huida', 'derrota']) {
    errores.push(...validarSalida(combate[salida], `${donde}, ${salida}`, contexto, false));
  }
  return errores;
}

function validarCombateNaval(combate: unknown, donde: string, contexto: Contexto): string[] {
  if (!esObjeto(combate)) {
    return [`${donde}: debe ser un objeto con su "barco".`];
  }
  const errores: string[] = [...camposQueSobran(combate, CAMPOS_COMBATE_NAVAL, donde)];
  if (typeof combate['barco'] !== 'string' || !BARCOS.some(b => b.id === combate['barco'])) {
    errores.push(`${donde}: el barco "${String(combate['barco'])}" no existe en el catálogo de barcos (data/barcos.json).`);
  }
  for (const salida of ['victoria', 'huida']) {
    errores.push(...validarSalida(combate[salida], `${donde}, ${salida}`, contexto, false));
  }
  return errores;
}

/** Una salida (éxito, fallo, victoria...): una rama. obligatoria = tiene que estar (puede ser {}). */
function validarSalida(salida: unknown, donde: string, contexto: Contexto, obligatoria: boolean): string[] {
  if (salida === undefined) {
    return obligatoria ? [`${donde}: falta (si no pasa nada, escribe {} o un texto).`] : [];
  }
  if (!esObjeto(salida)) {
    return [`${donde}: debe ser un objeto con texto, efectos y por dónde se sigue.`];
  }
  return validarRama(salida, donde, contexto, true);
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Los pasos a los que se puede llegar desde "inicio", siguiendo todos los "paso" que hay dentro. */
function pasosAlcanzables(pasos: Record<string, unknown>): Set<string> {
  const alcanzables = new Set<string>();
  const pendientes = [PASO_INICIAL];
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (alcanzables.has(actual) || !(actual in pasos)) continue;
    alcanzables.add(actual);
    recorrer(pasos[actual], valor => {
      if (esObjeto(valor) && typeof valor['paso'] === 'string') pendientes.push(valor['paso']);
    });
  }
  return alcanzables;
}

/** Visita un valor y todo lo que lleva dentro (objetos y listas), en cualquier profundidad. */
function recorrer(valor: unknown, visitar: (valor: unknown) => void): void {
  visitar(valor);
  if (Array.isArray(valor)) {
    valor.forEach(v => recorrer(v, visitar));
  } else if (esObjeto(valor)) {
    // Los efectos no tienen saltos dentro: no hace falta mirarlos (y "siNoHay" no es un paso).
    for (const [clave, v] of Object.entries(valor)) {
      if (clave !== 'efectos') recorrer(v, visitar);
    }
  }
}

function camposQueSobran(objeto: Objeto, validos: string[], donde: string): string[] {
  return Object.keys(objeto)
    .filter(campo => !validos.includes(campo))
    .map(campo => `${donde}: el campo "${campo}" no existe (válidos: ${validos.join(', ')}).`);
}

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}
