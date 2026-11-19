import { rangoDeTirada } from '../dados/tirada';
import { validarEfecto } from '../tablas/rangos/validar-tabla';
import type { Barco } from './barco';
import { ENEMIGOS } from './cargar-enemigos';

// Formato de los ids (de barcos y de eventos): minúsculas, números y guiones bajos.
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;

// Referencia al libro de papel: "E008".
const FORMATO_LIBRO = /^E\d{3}$/;

// Dados sin signo menos: "1d6", "1d3+1", "2d6x10".
const FORMATO_DADOS = /^\d+d\d+(x\d+)?(\+\d+)?$/;

// Campos que puede tener cada cosa. Cualquier otro es un error (casi siempre, una errata).
const CAMPOS_BARCO = ['id', 'nombre', 'descripcion', 'imagen', 'dano', 'resistencia', 'abordaje', 'recompensa', 'eventosAlGanar', 'botinAbordaje', 'libro'];
const CAMPOS_PEDIDO = ['enemigo', 'cantidad', 'ataque', 'resistencia', 'recompensa'];
const CAMPOS_BOTIN = ['efectos', 'probabilidadTesoro'];

/**
 * Revisa el catálogo de barcos completo y devuelve la lista de errores, en castellano.
 * Lista vacía = está bien. No lanza errores: así se ven todos los fallos de una vez.
 * Se usa en los tests, no durante la partida.
 */
export function validarBarcos(barcos: Barco[]): string[] {
  const errores: string[] = [];

  const vistos = new Set<string>();
  for (const barco of barcos) {
    if (vistos.has(barco.id)) {
      errores.push(`El id "${barco.id}" está repetido.`);
    }
    vistos.add(barco.id);
  }

  for (const barco of barcos) {
    errores.push(...validarBarco(barco));
  }

  return errores;
}

/** Revisa un barco suelto. Lo miramos como objeto genérico: en el JSON puede venir cualquier cosa. */
function validarBarco(barco: Barco): string[] {
  const errores: string[] = [];
  const b = barco as unknown as Record<string, unknown>;
  const nombre = `Barco "${String(b['id'])}"`;

  if (typeof b['id'] !== 'string' || !FORMATO_ID.test(b['id'])) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos (p. ej. "fragata_de_la_marina").`);
  }
  if (!esTextoConContenido(b['nombre'])) {
    errores.push(`${nombre}: le falta el nombre.`);
  }
  if (b['descripcion'] !== undefined && !esTextoConContenido(b['descripcion'])) {
    errores.push(`${nombre}: la descripción debe ser un texto (si no tiene, no la pongas).`);
  }
  if (b['imagen'] !== undefined && !esTextoConContenido(b['imagen'])) {
    errores.push(`${nombre}: la imagen debe ser la ruta del dibujo (un texto).`);
  }

  // Daño 0 vale: la chalupa de pescadores no te hace nada.
  if (!esEnteroDesde(b['dano'], 0) && !sonDados(b['dano'])) {
    errores.push(`${nombre}: el daño debe ser un número entero de 0 o más, o dados (p. ej. "1d6").`);
  }
  // Con resistencia 0 ya estaría hundido.
  if (!esEnteroDesde(b['resistencia'], 1)) {
    errores.push(`${nombre}: la resistencia debe ser un número entero de 1 o más.`);
  }

  errores.push(...validarAbordaje(b['abordaje'], nombre));

  if (b['recompensa'] !== undefined) {
    errores.push(...validarListaDeEfectos(b['recompensa'], `${nombre}, recompensa`));
  }

  const eventos = b['eventosAlGanar'];
  if (eventos !== undefined) {
    if (!Array.isArray(eventos) || eventos.length === 0) {
      errores.push(`${nombre}: "eventosAlGanar" debe ser una lista de ids de evento (si no tiene ninguno, no lo pongas).`);
    } else {
      for (const evento of eventos) {
        if (typeof evento !== 'string' || !FORMATO_ID.test(evento)) {
          errores.push(`${nombre}: el evento "${String(evento)}" debe ir en minúsculas y con guiones bajos.`);
        }
      }
    }
  }

  if (b['botinAbordaje'] !== undefined) {
    errores.push(...validarBotin(b['botinAbordaje'], nombre));
  }

  if (b['libro'] !== undefined && (typeof b['libro'] !== 'string' || !FORMATO_LIBRO.test(b['libro']))) {
    errores.push(`${nombre}: "libro" debe ser el código del libro de papel (p. ej. "E008").`);
  }

  errores.push(...camposQueSobran(b, CAMPOS_BARCO, nombre));

  return errores;
}

/** El abordaje: al menos un enemigo, que exista en el bestiario, con cantidades y números válidos. */
function validarAbordaje(abordaje: unknown, nombre: string): string[] {
  if (!Array.isArray(abordaje) || abordaje.length === 0) {
    return [`${nombre}: le falta el abordaje (la lista de enemigos contra los que peleas si lo abordas).`];
  }

  const errores: string[] = [];
  abordaje.forEach((pedido, i) => {
    const p = pedido as Record<string, unknown>;
    const donde = `${nombre}, abordaje ${i + 1}`;

    if (typeof p['enemigo'] !== 'string' || !ENEMIGOS.some(e => e.id === p['enemigo'])) {
      errores.push(`${donde}: el enemigo "${String(p['enemigo'])}" no existe en el bestiario (data/enemigos.json).`);
    }
    const cantidad = p['cantidad'];
    if (cantidad !== undefined && !esEnteroDesde(cantidad, 1) && !(sonDados(cantidad) && minimoDeLosDados(cantidad as string) >= 1)) {
      errores.push(`${donde}: la cantidad debe ser un número entero de 1 o más, o dados (p. ej. "1d3+1").`);
    }
    if (p['ataque'] !== undefined && !esEnteroDesde(p['ataque'], 1)) {
      errores.push(`${donde}: el ataque debe ser un número entero de 1 o más.`);
    }
    if (p['resistencia'] !== undefined && !esEnteroDesde(p['resistencia'], 1)) {
      errores.push(`${donde}: la resistencia debe ser un número entero de 1 o más.`);
    }
    if (p['recompensa'] !== undefined) {
      errores.push(...validarListaDeEfectos(p['recompensa'], `${donde}, recompensa`));
    }
    errores.push(...camposQueSobran(p, CAMPOS_PEDIDO, donde));
  });
  return errores;
}

/** El botín de abordaje: efectos válidos y una probabilidad de tesoro entre 0 y 100. */
function validarBotin(botin: unknown, nombre: string): string[] {
  const donde = `${nombre}, botín de abordaje`;
  if (typeof botin !== 'object' || botin === null || Array.isArray(botin)) {
    return [`${donde}: debe ser un objeto con "efectos" y/o "probabilidadTesoro".`];
  }

  const errores: string[] = [];
  const b = botin as Record<string, unknown>;
  if (b['efectos'] === undefined && b['probabilidadTesoro'] === undefined) {
    errores.push(`${donde}: está vacío (pon "efectos", "probabilidadTesoro" o quítalo).`);
  }
  if (b['efectos'] !== undefined) {
    errores.push(...validarListaDeEfectos(b['efectos'], donde));
  }
  const probabilidad = b['probabilidadTesoro'];
  if (probabilidad !== undefined && !(esEnteroDesde(probabilidad, 1) && (probabilidad as number) <= 100)) {
    errores.push(`${donde}: "probabilidadTesoro" debe ser un número entero entre 1 y 100.`);
  }
  errores.push(...camposQueSobran(b, CAMPOS_BOTIN, donde));
  return errores;
}

/** Una lista de efectos (no vacía), cada uno revisado con el revisor de siempre. */
function validarListaDeEfectos(efectos: unknown, donde: string): string[] {
  if (!Array.isArray(efectos) || efectos.length === 0) {
    return [`${donde}: debe ser una lista de efectos (si no tiene ninguno, no la pongas).`];
  }
  return efectos.flatMap((efecto, i) => validarEfecto(efecto, `${donde}, efecto ${i + 1}`));
}

function camposQueSobran(objeto: Record<string, unknown>, validos: string[], donde: string): string[] {
  return Object.keys(objeto)
    .filter(campo => !validos.includes(campo))
    .map(campo => `${donde}: el campo "${campo}" no existe (válidos: ${validos.join(', ')}).`);
}

/** Dados bien escritos: con el formato y que se puedan tirar ("1d0" no se puede). */
function sonDados(valor: unknown): boolean {
  if (typeof valor !== 'string' || !FORMATO_DADOS.test(valor)) {
    return false;
  }
  try {
    rangoDeTirada(valor);
    return true;
  } catch {
    return false;
  }
}

function minimoDeLosDados(expresion: string): number {
  return rangoDeTirada(expresion).min;
}

function esTextoConContenido(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}

function esEnteroDesde(valor: unknown, minimo: number): boolean {
  return Number.isInteger(valor) && (valor as number) >= minimo;
}
