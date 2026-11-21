import type { Terreno } from '../turno/lugar';
import type { Casilla, Coordenada, Mapa, PuertoPrincipalDelMapa, RasgoDelMapa } from './mapa';

// LECTOR DEL .WXX (Worldographer) → MAPA DEL JUEGO (Sprint 9).
// Lo usa el conversor (scripts/convertir-wxx.mts), que antes descomprime el archivo y lo pasa a
// texto. Sigue las reglas de docs/ContextoMapa/LEEME.md. Ante algo que no conoce, NO adivina: da un
// error que dice qué es, para preguntárselo al autor.
//
// OJO: este archivo solo puede importar TIPOS (import type). Así el conversor lo puede ejecutar
// directamente con Node, sin compilar.

/** Qué es cada terreno de Worldographer, mirando su nombre (en este orden: "Water Sea Deep" contiene "sea"). */
const TERRENOS_WXX: { contiene: string[]; terreno: Terreno }[] = [
  { contiene: ['ocean', 'deep'], terreno: 'alta_mar' },
  { contiene: ['water', 'sea', 'lake'], terreno: 'costa' },
  { contiene: ['beach', 'sand'], terreno: 'playa' },
  { contiene: ['farm'], terreno: 'jungla' }, // convención del autor: Flat Farmland = jungla normal
  { contiene: ['forest', 'jungle', 'wood'], terreno: 'jungla_profunda' }, // Flat Forest Jungle = jungla espesa
];

/** Qué significa cada símbolo de Worldographer (convenciones del autor, no lo que dice el inglés). */
const SIMBOLOS_WXX: Record<string, RasgoDelMapa | 'inicio' | 'barcos'> = {
  'Symbol Anchor': 'puerto', // con el ancla ROJA, puerto principal
  'Symbol Battle Primitive': 'aldea',
  'Symbol Construction': 'ruinas',
  'Building Church': 'monasterio',
  'Symbol Cave': 'guarida_pirata',
  'Symbol Shipwreck': 'naufragio',
  'Symbol Crossbones': 'inicio',
  'Military Sailship': 'barcos', // zona de eventos de barco (no se ve)
};

/** Los 4 puertos principales, según la esquina en la que estén (decidido por el autor el 20-nov). */
export const PUERTOS_POR_ESQUINA: Record<string, { id: string; nombre: string }> = {
  arriba_izquierda: { id: 'la_habana', nombre: 'La Habana' },
  arriba_derecha: { id: 'nassau', nombre: 'Nassau' },
  abajo_izquierda: { id: 'tortuga', nombre: 'Tortuga' },
  abajo_derecha: { id: 'port_royal', nombre: 'Port Royal' },
};

/** Nombres de los puertos normales, que se reparten en el orden en que aparecen en el .wxx. */
export const NOMBRES_DE_PUERTOS: readonly string[] = [
  'Cala Ventura',
  'Puerto Viejo',
  'Fondeadero Gris',
  'Bahía Chica',
  'Cala Tortuga',
  'Puerto Sal',
  'Ensenada Mansa',
];

export interface ResultadoLecturaWxx {
  mapa: Mapa;
  /** Cosas raras que no impiden crear el mapa (el conversor las enseña). */
  avisos: string[];
}

/** Error con TODOS los problemas encontrados a la vez. */
export class ErrorDeWxx extends Error {
  readonly problemas: string[];
  constructor(problemas: string[]) {
    super('El .wxx tiene problemas:\n  - ' + problemas.join('\n  - '));
    this.problemas = problemas;
  }
}

function terrenoDe(nombre: string): Terreno | null {
  const n = nombre.toLowerCase();
  return TERRENOS_WXX.find(t => t.contiene.some(palabra => n.includes(palabra)))?.terreno ?? null;
}

/** Centro de la casilla en "unidades de mundo" (radio del hexágono = 1). */
function centro(col: number, fila: number): { x: number; z: number } {
  return { x: 1.5 * col, z: Math.sqrt(3) * (fila + (col % 2 === 1 ? 0.5 : 0)) };
}

const texto = (c: Coordenada): string => `${c.col},${c.fila}`;

/**
 * Convierte el XML de un .wxx (ya descomprimido y en texto) en un mapa del juego.
 * Lanza ErrorDeWxx si hay algo que no se puede resolver solo.
 */
export function leerWxx(xml: string, id: string, nombre: string): ResultadoLecturaWxx {
  const problemas: string[] = [];
  const avisos: string[] = [];

  // --- Terrenos: <terrainmap> = "nombre⇥índice⇥nombre⇥índice..." ---
  const nombresDeTerreno = new Map<number, string>();
  const terrainmap = xml.match(/<terrainmap>([\s\S]*?)<\/terrainmap>/);
  if (!terrainmap) throw new ErrorDeWxx(['No encuentro <terrainmap> (¿es un .wxx de Worldographer?)']);
  const partes = terrainmap[1].split('\t');
  for (let i = 0; i + 1 < partes.length; i += 2) nombresDeTerreno.set(Number(partes[i + 1]), partes[i]);

  // --- Casillas: cada <tilerow> es una COLUMNA (hexOrientation="COLUMNS") ---
  const orientacion = xml.match(/hexOrientation="([^"]*)"/)?.[1];
  if (orientacion !== 'COLUMNS') problemas.push(`El mapa tiene hexOrientation="${orientacion}"; solo sé leer "COLUMNS"`);
  const inicioTiles = xml.indexOf('<tiles');
  const finTiles = xml.indexOf('</tiles>');
  if (inicioTiles < 0 || finTiles < 0) throw new ErrorDeWxx(['No encuentro las casillas (<tiles>)']);
  const cabecera = xml.slice(inicioTiles, xml.indexOf('>', inicioTiles));
  const ancho = Number(cabecera.match(/tilesWide="(\d+)"/)?.[1]);
  const alto = Number(cabecera.match(/tilesHigh="(\d+)"/)?.[1]);
  const columnasXml = [...xml.slice(inicioTiles, finTiles).matchAll(/<tilerow>([\s\S]*?)<\/tilerow>/g)].map(m =>
    m[1]
      .split('\n')
      .map(linea => linea.trim())
      .filter(Boolean)
      .map(linea => Number(linea.split('\t')[0])),
  );
  if (columnasXml.length !== ancho || columnasXml.some(c => c.length !== alto)) {
    throw new ErrorDeWxx([
      `El mapa dice medir ${ancho}×${alto}, pero trae ${columnasXml.length} columnas de ${[...new Set(columnasXml.map(c => c.length))].join('/')} casillas`,
    ]);
  }

  const casillas: Casilla[] = [];
  const terrenosDesconocidos = new Set<string>();
  for (let fila = 0; fila < alto; fila++) {
    for (let col = 0; col < ancho; col++) {
      const indice = columnasXml[col][fila];
      const nombreTerreno = nombresDeTerreno.get(indice) ?? `índice ${indice}`;
      const terreno = terrenoDe(nombreTerreno);
      if (!terreno) terrenosDesconocidos.add(nombreTerreno);
      casillas.push({ col, fila, terreno: terreno ?? 'alta_mar' });
    }
  }
  for (const t of terrenosDesconocidos) problemas.push(`Terreno desconocido "${t}": pregunta al autor qué es en el juego`);
  const casillaEn = (c: Coordenada): Casilla | undefined => casillas[c.fila * ancho + c.col];
  const esAgua = (c: Casilla): boolean => c.terreno === 'alta_mar' || c.terreno === 'costa';

  // --- Símbolos: <feature type="..."> con <location viewLevel="WORLD" x y> en píxeles ---
  // Un lugar por casilla. Guardamos el ORDEN de aparición (para repartir los dibujos como el HTML de referencia).
  interface Lugar {
    rasgo: RasgoDelMapa;
    principal: boolean;
  }
  const lugares = new Map<string, Lugar>(); // clave "col,fila", en orden de primera aparición
  const inicios: Coordenada[] = [];
  const simbolosDesconocidos = new Set<string>();
  for (const m of xml.matchAll(/<feature\b([^>]*)>([\s\S]*?)<\/feature>/g)) {
    const tipo = m[1].match(/type="([^"]*)"/)?.[1] ?? '?';
    const loc = m[2].match(/<location viewLevel="WORLD" x="([\d.]+)" y="([\d.]+)"/);
    if (!loc) continue;
    const significado = SIMBOLOS_WXX[tipo];
    if (!significado) {
      simbolosDesconocidos.add(tipo);
      continue;
    }
    // De píxeles a casilla (rejilla interna de 300 unidades por hexágono)
    const colExacta = (Number(loc[1]) - 150) / 225;
    const col = Math.round(colExacta);
    const filaExacta = (Number(loc[2]) - 150 - (col % 2 === 1 ? 150 : 0)) / 300;
    const fila = Math.round(filaExacta);
    const donde = { col, fila };
    if (Math.abs(colExacta - col) > 1e-6 || Math.abs(filaExacta - fila) > 1e-6) {
      problemas.push(`"${tipo}" en x=${loc[1]} y=${loc[2]} no cae justo en una casilla (¿otra escala?)`);
      continue;
    }
    const casilla = casillaEn(donde);
    if (col < 0 || fila < 0 || col >= ancho || fila >= alto || !casilla) {
      problemas.push(`"${tipo}" cae fuera del mapa (${texto(donde)})`);
      continue;
    }
    if (significado === 'inicio') {
      inicios.push(donde);
      continue;
    }
    if (significado === 'barcos') {
      if (esAgua(casilla)) casilla.eventosDeBarco = true;
      else avisos.push(`Hay un barco en tierra (${texto(donde)}): no cuenta como zona de barcos`);
      continue;
    }
    const principal = significado === 'puerto' && / color="1\.0,0\.0,0\.0/.test(m[1]);
    const clave = texto(donde);
    const anterior = lugares.get(clave);
    if (anterior) {
      if (anterior.principal) continue; // el puerto principal manda
      const mismoPuerto = anterior.rasgo === 'puerto' && significado === 'puerto';
      if (!mismoPuerto) avisos.push(`Dos lugares en ${clave} (${anterior.rasgo} y ${significado}): me quedo con ${significado}`);
    }
    lugares.set(clave, { rasgo: significado, principal });
  }
  for (const s of simbolosDesconocidos) problemas.push(`Símbolo desconocido "${s}": pregunta al autor qué es en el juego`);

  // --- Inicio ---
  if (inicios.length === 0) problemas.push('No hay casilla de inicio: pon una calavera con huesos (Symbol Crossbones)');
  if (inicios.length > 1) problemas.push(`Hay ${inicios.length} casillas de inicio (${inicios.map(texto).join(' · ')}): solo puede haber una`);
  const inicio = inicios[0] ?? { col: 0, fila: 0 };
  if (inicios.length === 1 && esAgua(casillaEn(inicio)!)) problemas.push(`La casilla de inicio (${texto(inicio)}) es agua: se empieza a pie`);

  // --- Lugares a las casillas, con su variante y su nombre ---
  const contadores: Record<string, number> = {};
  const puertosPrincipales: PuertoPrincipalDelMapa[] = [];
  let puertosNormales = 0;
  const { x: centroX, z: centroZ } = centro((ancho - 1) / 2, (alto - 1) / 2);
  for (const [clave, lugar] of lugares) {
    const [col, fila] = clave.split(',').map(Number);
    const casilla = casillaEn({ col, fila })!;
    if (esAgua(casilla)) avisos.push(`${lugar.rasgo} en el agua (${clave})`);
    casilla.rasgo = lugar.rasgo;
    casilla.variante = contadores[lugar.rasgo] = (contadores[lugar.rasgo] ?? -1) + 1;
    if (lugar.rasgo !== 'puerto') continue;
    if (lugar.principal) {
      const { x, z } = centro(col, fila);
      const esquina = (z < centroZ ? 'arriba' : 'abajo') + '_' + (x < centroX ? 'izquierda' : 'derecha');
      const puerto = PUERTOS_POR_ESQUINA[esquina];
      const yaHay = puertosPrincipales.find(p => p.id === puerto.id);
      if (yaHay) {
        problemas.push(`Hay dos puertos principales en la esquina ${esquina.replace('_', ' ')} (${texto(yaHay)} y ${clave})`);
        continue;
      }
      casilla.nombre = puerto.nombre;
      puertosPrincipales.push({ id: puerto.id, nombre: puerto.nombre, col, fila });
    } else {
      casilla.nombre = NOMBRES_DE_PUERTOS[puertosNormales % NOMBRES_DE_PUERTOS.length];
      if (puertosNormales >= NOMBRES_DE_PUERTOS.length) avisos.push(`Hay más puertos que nombres: "${casilla.nombre}" se repite`);
      puertosNormales++;
    }
  }
  if (puertosPrincipales.length !== 4) {
    problemas.push(`Hay ${puertosPrincipales.length} puertos principales (anclas rojas): tiene que haber 4, uno por esquina`);
  }

  if (problemas.length > 0) throw new ErrorDeWxx(problemas);
  const orden = Object.keys(PUERTOS_POR_ESQUINA).map(e => PUERTOS_POR_ESQUINA[e].id);
  puertosPrincipales.sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id));
  return { mapa: { id, nombre, columnas: ancho, filas: alto, inicio, puertosPrincipales, casillas }, avisos };
}
