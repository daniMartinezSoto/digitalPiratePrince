import { DIRECCIONES, vecinaEn } from '../../../core/mapa/hexagonos';
import type { Mapa } from '../../../core/mapa/mapa';
import type { Terreno } from '../../../core/turno/lugar';

// DEL MAPA DEL JUEGO A LO QUE NECESITA EL DIBUJO: cada casilla con su posición en pantalla, su
// color y su lugar. Solo dibujo: nada de reglas del juego.

/** Color de la tierra (paleta "Caribe vivo", elegida por el autor). El agua la pinta el sombreador. */
export const TINTES: Partial<Record<Terreno, [number, number, number]>> = {
  playa: [242, 210, 150], // #F2D296
  jungla: [134, 184, 88], // #86B858
  jungla_profunda: [46, 106, 54], // #2E6A36
};

export const NOMBRE_DE_TERRENO: Record<Terreno, string> = {
  alta_mar: 'Alta mar',
  costa: 'Costa',
  playa: 'Playa',
  jungla: 'Jungla',
  jungla_profunda: 'Jungla profunda',
};

export type LugarPintable = 'puerto' | 'puerto_principal' | 'aldea' | 'monasterio' | 'naufragio' | 'ruinas' | 'guarida_pirata';

export const NOMBRE_DE_LUGAR: Record<LugarPintable, string> = {
  puerto: 'Puerto',
  puerto_principal: 'Puerto principal',
  aldea: 'Aldea nativa',
  monasterio: 'Monasterio',
  naufragio: 'Naufragio',
  ruinas: 'Ruinas antiguas',
  guarida_pirata: 'Guarida pirata',
};

export interface CasillaPintable {
  c: number;
  r: number;
  terreno: Terreno;
  agua: boolean;
  lugar?: LugarPintable;
  /** Para repartir los dibujos de un mismo tipo (las tres ciudades, las cuatro aldeas...). */
  variante: number;
  nombre?: string;
  eventosDeBarco: boolean;
  inicio: boolean;
  /** Centro en unidades de mundo (radio del hexágono = 1). */
  wx: number;
  wz: number;
}

const R3 = Math.sqrt(3);

/**
 * Las 6 direcciones (cuánto cambian columna y fila) desde una casilla de esa columna. Salen de las
 * cuentas de hexágonos de core/mapa/hexagonos.ts, para que el dibujo y las reglas usen las mismas vecinas.
 */
export function direcciones(col: number): [number, number][] {
  return DIRECCIONES.map(d => {
    const v = vecinaEn({ col, fila: 0 }, d);
    return [v.col - col, v.fila];
  });
}

export function casillasParaPintar(mapa: Mapa): CasillaPintable[] {
  const principales = new Set(mapa.puertosPrincipales.map(p => `${p.col},${p.fila}`));
  return mapa.casillas.map(casilla => {
    const { col, fila, terreno, rasgo } = casilla;
    let lugar: LugarPintable | undefined = rasgo;
    if (rasgo === 'puerto' && principales.has(`${col},${fila}`)) lugar = 'puerto_principal';
    return {
      c: col,
      r: fila,
      terreno,
      agua: terreno === 'alta_mar' || terreno === 'costa',
      lugar,
      variante: casilla.variante ?? 0,
      nombre: casilla.nombre,
      eventosDeBarco: casilla.eventosDeBarco === true,
      inicio: col === mapa.inicio.col && fila === mapa.inicio.fila,
      wx: 1.5 * col,
      wz: R3 * (fila + (col % 2 === 1 ? 0.5 : 0)),
    };
  });
}
