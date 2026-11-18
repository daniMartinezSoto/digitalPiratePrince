import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { opcionesDelMercado, irAlMercado, venderObjeto } from '../mercado/mercado';
import { crearPartida } from '../partida/crear-partida';
import { obtenerTabla, TABLAS } from '../tablas/rangos/cargar-tablas';
import { resolverConSubtablas } from '../tablas/rangos/resolver-tabla';
import type { Sitio } from './accion';
import { accionesDisponibles } from './acciones-disponibles';
import { investigarNaufragio, registrarRuinas } from './explorar';

// INVESTIGAR NAUFRAGIO y REGISTRAR RUINAS (paso 12 del Sprint 6). Semillas comprobadas:
//   naufragio (1d6 y, si toca, el 1d6 de "el hogar de alguien"): 7 → 1 · 14 → 3 · 1 → 4 y luego 1 · 4 → 6.
//   ruinas (2d6 y el dado siguiente): 12 → 3 · 38 → 11 y luego 1-2 · 31 → 11 y luego 3-6 · 30 → 12 · 27 → 4.
const EN_EL_NAUFRAGIO: Sitio = { lugar: 'intemperie', rasgo: 'naufragio', hex: { col: 3, fila: 12 } };
const EN_LAS_RUINAS: Sitio = { lugar: 'intemperie', rasgo: 'ruinas', hex: { col: 9, fila: 8 } };

function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

function otroDia(estado: Estado): Estado {
  return { ...estado, mundo: { ...estado.mundo, dia: estado.mundo.dia + 1, fase: 'accion' } };
}

const disponibilidad = (estado: Estado, sitio: Sitio, accion: string) => accionesDisponibles(estado, sitio).find(a => a.accion === accion);

describe('"tira en otra tabla"', () => {
  it('todas las tablas a las que se manda existen', () => {
    const ids = TABLAS.map(t => t.id);
    const destinos = TABLAS.flatMap(t => t.filas.flatMap(f => (f.tabla ? [f.tabla] : [])));

    expect(destinos.length).toBeGreaterThan(0);
    expect(destinos.filter(d => !ids.includes(d))).toEqual([]);
  });

  it('resolverConSubtablas sigue tirando hasta una fila que no manda a otra', () => {
    const resultados = resolverConSubtablas(obtenerTabla('naufragio'), 0, new Dados(1), obtenerTabla);

    expect(resultados.map(r => r.total)).toEqual([4, 1]);
    expect(resultados[1].evento).toBe('fugitivo');
  });
});

describe('investigar naufragio', () => {
  it('solo donde hay un naufragio', () => {
    expect(disponibilidad(estadoCon(), EN_EL_NAUFRAGIO, 'investigar_naufragio')?.disponible).toBe(true);
    expect(disponibilidad(estadoCon(), { lugar: 'intemperie' }, 'investigar_naufragio')?.motivo).toBe('sin_naufragio');
  });

  it('1-2: un barco maldito (evento con combate, pendiente)', () => {
    expect(investigarNaufragio(estadoCon(), EN_EL_NAUFRAGIO, new Dados(7)).eventos).toEqual(['barco_maldito']);
  });

  it('3: una guarida pirata (evento pendiente)', () => {
    expect(investigarNaufragio(estadoCon(), EN_EL_NAUFRAGIO, new Dados(14)).eventos).toEqual(['guarida_pirata']);
  });

  it('4-5: el hogar de alguien: se tira en su tabla y salen las dos tiradas', () => {
    const { eventos, tiradas } = investigarNaufragio(estadoCon(), EN_EL_NAUFRAGIO, new Dados(1));

    expect(eventos).toEqual(['fugitivo']);
    expect(tiradas.map(t => t.total)).toEqual([4, 1]);
  });

  it('6: restos antiguos (evento pendiente)', () => {
    expect(investigarNaufragio(estadoCon(), EN_EL_NAUFRAGIO, new Dados(4)).eventos).toEqual(['restos_antiguos']);
  });

  it('una vez por casilla: después sale desactivada; toca comer', () => {
    const { estado } = investigarNaufragio(estadoCon(), EN_EL_NAUFRAGIO, new Dados(4));

    expect(estado.mundo.fase).toBe('comida');
    expect(disponibilidad(otroDia(estado), EN_EL_NAUFRAGIO, 'investigar_naufragio')?.motivo).toBe('ya_explorado');
    expect(() => investigarNaufragio(otroDia(estado), EN_EL_NAUFRAGIO, new Dados(1))).toThrow(/ya_explorado/);
  });
});

describe('registrar ruinas', () => {
  it('solo donde hay ruinas, y una vez por casilla', () => {
    expect(disponibilidad(estadoCon(), EN_EL_NAUFRAGIO, 'registrar_ruinas')?.motivo).toBe('sin_ruinas');

    const { estado } = registrarRuinas(estadoCon(), EN_LAS_RUINAS, new Dados(27));
    expect(disponibilidad(otroDia(estado), EN_LAS_RUINAS, 'registrar_ruinas')?.motivo).toBe('ya_explorado');
  });

  it('3: el ídolo dorado (4 huecos) y una maldición pendiente', () => {
    const { estado, eventos } = registrarRuinas(estadoCon(), EN_LAS_RUINAS, new Dados(12));

    expect(estado.jugador.inventario).toEqual([{ id: 'idolo_dorado' }]);
    expect(eventos).toEqual(['maldicion']);
  });

  it('4: dos esqueletos (un evento pendiente)', () => {
    expect(registrarRuinas(estadoCon(), EN_LAS_RUINAS, new Dados(27)).eventos).toEqual(['esqueletos']);
  });

  it('11, lámpara mágica: con 1-2 te quedas la lámpara agotada (se vende por 25)', () => {
    const { estado, eventos, tiradas } = registrarRuinas(estadoCon(), EN_LAS_RUINAS, new Dados(38));

    expect(tiradas).toHaveLength(2);
    expect(estado.jugador.inventario).toEqual([{ id: 'lampara_agotada' }]);
    expect(eventos).toEqual([]);
  });

  it('11, lámpara mágica: con 3-6 sale un genio (el deseo, pendiente)', () => {
    expect(registrarRuinas(estadoCon(), EN_LAS_RUINAS, new Dados(31)).eventos).toEqual(['deseo']);
  });

  it('12: el ídolo antediluviano (mágico: +1 de fama)', () => {
    const { estado } = registrarRuinas(estadoCon(), EN_LAS_RUINAS, new Dados(30));

    expect(estado.jugador.inventario).toEqual([{ id: 'idolo_antediluviano' }]);
    expect(estado.jugador.fama).toBe(1);
  });

  it('12: si ya tienes el ídolo antediluviano, en su lugar un tesoro mágico (pendiente)', () => {
    const { estado, eventos } = registrarRuinas(estadoCon({ inventario: [{ id: 'idolo_antediluviano' }] }), EN_LAS_RUINAS, new Dados(30));

    expect(estado.jugador.inventario).toEqual([{ id: 'idolo_antediluviano' }]);
    expect(eventos).toEqual(['tesoro_magico']);
  });

  it('vender el ídolo antediluviano (200) deja apuntado que se vendió (para la ciudad perdida)', () => {
    const dentro = irAlMercado(estadoCon({ inventario: [{ id: 'idolo_antediluviano' }] }), { lugar: 'puerto' }, new Dados(1)).estado;
    expect(opcionesDelMercado(dentro).venderObjetos[0].precio).toBe(200);

    const { estado } = venderObjeto(dentro, 0, new Dados(1));
    expect(estado.mundo.banderas['idolo_antediluviano_vendido']).toBe(true);
  });
});
