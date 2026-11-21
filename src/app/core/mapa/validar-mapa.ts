import { TERRENOS } from '../turno/lugar';
import { casillaInicialDelBarco } from './donde-estas';
import { RASGOS_DEL_MAPA, type Mapa } from './mapa';

// REVISOR DEL MAPA: comprueba un data/mapas/<id>.json. Devuelve TODOS los errores a la vez, en
// castellano (lista vacía = todo bien). El test del cargador lo pasa por todos los mapas.

const CAMPOS_DE_CASILLA = ['col', 'fila', 'terreno', 'rasgo', 'nombre', 'variante', 'eventosDeBarco'];

export function validarMapa(mapa: Mapa): string[] {
  const errores: string[] = [];
  const donde = `mapa "${mapa.id}"`;
  if (!/^[a-z0-9-]+$/.test(mapa.id)) errores.push(`${donde}: el id solo puede llevar minúsculas, números y guiones`);
  if (!Number.isInteger(mapa.columnas) || !Number.isInteger(mapa.filas) || mapa.columnas < 1 || mapa.filas < 1) {
    errores.push(`${donde}: columnas y filas tienen que ser enteros ≥ 1`);
    return errores;
  }
  if (mapa.casillas.length !== mapa.columnas * mapa.filas) {
    errores.push(`${donde}: tiene ${mapa.casillas.length} casillas y deberían ser ${mapa.columnas * mapa.filas}`);
    return errores;
  }

  const agua = (t: string): boolean => t === 'alta_mar' || t === 'costa';
  mapa.casillas.forEach((c, i) => {
    const aqui = `${donde}, casilla ${c.col},${c.fila}`;
    if (c.col !== i % mapa.columnas || c.fila !== Math.floor(i / mapa.columnas)) {
      errores.push(`${donde}: la casilla en la posición ${i} dice ser ${c.col},${c.fila} (van fila a fila)`);
    }
    if (!(TERRENOS as readonly string[]).includes(c.terreno)) errores.push(`${aqui}: terreno desconocido "${c.terreno}"`);
    if (c.rasgo !== undefined && !(RASGOS_DEL_MAPA as readonly string[]).includes(c.rasgo)) errores.push(`${aqui}: rasgo desconocido "${c.rasgo}"`);
    if (c.rasgo !== undefined && agua(c.terreno)) errores.push(`${aqui}: un ${c.rasgo} no puede estar en el agua`);
    if (c.nombre !== undefined && c.rasgo !== 'puerto') errores.push(`${aqui}: solo los puertos llevan nombre`);
    if (c.rasgo === 'puerto' && !c.nombre) errores.push(`${aqui}: el puerto no tiene nombre`);
    if (c.variante !== undefined && (!Number.isInteger(c.variante) || c.variante < 0)) errores.push(`${aqui}: la variante tiene que ser un entero ≥ 0`);
    if (c.eventosDeBarco !== undefined && c.eventosDeBarco !== true) errores.push(`${aqui}: eventosDeBarco solo puede ser true`);
    if (c.eventosDeBarco && !agua(c.terreno)) errores.push(`${aqui}: una zona de barcos tiene que ser agua`);
    for (const campo of Object.keys(c)) if (!CAMPOS_DE_CASILLA.includes(campo)) errores.push(`${aqui}: campo que sobra "${campo}"`);
  });

  const casilla = (col: number, fila: number) =>
    col >= 0 && fila >= 0 && col < mapa.columnas && fila < mapa.filas ? mapa.casillas[fila * mapa.columnas + col] : undefined;

  const inicio = casilla(mapa.inicio.col, mapa.inicio.fila);
  if (!inicio) errores.push(`${donde}: la casilla de inicio cae fuera del mapa`);
  else if (agua(inicio.terreno)) errores.push(`${donde}: la casilla de inicio es agua (se empieza a pie)`);

  if (mapa.puertosPrincipales.length !== 4) errores.push(`${donde}: tiene ${mapa.puertosPrincipales.length} puertos principales y tienen que ser 4`);
  const ids = mapa.puertosPrincipales.map(p => p.id);
  if (new Set(ids).size !== ids.length) errores.push(`${donde}: hay puertos principales repetidos`);
  for (const p of mapa.puertosPrincipales) {
    const c = casilla(p.col, p.fila);
    if (!c || c.rasgo !== 'puerto') errores.push(`${donde}: el puerto principal ${p.nombre} (${p.col},${p.fila}) no está en una casilla de puerto`);
    else if (c.nombre !== p.nombre) errores.push(`${donde}: la casilla de ${p.nombre} se llama "${c.nombre}"`);
  }
  if (errores.length === 0 && !casillaInicialDelBarco(mapa)) {
    errores.push(`${donde}: el puerto principal más cercano al inicio no tiene agua al lado (el barco no tiene dónde empezar)`);
  }
  return errores;
}
