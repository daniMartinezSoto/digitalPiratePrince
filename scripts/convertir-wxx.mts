// EL CONVERSOR DE MAPAS (Sprint 9): .wxx de Worldographer → src/app/data/mapas/<id>.json
// El juego no lee el .wxx: se convierte UNA vez con este script y el juego usa el JSON.
//
// Uso:  npm run convertir-mapa -- <archivo.wxx> <id> "<Nombre del mapa>"
// Ej.:  npm run convertir-mapa -- docs/ContextoMapa/primerMapaPrueba.wxx primer-mapa-prueba "Primer mapa de prueba"
//
// Las reglas (qué es cada terreno y cada símbolo, puertos principales, nombres...) están en
// src/app/core/mapa/leer-wxx.ts. Si el .wxx trae algo que no conoce, para y dice qué es.
// Después de convertir, lanza ng test: el revisor del mapa comprueba el JSON.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { leerWxx, ErrorDeWxx } from '../src/app/core/mapa/leer-wxx.ts';

const [archivo, id, nombre] = process.argv.slice(2);
if (!archivo || !id || !nombre || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Uso: npm run convertir-mapa -- <archivo.wxx> <id-en-minusculas-con-guiones> "<Nombre del mapa>"');
  process.exit(1);
}

// 1. Descomprimir (gzip) y pasar a texto (UTF-16 casi siempre; algunos mapas en UTF-8)
let bytes: Uint8Array = readFileSync(archivo);
if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
const codificacion = bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : bytes[0] === 0x3c && bytes[1] === 0x3f ? 'utf-8' : 'utf-16le';
const xml = new TextDecoder(codificacion).decode(bytes);

// 2. Leer
let resultado;
try {
  resultado = leerWxx(xml, id, nombre);
} catch (error) {
  console.error(error instanceof ErrorDeWxx ? error.message : error);
  process.exit(1);
}
const { mapa, avisos } = resultado;

// 3. Escribir el JSON (una casilla por línea, para que se pueda leer y comparar en git)
const linea = (objeto: object): string => JSON.stringify(objeto).replace(/,"/g, ', "').replace(/":/g, '": ');
const json = [
  '{',
  `  "id": ${JSON.stringify(mapa.id)},`,
  `  "nombre": ${JSON.stringify(mapa.nombre)},`,
  `  "columnas": ${mapa.columnas},`,
  `  "filas": ${mapa.filas},`,
  `  "inicio": ${linea(mapa.inicio)},`,
  '  "puertosPrincipales": [',
  mapa.puertosPrincipales.map(p => '    ' + linea(p)).join(',\n'),
  '  ],',
  '  "casillas": [',
  mapa.casillas.map(c => '    ' + linea(c)).join(',\n'),
  '  ]',
  '}',
  '',
].join('\n');
const carpeta = join(import.meta.dirname, '..', 'src', 'app', 'data', 'mapas');
mkdirSync(carpeta, { recursive: true });
const destino = join(carpeta, `${id}.json`);
writeFileSync(destino, json);

// 4. Resumen
const cuenta = (prueba: (c: (typeof mapa.casillas)[number]) => boolean): number => mapa.casillas.filter(prueba).length;
console.log(`Mapa "${mapa.nombre}" (${mapa.columnas}×${mapa.filas}) guardado en ${destino}`);
console.log(`  Inicio: ${mapa.inicio.col},${mapa.inicio.fila}`);
console.log(`  Puertos principales: ${mapa.puertosPrincipales.map(p => `${p.nombre} (${p.col},${p.fila})`).join(' · ')}`);
for (const rasgo of ['puerto', 'aldea', 'monasterio', 'ruinas', 'guarida_pirata', 'naufragio'] as const) {
  console.log(`  ${rasgo}: ${cuenta(c => c.rasgo === rasgo)}`);
}
console.log(`  Zonas de eventos de barco: ${cuenta(c => c.eventosDeBarco === true)}`);
for (const aviso of avisos) console.warn('  AVISO: ' + aviso);
