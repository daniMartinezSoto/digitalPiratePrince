import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import { ATAQUE_NORMAL, RESISTENCIA_NORMAL, type TipoSeguidor } from '../catalogos/tipo-seguidor';
import type { Dados } from '../dados/dados';
import type { Seguidor } from '../estado/seguidor';
import { LISTAS_DE_NOMBRES, nombresDe } from './nombres';

/** Lo que se puede decidir al crear un seguidor, además de su tipo. */
export interface OpcionesSeguidor {
  // true = nunca se marcha por su cuenta (el seguidor del hermano, el náufrago que te debe la vida...).
  inseparable?: boolean;
  // true = si muere, el jugador pierde la partida (el seguidor de "el hermano").
  vital?: boolean;
}

/** De dónde salen las fichas y las listas de nombres. Por defecto, las del juego; los tests pueden pasar otras. */
export interface FuentesSeguidor {
  tipos: readonly TipoSeguidor[];
  nombres: Readonly<Record<string, readonly string[]>>;
}

const FUENTES_DEL_JUEGO: FuentesSeguidor = { tipos: TIPOS_SEGUIDOR, nombres: LISTAS_DE_NOMBRES };

/**
 * Fabrica un seguidor nuevo de ese tipo: copia los números de su ficha (ataque, resistencia,
 * habilidades) y le pone un nombre propio al azar, de las listas de nombres que diga su ficha
 * (un nativo recibe un nombre de nativo; la bruja vudú, uno de mujer). Ejemplo: crearSeguidor('forzudo', ...) puede
 * devolver a "Rufus Malapata", forzudo, ataque 3 y resistencia 10 de 10.
 *
 * SOLO lo fabrica: no lo mete en el grupo ni cobra su precio (eso es el efecto "se une un seguidor").
 * `seguidoresActuales` es el grupo que ya tiene el jugador: sirve para no repetir nombre ni id.
 * Gasta exactamente UN número del generador (el del nombre).
 */
export function crearSeguidor(
  idTipo: string,
  seguidoresActuales: readonly Seguidor[],
  dados: Dados,
  opciones: OpcionesSeguidor = {},
  fuentes: FuentesSeguidor = FUENTES_DEL_JUEGO,
): Seguidor {
  const tipo = fuentes.tipos.find(t => t.id === idTipo);
  if (!tipo) {
    const disponibles = fuentes.tipos.map(t => t.id).join(', ');
    throw new Error(`crearSeguidor: no existe el tipo de seguidor "${idTipo}". Tipos disponibles: ${disponibles}`);
  }

  const resistencia = tipo.resistencia ?? RESISTENCIA_NORMAL;

  const seguidor: Seguidor = {
    id: idLibre(tipo.id, seguidoresActuales),
    tipo: tipo.id,
    nombre: nombreAlAzar(seguidoresActuales, dados, nombresDe(tipo.nombres, fuentes.nombres)),
    ataque: tipo.ataque ?? ATAQUE_NORMAL,
    resistencia,
    resistenciaMaxima: resistencia,
    habilidades: [...tipo.habilidades], // copia: la ficha del catálogo no se toca
  };

  // Solo se apuntan si son true: un seguidor normal no lleva esos campos.
  if (opciones.inseparable) {
    seguidor.inseparable = true;
  }
  if (opciones.vital) {
    seguidor.vital = true;
  }
  return seguidor;
}

/**
 * Id del seguidor dentro de la partida: el tipo y un número ("forzudo_1").
 * Si ya llevas un "forzudo_1", el siguiente es "forzudo_2".
 */
function idLibre(idTipo: string, seguidoresActuales: readonly Seguidor[]): string {
  let numero = 1;
  while (seguidoresActuales.some(s => s.id === `${idTipo}_${numero}`)) {
    numero++;
  }
  return `${idTipo}_${numero}`;
}

/**
 * Elige un nombre al azar de la lista. Si ya lo lleva alguien del grupo, coge el siguiente
 * de la lista (y así hasta encontrar uno libre), sin volver a tirar: siempre gasta un solo número.
 */
function nombreAlAzar(seguidoresActuales: readonly Seguidor[], dados: Dados, nombres: readonly string[]): string {
  if (nombres.length === 0) {
    throw new Error('crearSeguidor: no hay ningún nombre entre los que elegir (las listas de nombres están vacías)');
  }

  const inicio = dados.entero(0, nombres.length - 1);
  for (let salto = 0; salto < nombres.length; salto++) {
    const nombre = nombres[(inicio + salto) % nombres.length];
    if (!seguidoresActuales.some(s => s.nombre === nombre)) {
      return nombre;
    }
  }
  // Todos los nombres están cogidos (solo pasa con listas diminutas): se repite el que tocó.
  return nombres[inicio];
}
