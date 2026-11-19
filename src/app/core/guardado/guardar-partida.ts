import type { Estado } from '../estado/estado';

// GUARDAR LA PARTIDA (Sprint 8). Convierte el estado en texto para poder guardarlo
// (en el navegador, y algún día en la nube). Funciona porque el estado es SOLO DATOS
// (sección 3.4 del CLAUDE.md): sin funciones, clases, Map, Set ni Date.
// Lo contrario es leerPartida (leer-partida.ts).
export function guardarPartida(estado: Estado): string {
  return JSON.stringify(estado);
}
