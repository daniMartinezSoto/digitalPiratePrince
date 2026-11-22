import type { Dados } from '../dados/dados';
import { conCausaDeMuerte } from '../efectos/causa-de-muerte';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { calcularModificador } from '../modificadores/calcular-modificador';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { resolverTabla } from '../tablas/rangos/resolver-tabla';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';
import { sePuedeCazar } from './acciones-disponibles';

/**
 * ACCIÓN: CAZAR. Solo en tierra salvaje (playa, jungla, jungla profunda).
 * Tira en la tabla de caza (data/tablas/caza.json) con los bonificadores del jugador.
 * Da algo más de comida que pescar, pero tiene riesgo: una de las filas quita 1 PV.
 * Después, la partida pasa a la fase de comida.
 *
 * NO toca el estado que recibe: devuelve uno nuevo.
 * Dados: 1 tirada de la tabla (1d6).
 */
export function cazar(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'cazar');
  if (!sePuedeCazar(sitio)) {
    throw new Error('cazar: aquí no se puede cazar (solo en tierra salvaje: ni a bordo ni en puertos, aldeas o monasterios)');
  }

  const tirada = resolverTabla(obtenerTabla('caza'), calcularModificador(estado.jugador, 'caza'), dados);
  const aplicado = aplicarEfectos(estado, tirada.efectos, dados);
  const resultado = { ...aplicado, estado: conCausaDeMuerte(aplicado.estado, { tipo: 'accion', accion: 'cazar' }) };

  return {
    estado: cerrarFaseDeAccion(resultado.estado, dados),
    cambios: resultado.cambios,
    tirada: { dados: tirada.dados, modificador: tirada.modificador, total: tirada.total, ...(tirada.texto ? { texto: tirada.texto } : {}) },
    eventos: tirada.evento ? [tirada.evento] : [],
  };
}
