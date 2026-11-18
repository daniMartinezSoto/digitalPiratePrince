import { EFECTOS_EN_COMBATE } from './objeto';
import { rangoDeTirada } from '../dados/tirada';
import { validarOtorga } from '../condiciones/validar-otorga';
import { validarModificadores } from '../modificadores/validar-modificadores';
import { validarEfecto } from '../tablas/rangos/validar-tabla';
import { MOMENTOS_DE_USO, type Objeto } from './objeto';

const MOMENTOS_TEXTO: readonly string[] = MOMENTOS_DE_USO;

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

  // Activos: se usan y se gastan, así que necesitan usos y decir cuándo se usan.
  // Pasivos: permanentes y funcionan solos: sin usos, sin momento de uso y sin "alUsar".
  if (o['tipo'] === 'activo') {
    // Sin usos = permanente (los de combate se usan una vez por combate).
    if (o['usosMaximos'] !== undefined && !esEnteroDesde(o['usosMaximos'], 1)) {
      errores.push(`${nombre}: "usosMaximos" debe ser un número entero de 1 o más (sin él, el objeto es permanente).`);
    }
    if (typeof o['cuandoSeUsa'] !== 'string' || !MOMENTOS_TEXTO.includes(o['cuandoSeUsa'])) {
      errores.push(`${nombre}: es activo, así que necesita "cuandoSeUsa" (válidos: ${MOMENTOS_DE_USO.join(', ')}).`);
    }
    errores.push(...validarAlUsar(o['alUsar'], nombre));
    if (o['cuandoSeUsa'] === 'combate') {
      errores.push(...validarEnCombate(o['enCombate'], nombre));
    } else if (o['enCombate'] !== undefined) {
      errores.push(`${nombre}: "enCombate" solo va en los objetos que se usan en combate ("cuandoSeUsa": "combate").`);
    }
  } else if (o['tipo'] === 'pasivo') {
    if (o['enCombate'] !== undefined) {
      errores.push(`${nombre}: es pasivo, así que no lleva "enCombate" (sus bonificadores van en "modificadores").`);
    }
    if (o['usosMaximos'] !== undefined) {
      errores.push(`${nombre}: es pasivo (permanente), así que no lleva "usosMaximos".`);
    }
    if (o['cuandoSeUsa'] !== undefined || o['alUsar'] !== undefined) {
      errores.push(`${nombre}: es pasivo (funciona solo), así que no lleva "cuandoSeUsa" ni "alUsar".`);
    }
  } else {
    errores.push(`${nombre}: el tipo "${String(o['tipo'])}" no existe (válidos: pasivo, activo).`);
  }

  if (o['espacios'] !== undefined && !esEnteroDesde(o['espacios'], 1)) {
    errores.push(`${nombre}: los espacios deben ser un número entero de 1 o más.`);
  }
  if (!esEnteroDesde(o['precioVenta'], 1)) {
    errores.push(`${nombre}: le falta el precio de venta ("precioVenta", un número entero de 1 o más). Todos los objetos se pueden vender.`);
  }
  if (o['magico'] !== undefined && typeof o['magico'] !== 'boolean') {
    errores.push(`${nombre}: "magico" debe ser true o false.`);
  }

  if (o['banderaAlVender'] !== undefined && (typeof o['banderaAlVender'] !== 'string' || !FORMATO_ID.test(o['banderaAlVender']))) {
    errores.push(`${nombre}: "banderaAlVender" debe ir en minúsculas y con guiones bajos.`);
  }

  // Bonificadores: solo sobre tiradas que existen y con números enteros.
  errores.push(...validarModificadores(o['modificadores'], nombre));

  // Condiciones que da mientras lo llevas: tienen que existir.
  errores.push(...validarOtorga(o['otorga'], nombre));

  return errores;
}

/** "enCombate": obligatorio en los objetos de combate; cada efecto con sus datos justos. */
function validarEnCombate(enCombate: unknown, nombre: string): string[] {
  if (typeof enCombate !== 'object' || enCombate === null || Array.isArray(enCombate)) {
    return [`${nombre}: se usa en combate, así que necesita "enCombate" (p. ej. { "efecto": "bonificador", "cantidad": 2 }).`];
  }
  const c = enCombate as Record<string, unknown>;
  const errores: string[] = [];
  if (typeof c['efecto'] !== 'string' || !(EFECTOS_EN_COMBATE as readonly string[]).includes(c['efecto'])) {
    return [`${nombre}: el efecto en combate "${String(c['efecto'])}" no existe (válidos: ${EFECTOS_EN_COMBATE.join(', ')}).`];
  }
  if (c['efecto'] === 'bonificador') {
    if (!Number.isInteger(c['cantidad']) || c['cantidad'] === 0) {
      errores.push(`${nombre}: el bonificador en combate necesita "cantidad" (un número entero distinto de 0).`);
    }
  } else if (c['cantidad'] !== undefined) {
    errores.push(`${nombre}: "cantidad" solo va con el efecto en combate "bonificador".`);
  }
  if (c['efecto'] === 'dado_extra') {
    if (typeof c['dados'] !== 'string' || !esExpresionDeDados(c['dados'])) {
      errores.push(`${nombre}: el dado extra en combate necesita "dados" (p. ej. "1d6").`);
    }
  } else if (c['dados'] !== undefined) {
    errores.push(`${nombre}: "dados" solo va con el efecto en combate "dado_extra".`);
  }
  for (const campo of Object.keys(c)) {
    if (!['efecto', 'cantidad', 'dados'].includes(campo)) {
      errores.push(`${nombre}: el campo "${campo}" no existe en "enCombate".`);
    }
  }
  return errores;
}

function esExpresionDeDados(texto: string): boolean {
  try {
    rangoDeTirada(texto);
    return true;
  } catch {
    return false;
  }
}

/** "alUsar": una lista de efectos bien escritos (opcional). */
function validarAlUsar(alUsar: unknown, nombre: string): string[] {
  if (alUsar === undefined) {
    return [];
  }
  if (!Array.isArray(alUsar)) {
    return [`${nombre}: "alUsar" debe ser una lista de efectos.`];
  }
  return alUsar.flatMap(efecto => validarEfecto(efecto, `${nombre}, alUsar`));
}

function esTextoConContenido(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}

function esEnteroDesde(valor: unknown, minimo: number): boolean {
  return Number.isInteger(valor) && (valor as number) >= minimo;
}
