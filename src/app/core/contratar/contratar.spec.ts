import type { Sitio } from '../acciones/accion';
import { accionesDisponibles } from '../acciones/acciones-disponibles';
import { pescar } from '../acciones/pescar';
import { AJUSTES } from '../ajustes/ajustes';
import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import { rangoDeTirada } from '../dados/tirada';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import {
  buscarSeguidor,
  contratarMarineros,
  contratarSeguidor,
  darDiscurso,
  opcionesDeMarineros,
  opcionesDelSeguidor,
  pagarMarineros,
  rechazarSeguidor,
} from './contratar';

// CONTRATAR (paso 7 del Sprint 6): dar un discurso, contratar marineros y buscar un seguidor.
// Semillas comprobadas (el primer dado que se tira):
//   discurso: 7 → multa (fila 1), 9 → nadie te hace caso (fila 2-3), 4 → discurso memorable (6).
//   seguidor: 3 → forzudo (25 de oro), 4 → cartógrafo (40), 7 → diplomático (45), 12 → pirata anciano (gratis).
const DISCURSO_MULTA = 7;
const DISCURSO_NADA = 9;
const DISCURSO_MEMORABLE = 4;
const SALE_FORZUDO = 3;
const SALE_CARTOGRAFO = 4;
const SALE_DIPLOMATICO = 7;
const SALE_ANCIANO = 12;

const EN_PUERTO: Sitio = { lugar: 'puerto' };

/** Partida del influyente en la fase de acción, con lo que se le cambie. */
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

function seguidor(id: string, inseparable = false): Seguidor {
  const s: Seguidor = { id, tipo: 'forzudo', nombre: id, ataque: 3, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
  return inseparable ? { ...s, inseparable: true } : s;
}

const disponibilidad = (estado: Estado, accion: string) => accionesDisponibles(estado, EN_PUERTO).find(a => a.accion === accion);

describe('las tres formas de contratar, en las acciones disponibles', () => {
  it('en un puerto, las tres disponibles', () => {
    const enPuerto = accionesDisponibles(estadoCon({ tripulacion: 30 }), EN_PUERTO);

    expect(enPuerto.filter(a => a.disponible).map(a => a.accion)).toEqual(
      expect.arrayContaining(['dar_discurso', 'contratar_marineros', 'buscar_seguidor']),
    );
  });

  it('fuera de un puerto, salen desactivadas (solo en puertos)', () => {
    const enAldea = accionesDisponibles(estadoCon(), { lugar: 'aldea' });

    expect(enAldea.find(a => a.accion === 'dar_discurso')).toEqual({ accion: 'dar_discurso', disponible: false, motivo: 'solo_puerto' });
  });

  it('con hedor nauseabundo, buscar seguidor sale desactivada y dice qué condición lo impide', () => {
    const conHedor = estadoCon({ condiciones: [{ id: 'amuleto_maldito', partes: ['fuerza_letal', 'hedor_nauseabundo'] }] });

    expect(disponibilidad(conHedor, 'buscar_seguidor')).toEqual({
      accion: 'buscar_seguidor',
      disponible: false,
      motivo: 'prohibido',
      condiciones: ['hedor_nauseabundo'],
    });
  });

  it('con el grupo lleno de inseparables, buscar seguidor sale desactivada; si hay a quién despedir, no', () => {
    const inseparables = [seguidor('a', true), seguidor('b', true), seguidor('c', true)];

    expect(disponibilidad(estadoCon({ seguidores: inseparables }), 'buscar_seguidor')?.motivo).toBe('grupo_lleno');
    expect(disponibilidad(estadoCon({ seguidores: [seguidor('a', true), seguidor('b'), seguidor('c')] }), 'buscar_seguidor')?.disponible).toBe(true);
  });

  it('contratar marineros, desactivada con la tripulación al máximo o sin oro ni para uno', () => {
    expect(disponibilidad(estadoCon({ tripulacion: 40 }), 'contratar_marineros')?.motivo).toBe('tripulacion_al_maximo');
    expect(disponibilidad(estadoCon({ tripulacion: 30, oro: 1 }), 'contratar_marineros')?.motivo).toBe('sin_oro');
  });
});

describe('dar un discurso', () => {
  it('la tabla: 1 multa, 2-3 nadie te hace caso, 4 +1d6, 5 +1d6+3, 6 +1d6+6 de tripulación', () => {
    const tabla = obtenerTabla('discurso');

    expect(tabla.dado).toBe('1d6');
    expect(tabla.filas.map(f => [f.min, f.max, f.efectos ?? []])).toEqual([
      [1, 1, [{ tipo: 'oro', cantidad: '-1d6' }]],
      [2, 3, []],
      [4, 4, [{ tipo: 'tripulacion', cantidad: '1d6' }]],
      [5, 5, [{ tipo: 'tripulacion', cantidad: '1d6+3' }]],
      [6, 6, [{ tipo: 'tripulacion', cantidad: '1d6+6' }]],
    ]);
  });

  it('multa: si le llega el oro, la paga', () => {
    const { estado, eventos } = darDiscurso(estadoCon({ oro: 50 }), EN_PUERTO, new Dados(DISCURSO_MULTA));

    expect(estado.jugador.oro).toBeGreaterThanOrEqual(44);
    expect(estado.jugador.oro).toBeLessThan(50);
    expect(eventos).toEqual([]);
  });

  it('multa: si no le llega, le quitan todo su oro y lo arrestan', () => {
    const { estado, eventos } = darDiscurso(estadoCon({ oro: 0 }), EN_PUERTO, new Dados(DISCURSO_MULTA));

    expect(estado.jugador.oro).toBe(0);
    expect(eventos).toEqual(['arrestado']);
  });

  it('nadie te hace caso: no cambia nada', () => {
    const { cambios, tirada } = darDiscurso(estadoCon({ tripulacion: 30 }), EN_PUERTO, new Dados(DISCURSO_NADA));

    expect(cambios).toEqual([]);
    expect(tirada?.texto).toBe('Nadie te hace caso.');
  });

  it('discurso memorable: +7 a +12 de tripulación, sin pasar del máximo', () => {
    const lejos = darDiscurso(estadoCon({ tripulacion: 20 }), EN_PUERTO, new Dados(DISCURSO_MEMORABLE)).estado;
    const cerca = darDiscurso(estadoCon({ tripulacion: 38 }), EN_PUERTO, new Dados(DISCURSO_MEMORABLE)).estado;

    expect(lejos.jugador.tripulacion).toBeGreaterThanOrEqual(27);
    expect(lejos.jugador.tripulacion).toBeLessThanOrEqual(32);
    expect(cerca.jugador.tripulacion).toBe(40);
  });

  it('termina la acción: toca comer', () => {
    expect(darDiscurso(estadoCon(), EN_PUERTO, new Dados(1)).estado.mundo.fase).toBe('comida');
  });

  it('solo en puertos', () => {
    expect(() => darDiscurso(estadoCon(), { lugar: 'barco' }, new Dados(1))).toThrow(/solo se puede contratar en los puertos/);
  });
});

describe('contratar marineros', () => {
  it('paso 1: tira cuántos hay hoy (1d6×3+4) y se queda esperando la decisión', () => {
    const { estado, tirada } = contratarMarineros(estadoCon({ tripulacion: 20 }), EN_PUERTO, new Dados(1));
    const { min, max } = rangoDeTirada(AJUSTES.marinerosDisponibles);

    expect(min).toBe(7);
    expect(max).toBe(22);
    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'marineros', disponibles: tirada!.total });
    expect(tirada!.total).toBeGreaterThanOrEqual(min);
    expect(tirada!.total).toBeLessThanOrEqual(max);
    expect(estado.mundo.fase).toBe('accion');
  });

  it('mientras espera, no puede hacer otra acción', () => {
    const { estado } = contratarMarineros(estadoCon({ tripulacion: 20 }), EN_PUERTO, new Dados(1));

    expect(() => pescar(estado, { lugar: 'puerto', juntoAlAgua: true }, new Dados(1))).toThrow(/acción a medias \("marineros"\)/);
  });

  it('el máximo que puede contratar: lo que hay, lo que puede pagar y lo que le cabe', () => {
    const dentro = (cambios: Partial<Jugador>): Estado => ({
      ...estadoCon(cambios),
      mundo: { ...estadoCon(cambios).mundo, accionEnCurso: { tipo: 'marineros', disponibles: 10 } },
    });

    expect(opcionesDeMarineros(dentro({ oro: 100, tripulacion: 20 }))).toEqual({ disponibles: 10, precio: 2, maximo: 10 });
    expect(opcionesDeMarineros(dentro({ oro: 9, tripulacion: 20 })).maximo).toBe(4);
    expect(opcionesDeMarineros(dentro({ oro: 100, tripulacion: 37 })).maximo).toBe(3);
  });

  it('paso 2: contrata los que elige, a 2 de oro cada uno, y toca comer', () => {
    const esperando = contratarMarineros(estadoCon({ oro: 50, tripulacion: 20 }), EN_PUERTO, new Dados(1)).estado;
    const { estado } = pagarMarineros(esperando, 5, new Dados(1));

    expect(estado.jugador.tripulacion).toBe(25);
    expect(estado.jugador.oro).toBe(40);
    expect(estado.mundo.accionEnCurso).toBeNull();
    expect(estado.mundo.fase).toBe('comida');
  });

  it('puede no contratar a ninguno: la acción termina igual', () => {
    const esperando = contratarMarineros(estadoCon({ tripulacion: 20 }), EN_PUERTO, new Dados(1)).estado;
    const { estado, cambios } = pagarMarineros(esperando, 0, new Dados(1));

    expect(cambios).toEqual([]);
    expect(estado.mundo.fase).toBe('comida');
  });

  it('error si pide más del máximo, o sin haber tirado antes', () => {
    const esperando = contratarMarineros(estadoCon({ oro: 4, tripulacion: 20 }), EN_PUERTO, new Dados(1)).estado;

    expect(() => pagarMarineros(esperando, 3, new Dados(1))).toThrow(/entre 0 y 2/);
    expect(() => pagarMarineros(estadoCon(), 1, new Dados(1))).toThrow(/no hay ninguna acción "marineros"/);
  });

  it('error si se intenta con la tripulación al máximo', () => {
    expect(() => contratarMarineros(estadoCon({ tripulacion: 40 }), EN_PUERTO, new Dados(1))).toThrow(/tripulacion_al_maximo/);
  });
});

describe('buscar un seguidor', () => {
  it('la tabla tiene todos los seguidores contratables, y todos tienen precio', () => {
    const ids = obtenerTabla('contratar_seguidor').filas.flatMap(f => (f.efectos ?? []).flatMap(e => (e.tipo === 'ganar_seguidor' ? [e.seguidor] : [])));

    expect(ids).toEqual(['diplomatico', 'pirata_anciano', 'pescador', 'nativo', 'forzudo', 'artista', 'cartografo', 'barbero_cirujano', 'navegante', 'mono', 'pirata_experto']);
    expect(ids.every(id => TIPOS_SEGUIDOR.find(t => t.id === id)?.precio !== undefined)).toBe(true);
  });

  it('paso 1: sale un seguidor, con su precio, y espera la decisión', () => {
    const { estado } = buscarSeguidor(estadoCon(), EN_PUERTO, new Dados(SALE_FORZUDO));

    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'seguidor', seguidor: 'forzudo', precio: 25, nombre: expect.any(String) });
    expect(opcionesDelSeguidor(estado)).toEqual({
      seguidor: 'forzudo',
      nombre: expect.any(String),
      precio: 25,
      disponible: true,
      hayQueDespedir: false,
    });
  });

  it('su nombre se enseña antes de contratarlo, y entra con ese mismo nombre', () => {
    const esperando = buscarSeguidor(estadoCon({ oro: 50 }), EN_PUERTO, new Dados(SALE_FORZUDO)).estado;
    const nombre = opcionesDelSeguidor(esperando).nombre;
    expect(nombre).toBeTruthy();
    const { estado } = contratarSeguidor(esperando, new Dados(999));
    expect(estado.jugador.seguidores[0].nombre).toBe(nombre);
  });

  it('una partida guardada antes de esto (seguidor esperando sin nombre): se sortea al contratar', () => {
    const esperando = buscarSeguidor(estadoCon({ oro: 50 }), EN_PUERTO, new Dados(SALE_FORZUDO)).estado;
    const antigua = { ...esperando, mundo: { ...esperando.mundo, accionEnCurso: { tipo: 'seguidor' as const, seguidor: 'forzudo', precio: 25 } } };
    expect(opcionesDelSeguidor(antigua).nombre).toBeUndefined();
    const { estado } = contratarSeguidor(antigua, new Dados(1));
    expect(estado.jugador.seguidores[0].nombre).toBeTruthy();
  });

  it('con un 8 sale el cartógrafo (40 de oro) y con un 2 el diplomático (45)', () => {
    const cartografo = buscarSeguidor(estadoCon(), EN_PUERTO, new Dados(SALE_CARTOGRAFO)).estado;
    expect(cartografo.mundo.accionEnCurso).toMatchObject({ tipo: 'seguidor', seguidor: 'cartografo', precio: 40 });

    const diplomatico = buscarSeguidor(estadoCon(), EN_PUERTO, new Dados(SALE_DIPLOMATICO)).estado;
    expect(diplomatico.mundo.accionEnCurso).toMatchObject({ tipo: 'seguidor', seguidor: 'diplomatico', precio: 45 });
  });

  it('con los ropajes de pirata profesional, el seguidor cuesta 10 de oro menos', () => {
    const { estado } = buscarSeguidor(estadoCon({ inventario: [{ id: 'ropajes_de_pirata' }] }), EN_PUERTO, new Dados(SALE_FORZUDO));
    expect(estado.mundo.accionEnCurso).toMatchObject({ seguidor: 'forzudo', precio: 15 });
  });

  it('paso 2: contratarlo le une al grupo, cobra su precio y toca comer', () => {
    const esperando = buscarSeguidor(estadoCon({ oro: 50 }), EN_PUERTO, new Dados(SALE_FORZUDO)).estado;
    const { estado, cambios } = contratarSeguidor(esperando, new Dados(1));

    expect(estado.jugador.seguidores.map(s => s.tipo)).toEqual(['forzudo']);
    expect(estado.jugador.oro).toBe(25);
    expect(cambios.map(c => c.tipo)).toEqual(['seguidor_se_une', 'recurso']);
    expect(estado.mundo.fase).toBe('comida');
  });

  it('el pirata anciano es gratis', () => {
    const esperando = buscarSeguidor(estadoCon({ oro: 0 }), EN_PUERTO, new Dados(SALE_ANCIANO)).estado;
    const { estado, cambios } = contratarSeguidor(esperando, new Dados(1));

    expect(estado.jugador.seguidores.map(s => s.tipo)).toEqual(['pirata_anciano']);
    expect(cambios.map(c => c.tipo)).toEqual(['seguidor_se_une']);
  });

  it('rechazarlo: no se une nadie y la acción termina igual', () => {
    const esperando = buscarSeguidor(estadoCon(), EN_PUERTO, new Dados(SALE_FORZUDO)).estado;
    const { estado } = rechazarSeguidor(esperando, new Dados(1));

    expect(estado.jugador.seguidores).toEqual([]);
    expect(estado.mundo.fase).toBe('comida');
  });

  it('sin oro suficiente: el botón sale desactivado y contratarlo da error', () => {
    const esperando = buscarSeguidor(estadoCon({ oro: 10 }), EN_PUERTO, new Dados(SALE_FORZUDO)).estado;

    expect(opcionesDelSeguidor(esperando)).toMatchObject({ disponible: false, motivo: 'sin_oro' });
    expect(() => contratarSeguidor(esperando, new Dados(1))).toThrow(/pide 25/);
  });

  it('grupo lleno: avisa de que hay que despedir; sin despedir no entra ni paga, despidiendo sí', () => {
    const lleno = { oro: 50, seguidores: [seguidor('a'), seguidor('b'), seguidor('c')] };
    const esperando = buscarSeguidor(estadoCon(lleno), EN_PUERTO, new Dados(SALE_FORZUDO)).estado;
    expect(opcionesDelSeguidor(esperando).hayQueDespedir).toBe(true);

    const sinDespedir = contratarSeguidor(esperando, new Dados(1));
    expect(sinDespedir.estado.jugador.oro).toBe(50);
    expect(sinDespedir.estado.mundo.accionEnCurso).toEqual({ tipo: 'seguidor', seguidor: 'forzudo', precio: 25, nombre: expect.any(String) });

    const despidiendo = contratarSeguidor(esperando, new Dados(1), 'b');
    expect(despidiendo.estado.jugador.seguidores.map(s => s.id)).toEqual(['a', 'c', 'forzudo_1']);
    expect(despidiendo.estado.jugador.oro).toBe(25);
  });

  it('no se puede despedir a un inseparable', () => {
    const lleno = { oro: 50, seguidores: [seguidor('hermano', true), seguidor('b'), seguidor('c')] };
    const esperando = buscarSeguidor(estadoCon(lleno), EN_PUERTO, new Dados(SALE_FORZUDO)).estado;

    expect(() => contratarSeguidor(esperando, new Dados(1), 'hermano')).toThrow(/no se puede despedir/);
  });

  it('con hedor nauseabundo, buscar seguidor da error', () => {
    const conHedor = estadoCon({ condiciones: [{ id: 'amuleto_maldito', partes: ['fuerza_letal', 'hedor_nauseabundo'] }] });

    expect(() => buscarSeguidor(conHedor, EN_PUERTO, new Dados(1))).toThrow(/prohibido/);
  });
});
