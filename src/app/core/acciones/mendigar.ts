import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { calcularModificador } from '../modificadores/calcular-modificador';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { resolverTabla } from '../tablas/rangos/resolver-tabla';
import { esPuerto } from '../turno/lugar';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';

// ACCIÓN: MENDIGAR. La da el artista (habilidad "mendigar"): con uno o con varios, es la misma acción
// y se hace una vez al día. En puertos y guaridas. 2d6 en data/tablas/mendigar.json (tirada "mendigar"):
// lo normal es sacar unas monedas, pero puede salir mal (un guardia, unos matones). Ganar oro cuenta
// para el contable. Regla especial "comida_gratis" (el 12): hoy coméis gratis.

const HABILIDAD_MENDIGAR = 'mendigar';

/** Por qué no se puede mendigar: sin artista en el grupo, o no es un puerto ni una guarida. */
export type MotivoParaNoMendigar = 'sin_artista' | 'solo_puerto';

export function motivoParaNoMendigar(estado: Estado, sitio: Sitio): MotivoParaNoMendigar | undefined {
  if (!estado.jugador.seguidores.some(s => s.habilidades.includes(HABILIDAD_MENDIGAR))) {
    return 'sin_artista';
  }
  return esPuerto(sitio.lugar) ? undefined : 'solo_puerto';
}

/** ACCIÓN: MENDIGAR. Después, toca comer. Error si no se puede (la interfaz la enseña desactivada). */
export function mendigar(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'mendigar');
  const motivo = motivoParaNoMendigar(estado, sitio);
  if (motivo) {
    throw new Error(`mendigar: no se puede (${motivo})`);
  }

  const tirada = resolverTabla(obtenerTabla('mendigar'), calcularModificador(estado.jugador, 'mendigar'), dados);
  const resultado = aplicarEfectos(estado, tirada.efectos, dados);
  const actual: Estado =
    tirada.especial === 'comida_gratis' ? { ...resultado.estado, mundo: { ...resultado.estado.mundo, comidaGratis: true } } : resultado.estado;

  return {
    estado: cerrarFaseDeAccion(actual, dados),
    cambios: resultado.cambios,
    tirada: { dados: tirada.dados, modificador: tirada.modificador, total: tirada.total, ...(tirada.texto ? { texto: tirada.texto } : {}) },
    eventos: tirada.evento ? [tirada.evento] : [],
  };
}
