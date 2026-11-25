import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Objeto } from '../catalogos/objeto';
import { validarObjetos } from '../catalogos/validar-objeto';
import { tieneCondicion } from '../condiciones/condiciones-vigentes';
import { Dados } from '../dados/dados';
import { aplicarEfectos, type CatalogosEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { ObjetoLlevado } from '../estado/objeto-llevado';
import { crearPartida } from '../partida/crear-partida';
import { validarEfecto } from '../tablas/rangos/validar-tabla';
import { cabeObjeto, espaciosLibres, espaciosOcupados, espaciosQueFaltan, objetosUsablesAhora } from './consultas';
import { tirarObjeto } from './tirar-objeto';
import { usarObjeto } from './usar-objeto';

// Los objetos del paso 5b del Sprint 6: usar (en la fase de acción), tirar y elegir qué tiras
// cuando algo no cabe. Con un catálogo de prueba, para tener objetos que se usan en la acción.

const UNGUENTO: Objeto = {
  id: 'unguento',
  nombre: 'Ungüento',
  descripcion: 'Cura 5 PV.',
  tipo: 'activo',
  usosMaximos: 2,
  cuandoSeUsa: 'accion',
  alUsar: [{ tipo: 'vida', cantidad: 5 }],
  precioVenta: 10,
};
const VENDAS: Objeto = {
  id: 'vendas',
  nombre: 'Vendas',
  descripcion: 'Cura 1d6 PV.',
  tipo: 'activo',
  usosMaximos: 1,
  cuandoSeUsa: 'accion',
  alUsar: [{ tipo: 'vida', cantidad: '1d6' }],
  precioVenta: 5,
};
const PIEDRA: Objeto = { id: 'piedra', nombre: 'Piedra', descripcion: 'x', tipo: 'pasivo', precioVenta: 1 };
const COFRE: Objeto = { id: 'cofre', nombre: 'Cofre', descripcion: 'x', tipo: 'pasivo', espacios: 3, precioVenta: 50 };
const OBJETOS_PRUEBA: Objeto[] = [UNGUENTO, VENDAS, PIEDRA, COFRE, ...OBJETOS];
const CATALOGOS: CatalogosEfectos = { objetos: OBJETOS_PRUEBA, condiciones: CONDICIONES };

/** Partida del influyente (sin nada), en la fase de acción, con lo que se le cambie. */
function estadoCon(cambios: Partial<Jugador> = {}, fase: Estado['mundo']['fase'] = 'accion'): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  // Estas pruebas se escribieron con 5 huecos (hoy son 6): se fijan en 5 para que sigan valiendo.
  return { ...estado, jugador: { ...estado.jugador, capacidadInventario: 5, ...cambios }, mundo: { ...estado.mundo, fase } };
}

function inventario(...ids: string[]): ObjetoLlevado[] {
  return ids.map(id => {
    const ficha = OBJETOS_PRUEBA.find(o => o.id === id)!;
    return ficha.usosMaximos === undefined ? { id } : { id, usosRestantes: ficha.usosMaximos };
  });
}

describe('consultas del inventario', () => {
  it('cuenta los huecos ocupados y libres (cada objeto ocupa sus espacios)', () => {
    const jugador = estadoCon({ inventario: inventario('piedra', 'cofre') }).jugador;

    expect(espaciosOcupados(jugador, OBJETOS_PRUEBA)).toBe(4);
    expect(espaciosLibres(jugador, OBJETOS_PRUEBA)).toBe(1);
  });

  it('dice cuántos huecos faltan para que quepa algo (0 = cabe)', () => {
    const jugador = estadoCon({ inventario: inventario('piedra', 'cofre') }).jugador;

    expect(espaciosQueFaltan(jugador, 'piedra', OBJETOS_PRUEBA)).toBe(0);
    expect(espaciosQueFaltan(jugador, 'idolo_dorado', OBJETOS_PRUEBA)).toBe(3);
    expect(cabeObjeto(jugador, 'piedra', OBJETOS_PRUEBA)).toBe(true);
    expect(cabeObjeto(jugador, 'idolo_dorado', OBJETOS_PRUEBA)).toBe(false);
  });

  it('objetos usables ahora: solo los que se usan en la acción, y solo en la fase de acción', () => {
    const lleva = { inventario: inventario('piedra', 'unguento', 'mano_de_mono', 'vendas') };

    expect(objetosUsablesAhora(estadoCon(lleva), OBJETOS_PRUEBA)).toEqual([1, 3]);
    expect(objetosUsablesAhora(estadoCon(lleva, 'comida'), OBJETOS_PRUEBA)).toEqual([]);
  });

  it('con la partida terminada no hay nada que usar', () => {
    const estado = estadoCon({ inventario: inventario('unguento') });
    const terminada: Estado = { ...estado, mundo: { ...estado.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };

    expect(objetosUsablesAhora(terminada, OBJETOS_PRUEBA)).toEqual([]);
  });
});

describe('usarObjeto (en la fase de acción)', () => {
  it('gasta un uso y aplica sus efectos', () => {
    const inicial = estadoCon({ vida: 6, inventario: inventario('unguento') });
    const { estado, cambios } = usarObjeto(inicial, 0, new Dados(1), CATALOGOS);

    expect(estado.jugador.vida).toBe(11);
    expect(estado.jugador.inventario).toEqual([{ id: 'unguento', usosRestantes: 1 }]);
    expect(cambios).toEqual([
      { tipo: 'objeto_usado', objeto: 'unguento', usosRestantes: 1 },
      { tipo: 'recurso', recurso: 'vida', antes: 6, despues: 11 },
    ]);
  });

  it('no gasta la acción: sigue en la fase de acción y puede usar otro', () => {
    const inicial = estadoCon({ vida: 2, inventario: inventario('unguento') });
    const dados = new Dados(1);
    const primero = usarObjeto(inicial, 0, dados, CATALOGOS).estado;
    const segundo = usarObjeto(primero, 0, dados, CATALOGOS).estado;

    expect(primero.mundo.fase).toBe('accion');
    expect(segundo.jugador.vida).toBe(12);
  });

  it('al gastar el último uso, se agota y se tira solo', () => {
    const inicial = estadoCon({ vida: 6, inventario: [{ id: 'unguento', usosRestantes: 1 }, { id: 'piedra' }] });
    const { estado, cambios } = usarObjeto(inicial, 0, new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario).toEqual([{ id: 'piedra' }]);
    expect(cambios.slice(0, 2)).toEqual([
      { tipo: 'objeto_usado', objeto: 'unguento', usosRestantes: 0 },
      { tipo: 'objeto_agotado', objeto: 'unguento' },
    ]);
  });

  it('los efectos con dados se tiran al usarlo, y se apunta por dónde van los dados', () => {
    const dados = new Dados(3);
    const { estado } = usarObjeto(estadoCon({ vida: 2, inventario: inventario('vendas') }), 0, dados, CATALOGOS);

    expect(estado.jugador.vida).toBeGreaterThanOrEqual(3);
    expect(estado.jugador.vida).toBeLessThanOrEqual(8);
    expect(estado.mundo.estadoDados).toBe(dados.obtenerEstado());
  });

  it('con dos iguales, gasta el de la posición elegida', () => {
    const inicial = estadoCon({ inventario: [{ id: 'unguento', usosRestantes: 2 }, { id: 'unguento', usosRestantes: 1 }] });
    const { estado } = usarObjeto(inicial, 1, new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario).toEqual([{ id: 'unguento', usosRestantes: 2 }]);
  });

  it('error si no es la fase de acción', () => {
    expect(() => usarObjeto(estadoCon({ inventario: inventario('unguento') }, 'comida'), 0, new Dados(1), CATALOGOS)).toThrow(
      /fase "accion"/,
    );
  });

  it('error si el objeto se usa en otro momento (la mano de mono, en un evento) o es pasivo', () => {
    const estado = estadoCon({ inventario: inventario('mano_de_mono', 'piedra') });

    expect(() => usarObjeto(estado, 0, new Dados(1), CATALOGOS)).toThrow(/se usa en: evento/);
    expect(() => usarObjeto(estado, 1, new Dados(1), CATALOGOS)).toThrow(/es pasivo/);
  });

  it('error si no hay objeto en esa posición', () => {
    expect(() => usarObjeto(estadoCon(), 0, new Dados(1), CATALOGOS)).toThrow(/posición 0/);
  });

  it('no toca el estado que recibe', () => {
    const inicial = estadoCon({ vida: 6, inventario: inventario('unguento') });
    const copia = structuredClone(inicial);
    usarObjeto(inicial, 0, new Dados(1), CATALOGOS);

    expect(inicial).toEqual(copia);
  });
});

describe('tirarObjeto', () => {
  it('tira el objeto de esa posición y el chivato lo cuenta', () => {
    const inicial = estadoCon({ inventario: inventario('piedra', 'cofre') });
    const { estado, cambios } = tirarObjeto(inicial, 1, new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario).toEqual([{ id: 'piedra' }]);
    expect(cambios).toEqual([{ tipo: 'objeto_tirado', objeto: 'cofre' }]);
  });

  it('con dos iguales, tira el elegido (el otro conserva sus usos)', () => {
    const inicial = estadoCon({ inventario: [{ id: 'unguento', usosRestantes: 1 }, { id: 'unguento', usosRestantes: 2 }] });
    const { estado } = tirarObjeto(inicial, 0, new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario).toEqual([{ id: 'unguento', usosRestantes: 2 }]);
  });

  it('se puede en cualquier fase, sin cambiar de fase', () => {
    const { estado } = tirarObjeto(estadoCon({ inventario: inventario('piedra') }, 'descanso'), 0, new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario).toEqual([]);
    expect(estado.mundo.fase).toBe('descanso');
  });

  it('al tirar el amuleto kalinago se pierde el vínculo nativo', () => {
    const inicial = estadoCon({ inventario: [{ id: 'amuleto_kalinago' }] });
    expect(tieneCondicion(inicial.jugador, 'vinculo_nativo')).toBe(true);

    const { estado } = tirarObjeto(inicial, 0, new Dados(1));
    expect(tieneCondicion(estado.jugador, 'vinculo_nativo')).toBe(false);
  });

  it('error si no hay objeto en esa posición o la partida ha terminado', () => {
    const estado = estadoCon({ inventario: inventario('piedra') });
    const terminada: Estado = { ...estado, mundo: { ...estado.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };

    expect(() => tirarObjeto(estado, 3, new Dados(1), CATALOGOS)).toThrow(/posición 3/);
    expect(() => tirarObjeto(terminada, 0, new Dados(1), CATALOGOS)).toThrow(/ha terminado/);
  });
});

describe('conseguir un objeto que no cabe: elegir qué tiras', () => {
  // 5 huecos: piedra (1) + cofre (3) + piedra (1) = lleno.
  const LLENO = (): Estado => estadoCon({ inventario: inventario('piedra', 'cofre', 'piedra') });

  it('sin elegir nada, no entra (como antes)', () => {
    const { estado, cambios } = aplicarEfectos(LLENO(), [{ tipo: 'ganar_objeto', objeto: 'unguento' }], new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario).toHaveLength(3);
    expect(cambios).toEqual([{ tipo: 'objeto_no_cabe', objeto: 'unguento' }]);
  });

  it('tirando uno, entra el nuevo: primero se tira, después se gana', () => {
    const efecto = { tipo: 'ganar_objeto' as const, objeto: 'unguento', tirar: [0] };
    const { estado, cambios } = aplicarEfectos(LLENO(), [efecto], new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario.map(o => o.id)).toEqual(['cofre', 'piedra', 'unguento']);
    expect(cambios).toEqual([
      { tipo: 'objeto_tirado', objeto: 'piedra' },
      { tipo: 'objeto_ganado', objeto: 'unguento' },
    ]);
  });

  it('el ídolo (4 huecos) puede necesitar tirar varios', () => {
    const efecto = { tipo: 'ganar_objeto' as const, objeto: 'idolo_dorado', tirar: [1, 2] };
    const { estado } = aplicarEfectos(LLENO(), [efecto], new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario.map(o => o.id)).toEqual(['piedra', 'idolo_dorado']);
  });

  it('si ni tirando lo elegido cabe, no se tira nada y no entra', () => {
    const efecto = { tipo: 'ganar_objeto' as const, objeto: 'idolo_dorado', tirar: [0, 2] };
    const { estado, cambios } = aplicarEfectos(LLENO(), [efecto], new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario).toHaveLength(3);
    expect(cambios).toEqual([{ tipo: 'objeto_no_cabe', objeto: 'idolo_dorado' }]);
  });

  it('si ya cabe, no se tira nada aunque el efecto lo diga', () => {
    const inicial = estadoCon({ inventario: inventario('piedra') });
    const { estado } = aplicarEfectos(inicial, [{ tipo: 'ganar_objeto', objeto: 'unguento', tirar: [0] }], new Dados(1), CATALOGOS);

    expect(estado.jugador.inventario.map(o => o.id)).toEqual(['piedra', 'unguento']);
  });

  it('un objeto mágico que entra tirando otro sigue dando +1 de fama', () => {
    const { estado } = aplicarEfectos(LLENO(), [{ tipo: 'ganar_objeto', objeto: 'mano_de_mono', tirar: [2] }], new Dados(1), CATALOGOS);

    expect(estado.jugador.fama).toBe(1);
  });

  it('error con posiciones que no existen o repetidas', () => {
    expect(() => aplicarEfectos(LLENO(), [{ tipo: 'ganar_objeto', objeto: 'unguento', tirar: [7] }], new Dados(1), CATALOGOS)).toThrow(
      /posición 7/,
    );
    expect(() => aplicarEfectos(LLENO(), [{ tipo: 'ganar_objeto', objeto: 'unguento', tirar: [0, 0] }], new Dados(1), CATALOGOS)).toThrow(
      /repetidas/,
    );
  });
});

describe('revisores: objetos activos, precios y efectos internos', () => {
  const erroresDe = (objeto: unknown): string => validarObjetos([objeto as Objeto]).join(' | ');

  it('un objeto que se usa en la acción, con sus efectos, está bien', () => {
    expect(validarObjetos([UNGUENTO, VENDAS])).toEqual([]);
  });

  it('un activo sin "cuandoSeUsa" o con un momento que no existe', () => {
    const { cuandoSeUsa: _, ...sinMomento } = UNGUENTO;

    expect(erroresDe(sinMomento)).toContain('necesita "cuandoSeUsa"');
    expect(erroresDe({ ...UNGUENTO, cuandoSeUsa: 'siempre' })).toContain('necesita "cuandoSeUsa"');
  });

  it('un pasivo no lleva "cuandoSeUsa" ni "alUsar"', () => {
    expect(erroresDe({ ...PIEDRA, cuandoSeUsa: 'accion' })).toContain('es pasivo (funciona solo)');
    expect(erroresDe({ ...PIEDRA, alUsar: [] })).toContain('es pasivo (funciona solo)');
  });

  it('los efectos de "alUsar" se revisan como los de las tablas', () => {
    expect(erroresDe({ ...UNGUENTO, alUsar: [{ tipo: 'vidaa', cantidad: 5 }] })).toContain('"vidaa" no existe');
    expect(erroresDe({ ...UNGUENTO, alUsar: { tipo: 'vida' } })).toContain('"alUsar" debe ser una lista');
  });

  it('todos los objetos necesitan precio de venta', () => {
    const { precioVenta: _, ...sinPrecio } = PIEDRA;

    expect(erroresDe(sinPrecio)).toContain('le falta el precio de venta');
  });

  it('todos los objetos del juego tienen precio, mágicos incluidos', () => {
    expect(OBJETOS.every(o => Number.isInteger(o.precioVenta) && o.precioVenta >= 1)).toBe(true);
  });

  it('los efectos internos no se pueden escribir en el JSON', () => {
    expect(validarEfecto({ tipo: 'gastar_uso', posicion: 0 }, 'prueba')).toEqual([
      'prueba: "gastar_uso" es un efecto interno del juego (lo usa el inventario): no se escribe en el JSON.',
    ]);
    expect(validarEfecto({ tipo: 'tirar_objeto', posicion: 0 }, 'prueba')[0]).toContain('efecto interno');
  });

  it('"tirar" en ganar_objeto tampoco se escribe en el JSON', () => {
    expect(validarEfecto({ tipo: 'ganar_objeto', objeto: 'piedra', tirar: [0] }, 'prueba')[0]).toContain('sobra "tirar"');
  });
});
