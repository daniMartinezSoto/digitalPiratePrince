import { rangoDeTirada } from '../../dados/tirada';
import { RECURSOS } from '../efecto';
import type { Fila, Tabla } from './tabla';

// Formatos válidos.
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;              // minúsculas, números y guiones bajos: "taberna_clandestina"
const FORMATO_CANTIDAD = /^-?\d+d\d+(x\d+)?$/;        // "2d6", "1d6x10", "-1d6"
const TIPOS_EFECTO: readonly string[] = [...RECURSOS, 'perder_mitad_oro'];

/**
 * Revisa una tabla y devuelve la lista de errores encontrados, explicados en castellano.
 * Lista vacía = la tabla está bien. No lanza errores: así se ven todos los fallos de una vez.
 */
export function validarTabla(tabla: Tabla): string[] {
  const errores: string[] = [];
  const nombre = `Tabla "${tabla.id}"`;

  if (!FORMATO_ID.test(tabla.id)) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "buscar_informacion").`);
  }

  // El dado tiene que ser una expresión válida.
  let rango: { min: number; max: number } | null = null;
  try {
    rango = rangoDeTirada(tabla.dado);
  } catch {
    errores.push(`${nombre}: el dado "${tabla.dado}" no es válido (ejemplos: "1d6", "3d6", "1d7").`);
  }

  if (tabla.filas.length === 0) {
    errores.push(`${nombre}: no tiene filas.`);
    return errores;
  }

  // Cada fila por separado.
  for (const fila of tabla.filas) {
    errores.push(...validarFila(fila, nombre));
  }

  // Las filas juntas: ordenadas por "min", sin huecos ni solapes, y cubriendo lo que saca el dado.
  const ordenadas = [...tabla.filas].sort((a, b) => a.min - b.min);
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const actual = ordenadas[i];
    if (actual.min > anterior.max + 1) {
      const desde = anterior.max + 1;
      const hasta = actual.min - 1;
      const falta = desde === hasta ? `falta el ${desde}` : `faltan del ${desde} al ${hasta}`;
      errores.push(`${nombre}: hay un hueco entre ${anterior.max} y ${actual.min} (${falta}).`);
    }
    if (actual.min <= anterior.max) {
      errores.push(`${nombre}: las filas ${rangoTexto(anterior)} y ${rangoTexto(actual)} se pisan.`);
    }
  }

  if (rango) {
    const primera = ordenadas[0].min;
    const ultima = Math.max(...ordenadas.map(f => f.max));
    if (primera !== rango.min) {
      errores.push(`${nombre}: "${tabla.dado}" saca como mínimo ${rango.min}, pero la primera fila empieza en ${primera}.`);
    }
    if (ultima !== rango.max) {
      errores.push(`${nombre}: "${tabla.dado}" saca como máximo ${rango.max}, pero la última fila acaba en ${ultima}.`);
    }
  }

  return errores;
}

function validarFila(fila: Fila, nombre: string): string[] {
  const errores: string[] = [];
  const donde = `${nombre}, fila ${rangoTexto(fila)}`;

  if (!Number.isInteger(fila.min) || !Number.isInteger(fila.max)) {
    errores.push(`${donde}: "min" y "max" deben ser números enteros.`);
  }
  if (fila.min > fila.max) {
    errores.push(`${donde}: "min" es mayor que "max".`);
  }
  if (fila.texto === undefined && fila.efectos === undefined && fila.evento === undefined) {
    errores.push(`${donde}: está vacía (necesita al menos "texto", "efectos" o "evento").`);
  }
  if (fila.evento !== undefined && !FORMATO_ID.test(fila.evento)) {
    errores.push(`${donde}: el evento "${fila.evento}" debe ir en minúsculas y con guiones bajos.`);
  }

  for (const efecto of fila.efectos ?? []) {
    // Lo miramos como objeto genérico: en el JSON puede venir cualquier cosa.
    const e = efecto as { tipo: string; cantidad?: unknown };

    if (!TIPOS_EFECTO.includes(e.tipo)) {
      errores.push(`${donde}: el tipo de efecto "${e.tipo}" no existe (válidos: ${TIPOS_EFECTO.join(', ')}).`);
      continue;
    }
    if (e.tipo === 'perder_mitad_oro') {
      if (e.cantidad !== undefined) {
        errores.push(`${donde}: "perder_mitad_oro" no lleva cantidad.`);
      }
      continue;
    }
    const cantidadValida =
      (typeof e.cantidad === 'number' && Number.isInteger(e.cantidad)) ||
      (typeof e.cantidad === 'string' && FORMATO_CANTIDAD.test(e.cantidad));
    if (!cantidadValida) {
      errores.push(`${donde}: la cantidad de "${e.tipo}" no es válida (ejemplos: 8, -1, "2d6", "-1d6").`);
    }
  }

  return errores;
}

function rangoTexto(fila: Fila): string {
  return fila.min === fila.max ? `${fila.min}` : `${fila.min}-${fila.max}`;
}
