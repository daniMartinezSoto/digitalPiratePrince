import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { buscarMarca, conMarca, hayMarca, sinMarca } from '../estado/marcas';
import type { IdTirada } from '../modificadores/id-tirada';
import { calcularModificador } from '../modificadores/calcular-modificador';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { resolverTabla } from '../tablas/rangos/resolver-tabla';
import type { Lugar } from '../turno/lugar';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';

// ACCIÓN: SOLICITAR AUDIENCIA. 1d6 en la tabla de quien manda en ese sitio:
//   puerto:  el gobernador        (data/tablas/audiencia-gobernador.json, tirada "audiencia_puerto")
//   aldea:   el jefe de la aldea  (data/tablas/audiencia-jefe-aldea.json, tirada "audiencia_aldea")
//   guarida: el capitán pirata    (data/tablas/audiencia-capitan.json,    tirada "audiencia_guarida";
//            +1 por cada 2 de fama, en AJUSTES.bonificadorPorFama)
// Reglas especiales de las filas (marcas en la casilla):
//   audiencia_concedida: te reciben; aquí ya no se puede volver a pedir en toda la partida.
//   audiencia_vetada:    ofendes (o te reconoce un guardia); aquí no se puede volver a pedir nunca.
//   audiencia_aplazada:  "hoy no"; si la pides aquí MAÑANA, +1 (no se acumula; después caduca).
// Casi todos los resultados mandan a un evento, que queda pendiente hasta el motor de eventos.

interface QuienManda {
  tabla: string;
  tirada: IdTirada;
}

const AUDIENCIAS: Partial<Record<Lugar, QuienManda>> = {
  puerto: { tabla: 'audiencia_gobernador', tirada: 'audiencia_puerto' },
  aldea: { tabla: 'audiencia_jefe_aldea', tirada: 'audiencia_aldea' },
  guarida: { tabla: 'audiencia_capitan', tirada: 'audiencia_guarida' },
};

/** Por qué no se puede pedir audiencia aquí y ahora. */
export type MotivoParaNoPedirAudiencia =
  | 'solo_puerto_aldea_o_guarida'
  | 'audiencia_ya_concedida' // "Ya te concedieron audiencia aquí"
  | 'audiencia_vetada'; // "Aquí no quieren volver a verte"

/** Solo consulta: si no se puede pedir audiencia, por qué. undefined = se puede. */
export function motivoParaNoPedirAudiencia(estado: Estado, sitio: Sitio): MotivoParaNoPedirAudiencia | undefined {
  if (!AUDIENCIAS[sitio.lugar]) {
    return 'solo_puerto_aldea_o_guarida';
  }
  if (hayMarca(estado, 'audiencia_vetada', sitio.hex)) {
    return 'audiencia_vetada';
  }
  if (hayMarca(estado, 'audiencia_concedida', sitio.hex)) {
    return 'audiencia_ya_concedida';
  }
  return undefined;
}

/** ¿Tiene hoy el +1 por haberla pedido ayer aquí ("hoy no, mañana tendrás más suerte")? */
export function tieneBonoDeAyer(estado: Estado, sitio: Sitio): boolean {
  const aplazada = buscarMarca(estado, 'audiencia_aplazada', sitio.hex);
  return aplazada?.dia !== undefined && aplazada.dia === estado.mundo.dia - 1;
}

/**
 * ACCIÓN: SOLICITAR AUDIENCIA. Tira en la tabla del sitio con los bonificadores del jugador
 * (y +1 si ayer le dijeron "hoy no" aquí). Apunta en la casilla lo que diga la fila y devuelve
 * el evento, si lo hay, como pendiente. Después, toca comer.
 * Error si no se puede (la interfaz la enseña desactivada con el motivo).
 */
export function solicitarAudiencia(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'solicitarAudiencia');
  const motivo = motivoParaNoPedirAudiencia(estado, sitio);
  if (motivo) {
    throw new Error(`solicitarAudiencia: no se puede (${motivo})`);
  }
  const quien = AUDIENCIAS[sitio.lugar]!;

  // El +1 de ayer se usa ahora o caduca: la marca de aplazada se quita siempre.
  const bonoDeAyer = tieneBonoDeAyer(estado, sitio);
  let actual = sinMarca(estado, 'audiencia_aplazada', sitio.hex);

  const tirada = resolverTabla(obtenerTabla(quien.tabla), calcularModificador(estado.jugador, quien.tirada) + (bonoDeAyer ? 1 : 0), dados);
  const resultado = aplicarEfectos(actual, tirada.efectos, dados);
  actual = resultado.estado;

  if (tirada.especial === 'audiencia_concedida' || tirada.especial === 'audiencia_vetada') {
    actual = conMarca(actual, tirada.especial, sitio.hex);
  } else if (tirada.especial === 'audiencia_aplazada') {
    actual = conMarca(actual, 'audiencia_aplazada', sitio.hex, estado.mundo.dia);
  }

  return {
    estado: cerrarFaseDeAccion(actual, dados),
    cambios: resultado.cambios,
    tirada: { dados: tirada.dados, modificador: tirada.modificador, total: tirada.total, ...(tirada.texto ? { texto: tirada.texto } : {}) },
    eventos: tirada.evento ? [tirada.evento] : [],
  };
}
