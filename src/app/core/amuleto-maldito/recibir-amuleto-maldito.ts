import { tieneCondicion } from '../condiciones/condiciones-vigentes';
import type { Dados } from '../dados/dados';
import { aplicarEfectos, type CatalogosEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import type { Efecto } from '../tablas/efecto';
import { resolverEfecto } from '../tablas/rangos/resolver-tabla';
import type { AmuletoMaldito, ResultadoDelAmuleto } from './amuleto-maldito';
import { AMULETO_MALDITO } from './cargar-amuleto-maldito';

export const CONDICION_AMULETO_MALDITO = 'amuleto_maldito';

/** Lo que devuelve recibirAmuletoMaldito. */
export interface ResultadoAmuleto {
  estado: Estado;
  cambios: Cambio[];

  // Lo que ha salido en los dos dados (la posición en cada lista: 1-6), para enseñarlo.
  // null = ya tenía un amuleto: no se ha tirado nada.
  tiradas: { bendicion: number; maldicion: number } | null;

  // Eventos que hay que lanzar (el "deseo"). Hasta el motor de eventos, quedan pendientes.
  eventos: string[];
}

/**
 * El jugador recibe un amuleto maldito (E027): "el maldito" al empezar, la bruja vudú, algún evento...
 *   1. Si ya lleva uno, no recibe otro (no se tira ningún dado) y se avisa con el cambio
 *      "condicion_no_puesta" (motivo "ya_la_tiene").
 *   2. Tira un dado en la lista de bendiciones y otro en la de maldiciones (gasta dos números del generador).
 *   3. Pone UNA condición, "amuleto_maldito", con las dos que han tocado dentro (sus "partes").
 *      Si en una lista sale un evento (el deseo), esa parte no va dentro: el evento se devuelve
 *      en "eventos" y el amuleto lleva solo la otra.
 *   4. Aplica lo que pasa una sola vez al recibirlo ("alRecibir"): gran fortaleza te cura del todo
 *      (con la vida máxima ya aumentada).
 * Todo pasa por aplicarEfectos: no toca el estado recibido.
 */
export function recibirAmuletoMaldito(
  estado: Estado,
  dados: Dados,
  catalogos?: CatalogosEfectos,
  amuleto: AmuletoMaldito = AMULETO_MALDITO,
): ResultadoAmuleto {
  if (tieneCondicion(estado.jugador, CONDICION_AMULETO_MALDITO)) {
    return {
      estado,
      cambios: [{ tipo: 'condicion_no_puesta', condicion: CONDICION_AMULETO_MALDITO, motivo: 'ya_la_tiene' }],
      tiradas: null,
      eventos: [],
    };
  }

  const tiradaBendicion = dados.tirar(`1d${amuleto.bendiciones.length}`).total;
  const tiradaMaldicion = dados.tirar(`1d${amuleto.maldiciones.length}`).total;
  const bendicion = amuleto.bendiciones[tiradaBendicion - 1];
  const maldicion = amuleto.maldiciones[tiradaMaldicion - 1];

  const partes = [bendicion, maldicion].flatMap(r => (r.condicion === undefined ? [] : [r.condicion]));
  const eventos = [bendicion, maldicion].flatMap(r => (r.evento === undefined ? [] : [r.evento]));

  const efectos: Efecto[] = [
    { tipo: 'poner_condicion', condicion: CONDICION_AMULETO_MALDITO, partes },
    ...efectosAlRecibir(bendicion, dados),
    ...efectosAlRecibir(maldicion, dados),
  ];

  const resultado = aplicarEfectos(estado, efectos, dados, catalogos);
  return { ...resultado, tiradas: { bendicion: tiradaBendicion, maldicion: tiradaMaldicion }, eventos };
}

/** Los efectos de una sola vez de ese resultado, con sus dados ya tirados. */
function efectosAlRecibir(resultado: ResultadoDelAmuleto, dados: Dados): Efecto[] {
  return (resultado.alRecibir ?? []).map(definicion => resolverEfecto(definicion, dados));
}
