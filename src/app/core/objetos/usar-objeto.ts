import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Dados } from '../dados/dados';
import { aplicarEfectos, type CatalogosEfectos, type ResultadoEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import type { Efecto } from '../tablas/efecto';
import { resolverEfecto } from '../tablas/rangos/resolver-tabla';
import { hayCombate } from '../combate/hay-combate';
import { hayEventoEnCurso } from '../eventos/una-vez';

/**
 * El jugador usa un objeto en la fase de acción, ANTES de elegir qué hace ese día
 * (un ungüento que cura). No gasta la acción: la partida sigue en la fase "accion",
 * y puede usar varios seguidos.
 *   1. Comprueba que se puede: la partida sigue, está en la fase "accion" (sin ninguna acción
 *      a medias), en esa posición hay
 *      un objeto y es de los que se usan en la acción ("cuandoSeUsa": "accion"). Si no, error:
 *      la interfaz solo debe ofrecer los de objetosUsablesAhora.
 *   2. Gasta un uso (a 0 se tira solo) y aplica sus efectos de "alUsar", con sus dados ya tirados.
 * Todo pasa por aplicarEfectos: no toca el estado recibido. Apunta por dónde van los dados.
 */
export function usarObjeto(estado: Estado, posicion: number, dados: Dados, catalogos?: CatalogosEfectos): ResultadoEfectos {
  if (estado.mundo.finPartida) {
    throw new Error('usarObjeto: la partida ya ha terminado');
  }
  if (hayCombate(estado)) {
    throw new Error('usarObjeto: hay un combate en curso; primero hay que terminarlo');
  }
  if (hayEventoEnCurso(estado)) {
    throw new Error('usarObjeto: hay un evento en curso; primero hay que terminarlo');
  }
  if (estado.mundo.fase !== 'accion') {
    throw new Error(`usarObjeto: los objetos se usan en la fase "accion" (la partida está en "${estado.mundo.fase}")`);
  }
  if (estado.mundo.accionEnCurso) {
    throw new Error(`usarObjeto: los objetos se usan antes de elegir la acción, y hay una acción a medias ("${estado.mundo.accionEnCurso.tipo}")`);
  }
  const llevado = estado.jugador.inventario[posicion];
  if (!llevado) {
    throw new Error(`usarObjeto: no hay ningún objeto en la posición ${posicion} del inventario`);
  }
  const ficha = (catalogos?.objetos ?? OBJETOS).find(o => o.id === llevado.id);
  if (!ficha) {
    throw new Error(`usarObjeto: no existe el objeto "${llevado.id}" en el catálogo`);
  }
  if (ficha.cuandoSeUsa !== 'accion') {
    throw new Error(`usarObjeto: "${ficha.id}" no se usa en la fase de acción (${ficha.cuandoSeUsa ? `se usa en: ${ficha.cuandoSeUsa}` : 'es pasivo'})`);
  }

  // Un activo sin usos es permanente: se usa sin gastarse.
  const gasto: Efecto[] = llevado.usosRestantes === undefined ? [] : [{ tipo: 'gastar_uso', posicion }];
  const efectos: Efecto[] = [...gasto, ...(ficha.alUsar ?? []).map(definicion => resolverEfecto(definicion, dados))];
  const resultado = aplicarEfectos(estado, efectos, dados, catalogos);
  return { ...resultado, estado: { ...resultado.estado, mundo: { ...resultado.estado.mundo, estadoDados: dados.obtenerEstado() } } };
}
