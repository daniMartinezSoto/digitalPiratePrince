import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import type { Sitio } from './accion';
import { accionesDisponibles } from './acciones-disponibles';
import { enterrarTesoro, hayTesoroEnterrado, motivoParaNoEnterrar } from './enterrar-tesoro';

// ENTERRAR TESORO (paso 9 del Sprint 6): 100 de oro = 1 de fama, en playa, jungla o jungla profunda,
// un tesoro por casilla, y lo enterrado no se desentierra.

const EN_LA_JUNGLA: Sitio = { lugar: 'intemperie', hex: { col: 4, fila: 7 } };
const OTRA_CASILLA: Sitio = { lugar: 'intemperie', hex: { col: 5, fila: 7 } };

/** Partida del influyente en la fase de acción, con lo que se le cambie. */
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

/** Pasa al día siguiente en la fase de acción (para volver a intentar enterrar). */
function otroDia(estado: Estado): Estado {
  return { ...estado, mundo: { ...estado.mundo, fase: 'accion' } };
}

describe('enterrar tesoro', () => {
  it('se entierran 100 de oro y se gana 1 de fama; toca comer', () => {
    const { estado, cambios } = enterrarTesoro(estadoCon({ oro: 150, fama: 2 }), EN_LA_JUNGLA, new Dados(1));

    expect(estado.jugador.oro).toBe(50);
    expect(estado.jugador.fama).toBe(3);
    expect(estado.mundo.fase).toBe('comida');
    expect(cambios).toEqual([
      { tipo: 'recurso', recurso: 'oro', antes: 150, despues: 50 },
      { tipo: 'recurso', recurso: 'fama', antes: 2, despues: 3 },
    ]);
  });

  it('queda una marca de tesoro enterrado en esa casilla', () => {
    const { estado } = enterrarTesoro(estadoCon({ oro: 150 }), EN_LA_JUNGLA, new Dados(1));

    expect(estado.mundo.marcas).toEqual([{ col: 4, fila: 7, tipo: 'tesoro_enterrado' }]);
    expect(hayTesoroEnterrado(estado, EN_LA_JUNGLA)).toBe(true);
    expect(hayTesoroEnterrado(estado, OTRA_CASILLA)).toBe(false);
  });

  it('en la misma casilla no se puede enterrar otro ("Ya has enterrado un tesoro aquí"); en otra, sí', () => {
    const tras = otroDia(enterrarTesoro(estadoCon({ oro: 300 }), EN_LA_JUNGLA, new Dados(1)).estado);

    expect(accionesDisponibles(tras, EN_LA_JUNGLA).find(a => a.accion === 'enterrar_tesoro')).toEqual({
      accion: 'enterrar_tesoro',
      disponible: false,
      motivo: 'tesoro_ya_enterrado',
    });
    expect(() => enterrarTesoro(tras, EN_LA_JUNGLA, new Dados(1))).toThrow(/tesoro_ya_enterrado/);
    expect(enterrarTesoro(tras, OTRA_CASILLA, new Dados(1)).estado.jugador.fama).toBe(2);
  });

  it('solo en tierra salvaje (playa, jungla, jungla profunda): ni a bordo, ni en puertos, aldeas o monasterios', () => {
    for (const lugar of ['barco', 'puerto', 'aldea', 'monasterio'] as const) {
      expect(motivoParaNoEnterrar(estadoCon({ oro: 200 }), { lugar })).toEqual({ motivo: 'solo_salvaje' });
    }
  });

  it('con menos de 100 de oro, desactivada', () => {
    expect(motivoParaNoEnterrar(estadoCon({ oro: 99 }), EN_LA_JUNGLA)).toEqual({ motivo: 'sin_oro' });
  });

  it('con avaricioso, desactivada y dice qué condición lo impide', () => {
    const avaro = estadoCon({ oro: 200, condiciones: [{ id: 'amuleto_maldito', partes: ['fuerza_letal', 'avaricioso'] }] });

    expect(accionesDisponibles(avaro, EN_LA_JUNGLA).find(a => a.accion === 'enterrar_tesoro')).toEqual({
      accion: 'enterrar_tesoro',
      disponible: false,
      motivo: 'prohibido',
      condiciones: ['avaricioso'],
    });
    expect(() => enterrarTesoro(avaro, EN_LA_JUNGLA, new Dados(1))).toThrow(/prohibido/);
  });

  it('sin saber la casilla (aún no hay mapa), se puede enterrar pero no queda marca', () => {
    const { estado } = enterrarTesoro(estadoCon({ oro: 150 }), { lugar: 'intemperie' }, new Dados(1));

    expect(estado.jugador.fama).toBe(1);
    expect(estado.mundo.marcas).toEqual([]);
  });

  it('el contable no gana nada al enterrar (es perder oro, no ganarlo)', () => {
    const { estado } = enterrarTesoro(estadoCon({ oro: 150, sobrenombre: 'el_contable' }), EN_LA_JUNGLA, new Dados(1));

    expect(estado.jugador.oro).toBe(50);
  });
});
