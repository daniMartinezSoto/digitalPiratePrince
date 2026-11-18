import { rangoDeTirada } from '../../dados/tirada';
import { CONDICIONES } from '../../catalogos/cargar-condiciones';
import { OBJETOS } from '../../catalogos/cargar-objetos';
import { TIPOS_SEGUIDOR } from '../../catalogos/cargar-seguidores';
import { CATEGORIAS_CONDICION } from '../../catalogos/condicion';
import {
  CARACTERISTICAS,
  DESTINOS,
  EFECTOS_INTERNOS,
  FINES_DE_PARTIDA,
  OPERACIONES,
  OTROS_EFECTOS,
  RECURSOS,
  RECURSOS_CON_MAXIMO,
} from '../efecto';
import { ESPECIALES_DE_TABLA, type Fila, type Tabla } from './tabla';

// Formatos válidos.
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;              // minúsculas, números y guiones bajos: "taberna_clandestina"
const FORMATO_CANTIDAD = /^-?\d+d\d+(x\d+)?(\+\d+)?$/; // "2d6", "1d6x10", "1d6+1", "-1d6"
const FINES_TEXTO: readonly string[] = FINES_DE_PARTIDA;
const OPERACIONES_TEXTO: readonly string[] = OPERACIONES;
const DESTINOS_TEXTO: readonly string[] = DESTINOS;
const CON_MAXIMO_TEXTO: readonly string[] = RECURSOS_CON_MAXIMO;
const CARACTERISTICAS_TEXTO: readonly string[] = CARACTERISTICAS;
const CATEGORIAS_TEXTO: readonly string[] = CATEGORIAS_CONDICION;
const TIPOS_EFECTO: readonly string[] = [...RECURSOS, ...FINES_DE_PARTIDA, ...OTROS_EFECTOS];
// Operaciones que llevan cantidad; las demás (mitad, maximo, todo) no.
const OPERACIONES_CON_CANTIDAD = ['sumar', 'fijar'];

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
  if (fila.texto === undefined && fila.efectos === undefined && fila.evento === undefined && fila.especial === undefined && fila.tabla === undefined) {
    errores.push(`${donde}: está vacía (necesita al menos "texto", "efectos", "evento", "tabla" o "especial").`);
  }
  if (fila.evento !== undefined && !FORMATO_ID.test(fila.evento)) {
    errores.push(`${donde}: el evento "${fila.evento}" debe ir en minúsculas y con guiones bajos.`);
  }
  if (fila.tabla !== undefined && (typeof fila.tabla !== 'string' || !FORMATO_ID.test(fila.tabla))) {
    errores.push(`${donde}: la tabla "${String(fila.tabla)}" debe ir en minúsculas y con guiones bajos.`);
  }
  if (fila.especial !== undefined && !(ESPECIALES_DE_TABLA as readonly string[]).includes(fila.especial)) {
    errores.push(`${donde}: la regla especial "${String(fila.especial)}" no existe (válidas: ${ESPECIALES_DE_TABLA.join(', ')}).`);
  }

  for (const efecto of fila.efectos ?? []) {
    errores.push(...validarEfecto(efecto, donde));
  }

  return errores;
}

/**
 * Revisa un efecto suelto. Lo mira como objeto genérico: en el JSON puede venir cualquier cosa.
 * Se exporta porque los efectos también se escriben fuera de las tablas (fichas de condición).
 */
export function validarEfecto(efecto: unknown, donde: string): string[] {
  const e = efecto as Record<string, unknown> & { tipo: string };

  if ((EFECTOS_INTERNOS as readonly string[]).includes(e.tipo)) {
    return [`${donde}: "${e.tipo}" es un efecto interno del juego (lo usa el inventario): no se escribe en el JSON.`];
  }
  if (!TIPOS_EFECTO.includes(e.tipo)) {
    return [`${donde}: el tipo de efecto "${e.tipo}" no existe (válidos: ${TIPOS_EFECTO.join(', ')}).`];
  }

  switch (e.tipo) {
    case 'ganar_partida':
    case 'perder_partida':
      return soloEstosCampos(e, [], donde);
    case 'ganar_objeto':
    case 'perder_objeto':
      // "tirar" no se escribe en el JSON (lo elige el jugador cuando no cabe): aquí sobra.
      return [...soloEstosCampos(e, ['objeto'], donde), ...validarIdObjeto(e['objeto'], donde)];
    case 'poner_condicion':
      return [
        ...soloEstosCampos(e, ['condicion', 'turnos', 'partes'], donde),
        ...validarIdCondicion(e['condicion'], donde),
        ...validarPartes(e['partes'], donde),
        ...(e['turnos'] === undefined ? [] : validarCantidadPositiva(e['turnos'], `los turnos de "${e.tipo}"`, donde)),
      ];
    case 'quitar_condicion':
      return [...soloEstosCampos(e, ['condicion', 'categoria'], donde), ...validarQuitarCondicion(e, donde)];
    case 'perder_turnos':
      return [...soloEstosCampos(e, ['cantidad'], donde), ...validarCantidadPositiva(e['cantidad'], 'la cantidad de "perder_turnos"', donde)];
    case 'bandera':
      return [...soloEstosCampos(e, ['bandera'], donde), ...validarIdBandera(e['bandera'], donde)];
    case 'ganar_seguidor':
      // "despedir" no se escribe en el JSON (lo elige el jugador durante la partida): aquí sobra.
      return [
        ...soloEstosCampos(e, ['seguidor', 'inseparable'], donde),
        ...validarIdSeguidor(e['seguidor'], donde),
        ...(e['inseparable'] === undefined || typeof e['inseparable'] === 'boolean'
          ? []
          : [`${donde}: "inseparable" debe ser true o false.`]),
      ];
    default:
      return validarEfectoDeRecurso(e, donde);
  }
}

/** Oro, comida, tripulacion, vida, fama, fuerza, ingenio y vidaMax. */
function validarEfectoDeRecurso(e: Record<string, unknown> & { tipo: string }, donde: string): string[] {
  const errores: string[] = [...soloEstosCampos(e, ['operacion', 'cantidad', 'destino', 'siNoHay'], donde)];
  const operacion = typeof e['operacion'] === 'string' ? e['operacion'] : e['operacion'] === undefined ? 'sumar' : '?';
  const esCaracteristica = CARACTERISTICAS_TEXTO.includes(e.tipo);

  if (!OPERACIONES_TEXTO.includes(operacion)) {
    errores.push(`${donde}: la operación "${String(e['operacion'])}" no existe (válidas: ${OPERACIONES.join(', ')}).`);
    return errores;
  }

  if (OPERACIONES_CON_CANTIDAD.includes(operacion)) {
    const cantidadValida =
      (typeof e['cantidad'] === 'number' && Number.isInteger(e['cantidad'])) ||
      (typeof e['cantidad'] === 'string' && FORMATO_CANTIDAD.test(e['cantidad']));
    if (!cantidadValida) {
      errores.push(`${donde}: la cantidad de "${e.tipo}" no es válida (ejemplos: 8, -1, "2d6", "1d6+1", "-1d6").`);
    } else if (operacion === 'fijar' && esNegativa(e['cantidad'])) {
      errores.push(`${donde}: no se puede fijar "${e.tipo}" en un número negativo (ningún recurso baja de 0).`);
    } else if (operacion === 'fijar' && esCaracteristica && e['cantidad'] === 0) {
      errores.push(`${donde}: no se puede fijar "${e.tipo}" en 0 (las características nunca bajan de 1).`);
    }
  } else if (e['cantidad'] !== undefined) {
    errores.push(`${donde}: la operación "${operacion}" no lleva cantidad.`);
  }

  if (operacion === 'maximo' && !CON_MAXIMO_TEXTO.includes(e.tipo)) {
    errores.push(`${donde}: "${e.tipo}" no tiene máximo, así que no admite "maximo" (solo ${RECURSOS_CON_MAXIMO.join(', ')}).`);
  }
  if (operacion === 'todo' && esCaracteristica) {
    errores.push(`${donde}: "${e.tipo}" es una característica y nunca baja de 1, así que no admite "todo".`);
  }

  const destino = e['destino'];
  if (destino !== undefined) {
    if (typeof destino !== 'string' || !DESTINOS_TEXTO.includes(destino)) {
      errores.push(`${donde}: el destino "${String(destino)}" no existe (válidos: ${DESTINOS.join(', ')}).`);
    } else if (destino !== 'jugador' && e.tipo !== 'vida') {
      errores.push(`${donde}: solo la vida puede afectar a seguidores; "${e.tipo}" es siempre del jugador.`);
    }
  }

  errores.push(...validarSiNoHay(e['siNoHay'], destino, donde));

  return errores;
}

/** "siNoHay": solo con "seguidor_azar"; una lista de efectos normales (sin otro "siNoHay" dentro). */
function validarSiNoHay(siNoHay: unknown, destino: unknown, donde: string): string[] {
  if (siNoHay === undefined) {
    return [];
  }
  if (destino !== 'seguidor_azar') {
    return [`${donde}: "siNoHay" solo tiene sentido con el destino "seguidor_azar" (qué pasa si no hay ningún seguidor).`];
  }
  if (!Array.isArray(siNoHay) || siNoHay.length === 0) {
    return [`${donde}: "siNoHay" debe ser una lista con al menos un efecto.`];
  }

  const errores: string[] = [];
  for (const reemplazo of siNoHay) {
    if (typeof reemplazo === 'object' && reemplazo !== null && 'siNoHay' in reemplazo) {
      errores.push(`${donde}: un efecto de "siNoHay" no puede llevar otro "siNoHay" dentro.`);
    } else {
      errores.push(...validarEfecto(reemplazo, `${donde}, siNoHay`));
    }
  }
  return errores;
}

/** Avisa de campos que ese tipo de efecto no lleva (p. ej. una "cantidad" en ganar_objeto). */
function soloEstosCampos(e: Record<string, unknown>, permitidos: string[], donde: string): string[] {
  const sobran = Object.keys(e).filter(campo => campo !== 'tipo' && !permitidos.includes(campo));
  if (sobran.length === 0) {
    return [];
  }
  const lleva = permitidos.length > 0 ? `solo lleva ${permitidos.map(c => `"${c}"`).join(', ')}` : 'no lleva nada más';
  return [`${donde}: "${String(e['tipo'])}" ${lleva}; sobra ${sobran.map(c => `"${c}"`).join(', ')}.`];
}

function validarIdObjeto(id: unknown, donde: string): string[] {
  if (typeof id !== 'string') {
    return [`${donde}: falta el "objeto" (su id del catálogo, p. ej. "mano_de_mono").`];
  }
  if (!OBJETOS.some(o => o.id === id)) {
    return [`${donde}: el objeto "${id}" no existe en el catálogo de objetos (data/objetos.json).`];
  }
  return [];
}

/** "partes": las condiciones que una condición lleva dentro (el amuleto maldito). Tienen que existir. */
function validarPartes(partes: unknown, donde: string): string[] {
  if (partes === undefined) {
    return [];
  }
  if (!Array.isArray(partes) || partes.length === 0) {
    return [`${donde}: "partes" debe ser una lista con al menos una condición (si no lleva ninguna dentro, no lo pongas).`];
  }
  return partes.flatMap(parte =>
    typeof parte === 'string' && CONDICIONES.some(c => c.id === parte)
      ? []
      : [`${donde}: la parte "${String(parte)}" no existe en el catálogo de condiciones (data/condiciones.json).`],
  );
}

function validarIdSeguidor(id: unknown, donde: string): string[] {
  if (typeof id !== 'string') {
    return [`${donde}: falta el "seguidor" (el id de su tipo en el catálogo, p. ej. "forzudo").`];
  }
  if (!TIPOS_SEGUIDOR.some(t => t.id === id)) {
    return [`${donde}: el seguidor "${id}" no existe en el catálogo de seguidores (data/seguidores.json).`];
  }
  return [];
}

function validarIdCondicion(id: unknown, donde: string): string[] {
  if (typeof id !== 'string') {
    return [`${donde}: falta la "condicion" (su id del catálogo, p. ej. "escorbuto").`];
  }
  if (!CONDICIONES.some(c => c.id === id)) {
    return [`${donde}: la condición "${id}" no existe en el catálogo de condiciones (data/condiciones.json).`];
  }
  return [];
}

/** quitar_condicion lleva una condición concreta O una categoría, nunca las dos ni ninguna. */
function validarQuitarCondicion(e: Record<string, unknown>, donde: string): string[] {
  const tieneCondicion = e['condicion'] !== undefined;
  const tieneCategoria = e['categoria'] !== undefined;
  if (tieneCondicion === tieneCategoria) {
    return [`${donde}: "quitar_condicion" lleva "condicion" (una concreta) o "categoria" (una de esa categoría), una de las dos.`];
  }
  if (tieneCondicion) {
    return validarIdCondicion(e['condicion'], donde);
  }
  const categoria = e['categoria'];
  if (typeof categoria !== 'string' || !CATEGORIAS_TEXTO.includes(categoria)) {
    return [`${donde}: la categoría "${String(categoria)}" no existe (válidas: ${CATEGORIAS_CONDICION.join(', ')}).`];
  }
  return [];
}

function validarIdBandera(bandera: unknown, donde: string): string[] {
  if (typeof bandera !== 'string' || !FORMATO_ID.test(bandera)) {
    return [`${donde}: la bandera debe ser un nombre en minúsculas y con guiones bajos (p. ej. "emporio_bob_derrotado").`];
  }
  return [];
}

/** Turnos y turnos perdidos: un número entero de 1 o más, o dados sin signo menos ("1d3"). */
function validarCantidadPositiva(valor: unknown, que: string, donde: string): string[] {
  const valido =
    (typeof valor === 'number' && Number.isInteger(valor) && valor >= 1) ||
    (typeof valor === 'string' && FORMATO_CANTIDAD.test(valor) && !valor.startsWith('-'));
  return valido ? [] : [`${donde}: ${que} debe ser un número entero de 1 o más, o dados como "1d3".`];
}

function esNegativa(cantidad: unknown): boolean {
  return (typeof cantidad === 'number' && cantidad < 0) || (typeof cantidad === 'string' && cantidad.startsWith('-'));
}

function rangoTexto(fila: Fila): string {
  return fila.min === fila.max ? `${fila.min}` : `${fila.min}-${fila.max}`;
}
