import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { conMarca, hayMarca } from '../estado/marcas';
import type { TipoDeMarca } from '../estado/mundo';
import type { Efecto } from '../tablas/efecto';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { resolverConSubtablas } from '../tablas/rangos/resolver-tabla';
import type { ResultadoTabla } from '../tablas/rangos/resultado-tabla';
import type { Rasgo } from '../turno/lugar';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio, type TiradaDeAccion } from './accion';

// ACCIONES: INVESTIGAR NAUFRAGIO y REGISTRAR RUINAS. Solo en casillas con ese rasgo y UNA VEZ por
// casilla (queda una marca y después sale desactivada). Tiran en su tabla, siguiendo las filas que
// mandan a otra tabla ("el hogar de alguien", "la lámpara mágica"):
//   naufragio: data/tablas/naufragio.json (1d6)
//   ruinas:    data/tablas/ruinas.json    (2d6)
// Casi todo acaba en eventos (y combates), que quedan pendientes hasta el motor de eventos.
// Regla especial "idolo_antediluviano" (ruinas, 12): recibes el ídolo; si ya lo tienes, un tesoro mágico.

const OBJETO_IDOLO_ANTEDILUVIANO = 'idolo_antediluviano';
const EVENTO_TESORO_MAGICO = 'tesoro_magico';

interface Exploracion {
  rasgo: Rasgo;
  tabla: string;
  marca: TipoDeMarca;
}

const EXPLORACIONES = {
  investigar_naufragio: { rasgo: 'naufragio', tabla: 'naufragio', marca: 'naufragio_investigado' },
  registrar_ruinas: { rasgo: 'ruinas', tabla: 'ruinas', marca: 'ruinas_registradas' },
} as const satisfies Record<string, Exploracion>;

export type IdExploracion = keyof typeof EXPLORACIONES;

/** Por qué no se puede explorar aquí: no hay ese rasgo, o ya se exploró ("Ya has registrado estas ruinas"). */
export type MotivoParaNoExplorar = 'sin_naufragio' | 'sin_ruinas' | 'ya_explorado';

export function motivoParaNoExplorar(estado: Estado, sitio: Sitio, accion: IdExploracion): MotivoParaNoExplorar | undefined {
  const exploracion = EXPLORACIONES[accion];
  if (sitio.rasgo !== exploracion.rasgo) {
    return exploracion.rasgo === 'naufragio' ? 'sin_naufragio' : 'sin_ruinas';
  }
  return hayMarca(estado, exploracion.marca, sitio.hex) ? 'ya_explorado' : undefined;
}

/** Lo que devuelve explorar: además de lo de siempre, todas las tiradas (la de la tabla y las de sus subtablas). */
export interface ResultadoExploracion extends ResultadoAccion {
  tiradas: TiradaDeAccion[];
}

/** ACCIÓN: INVESTIGAR NAUFRAGIO. */
export function investigarNaufragio(estado: Estado, sitio: Sitio, dados: Dados): ResultadoExploracion {
  return explorar(estado, sitio, 'investigar_naufragio', dados);
}

/** ACCIÓN: REGISTRAR RUINAS. */
export function registrarRuinas(estado: Estado, sitio: Sitio, dados: Dados): ResultadoExploracion {
  return explorar(estado, sitio, 'registrar_ruinas', dados);
}

function explorar(estado: Estado, sitio: Sitio, accion: IdExploracion, dados: Dados): ResultadoExploracion {
  comprobarQueSePuedeActuar(estado, accion);
  const motivo = motivoParaNoExplorar(estado, sitio, accion);
  if (motivo) {
    throw new Error(`${accion}: no se puede (${motivo})`);
  }
  const exploracion = EXPLORACIONES[accion];

  const resultados = resolverConSubtablas(obtenerTabla(exploracion.tabla), 0, dados, obtenerTabla);
  const efectos: Efecto[] = resultados.flatMap(r => r.efectos);
  const eventos: string[] = resultados.flatMap(r => (r.evento ? [r.evento] : []));

  if (resultados.some(r => r.especial === 'idolo_antediluviano')) {
    if (estado.jugador.inventario.some(o => o.id === OBJETO_IDOLO_ANTEDILUVIANO)) {
      eventos.push(EVENTO_TESORO_MAGICO);
    } else {
      efectos.push({ tipo: 'ganar_objeto', objeto: OBJETO_IDOLO_ANTEDILUVIANO });
    }
  }

  const resultado = aplicarEfectos(estado, efectos, dados);
  const marcado = conMarca(resultado.estado, exploracion.marca, sitio.hex);
  const tiradas = resultados.map(paraEnsenar);
  return { estado: cerrarFaseDeAccion(marcado, dados), cambios: resultado.cambios, tirada: tiradas[0], tiradas, eventos };
}

function paraEnsenar(tirada: ResultadoTabla): TiradaDeAccion {
  return { dados: tirada.dados, modificador: tirada.modificador, total: tirada.total, ...(tirada.texto ? { texto: tirada.texto } : {}) };
}
