import type { Estado } from '../../core/estado/estado';
import { mapaDeLaPartida } from '../../core/mapa/donde-estas';
import { DIRECCIONES, distancia, mismaCasilla, vecinaEn, type Direccion } from '../../core/mapa/hexagonos';
import { casillaEn, type Coordenada, type RasgoDelMapa } from '../../core/mapa/mapa';
import { sitioEn } from '../../core/mapa/sitio-actual';
import type { MotivoSinEmbarque } from '../../core/viaje/embarcar';
import { NOMBRE_DE_TERRENO } from './textos';

// TEXTOS DEL MAPA (pantalla de pruebas, Sprint 9): describir casillas y direcciones.

const NOMBRE_DEL_RASGO_DEL_MAPA: Record<RasgoDelMapa, string> = {
  puerto: 'Puerto',
  aldea: 'Aldea',
  monasterio: 'Monasterio',
  naufragio: 'Naufragio',
  ruinas: 'Ruinas',
  guarida_pirata: 'Guarida pirata',
};

/** "La Habana (puerto principal)", "Aldea · Jungla profunda", "Guarida pirata (sin explorar)", "Costa". */
export function describirCasilla(estado: Estado, c: Coordenada, aBordo: boolean): string {
  const sitio = sitioEn(estado, c, aBordo);
  const terreno = NOMBRE_DE_TERRENO[sitio.terreno];
  const casilla = casillaEn(mapaDeLaPartida(estado), c.col, c.fila);
  if (sitio.rasgoDelMapa === 'puerto') {
    const nombre = casilla?.nombre ?? 'Puerto';
    return sitio.puertoPrincipal ? `${nombre} (puerto principal)` : `${nombre} (puerto)`;
  }
  if (sitio.rasgoDelMapa === 'guarida_pirata') {
    const estadoGuarida = sitio.lugar === 'guarida' ? 'neutral' : sitio.guaridaSinExplorar ? 'sin explorar' : 'bloqueada';
    return `Guarida pirata (${estadoGuarida}) · ${terreno}`;
  }
  return sitio.rasgoDelMapa ? `${NOMBRE_DEL_RASGO_DEL_MAPA[sitio.rasgoDelMapa]} · ${terreno}` : terreno;
}

/** La dirección de una casilla vecina ("SE"), o null si no es vecina. */
export function direccionHacia(desde: Coordenada, hasta: Coordenada): Direccion | null {
  return DIRECCIONES.find(d => mismaCasilla(vecinaEn(desde, d), hasta)) ?? null;
}

/** "al SE (7,2)" para una vecina; "a 2 casillas (8,4)" para una más lejos. */
export function haciaDonde(desde: Coordenada, hasta: Coordenada): string {
  const direccion = direccionHacia(desde, hasta);
  const donde = `(${hasta.col},${hasta.fila})`;
  return direccion ? `al ${direccion} ${donde}` : `a ${distancia(desde, hasta)} casillas ${donde}`;
}

export const TEXTO_SIN_EMBARQUE: Record<MotivoSinEmbarque, string> = {
  no_es_momento: 'Solo antes de elegir la acción del día',
  ya_usado_hoy: 'Ya has subido o bajado del barco hoy',
  lejos_del_barco: 'El barco no está al lado',
  aqui_no_se_atraca: 'Desde la jungla profunda no se puede embarcar',
  sin_sitio_para_bajar: 'No hay ningún sitio para bajar junto al barco (la jungla profunda no vale)',
};
