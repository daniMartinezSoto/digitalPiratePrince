import { validarOtorga } from '../condiciones/validar-otorga';
import { validarModificadores } from '../modificadores/validar-modificadores';
import type { Objeto } from './objeto';

// Formato de los ids: minúsculas, números y guiones bajos ("mano_de_mono").
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;

/**
 * Revisa el catálogo de objetos completo y devuelve la lista de errores, en castellano.
 * Lista vacía = el catálogo está bien. No lanza errores: así se ven todos los fallos de una vez.
 * Se usa en los tests, no durante la partida.
 */
export function validarObjetos(objetos: Objeto[]): string[] {
  const errores: string[] = [];

  // Ids repetidos: cada objeto tiene que poder encontrarse por su id sin dudas.
  const vistos = new Set<string>();
  for (const objeto of objetos) {
    if (vistos.has(objeto.id)) {
      errores.push(`El id "${objeto.id}" está repetido.`);
    }
    vistos.add(objeto.id);
  }

  for (const objeto of objetos) {
    errores.push(...validarObjeto(objeto));
  }

  return errores;
}

/** Revisa un objeto suelto. Lo miramos como objeto genérico: en el JSON puede venir cualquier cosa. */
function validarObjeto(objeto: Objeto): string[] {
  const errores: string[] = [];
  const o = objeto as unknown as Record<string, unknown>;
  const nombre = `Objeto "${String(o['id'])}"`;

  if (typeof o['id'] !== 'string' || !FORMATO_ID.test(o['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "mano_de_mono").`);
  }
  if (!esTextoConContenido(o['nombre'])) {
    errores.push(`${nombre}: le falta el nombre.`);
  }
  if (!esTextoConContenido(o['descripcion'])) {
    errores.push(`${nombre}: le falta la descripción.`);
  }
  if (o['imagen'] !== undefined && !esTextoConContenido(o['imagen'])) {
    errores.push(`${nombre}: la imagen debe ser la ruta del dibujo (un texto).`);
  }

  // Activos: se usan y se gastan, así que necesitan usos. Pasivos: permanentes, sin usos.
  if (o['tipo'] === 'activo') {
    if (!esEnteroDesde(o['usosMaximos'], 1)) {
      errores.push(`${nombre}: es activo, así que necesita "usosMaximos" (un número entero de 1 o más).`);
    }
  } else if (o['tipo'] === 'pasivo') {
    if (o['usosMaximos'] !== undefined) {
      errores.push(`${nombre}: es pasivo (permanente), así que no lleva "usosMaximos".`);
    }
  } else {
    errores.push(`${nombre}: el tipo "${String(o['tipo'])}" no existe (válidos: pasivo, activo).`);
  }

  if (o['espacios'] !== undefined && !esEnteroDesde(o['espacios'], 1)) {
    errores.push(`${nombre}: los espacios deben ser un número entero de 1 o más.`);
  }
  if (o['precioVenta'] !== undefined && !esEnteroDesde(o['precioVenta'], 1)) {
    errores.push(`${nombre}: el precio de venta debe ser un número entero de 1 o más (si no se vende, no lo pongas).`);
  }
  if (o['magico'] !== undefined && typeof o['magico'] !== 'boolean') {
    errores.push(`${nombre}: "magico" debe ser true o false.`);
  }

  // Bonificadores: solo sobre tiradas que existen y con números enteros.
  errores.push(...validarModificadores(o['modificadores'], nombre));

  // Condiciones que da mientras lo llevas: tienen que existir.
  errores.push(...validarOtorga(o['otorga'], nombre));

  return errores;
}

function esTextoConContenido(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}

function esEnteroDesde(valor: unknown, minimo: number): boolean {
  return Number.isInteger(valor) && (valor as number) >= minimo;
}
