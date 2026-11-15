import { validarModificadores } from '../modificadores/validar-modificadores';
import { CATEGORIAS_CONDICION, type Condicion } from './condicion';

// Formato de los ids: minúsculas, números y guiones bajos ("el_mal").
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;
const CATEGORIAS: readonly string[] = CATEGORIAS_CONDICION;

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

  return errores;
}

function esTextoConContenido(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}
