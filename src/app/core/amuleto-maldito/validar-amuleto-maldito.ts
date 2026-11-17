import { CONDICIONES } from '../catalogos/cargar-condiciones';
import type { CategoriaCondicion, Condicion } from '../catalogos/condicion';
import { validarEfecto } from '../tablas/rangos/validar-tabla';

const FORMATO_ID = /^[a-z][a-z0-9_]*$/;
const CAMPOS_VALIDOS = ['condicion', 'evento', 'alRecibir'];

/**
 * Revisa las tablas del amuleto maldito y devuelve los errores, explicados en castellano.
 * Lista vacía = está bien. No lanza errores: así se ven todos los fallos de una vez.
 * Comprueba que:
 *   - hay una lista de "bendiciones" y otra de "maldiciones", y ninguna está vacía;
 *   - cada resultado lleva una "condicion" o un "evento" (uno de los dos, no ambos);
 *   - la condición existe en el catálogo y es de su tipo (en bendiciones, una bendición;
 *     en maldiciones, una maldición);
 *   - los efectos de "alRecibir" están bien escritos y no hay campos que sobren.
 */
export function validarAmuletoMaldito(amuleto: unknown, condiciones: readonly Condicion[] = CONDICIONES): string[] {
  if (typeof amuleto !== 'object' || amuleto === null) {
    return ['amuleto maldito: debe tener una lista de "bendiciones" y otra de "maldiciones".'];
  }
  const a = amuleto as Record<string, unknown>;
  return [
    ...validarLista(a['bendiciones'], 'bendiciones', 'bendicion', condiciones),
    ...validarLista(a['maldiciones'], 'maldiciones', 'maldicion', condiciones),
  ];
}

function validarLista(lista: unknown, nombre: string, categoria: CategoriaCondicion, condiciones: readonly Condicion[]): string[] {
  if (!Array.isArray(lista) || lista.length === 0) {
    return [`amuleto maldito: falta la lista de "${nombre}" o está vacía.`];
  }
  return lista.flatMap((resultado, i) => validarResultado(resultado, `amuleto maldito, ${nombre}, resultado ${i + 1}`, categoria, condiciones));
}

function validarResultado(resultado: unknown, donde: string, categoria: CategoriaCondicion, condiciones: readonly Condicion[]): string[] {
  if (typeof resultado !== 'object' || resultado === null || Array.isArray(resultado)) {
    return [`${donde}: debe ser una ficha, p. ej. { "condicion": "fuerza_letal" }.`];
  }
  const r = resultado as Record<string, unknown>;
  const errores: string[] = [];

  for (const campo of Object.keys(r)) {
    if (!CAMPOS_VALIDOS.includes(campo)) {
      errores.push(`${donde}: el campo "${campo}" sobra (válidos: ${CAMPOS_VALIDOS.join(', ')}).`);
    }
  }

  const tieneCondicion = r['condicion'] !== undefined;
  const tieneEvento = r['evento'] !== undefined;
  if (tieneCondicion === tieneEvento) {
    errores.push(`${donde}: necesita una "condicion" o un "evento" (uno de los dos, no ambos).`);
  }

  if (tieneCondicion) {
    const ficha = condiciones.find(c => c.id === r['condicion']);
    if (!ficha) {
      errores.push(`${donde}: la condición "${String(r['condicion'])}" no existe en el catálogo de condiciones (data/condiciones.json).`);
    } else if (ficha.categoria !== categoria) {
      errores.push(`${donde}: la condición "${ficha.id}" es de categoría "${ficha.categoria}" y aquí debe ser "${categoria}".`);
    }
  }

  if (tieneEvento && (typeof r['evento'] !== 'string' || !FORMATO_ID.test(r['evento']))) {
    errores.push(`${donde}: el evento "${String(r['evento'])}" debe ir en minúsculas y con guiones bajos.`);
  }

  if (r['alRecibir'] !== undefined) {
    if (!Array.isArray(r['alRecibir'])) {
      errores.push(`${donde}: "alRecibir" debe ser una lista de efectos.`);
    } else {
      for (const efecto of r['alRecibir']) {
        errores.push(...validarEfecto(efecto, `${donde}, alRecibir`));
      }
    }
  }

  return errores;
}
