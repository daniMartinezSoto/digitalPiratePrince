import type { Sitio } from '../acciones/accion';
import type { Estado } from '../estado/estado';
import type { TipoDeMarca } from '../estado/mundo';
import { esAgua, type Lugar, type Rasgo, type Terreno } from '../turno/lugar';
import { mapaDeLaPartida, vasABordo } from './donde-estas';
import { vecinas } from './hexagonos';
import { casillaEn, type Coordenada, type Mapa, type RasgoDelMapa } from './mapa';

// EL SITIO SALE DEL MAPA (Sprint 9, paso 4). Hasta ahora quien llamaba a las acciones decía a mano
// dónde estaba el jugador (lugar, rasgo, junto al agua...). Ahora se calcula con su posición, el
// mapa y las marcas de la partida. Solo calcula.
//
// Cómo se decide el LUGAR (lo que entienden las acciones, la comida y el descanso):
//   - a bordo (en la casilla del barco)            → barco
//   - casilla con puerto (aunque su terreno sea jungla: decidido por el autor el 20-nov) → puerto
//   - aldea → aldea · monasterio → monasterio
//   - guarida pirata NEUTRAL (marca guarida_neutral) → guarida (funciona como un puerto pirata)
//   - todo lo demás → intemperie (guarida sin explorar, naufragio, ruinas, playa, jungla...)
// Las marcas cambian el mapa PARA EL RESTO DE LA PARTIDA: "rasgo_cambiado" convierte la casilla en
// otra cosa (una aldea nueva, un puerto, una ciudad pirata en unas ruinas, una guarida abandonada que
// se queda en nada...), y "guarida_neutral" dice que la guarida de esa casilla es neutral.

/** El sitio donde está (o estaría) el jugador, con todo lo que dice el mapa. */
export interface SitioEnElMapa extends Sitio {
  hex: Coordenada;
  juntoAlAgua: boolean;
  /** El color de la casilla: decide la lista de eventos al viajar y el evento nocturno. */
  terreno: Terreno;
  aBordo: boolean;
  /** El rasgo tal como está ahora (el del mapa, cambiado por las marcas). */
  rasgoDelMapa?: RasgoDelMapa;
  /** Si es uno de los 4 puertos principales, su id ("la_habana"). */
  puertoPrincipal?: string;
  /** Una guarida pirata a la que aún no se ha entrado (al llegar, E038 decide qué es). */
  guaridaSinExplorar: boolean;
}

function hayMarca(estado: Estado, c: Coordenada, tipo: TipoDeMarca): boolean {
  return estado.mundo.marcas.some(m => m.tipo === tipo && m.col === c.col && m.fila === c.fila);
}

/**
 * ¿Es una aldea OFENDIDA? (Te echaron al intentar dormir allí, u ofendiste al jefe en la audiencia.)
 * No se puede volver a entrar y, si estás dentro, tienes que irte (decidido por el autor; en el
 * mapa, una X roja).
 */
export function aldeaOfendida(estado: Estado, c: Coordenada): boolean {
  return rasgoEn(estado, c) === 'aldea' && (hayMarca(estado, c, 'echado_de_la_aldea') || hayMarca(estado, c, 'audiencia_vetada'));
}

/** ¿Está bloqueada esta casilla? (No se puede entrar: camino bloqueado, guarida hostil, aldea ofendida...) */
export function casillaBloqueada(estado: Estado, c: Coordenada): boolean {
  return hayMarca(estado, c, 'casilla_bloqueada') || aldeaOfendida(estado, c);
}

/** El rasgo de una casilla AHORA: el del mapa, o el de la última marca "rasgo_cambiado" de esa casilla. */
export function rasgoEn(estado: Estado, c: Coordenada): RasgoDelMapa | undefined {
  const cambios = estado.mundo.marcas.filter(m => m.tipo === 'rasgo_cambiado' && m.col === c.col && m.fila === c.fila);
  const ultimo = cambios[cambios.length - 1]?.rasgo;
  if (ultimo !== undefined) return ultimo === 'ninguno' ? undefined : ultimo;
  return casillaEn(mapaDeLaPartida(estado), c.col, c.fila)?.rasgo;
}

/**
 * El sitio de una casilla, a bordo o a pie. Sirve para la casilla donde estás (sitioActual) y para
 * saber cómo sería llegar a otra (viajar).
 */
export function sitioEn(estado: Estado, c: Coordenada, aBordo: boolean): SitioEnElMapa {
  const mapa = mapaDeLaPartida(estado);
  const casilla = casillaEn(mapa, c.col, c.fila);
  if (!casilla) throw new Error(`sitioEn: la casilla ${c.col},${c.fila} está fuera del mapa "${mapa.id}"`);
  const rasgoDelMapa = aBordo ? undefined : rasgoEn(estado, c);
  const neutral = rasgoDelMapa === 'guarida_pirata' && hayMarca(estado, c, 'guarida_neutral');

  let lugar: Lugar = 'intemperie';
  if (aBordo) lugar = 'barco';
  else if (rasgoDelMapa === 'puerto') lugar = 'puerto';
  else if (rasgoDelMapa === 'aldea') lugar = 'aldea';
  else if (rasgoDelMapa === 'monasterio') lugar = 'monasterio';
  else if (neutral) lugar = 'guarida';

  const rasgo: Rasgo | undefined = rasgoDelMapa === 'naufragio' || rasgoDelMapa === 'ruinas' ? rasgoDelMapa : undefined;
  const puertoPrincipal = rasgoDelMapa === 'puerto' ? mapa.puertosPrincipales.find(p => p.col === c.col && p.fila === c.fila)?.id : undefined;
  return {
    lugar,
    hex: { col: c.col, fila: c.fila },
    ...(rasgo ? { rasgo } : {}),
    juntoAlAgua: aBordo || vecinas(mapa, c).some(v => esAgua(casillaEn(mapa, v.col, v.fila)!.terreno)),
    terreno: casilla.terreno,
    aBordo,
    ...(rasgoDelMapa ? { rasgoDelMapa } : {}),
    ...(puertoPrincipal ? { puertoPrincipal } : {}),
    guaridaSinExplorar: rasgoDelMapa === 'guarida_pirata' && !neutral && !casillaBloqueada(estado, c),
  };
}

/** Dónde está el jugador ahora mismo. */
export function sitioActual(estado: Estado): SitioEnElMapa {
  return sitioEn(estado, estado.mundo.posicion, vasABordo(estado));
}

/**
 * El mapa de la partida TAL COMO ESTÁ AHORA: el del JSON con los rasgos cambiados por las marcas
 * (una aldea nueva, una guarida abandonada que ya no está...). Para dibujarlo. Solo calcula.
 */
export function mapaActual(estado: Estado): Mapa {
  const mapa = mapaDeLaPartida(estado);
  const cambiadas = estado.mundo.marcas.filter(m => m.tipo === 'rasgo_cambiado');
  if (cambiadas.length === 0) return mapa;
  const casillas = mapa.casillas.map(casilla => {
    if (!cambiadas.some(m => m.col === casilla.col && m.fila === casilla.fila)) return casilla;
    const rasgo = rasgoEn(estado, casilla);
    const { rasgo: _antes, ...sinRasgo } = casilla;
    return rasgo ? { ...sinRasgo, rasgo } : sinRasgo;
  });
  return { ...mapa, casillas };
}

/** Las casillas con marca de bloqueo (en el mapa, una roca) y las aldeas ofendidas (una X roja). */
export function casillasMarcadas(estado: Estado): { bloqueadas: Coordenada[]; ofendidas: Coordenada[] } {
  const bloqueadas: Coordenada[] = [];
  const ofendidas: Coordenada[] = [];
  const ya = (lista: Coordenada[], c: Coordenada) => lista.some(x => x.col === c.col && x.fila === c.fila);
  for (const m of estado.mundo.marcas) {
    const c = { col: m.col, fila: m.fila };
    if (m.tipo === 'casilla_bloqueada' && !ya(bloqueadas, c)) bloqueadas.push(c);
    if ((m.tipo === 'echado_de_la_aldea' || m.tipo === 'audiencia_vetada') && aldeaOfendida(estado, c) && !ya(ofendidas, c)) ofendidas.push(c);
  }
  return { bloqueadas, ofendidas };
}
