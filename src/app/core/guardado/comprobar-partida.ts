import { FASES } from '../estado/fase';
import { RETRATOS } from '../personaje/retrato';

// COMPROBAR QUE UNOS DATOS TIENEN FORMA DE PARTIDA (Sprint 8).
// Mira la FORMA, no el contenido: que estén los campos importantes con su tipo (números,
// listas, la fase...). No mira si cada objeto o condición existe en su catálogo: si algún día
// se borra uno del JSON, eso lo arreglará un adaptador (adaptadores.ts).
// Sirve para que un texto estropeado no se cargue como si fuera una partida y rompa el juego después.

type Datos = Record<string, unknown>;

const NUMEROS_DEL_JUGADOR = [
  'vida', 'vidaMax', 'fuerza', 'ingenio', 'oro', 'tripulacion', 'tripulacionMax', 'comida',
  'fama', 'famaObjetivo', 'diasSinComer', 'capacidadInventario', 'fasesAccionPerdidas',
] as const;
const LISTAS_DEL_JUGADOR = ['inventario', 'seguidores', 'condiciones'] as const;
const LISTAS_DEL_MUNDO = ['marcas', 'pilaEventos', 'puertosVisitados'] as const;
const OBJETOS_O_NULL_DEL_MUNDO = ['finPartida', 'accionEnCurso', 'combate', 'combateNaval'] as const;
const CASILLAS_DEL_MUNDO = ['posicion', 'posicionBarco'] as const; // desde la versión 2 (Sprint 9)

export function tieneFormaDePartida(datos: unknown): boolean {
  if (!esObjeto(datos) || !esEnteroPositivo(datos['version'])) {
    return false;
  }
  return jugadorValido(datos['jugador']) && mundoValido(datos['mundo']);
}

function jugadorValido(jugador: unknown): boolean {
  return (
    esObjeto(jugador) &&
    typeof jugador['nombre'] === 'string' &&
    typeof jugador['sobrenombre'] === 'string' &&
    (RETRATOS as readonly unknown[]).includes(jugador['retrato']) &&
    NUMEROS_DEL_JUGADOR.every(campo => esNumero(jugador[campo])) &&
    LISTAS_DEL_JUGADOR.every(campo => Array.isArray(jugador[campo]))
  );
}

function mundoValido(mundo: unknown): boolean {
  return (
    esObjeto(mundo) &&
    typeof mundo['mapaId'] === 'string' &&
    CASILLAS_DEL_MUNDO.every(campo => esCasilla(mundo[campo])) &&
    esNumero(mundo['dia']) &&
    (FASES as readonly unknown[]).includes(mundo['fase']) &&
    Number.isInteger(mundo['semilla']) &&
    Number.isInteger(mundo['estadoDados']) && // crece con cada tirada: sin límite de tamaño
    esObjeto(mundo['banderas']) &&
    LISTAS_DEL_MUNDO.every(campo => Array.isArray(mundo[campo])) &&
    OBJETOS_O_NULL_DEL_MUNDO.every(campo => mundo[campo] === null || esObjeto(mundo[campo])) &&
    typeof mundo['nochePagada'] === 'boolean' &&
    typeof mundo['comidaGratis'] === 'boolean' &&
    (mundo['ultimaBusquedaInformacion'] === null || esNumero(mundo['ultimaBusquedaInformacion']))
  );
}

/** Una casilla del mapa: { col, fila } con números enteros. */
function esCasilla(valor: unknown): boolean {
  return esObjeto(valor) && Number.isInteger(valor['col']) && Number.isInteger(valor['fila']);
}

export function esObjeto(valor: unknown): valor is Datos {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function esEnteroPositivo(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= 1;
}

function esNumero(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isFinite(valor);
}
