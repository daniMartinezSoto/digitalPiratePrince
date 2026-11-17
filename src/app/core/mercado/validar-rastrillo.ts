import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Objeto } from '../catalogos/objeto';

const CAMPOS_VALIDOS = ['objeto', 'peso', 'precio'];

/**
 * Revisa el rastrillo y devuelve los errores, explicados en castellano. Lista vacía = está bien.
 * Comprueba que hay una lista de "objetos" con algo dentro y que cada entrada:
 *   - es de un objeto que existe en el catálogo, y no está repetido;
 *   - tiene un peso entero de 1 o más;
 *   - cuesta MÁS que lo que te dan al venderlo (si no, comprar y vender daría oro gratis);
 *   - no tiene campos que sobren.
 */
export function validarRastrillo(rastrillo: unknown, objetos: readonly Objeto[] = OBJETOS): string[] {
  const lista = (rastrillo as Record<string, unknown> | null)?.['objetos'];
  if (!Array.isArray(lista) || lista.length === 0) {
    return ['rastrillo: falta la lista de "objetos" o está vacía.'];
  }

  const errores: string[] = [];
  const vistos = new Set<unknown>();
  lista.forEach((entrada, i) => {
    const e = (entrada ?? {}) as Record<string, unknown>;
    const donde = `rastrillo, entrada ${i + 1} ("${String(e['objeto'])}")`;

    for (const campo of Object.keys(e)) {
      if (!CAMPOS_VALIDOS.includes(campo)) {
        errores.push(`${donde}: el campo "${campo}" sobra (válidos: ${CAMPOS_VALIDOS.join(', ')}).`);
      }
    }
    if (vistos.has(e['objeto'])) {
      errores.push(`${donde}: el objeto está repetido (si quieres que salga más, sube su peso).`);
    }
    vistos.add(e['objeto']);

    const ficha = objetos.find(o => o.id === e['objeto']);
    if (!ficha) {
      errores.push(`${donde}: el objeto no existe en el catálogo de objetos (data/objetos.json).`);
    }
    if (!Number.isInteger(e['peso']) || (e['peso'] as number) < 1) {
      errores.push(`${donde}: el peso debe ser un número entero de 1 o más.`);
    }
    if (!Number.isInteger(e['precio']) || (e['precio'] as number) < 1) {
      errores.push(`${donde}: el precio debe ser un número entero de 1 o más.`);
    } else if (ficha && (e['precio'] as number) <= ficha.precioVenta) {
      errores.push(`${donde}: cuesta ${String(e['precio'])} y al venderlo te dan ${ficha.precioVenta}: tiene que costar más.`);
    }
  });
  return errores;
}
