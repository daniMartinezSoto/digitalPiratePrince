import { validarPedidosDeEnemigos } from '../catalogos/validar-barco';
import { rangoDeTirada } from '../dados/tirada';
import { validarEfecto } from '../tablas/rangos/validar-tabla';
import type { Encuentro } from './encuentro';

// REVISOR DE ENCUENTROS (Sprint 10, paso 7). Devuelve los errores en castellano, todos a la vez.
// Lista vacía = está bien. Comprueba: id, dado, filas sin huecos ni solapes que cubren lo que saca el
// dado, cada fila con su texto y sus enemigos (del bestiario), la recompensa y los campos que sobran.

const FORMATO_ID = /^[a-z][a-z0-9_]*$/;
const CAMPOS = ['id', 'dado', 'filas', 'recompensaPorEnemigo', 'libro'];
const CAMPOS_FILA = ['min', 'max', 'texto', 'enemigos'];

type Objeto = Record<string, unknown>;

export function validarEncuentros(encuentros: readonly Encuentro[]): string[] {
  const errores: string[] = [];
  const vistos = new Set<string>();
  for (const encuentro of encuentros) {
    if (vistos.has(encuentro.id)) errores.push(`El encuentro "${encuentro.id}" está repetido.`);
    vistos.add(encuentro.id);
    errores.push(...validarEncuentro(encuentro));
  }
  return errores;
}

export function validarEncuentro(encuentro: Encuentro): string[] {
  const e = encuentro as unknown as Objeto;
  const nombre = `Encuentro "${String(e['id'])}"`;
  const errores: string[] = [];

  if (typeof e['id'] !== 'string' || !FORMATO_ID.test(e['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "piratas_hostiles").`);
  }
  for (const campo of Object.keys(e)) {
    if (!CAMPOS.includes(campo)) errores.push(`${nombre}: el campo "${campo}" no existe (válidos: ${CAMPOS.join(', ')}).`);
  }
  if (e['libro'] !== undefined && (typeof e['libro'] !== 'string' || !/^E\d{3}$/.test(e['libro']))) {
    errores.push(`${nombre}: "libro" debe ser el código del libro de papel (p. ej. "E003").`);
  }

  const recompensa = e['recompensaPorEnemigo'];
  if (recompensa !== undefined) {
    if (!Array.isArray(recompensa) || recompensa.length === 0) {
      errores.push(`${nombre}: "recompensaPorEnemigo" debe ser una lista de efectos (si no hay, no la pongas).`);
    } else {
      recompensa.forEach((efecto, i) => errores.push(...validarEfecto(efecto, `${nombre}, recompensa ${i + 1}`)));
    }
  }

  let rango: { min: number; max: number } | null = null;
  try {
    rango = rangoDeTirada(String(e['dado']));
  } catch {
    errores.push(`${nombre}: el dado "${String(e['dado'])}" no es válido (ejemplos: "1d6", "2d6").`);
  }

  const filas = e['filas'];
  if (!Array.isArray(filas) || filas.length === 0) {
    errores.push(`${nombre}: no tiene filas.`);
    return errores;
  }

  const buenas: { min: number; max: number }[] = [];
  for (const fila of filas as Objeto[]) {
    const donde = `${nombre}, fila ${String(fila['min'])}-${String(fila['max'])}`;
    for (const campo of Object.keys(fila)) {
      if (!CAMPOS_FILA.includes(campo)) errores.push(`${donde}: el campo "${campo}" no existe (válidos: ${CAMPOS_FILA.join(', ')}).`);
    }
    if (!Number.isInteger(fila['min']) || !Number.isInteger(fila['max']) || (fila['min'] as number) > (fila['max'] as number)) {
      errores.push(`${donde}: "min" y "max" deben ser números enteros, con "min" ≤ "max".`);
    } else {
      buenas.push({ min: fila['min'] as number, max: fila['max'] as number });
    }
    if (typeof fila['texto'] !== 'string' || fila['texto'].trim() === '') {
      errores.push(`${donde}: le falta el texto (lo que se cuenta antes de luchar).`);
    }
    const enemigos = fila['enemigos'];
    if (!Array.isArray(enemigos) || enemigos.length === 0) {
      errores.push(`${donde}: le faltan los enemigos.`);
    } else {
      errores.push(...validarPedidosDeEnemigos(enemigos, `${donde}, enemigo`));
    }
  }

  const ordenadas = [...buenas].sort((a, b) => a.min - b.min);
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const actual = ordenadas[i];
    if (actual.min > anterior.max + 1) errores.push(`${nombre}: hay un hueco entre ${anterior.max} y ${actual.min}.`);
    if (actual.min <= anterior.max) errores.push(`${nombre}: las filas ${anterior.min}-${anterior.max} y ${actual.min}-${actual.max} se pisan.`);
  }
  if (rango && ordenadas.length > 0) {
    if (ordenadas[0].min !== rango.min) errores.push(`${nombre}: "${String(e['dado'])}" saca como mínimo ${rango.min}, pero la primera fila empieza en ${ordenadas[0].min}.`);
    const ultima = Math.max(...ordenadas.map(f => f.max));
    if (ultima !== rango.max) errores.push(`${nombre}: "${String(e['dado'])}" saca como máximo ${rango.max}, pero la última fila acaba en ${ultima}.`);
  }
  return errores;
}
