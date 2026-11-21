// EL VIGILANTE DE core/ (pantalla de pruebas, tras el Sprint 8).
// Regla de oro del proyecto: core/ (las reglas del juego) NO importa nada de Angular ni del
// navegador. Este script revisa todos los .ts de src/app/core y falla si alguno importa
// "@angular/..." o algo de store/ o ui/.
// Uso: npm run vigilar   (sale "core/ está limpio" o la lista de archivos que rompen la regla)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CORE = join(import.meta.dirname, '..', 'src', 'app', 'core');
const PROHIBIDO = /from\s+['"](@angular\/[^'"]*|[^'"]*\/(store|ui)\/[^'"]*)['"]/g;

function archivosTs(carpeta) {
  return readdirSync(carpeta).flatMap(nombre => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivosTs(ruta);
    return nombre.endsWith('.ts') ? [ruta] : [];
  });
}

const fallos = [];
for (const archivo of archivosTs(CORE)) {
  for (const [, importado] of readFileSync(archivo, 'utf8').matchAll(PROHIBIDO)) {
    fallos.push(`${relative(CORE, archivo)} importa "${importado}"`);
  }
}

if (fallos.length > 0) {
  console.error('core/ NO puede importar Angular, store/ ni ui/:');
  for (const fallo of fallos) console.error('  - ' + fallo);
  process.exit(1);
}
console.log('core/ está limpio: no importa Angular, store/ ni ui/.');
