import type { Tabla } from './tabla';

import audienciaCapitan from '../../../data/tablas/audiencia-capitan.json';
import audienciaGobernador from '../../../data/tablas/audiencia-gobernador.json';
import audienciaJefeAldea from '../../../data/tablas/audiencia-jefe-aldea.json';
import buscarInformacion from '../../../data/tablas/buscar-informacion.json';
import buscarInformacionAldea from '../../../data/tablas/buscar-informacion-aldea.json';
import caza from '../../../data/tablas/caza.json';
import contratarSeguidor from '../../../data/tablas/contratar-seguidor.json';
import discurso from '../../../data/tablas/discurso.json';
import elMal from '../../../data/tablas/el-mal.json';
import escorbuto from '../../../data/tablas/escorbuto.json';
import lluviasPersisten from '../../../data/tablas/lluvias-persisten.json';
import pesca from '../../../data/tablas/pesca.json';
import tormentaContinua from '../../../data/tablas/tormenta-continua.json';

// El JSON llega sin tipos ("oro" es un texto cualquiera). Aquí, y solo aquí,
// le decimos que es una Tabla. El test de validación comprueba que de verdad lo sea.
const comoTabla = (json: unknown) => json as Tabla;

/**
 * Todas las tablas del juego.
 * PARA AÑADIR UNA TABLA: crea su JSON en data/tablas/, impórtalo arriba y añádelo aquí.
 */
export const TABLAS: readonly Tabla[] = [
  comoTabla(audienciaCapitan),
  comoTabla(audienciaGobernador),
  comoTabla(audienciaJefeAldea),
  comoTabla(buscarInformacion),
  comoTabla(buscarInformacionAldea),
  comoTabla(caza),
  comoTabla(contratarSeguidor),
  comoTabla(discurso),
  comoTabla(elMal),
  comoTabla(escorbuto),
  comoTabla(lluviasPersisten),
  comoTabla(pesca),
  comoTabla(tormentaContinua),
];

/** Devuelve la tabla con ese id. Si no existe, avisa con un error que lista las disponibles. */
export function obtenerTabla(id: string): Tabla {
  const tabla = TABLAS.find(t => t.id === id);
  if (!tabla) {
    const disponibles = TABLAS.map(t => t.id).join(', ');
    throw new Error(`No existe la tabla "${id}". Tablas disponibles: ${disponibles}`);
  }
  return tabla;
}
