import type { Estado } from '../estado/estado';
import { MOTIVOS_DE_FIN, RESULTADOS_DE_PARTIDA, TIPOS_DE_CAUSA_DE_MUERTE, type CausaDeMuerte, type MotivoDeFin, type ResultadoDePartida } from '../estado/fin-partida';
import { RETRATOS, type Retrato } from '../personaje/retrato';
import { esEnteroPositivo, esObjeto } from './comprobar-partida';
import type { MotivoDeLecturaFallida } from './leer-partida';

// LA CRÓNICA (Sprint 8): el historial de partidas terminadas. Al ganar o morir, la partida se
// borra y queda una ficha aquí. Se guardan TODAS, ordenadas por fama (de más a menos), a igual
// fama por oro y, si también empatan, primero la más antigua (como un récord: quien lo consiguió
// antes conserva el puesto).
// La crónica tiene SU PROPIA versión (VERSION_CRONICA), aparte de la de la partida: cada una
// puede cambiar de formato por su lado.

export const VERSION_CRONICA = 1;

/** Una partida terminada, tal como se ve en la crónica. */
export interface EntradaCronica {
  semilla: number;
  nombre: string;
  sobrenombre: string; // id del sobrenombre
  retrato: Retrato;
  dias: number; // el día en que terminó
  fama: number;
  oro: number;
  resultado: ResultadoDePartida;
  motivo: MotivoDeFin;
  causa?: CausaDeMuerte; // por qué murió (si se sabe)
  fecha: string; // ISO ("2026-11-19T12:30:00.000Z"). La pone el store: core/ no usa fechas.
}

/**
 * La ficha de una partida terminada. La fecha la pasa quien llama (el store).
 * Da error si la partida no ha terminado: eso solo puede ser un fallo del programa.
 */
export function crearEntradaCronica(estado: Estado, fecha: string): EntradaCronica {
  const fin = estado.mundo.finPartida;
  if (!fin) {
    throw new Error('crearEntradaCronica: la partida todavía no ha terminado');
  }
  const { jugador, mundo } = estado;
  return {
    semilla: mundo.semilla,
    nombre: jugador.nombre,
    sobrenombre: jugador.sobrenombre,
    retrato: jugador.retrato,
    dias: mundo.dia,
    fama: jugador.fama,
    oro: jugador.oro,
    resultado: fin.resultado,
    motivo: fin.motivo,
    ...(fin.causa ? { causa: fin.causa } : {}),
    fecha,
  };
}

/** Ordena: más fama arriba; a igual fama, más oro; si empatan, la más antigua primero. No toca la lista recibida. */
export function ordenarCronica(cronica: readonly EntradaCronica[]): EntradaCronica[] {
  return [...cronica].sort(
    (a, b) => b.fama - a.fama || b.oro - a.oro || (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0),
  );
}

/** Añade una ficha y devuelve la crónica nueva, ya ordenada. No toca la lista recibida. */
export function anadirACronica(cronica: readonly EntradaCronica[], entrada: EntradaCronica): EntradaCronica[] {
  return ordenarCronica([...cronica, entrada]);
}

// ---------------------------------------------------------------------------
// Guardar y leer (con el mismo cuidado que la partida: leer NUNCA rompe)
// ---------------------------------------------------------------------------

/** La crónica como texto: { version, entradas }. */
export function guardarCronica(cronica: readonly EntradaCronica[]): string {
  return JSON.stringify({ version: VERSION_CRONICA, entradas: cronica });
}

/**
 * ok: true  → las fichas buenas, ordenadas; "descartadas" = cuántas estaban estropeadas y se han quitado.
 * ok: false → no se ha podido leer NADA. Quien llama no debe escribir encima (perdería el historial).
 */
export type ResultadoDeLecturaCronica =
  | { ok: true; entradas: EntradaCronica[]; descartadas: number }
  | { ok: false; motivo: MotivoDeLecturaFallida };

export function leerCronica(texto: string, versionActual: number = VERSION_CRONICA): ResultadoDeLecturaCronica {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'no_se_puede_leer' };
  }
  if (!esObjeto(datos) || !esEnteroPositivo(datos['version'])) {
    return { ok: false, motivo: 'no_es_una_partida' };
  }
  if (datos['version'] > versionActual) {
    return { ok: false, motivo: 'version_futura' };
  }
  // (Cuando cambie el formato, aquí irán sus adaptadores, como los de la partida.)
  const lista = datos['entradas'];
  if (!Array.isArray(lista)) {
    return { ok: false, motivo: 'no_es_una_partida' };
  }

  // Una ficha estropeada no tira toda la crónica: se quita esa y se quedan las buenas.
  const buenas = lista.filter(esEntradaValida);
  return { ok: true, entradas: ordenarCronica(buenas), descartadas: lista.length - buenas.length };
}

function esEntradaValida(valor: unknown): valor is EntradaCronica {
  return (
    esObjeto(valor) &&
    Number.isInteger(valor['semilla']) &&
    typeof valor['nombre'] === 'string' &&
    typeof valor['sobrenombre'] === 'string' &&
    (RETRATOS as readonly unknown[]).includes(valor['retrato']) &&
    esNumero(valor['dias']) &&
    esNumero(valor['fama']) &&
    esNumero(valor['oro']) &&
    (RESULTADOS_DE_PARTIDA as readonly unknown[]).includes(valor['resultado']) &&
    (MOTIVOS_DE_FIN as readonly unknown[]).includes(valor['motivo']) &&
    (valor['causa'] === undefined || (esObjeto(valor['causa']) && (TIPOS_DE_CAUSA_DE_MUERTE as readonly unknown[]).includes(valor['causa']['tipo']))) &&
    typeof valor['fecha'] === 'string'
  );
}

function esNumero(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isFinite(valor);
}
