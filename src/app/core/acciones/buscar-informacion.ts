import { AJUSTES } from '../ajustes/ajustes';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import { conMarca, hayMarca, sinMarca } from '../estado/marcas';
import { calcularModificador } from '../modificadores/calcular-modificador';
import type { Efecto } from '../tablas/efecto';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { resolverTabla } from '../tablas/rangos/resolver-tabla';
import { esPuerto } from '../turno/lugar';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';

// ACCIÓN: BUSCAR INFORMACIÓN, en puertos, guaridas piratas y aldeas. 3d6 en su tabla:
//   puerto:  data/tablas/buscar-informacion.json      (tirada "buscar_info_puerto")
//   guarida: la misma tabla, SIN sobornos y con +1 por cada 2 de fama (tirada "buscar_info_guarida";
//            el +1 por fama está en AJUSTES.bonificadorPorFama)
//   aldea:  data/tablas/buscar-informacion-aldea.json (tirada "buscar_info_aldea")
// - Sobornos (solo en puertos): antes de tirar, 0 a AJUSTES.maximoSobornos, a AJUSTES.precioSoborno cada uno: +1 por soborno.
// - "Haces amigos" (marca en la casilla): +1, y la marca se gasta.
// - Tras buscar, hay que esperar AJUSTES.diasEntreBusquedas días (en cualquier sitio).
// - Reglas especiales de las filas: haces_amigos (deja la marca), cubil (una vez por casilla), fiesta.
// - Manos largas (el mono, solo en puertos): por cada uno, 1d6: con 2-6 te trae ese oro; con un 1
//   lo pillan y pagas 1d6 de multa.
// Orden de los dados: la tabla (y los dados de sus efectos) y después un dado por mono (y su multa).

const HABILIDAD_MANOS_LARGAS = 'manos_largas';
const TEXTO_CUBIL_VACIO = 'El cubil ya está vacío.';

/** Lo que hizo cada mono: el dado que sacó y, si lo pillaron, la multa (si no, trajo "dado" de oro). */
export interface RoboDeMono {
  seguidor: string; // id del seguidor en la partida
  dado: number;
  multa?: number;
}

export interface ResultadoBuscarInformacion extends ResultadoAccion {
  manosLargas: RoboDeMono[];
}

/** Por qué no se puede buscar información aquí y ahora. */
export type MotivoParaNoBuscar = { motivo: 'solo_puerto_o_aldea' } | { motivo: 'espera'; faltanDias: number };

/** Solo consulta: si no se puede buscar información, por qué. undefined = se puede. */
export function motivoParaNoBuscar(estado: Estado, sitio: Sitio): MotivoParaNoBuscar | undefined {
  if (!esPuerto(sitio.lugar) && sitio.lugar !== 'aldea') {
    return { motivo: 'solo_puerto_o_aldea' };
  }
  const ultima = estado.mundo.ultimaBusquedaInformacion;
  if (ultima !== null) {
    const faltanDias = ultima + AJUSTES.diasEntreBusquedas - estado.mundo.dia;
    if (faltanDias > 0) {
      return { motivo: 'espera', faltanDias };
    }
  }
  return undefined;
}

/** Lo que la interfaz enseña al pulsar "Buscar información": los sobornos (solo en puerto) y si tiene amigos aquí. */
export interface OpcionesBuscarInformacion {
  // "Sobornar 10", "Sobornar 20", "Sobornar 30": cuántos sobornos, cuánto cuesta y si le llega. Vacía en aldeas.
  sobornos: { cantidad: number; precio: number; disponible: boolean }[];
  // true = tiene amigos en esta casilla: +1.
  amigos: boolean;
}

export function opcionesDeBuscarInformacion(estado: Estado, sitio: Sitio): OpcionesBuscarInformacion {
  const sobornos =
    sitio.lugar === 'puerto' // en la guarida no hay sobornos: lo que cuenta es la fama
      ? Array.from({ length: AJUSTES.maximoSobornos }, (_, i) => {
          const precio = (i + 1) * AJUSTES.precioSoborno;
          return { cantidad: i + 1, precio, disponible: estado.jugador.oro >= precio };
        })
      : [];
  return { sobornos, amigos: hayMarca(estado, 'amigos', sitio.hex) };
}

/**
 * ACCIÓN: BUSCAR INFORMACIÓN. "sobornos" = cuántos paga antes de tirar (0 = ninguno; en aldeas, siempre 0).
 * Después, toca comer. Error si no se puede (la interfaz la enseña desactivada con el motivo) o si
 * los sobornos no son válidos o no le llega el oro.
 */
export function buscarInformacion(estado: Estado, sitio: Sitio, sobornos: number, dados: Dados): ResultadoBuscarInformacion {
  comprobarQueSePuedeActuar(estado, 'buscarInformacion');
  const noSePuede = motivoParaNoBuscar(estado, sitio);
  if (noSePuede) {
    throw new Error(`buscarInformacion: no se puede (${noSePuede.motivo})`);
  }
  const enPuerto = esPuerto(sitio.lugar); // puerto o guarida: tabla de puertos y el mono roba
  const enGuarida = sitio.lugar === 'guarida';
  if (!Number.isInteger(sobornos) || sobornos < 0 || sobornos > (sitio.lugar === 'puerto' ? AJUSTES.maximoSobornos : 0)) {
    throw new Error(`buscarInformacion: sobornos no válidos (${sobornos}); solo se puede sobornar en los puertos`);
  }
  const precioSobornos = sobornos * AJUSTES.precioSoborno;
  if (estado.jugador.oro < precioSobornos) {
    throw new Error(`buscarInformacion: los sobornos cuestan ${precioSobornos} y solo tiene ${estado.jugador.oro} de oro`);
  }

  // Los amigos de esta casilla dan +1, y se gastan.
  const amigos = hayMarca(estado, 'amigos', sitio.hex);
  let actual = amigos ? sinMarca(estado, 'amigos', sitio.hex) : estado;

  const idTirada = enGuarida ? 'buscar_info_guarida' : enPuerto ? 'buscar_info_puerto' : 'buscar_info_aldea';
  const modificador = calcularModificador(estado.jugador, idTirada) + sobornos + (amigos ? 1 : 0);
  const tirada = resolverTabla(obtenerTabla(enPuerto ? 'buscar_informacion' : 'buscar_informacion_aldea'), modificador, dados);

  // El cubil solo se saquea una vez por casilla: si ya estaba saqueado, está vacío.
  const cubilVacio = tirada.especial === 'cubil' && hayMarca(actual, 'cubil_saqueado', sitio.hex);
  const efectos: Efecto[] = [...(precioSobornos > 0 ? [{ tipo: 'oro', cantidad: -precioSobornos } as Efecto] : []), ...(cubilVacio ? [] : tirada.efectos)];

  const resultado = aplicarEfectos(actual, efectos, dados);
  actual = resultado.estado;
  const cambios: Cambio[] = [...resultado.cambios];

  if (tirada.especial === 'haces_amigos') {
    actual = conMarca(actual, 'amigos', sitio.hex);
  } else if (tirada.especial === 'cubil' && !cubilVacio) {
    actual = conMarca(actual, 'cubil_saqueado', sitio.hex);
  } else if (tirada.especial === 'fiesta') {
    actual = { ...actual, mundo: { ...actual.mundo, comidaGratis: true, nochePagada: true } };
  }

  // El mono: solo en puertos.
  const manosLargas: RoboDeMono[] = [];
  if (enPuerto) {
    for (const mono of actual.jugador.seguidores.filter(s => s.habilidades.includes(HABILIDAD_MANOS_LARGAS))) {
      if (actual.mundo.finPartida) {
        break;
      }
      const dado = dados.tirar('1d6').total;
      const multa = dado === 1 ? dados.tirar('1d6').total : undefined;
      const robo = aplicarEfectos(actual, [{ tipo: 'oro', cantidad: multa === undefined ? dado : -multa }], dados);
      actual = robo.estado;
      cambios.push(...robo.cambios);
      manosLargas.push(multa === undefined ? { seguidor: mono.id, dado } : { seguidor: mono.id, dado, multa });
    }
  }

  actual = { ...actual, mundo: { ...actual.mundo, ultimaBusquedaInformacion: estado.mundo.dia } };
  const texto = cubilVacio ? TEXTO_CUBIL_VACIO : tirada.texto;
  return {
    estado: cerrarFaseDeAccion(actual, dados),
    cambios,
    tirada: { dados: tirada.dados, modificador: tirada.modificador, total: tirada.total, ...(texto ? { texto } : {}) },
    eventos: tirada.evento ? [tirada.evento] : [],
    manosLargas,
  };
}
