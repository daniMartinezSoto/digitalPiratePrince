import { validarModificadores } from '../modificadores/validar-modificadores';
import { TABLAS } from '../tablas/rangos/cargar-tablas';
import { validarEfecto } from '../tablas/rangos/validar-tabla';
import { AJUSTES_DE_CONDICION, CATEGORIAS_CONDICION, LUGARES_DE_LLEGADA, PROHIBICIONES, type Condicion } from './condicion';

// Formato de los ids: minúsculas, números y guiones bajos ("el_mal").
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;
const CATEGORIAS: readonly string[] = CATEGORIAS_CONDICION;
const PROHIBICIONES_VALIDAS: readonly string[] = PROHIBICIONES;
const AJUSTES_VALIDOS: readonly string[] = AJUSTES_DE_CONDICION;
const LUGARES_VALIDOS: readonly string[] = LUGARES_DE_LLEGADA;

/**
 * Revisa el catálogo de condiciones completo y devuelve la lista de errores, en castellano.
 * Lista vacía = el catálogo está bien. Se usa en los tests, no durante la partida.
 */
export function validarCondiciones(condiciones: Condicion[]): string[] {
  const errores: string[] = [];

  const vistos = new Set<string>();
  for (const condicion of condiciones) {
    if (vistos.has(condicion.id)) {
      errores.push(`El id "${condicion.id}" está repetido.`);
    }
    vistos.add(condicion.id);
  }

  for (const condicion of condiciones) {
    errores.push(...validarCondicion(condicion));
  }

  return errores;
}

/** Revisa una condición suelta. La miramos como objeto genérico: en el JSON puede venir cualquier cosa. */
function validarCondicion(condicion: Condicion): string[] {
  const errores: string[] = [];
  const c = condicion as unknown as Record<string, unknown>;
  const nombre = `Condición "${String(c['id'])}"`;

  if (typeof c['id'] !== 'string' || !FORMATO_ID.test(c['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "el_mal").`);
  }
  if (!esTextoConContenido(c['nombre'])) {
    errores.push(`${nombre}: le falta el nombre.`);
  }
  if (!esTextoConContenido(c['descripcion'])) {
    errores.push(`${nombre}: le falta la descripción.`);
  }
  if (c['imagen'] !== undefined && !esTextoConContenido(c['imagen'])) {
    errores.push(`${nombre}: la imagen debe ser la ruta del dibujo (un texto).`);
  }
  if (typeof c['categoria'] !== 'string' || !CATEGORIAS.includes(c['categoria'])) {
    errores.push(`${nombre}: la categoría "${String(c['categoria'])}" no existe (válidas: ${CATEGORIAS_CONDICION.join(', ')}).`);
  }

  errores.push(...validarModificadores(c['modificadores'], nombre));
  errores.push(...validarProhibe(c['prohibe'], nombre));
  errores.push(...validarAjustes(c['ajustes'], nombre));
  errores.push(...validarCadaTurno(c['cadaTurno'], nombre));
  errores.push(...validarAlLlegar(c['alLlegar'], nombre));

  return errores;
}

/** "prohibe": una lista de prohibiciones que existen, sin repetir. */
function validarProhibe(prohibe: unknown, nombre: string): string[] {
  if (prohibe === undefined) {
    return [];
  }
  if (!Array.isArray(prohibe) || prohibe.length === 0) {
    return [`${nombre}: "prohibe" debe ser una lista con al menos una prohibición (si no prohíbe nada, quita el campo).`];
  }

  const errores: string[] = [];
  const vistas = new Set<unknown>();
  for (const prohibicion of prohibe) {
    if (!PROHIBICIONES_VALIDAS.includes(prohibicion)) {
      errores.push(`${nombre}: la prohibición "${String(prohibicion)}" no existe (válidas: ${PROHIBICIONES.join(', ')}).`);
    } else if (vistas.has(prohibicion)) {
      errores.push(`${nombre}: la prohibición "${prohibicion}" está repetida.`);
    }
    vistas.add(prohibicion);
  }
  return errores;
}

/** "ajustes": reglas que existen, cada una con un número entero distinto de 0. */
function validarAjustes(ajustes: unknown, nombre: string): string[] {
  if (ajustes === undefined) {
    return [];
  }
  if (typeof ajustes !== 'object' || ajustes === null || Array.isArray(ajustes)) {
    return [`${nombre}: "ajustes" debe ser una lista de reglas con su número, p. ej. { "famaObjetivo": 2 }.`];
  }

  const errores: string[] = [];
  for (const [regla, valor] of Object.entries(ajustes)) {
    if (!AJUSTES_VALIDOS.includes(regla)) {
      errores.push(`${nombre}: el ajuste "${regla}" no existe (válidos: ${AJUSTES_DE_CONDICION.join(', ')}).`);
    } else if (!Number.isInteger(valor) || valor === 0) {
      errores.push(`${nombre}: el ajuste "${regla}" debe ser un número entero distinto de 0.`);
    }
  }
  return errores;
}

function esTextoConContenido(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}

/** "cadaTurno": efectos, una tabla que existe, o las dos cosas. */
function validarCadaTurno(cadaTurno: unknown, nombre: string): string[] {
  if (cadaTurno === undefined) {
    return [];
  }
  if (!esFicha(cadaTurno)) {
    return [`${nombre}: "cadaTurno" debe llevar "efectos", "tabla" o las dos cosas.`];
  }

  const donde = `${nombre}, cadaTurno`;
  const errores: string[] = [...camposQueSobran(cadaTurno, ['efectos', 'tabla'], donde)];

  if (cadaTurno['efectos'] === undefined && cadaTurno['tabla'] === undefined) {
    errores.push(`${donde}: está vacío (necesita "efectos", "tabla" o las dos cosas).`);
  }
  errores.push(...validarEfectos(cadaTurno['efectos'], donde));

  const tabla = cadaTurno['tabla'];
  if (tabla !== undefined && !TABLAS.some(t => t.id === tabla)) {
    errores.push(`${donde}: la tabla "${String(tabla)}" no existe (data/tablas/ y cargar-tablas.ts).`);
  }
  return errores;
}

/** "alLlegar": un lugar que existe y, si quiere, efectos y un evento. */
function validarAlLlegar(alLlegar: unknown, nombre: string): string[] {
  if (alLlegar === undefined) {
    return [];
  }
  if (!esFicha(alLlegar)) {
    return [`${nombre}: "alLlegar" debe llevar el "lugar" (p. ej. { "lugar": "tierra" }).`];
  }

  const donde = `${nombre}, alLlegar`;
  const errores: string[] = [...camposQueSobran(alLlegar, ['lugar', 'efectos', 'evento'], donde)];

  const lugar = alLlegar['lugar'];
  if (typeof lugar !== 'string' || !LUGARES_VALIDOS.includes(lugar)) {
    errores.push(`${donde}: el lugar "${String(lugar)}" no existe (válidos: ${LUGARES_DE_LLEGADA.join(', ')}).`);
  }
  errores.push(...validarEfectos(alLlegar['efectos'], donde));

  const evento = alLlegar['evento'];
  if (evento !== undefined && (typeof evento !== 'string' || !FORMATO_ID.test(evento))) {
    errores.push(`${donde}: el evento "${String(evento)}" debe ir en minúsculas y con guiones bajos.`);
  }
  return errores;
}

/** Una lista de efectos escrita en la ficha: se revisa igual que los efectos de una tabla. */
function validarEfectos(efectos: unknown, donde: string): string[] {
  if (efectos === undefined) {
    return [];
  }
  if (!Array.isArray(efectos) || efectos.length === 0) {
    return [`${donde}: "efectos" debe ser una lista con al menos un efecto (si no hay ninguno, quita el campo).`];
  }
  return efectos.flatMap(efecto => validarEfecto(efecto, donde));
}

function camposQueSobran(ficha: Record<string, unknown>, permitidos: string[], donde: string): string[] {
  const sobran = Object.keys(ficha).filter(campo => !permitidos.includes(campo));
  return sobran.length === 0 ? [] : [`${donde}: sobra ${sobran.map(c => `"${c}"`).join(', ')}.`];
}

function esFicha(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
