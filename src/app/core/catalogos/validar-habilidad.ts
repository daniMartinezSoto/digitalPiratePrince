import { validarOtorga } from '../condiciones/validar-otorga';
import { validarModificadores } from '../modificadores/validar-modificadores';
import { AJUSTES_DE_HABILIDAD, type Habilidad } from './habilidad';

// Formato de los ids: minúsculas, números y guiones bajos ("manos_largas").
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;

/**
 * Revisa el catálogo de habilidades completo y devuelve la lista de errores, en castellano.
 * Lista vacía = el catálogo está bien. No lanza errores: así se ven todos los fallos de una vez.
 * Se usa en los tests, no durante la partida.
 */
export function validarHabilidades(habilidades: Habilidad[]): string[] {
  const errores: string[] = [];

  const vistos = new Set<string>();
  for (const habilidad of habilidades) {
    if (vistos.has(habilidad.id)) {
      errores.push(`El id "${habilidad.id}" está repetido.`);
    }
    vistos.add(habilidad.id);
  }

  for (const habilidad of habilidades) {
    errores.push(...validarHabilidad(habilidad));
  }

  return errores;
}

/** Revisa una habilidad suelta. La miramos como objeto genérico: en el JSON puede venir cualquier cosa. */
function validarHabilidad(habilidad: Habilidad): string[] {
  const errores: string[] = [];
  const h = habilidad as unknown as Record<string, unknown>;
  const nombre = `Habilidad "${String(h['id'])}"`;

  if (typeof h['id'] !== 'string' || !FORMATO_ID.test(h['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "manos_largas").`);
  }
  if (!esTextoConContenido(h['nombre'])) {
    errores.push(`${nombre}: le falta el nombre.`);
  }
  if (!esTextoConContenido(h['descripcion'])) {
    errores.push(`${nombre}: le falta la descripción.`);
  }
  if (h['imagen'] !== undefined && !esTextoConContenido(h['imagen'])) {
    errores.push(`${nombre}: la imagen debe ser la ruta del dibujo (un texto).`);
  }
  if (h['tipo'] !== 'pasiva' && h['tipo'] !== 'activa') {
    errores.push(`${nombre}: el tipo "${String(h['tipo'])}" no existe (válidos: pasiva, activa).`);
  }

  // Bonificadores: solo sobre tiradas que existen y con números enteros.
  errores.push(...validarModificadores(h['modificadores'], nombre));

  // Ajustes: solo reglas que existen y con números enteros.
  const ajustes = h['ajustes'];
  if (ajustes !== undefined) {
    if (typeof ajustes !== 'object' || ajustes === null || Array.isArray(ajustes)) {
      errores.push(`${nombre}: "ajustes" debe ser una lista de reglas con su número.`);
    } else {
      const reglas: readonly string[] = AJUSTES_DE_HABILIDAD;
      for (const [regla, valor] of Object.entries(ajustes)) {
        if (!reglas.includes(regla)) {
          errores.push(`${nombre}: el ajuste "${regla}" no existe (válidos: ${AJUSTES_DE_HABILIDAD.join(', ')}).`);
        } else if (!Number.isInteger(valor)) {
          errores.push(`${nombre}: el ajuste "${regla}" debe ser un número entero.`);
        }
      }
    }
  }

  // Condiciones que da mientras el seguidor te acompaña: tienen que existir.
  errores.push(...validarOtorga(h['otorga'], nombre));

  return errores;
}

function esTextoConContenido(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}
