import { AJUSTES } from '../ajustes/ajustes';
import { condicionesQueProhiben } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';

// ACCIÓN: ENTERRAR TESORO. Se entierran AJUSTES.oroAlEnterrarTesoro (100) de oro y se gana 1 punto de fama.
//   - Solo en tierra salvaje: playa, jungla o jungla profunda (ni agua, ni puertos, aldeas o monasterios).
//   - Un tesoro por casilla: queda una marca "tesoro_enterrado" y ahí ya no se puede enterrar otro.
//   - Lo enterrado no se desentierra nunca: es cambiar oro por fama.
//   - "Avaricioso" (maldición del amuleto) lo prohíbe.

/** Por qué no se puede enterrar un tesoro aquí y ahora. */
export type MotivoParaNoEnterrar =
  | { motivo: 'solo_salvaje' }
  | { motivo: 'prohibido'; condiciones: string[] }
  | { motivo: 'tesoro_ya_enterrado' } // "Ya has enterrado un tesoro aquí"
  | { motivo: 'sin_oro' };

/** Solo consulta: si no se puede enterrar, por qué. undefined = se puede. */
export function motivoParaNoEnterrar(estado: Estado, sitio: Sitio): MotivoParaNoEnterrar | undefined {
  if (sitio.lugar !== 'intemperie') {
    return { motivo: 'solo_salvaje' };
  }
  const prohiben = condicionesQueProhiben(estado.jugador, 'enterrar_tesoro');
  if (prohiben.length > 0) {
    return { motivo: 'prohibido', condiciones: prohiben };
  }
  if (hayTesoroEnterrado(estado, sitio)) {
    return { motivo: 'tesoro_ya_enterrado' };
  }
  if (estado.jugador.oro < AJUSTES.oroAlEnterrarTesoro) {
    return { motivo: 'sin_oro' };
  }
  return undefined;
}

/** ¿Ya hay un tesoro enterrado en la casilla de ese sitio? (Sin casilla conocida, no se puede saber: false.) */
export function hayTesoroEnterrado(estado: Estado, sitio: Sitio): boolean {
  const hex = sitio.hex;
  return hex !== undefined && estado.mundo.marcas.some(m => m.tipo === 'tesoro_enterrado' && m.col === hex.col && m.fila === hex.fila);
}

/**
 * ACCIÓN: ENTERRAR TESORO. −100 de oro, +1 de fama y, si se sabe la casilla, queda la marca.
 * Después, toca comer. Error si no se puede (la interfaz la enseña desactivada con el motivo).
 */
export function enterrarTesoro(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'enterrarTesoro');
  const noSePuede = motivoParaNoEnterrar(estado, sitio);
  if (noSePuede) {
    throw new Error(`enterrarTesoro: no se puede (${noSePuede.motivo})`);
  }

  const resultado = aplicarEfectos(
    estado,
    [
      { tipo: 'oro', cantidad: -AJUSTES.oroAlEnterrarTesoro },
      { tipo: 'fama', cantidad: 1 },
    ],
    dados,
  );
  const hex = sitio.hex;
  const conMarca: Estado = hex
    ? { ...resultado.estado, mundo: { ...resultado.estado.mundo, marcas: [...resultado.estado.mundo.marcas, { col: hex.col, fila: hex.fila, tipo: 'tesoro_enterrado' }] } }
    : resultado.estado;
  return { estado: cerrarFaseDeAccion(conMarca, dados), cambios: resultado.cambios, eventos: [] };
}
