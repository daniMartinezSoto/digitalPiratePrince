import { HABILIDADES } from './cargar-habilidades';
import type { Habilidad } from './habilidad';
import { LISTAS_DE_NOMBRES } from '../seguidores/nombres';
import type { TipoSeguidor } from './tipo-seguidor';

// Formato de los ids: minúsculas, números y guiones bajos ("barbero_cirujano").
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;

/**
 * Revisa el catálogo de tipos de seguidor completo y devuelve la lista de errores, en castellano.
 * Lista vacía = el catálogo está bien. No lanza errores: así se ven todos los fallos de una vez.
 * Se usa en los tests, no durante la partida.
 * Los otros parámetros son el catálogo de habilidades y los ids de las listas de nombres
 * donde comprobar que existen (por defecto, los del juego; los tests pueden pasar otros).
 */
export function validarTiposSeguidor(
  tipos: TipoSeguidor[],
  habilidades: readonly Habilidad[] = HABILIDADES,
  listasDeNombres: readonly string[] = Object.keys(LISTAS_DE_NOMBRES),
): string[] {
  const errores: string[] = [];

  const vistos = new Set<string>();
  for (const tipo of tipos) {
    if (vistos.has(tipo.id)) {
      errores.push(`El id "${tipo.id}" está repetido.`);
    }
    vistos.add(tipo.id);
  }

  const idsDeHabilidades = habilidades.map(h => h.id);
  for (const tipo of tipos) {
    errores.push(...validarTipoSeguidor(tipo, idsDeHabilidades, listasDeNombres));
  }

  return errores;
}

/** Revisa un tipo suelto. Lo miramos como objeto genérico: en el JSON puede venir cualquier cosa. */
function validarTipoSeguidor(tipo: TipoSeguidor, idsDeHabilidades: string[], listasDeNombres: readonly string[]): string[] {
  const errores: string[] = [];
  const t = tipo as unknown as Record<string, unknown>;
  const nombre = `Seguidor "${String(t['id'])}"`;

  if (typeof t['id'] !== 'string' || !FORMATO_ID.test(t['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "barbero_cirujano").`);
  }
  if (!esTextoConContenido(t['nombre'])) {
    errores.push(`${nombre}: le falta el nombre.`);
  }
  if (!esTextoConContenido(t['descripcion'])) {
    errores.push(`${nombre}: le falta la descripción.`);
  }
  if (t['imagen'] !== undefined && !esTextoConContenido(t['imagen'])) {
    errores.push(`${nombre}: la imagen debe ser la ruta del dibujo (un texto).`);
  }

  // Ataque y resistencia, siempre escritos (decidido por el autor: que se vea que todos combaten).
  if (!esEnteroDesde(t['ataque'], 0)) {
    errores.push(`${nombre}: el ataque debe ser un número entero de 0 o más (lo normal, 2; 0 = no entra en combate).`);
  }
  // Con resistencia 0 nacería muerto.
  if (!esEnteroDesde(t['resistencia'], 1)) {
    errores.push(`${nombre}: la resistencia debe ser un número entero de 1 o más.`);
  }
  if (t['precio'] !== undefined && !esEnteroDesde(t['precio'], 0)) {
    errores.push(`${nombre}: el precio debe ser un número entero de 0 o más (si no se contrata en puertos, no lo pongas).`);
  }

  // Habilidades: una lista (aunque esté vacía) de ids que existen, sin repetir.
  const habilidades = t['habilidades'];
  if (!Array.isArray(habilidades)) {
    errores.push(`${nombre}: "habilidades" debe ser una lista de ids (vacía si no tiene ninguna).`);
  } else {
    const vistas = new Set<unknown>();
    for (const id of habilidades) {
      if (typeof id !== 'string' || !idsDeHabilidades.includes(id)) {
        errores.push(`${nombre}: la habilidad "${String(id)}" no existe en el catálogo de habilidades.`);
      } else if (vistas.has(id)) {
        errores.push(`${nombre}: la habilidad "${id}" está repetida.`);
      }
      vistas.add(id);
    }
  }

  // Listas de nombres: si se ponen, al menos una, y todas tienen que existir.
  const nombres = t['nombres'];
  if (nombres !== undefined) {
    if (!Array.isArray(nombres) || nombres.length === 0) {
      errores.push(`${nombre}: "nombres" debe ser una lista con al menos una lista de nombres (si usa las normales, no lo pongas).`);
    } else {
      for (const id of nombres) {
        if (typeof id !== 'string' || !listasDeNombres.includes(id)) {
          errores.push(`${nombre}: la lista de nombres "${String(id)}" no existe (válidas: ${listasDeNombres.join(', ')}).`);
        }
      }
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
