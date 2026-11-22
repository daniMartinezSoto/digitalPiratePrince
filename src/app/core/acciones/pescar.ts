import type { Dados } from '../dados/dados';
import { conCausaDeMuerte } from '../efectos/causa-de-muerte';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { calcularModificador } from '../modificadores/calcular-modificador';
import { ajusteDeSeguidores } from '../seguidores/consultas';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { resolverTabla } from '../tablas/rangos/resolver-tabla';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';
import { sePuedePescar } from './acciones-disponibles';

/**
 * ACCIÓN: PESCAR. A bordo, o en tierra junto al agua.
 * Tira en la tabla de pesca (data/tablas/pesca.json) con los bonificadores del jugador.
 * Si CONSIGUE pescar algo, cada seguidor pescador da 1 reserva más (si no pesca nada, no dan nada).
 * Después, la partida pasa a la fase de comida.
 *
 * NO toca el estado que recibe: devuelve uno nuevo.
 * Dados: 1 tirada de la tabla (1d6).
 */
export function pescar(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'pescar');
  if (!sePuedePescar(sitio)) {
    throw new Error('pescar: aquí no se puede pescar (hay que estar a bordo o en tierra junto al agua)');
  }

  const tirada = resolverTabla(obtenerTabla('pesca'), calcularModificador(estado.jugador, 'pesca'), dados);

  // El pescador: +1 reserva por cada uno, solo si la fila da comida.
  const extra = ajusteDeSeguidores(estado.jugador, 'reservasAlPescar');
  const efectos = tirada.efectos.map(efecto =>
    efecto.tipo === 'comida' && 'cantidad' in efecto && efecto.cantidad > 0 ? { ...efecto, cantidad: efecto.cantidad + extra } : efecto,
  );

  const aplicado = aplicarEfectos(estado, efectos, dados);
  const resultado = { ...aplicado, estado: conCausaDeMuerte(aplicado.estado, { tipo: 'accion', accion: 'pescar' }) };

  return {
    estado: cerrarFaseDeAccion(resultado.estado, dados),
    cambios: resultado.cambios,
    tirada: { dados: tirada.dados, modificador: tirada.modificador, total: tirada.total, ...(tirada.texto ? { texto: tirada.texto } : {}) },
    eventos: tirada.evento ? [tirada.evento] : [],
  };
}
