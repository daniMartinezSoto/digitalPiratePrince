import { CATEGORIAS_ENEMIGO, HABILIDADES_DE_ENEMIGO, type Enemigo } from './enemigo';

// Formato de los ids: minúsculas, números y guiones bajos ("pirata_maldito").
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;

// Referencia al libro de papel: "E078".
const FORMATO_LIBRO = /^E\d{3}$/;

// Campos que puede tener una ficha. Cualquier otro es un error (casi siempre, una errata: "resistecia").
const CAMPOS_VALIDOS = ['id', 'nombre', 'descripcion', 'imagen', 'categoria', 'ataque', 'resistencia', 'habilidades', 'libro'];

/**
 * Revisa el bestiario completo y devuelve la lista de errores, en castellano.
 * Lista vacía = el bestiario está bien. No lanza errores: así se ven todos los fallos de una vez.
 * Se usa en los tests, no durante la partida.
 */
export function validarEnemigos(enemigos: Enemigo[]): string[] {
  const errores: string[] = [];

  const vistos = new Set<string>();
  for (const enemigo of enemigos) {
    if (vistos.has(enemigo.id)) {
      errores.push(`El id "${enemigo.id}" está repetido.`);
    }
    vistos.add(enemigo.id);
  }

  for (const enemigo of enemigos) {
    errores.push(...validarEnemigo(enemigo));
  }

  return errores;
}

/** Revisa un enemigo suelto. Lo miramos como objeto genérico: en el JSON puede venir cualquier cosa. */
function validarEnemigo(enemigo: Enemigo): string[] {
  const errores: string[] = [];
  const e = enemigo as unknown as Record<string, unknown>;
  const nombre = `Enemigo "${String(e['id'])}"`;

  if (typeof e['id'] !== 'string' || !FORMATO_ID.test(e['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "pirata_maldito").`);
  }
  if (!esTextoConContenido(e['nombre'])) {
    errores.push(`${nombre}: le falta el nombre.`);
  }
  if (e['descripcion'] !== undefined && !esTextoConContenido(e['descripcion'])) {
    errores.push(`${nombre}: la descripción debe ser un texto (si no tiene, no la pongas).`);
  }
  if (e['imagen'] !== undefined && !esTextoConContenido(e['imagen'])) {
    errores.push(`${nombre}: la imagen debe ser la ruta del dibujo (un texto).`);
  }

  // Un enemigo siempre ataca: con 0 no haría nada en el combate.
  if (!esEnteroDesde(e['ataque'], 1)) {
    errores.push(`${nombre}: el ataque debe ser un número entero de 1 o más.`);
  }
  // Con resistencia 0 nacería muerto.
  if (!esEnteroDesde(e['resistencia'], 1)) {
    errores.push(`${nombre}: la resistencia debe ser un número entero de 1 o más.`);
  }

  if (typeof e['categoria'] !== 'string' || !(CATEGORIAS_ENEMIGO as readonly string[]).includes(e['categoria'])) {
    errores.push(`${nombre}: le falta la categoría o no existe (válidas: ${CATEGORIAS_ENEMIGO.join(', ')}).`);
  }

  const habilidades = e['habilidades'];
  if (habilidades !== undefined) {
    if (!Array.isArray(habilidades)) {
      errores.push(`${nombre}: "habilidades" debe ser una lista (si no tiene ninguna, no lo pongas).`);
    } else {
      const vistas = new Set<unknown>();
      for (const id of habilidades) {
        if (typeof id !== 'string' || !(HABILIDADES_DE_ENEMIGO as readonly string[]).includes(id)) {
          errores.push(`${nombre}: la habilidad "${String(id)}" no existe (válidas: ${HABILIDADES_DE_ENEMIGO.join(', ')}).`);
        } else if (vistas.has(id)) {
          errores.push(`${nombre}: la habilidad "${id}" está repetida.`);
        }
        vistas.add(id);
      }
    }
  }

  if (e['libro'] !== undefined && (typeof e['libro'] !== 'string' || !FORMATO_LIBRO.test(e['libro']))) {
    errores.push(`${nombre}: "libro" debe ser el código del libro de papel (p. ej. "E078").`);
  }

  for (const campo of Object.keys(e)) {
    if (!CAMPOS_VALIDOS.includes(campo)) {
      errores.push(`${nombre}: el campo "${campo}" no existe (válidos: ${CAMPOS_VALIDOS.join(', ')}).`);
    }
  }

  return errores;
}

function esTextoConContenido(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}

function esEnteroDesde(valor: unknown, minimo: number): boolean {
  return Number.isInteger(valor) && (valor as number) >= minimo;
}
