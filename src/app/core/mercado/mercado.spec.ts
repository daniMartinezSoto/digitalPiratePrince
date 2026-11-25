import type { Sitio } from '../acciones/accion';
import { pescar } from '../acciones/pescar';
import { AJUSTES } from '../ajustes/ajustes';
import { OBJETOS } from '../catalogos/cargar-objetos';
import { tieneCondicion } from '../condiciones/condiciones-vigentes';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { objetosUsablesAhora } from '../objetos/consultas';
import { usarObjeto } from '../objetos/usar-objeto';
import { crearPartida } from '../partida/crear-partida';
import { comer } from '../turno/comer';
import { iniciarTurno } from '../turno/iniciar-turno';
import { RASTRILLO } from './cargar-rastrillo';
import {
  comprarComida,
  comprarEnRastrillo,
  irAlMercado,
  opcionesDelMercado,
  salirDelMercado,
  venderComida,
  venderObjeto,
} from './mercado';
import type { Rastrillo } from './rastrillo';
import { validarRastrillo } from './validar-rastrillo';

// La acción "Ir al mercado" (paso 6 del Sprint 6): entrar gasta el día; dentro, cada cosa es un
// botón aparte (comprar o vender comida de una en una, vender objetos, el rastrillo) hasta salir.

const EN_PUERTO: Sitio = { lugar: 'puerto' };
const BRUJULA_HOY: Rastrillo = { objetos: [{ objeto: 'brujula_magica', peso: 1, precio: 200 }] };

/** Partida del influyente en la fase de acción, con lo que se le cambie. */
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  // Estas pruebas se escribieron con 5 huecos (hoy son 6): se fijan en 5 para que sigan valiendo.
  return { ...estado, jugador: { ...estado.jugador, capacidadInventario: 5, ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

/** Ya dentro del mercado, con la brújula en el rastrillo. */
function dentro(cambios: Partial<Jugador> = {}): Estado {
  return irAlMercado(estadoCon(cambios), EN_PUERTO, new Dados(1), BRUJULA_HOY).estado;
}

describe('irAlMercado', () => {
  it('entra en el mercado con el objeto del rastrillo de hoy; sigue en la fase de acción', () => {
    const { estado } = irAlMercado(estadoCon(), EN_PUERTO, new Dados(1), BRUJULA_HOY);

    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'mercado', rastrillo: { objeto: 'brujula_magica', precio: 200 } });
    expect(estado.mundo.fase).toBe('accion');
  });

  it('solo en los puertos', () => {
    expect(() => irAlMercado(estadoCon(), { lugar: 'aldea' }, new Dados(1))).toThrow(/solo está en los puertos/);
    expect(() => irAlMercado(estadoCon(), { lugar: 'barco' }, new Dados(1))).toThrow(/solo está en los puertos/);
  });

  it('elegir el objeto del rastrillo gasta un número del generador, y se apunta', () => {
    const dados = new Dados(4);
    const testigo = new Dados(4);
    const { estado } = irAlMercado(estadoCon(), EN_PUERTO, dados);
    testigo.elegirPonderado(RASTRILLO.objetos);

    expect(dados.obtenerEstado()).toBe(testigo.obtenerEstado());
    expect(estado.mundo.estadoDados).toBe(dados.obtenerEstado());
  });

  it('con muchas semillas salen todos los objetos del rastrillo', () => {
    const vistos = new Set<string>();
    for (let semilla = 1; semilla <= 60; semilla++) {
      const enCurso = irAlMercado(estadoCon(), EN_PUERTO, new Dados(semilla)).estado.mundo.accionEnCurso;
      if (enCurso?.tipo === 'mercado' && enCurso.rastrillo) {
        vistos.add(enCurso.rastrillo.objeto);
      }
    }

    expect(vistos.size).toBe(RASTRILLO.objetos.length);
  });

  it('con el rastrillo vacío no hay nada que comprar y no se gastan dados', () => {
    const dados = new Dados(1);
    const antes = dados.obtenerEstado();
    const { estado } = irAlMercado(estadoCon(), EN_PUERTO, dados, { objetos: [] });

    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'mercado', rastrillo: null });
    expect(dados.obtenerEstado()).toBe(antes);
  });

  it('dentro del mercado no se puede hacer otra acción, ni volver a entrar, ni usar objetos', () => {
    const estado = dentro();

    expect(() => pescar(estado, { lugar: 'puerto', juntoAlAgua: true }, new Dados(1))).toThrow(/acción a medias \("mercado"\)/);
    expect(() => irAlMercado(estado, EN_PUERTO, new Dados(1))).toThrow(/acción a medias/);
    expect(() => usarObjeto(estado, 0, new Dados(1))).toThrow(/acción a medias/);
    expect(objetosUsablesAhora(estado)).toEqual([]);
  });

  it('a mitad de la visita, el estado sigue siendo solo datos (se puede guardar)', () => {
    const estado = dentro();

    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });
});

describe('comprar y vender comida, de una en una', () => {
  it('comprar una reserva: −5 de oro, +1 de comida, y sigue dentro con el mismo rastrillo', () => {
    const { estado, cambios } = comprarComida(dentro({ oro: 50, comida: 3 }), new Dados(1));

    expect(estado.jugador.oro).toBe(50 - AJUSTES.precioComprarComida);
    expect(estado.jugador.comida).toBe(4);
    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'mercado', rastrillo: { objeto: 'brujula_magica', precio: 200 } });
    expect(cambios).toEqual([
      { tipo: 'recurso', recurso: 'oro', antes: 50, despues: 45 },
      { tipo: 'recurso', recurso: 'comida', antes: 3, despues: 4 },
    ]);
  });

  it('se puede comprar varias veces seguidas', () => {
    const dados = new Dados(1);
    let estado = dentro({ oro: 50, comida: 0 });
    for (let i = 0; i < 3; i++) {
      estado = comprarComida(estado, dados).estado;
    }

    expect(estado.jugador.comida).toBe(3);
    expect(estado.jugador.oro).toBe(35);
  });

  it('error si no le llega el oro o ya tiene la comida al máximo', () => {
    expect(() => comprarComida(dentro({ oro: 4 }), new Dados(1))).toThrow(/sin_oro/);
    expect(() => comprarComida(dentro({ comida: AJUSTES.comidaMaxima }), new Dados(1))).toThrow(/comida_al_maximo/);
  });

  it('vender una reserva: −1 de comida, +2 de oro', () => {
    const { estado } = venderComida(dentro({ oro: 10, comida: 3 }), new Dados(1));

    expect(estado.jugador.comida).toBe(2);
    expect(estado.jugador.oro).toBe(10 + AJUSTES.precioVenderComida);
  });

  it('error si no tiene comida que vender', () => {
    expect(() => venderComida(dentro({ comida: 0 }), new Dados(1))).toThrow(/no tiene comida/);
  });

  it('el contable gana su 1d6 en cada venta', () => {
    const { estado, cambios } = venderComida(dentro({ oro: 10, comida: 3, sobrenombre: 'el_contable' }), new Dados(1));

    expect(estado.jugador.oro).toBeGreaterThanOrEqual(10 + 2 + 1);
    expect(cambios.some(c => c.tipo === 'recurso' && c.motivo === 'contable')).toBe(true);
  });
});

describe('vender objetos, uno a uno', () => {
  it('sale del inventario y le dan su precio de venta', () => {
    const inicial = dentro({ oro: 10, inventario: [{ id: 'idolo_dorado' }, { id: 'brujula_magica' }] });
    const { estado, cambios } = venderObjeto(inicial, 1, new Dados(1));

    expect(estado.jugador.inventario).toEqual([{ id: 'idolo_dorado' }]);
    expect(estado.jugador.oro).toBe(110);
    expect(cambios).toEqual([
      { tipo: 'objeto_vendido', objeto: 'brujula_magica' },
      { tipo: 'recurso', recurso: 'oro', antes: 10, despues: 110 },
    ]);
  });

  it('vender un objeto mágico no quita la fama que dio', () => {
    const { estado } = venderObjeto(dentro({ fama: 3, inventario: [{ id: 'mano_de_mono', usosRestantes: 1 }] }), 0, new Dados(1));

    expect(estado.jugador.fama).toBe(3);
  });

  it('vender el amuleto kalinago quita el vínculo nativo', () => {
    const { estado } = venderObjeto(dentro({ inventario: [{ id: 'amuleto_kalinago' }] }), 0, new Dados(1));

    expect(tieneCondicion(estado.jugador, 'vinculo_nativo')).toBe(false);
  });

  it('error si no hay objeto en esa posición', () => {
    expect(() => venderObjeto(dentro(), 0, new Dados(1))).toThrow(/posición 0/);
  });
});

describe('el rastrillo', () => {
  it('comprarlo: entra en el inventario, se cobra, y el rastrillo se queda vacío', () => {
    const { estado, cambios } = comprarEnRastrillo(dentro({ oro: 250 }), new Dados(1));

    expect(estado.jugador.inventario).toEqual([{ id: 'brujula_magica' }]);
    expect(estado.jugador.oro).toBe(50);
    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'mercado', rastrillo: null });
    expect(cambios.map(c => c.tipo)).toEqual(['objeto_ganado', 'recurso', 'recurso']); // objeto, +1 fama (mágico), −oro
  });

  it('un objeto mágico del rastrillo da +1 de fama', () => {
    expect(comprarEnRastrillo(dentro({ oro: 250 }), new Dados(1)).estado.jugador.fama).toBe(1);
  });

  it('error si ya lo ha comprado o no le llega el oro', () => {
    const comprado = comprarEnRastrillo(dentro({ oro: 500 }), new Dados(1)).estado;

    expect(() => comprarEnRastrillo(comprado, new Dados(1))).toThrow(/ya no queda nada/);
    expect(() => comprarEnRastrillo(dentro({ oro: 199 }), new Dados(1))).toThrow(/cuesta 200/);
  });

  it('si no cabe y no tira nada, ni se compra ni se cobra, y sigue en el rastrillo', () => {
    const lleno = dentro({ oro: 250, inventario: [{ id: 'idolo_dorado' }, { id: 'amuleto_kalinago' }] });
    const { estado, cambios } = comprarEnRastrillo(lleno, new Dados(1));

    expect(estado.jugador.oro).toBe(250);
    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'mercado', rastrillo: { objeto: 'brujula_magica', precio: 200 } });
    expect(cambios).toEqual([{ tipo: 'objeto_no_cabe', objeto: 'brujula_magica' }]);
  });

  it('si no cabe, tirando lo elegido entra', () => {
    const lleno = dentro({ oro: 250, inventario: [{ id: 'idolo_dorado' }, { id: 'amuleto_kalinago' }] });
    const { estado } = comprarEnRastrillo(lleno, new Dados(1), [1]);

    expect(estado.jugador.inventario.map(o => o.id)).toEqual(['idolo_dorado', 'brujula_magica']);
    expect(estado.jugador.oro).toBe(50);
  });
});

describe('salirDelMercado', () => {
  it('termina la acción: toca comer y ya no está en el mercado', () => {
    const { estado } = salirDelMercado(dentro(), new Dados(1));

    expect(estado.mundo.fase).toBe('comida');
    expect(estado.mundo.accionEnCurso).toBeNull();
  });

  it('fuera del mercado, los botones de dentro dan error', () => {
    const fuera = salirDelMercado(dentro(), new Dados(1)).estado;

    expect(() => comprarComida(fuera, new Dados(1))).toThrow(/no está dentro del mercado/);
    expect(() => salirDelMercado(estadoCon(), new Dados(1))).toThrow(/no está dentro del mercado/);
    expect(() => opcionesDelMercado(estadoCon())).toThrow(/no está dentro del mercado/);
  });
});

describe('opcionesDelMercado (para la interfaz)', () => {
  it('con oro y comida, todo activo, con sus precios', () => {
    const opciones = opcionesDelMercado(dentro({ oro: 300, comida: 3, inventario: [{ id: 'amuleto_kalinago' }] }));

    expect(opciones).toEqual({
      comprarComida: { precio: 5, disponible: true },
      venderComida: { precio: 2, disponible: true },
      venderObjetos: [{ posicion: 0, objeto: 'amuleto_kalinago', precio: 40 }],
      rastrillo: { precio: 200, disponible: true, objeto: 'brujula_magica', espaciosQueFaltan: 0 },
    });
  });

  it('sin oro ni comida, desactivados y con el motivo', () => {
    const opciones = opcionesDelMercado(dentro({ oro: 0, comida: 0 }));

    expect(opciones.comprarComida).toEqual({ precio: 5, disponible: false, motivo: 'sin_oro' });
    expect(opciones.venderComida).toEqual({ precio: 2, disponible: false, motivo: 'sin_comida' });
    expect(opciones.rastrillo).toMatchObject({ disponible: false, motivo: 'sin_oro' });
  });

  it('con la comida al máximo no se puede comprar más', () => {
    expect(opcionesDelMercado(dentro({ comida: AJUSTES.comidaMaxima })).comprarComida.motivo).toBe('comida_al_maximo');
  });

  it('si el objeto del rastrillo no cabe, dice cuántos huecos faltan', () => {
    const lleno = dentro({ oro: 300, inventario: [{ id: 'idolo_dorado' }, { id: 'amuleto_kalinago' }] });

    expect(opcionesDelMercado(lleno).rastrillo?.espaciosQueFaltan).toBe(1);
  });

  it('tras comprar lo del rastrillo, ya no aparece', () => {
    const comprado = comprarEnRastrillo(dentro({ oro: 300 }), new Dados(1)).estado;

    expect(opcionesDelMercado(comprado).rastrillo).toBeNull();
  });
});

describe('un día de mercado completo', () => {
  it('amanece, entra en el mercado, vende y compra, sale y come en la taberna', () => {
    const { estado: inicial } = crearPartida(1, 'Marta');
    const dados = new Dados(inicial.mundo.estadoDados);

    let estado = iniciarTurno(inicial, dados).estado;
    estado = irAlMercado(estado, EN_PUERTO, dados).estado;
    estado = venderComida(estado, dados).estado;
    estado = comprarComida(estado, dados).estado;
    estado = comprarComida(estado, dados).estado;
    estado = salirDelMercado(estado, dados).estado;

    expect(estado.jugador.comida).toBe(6);
    expect(estado.jugador.oro).toBe(50 + 2 - 10);

    const comida = comer(estado, 'pagar', 'puerto', dados);
    expect(comida.estado.mundo.fase).toBe('descanso');
  });
});

describe('validarRastrillo', () => {
  it('el rastrillo del juego (data/rastrillo.json) está bien', () => {
    expect(validarRastrillo(RASTRILLO)).toEqual([]);
  });

  it('avisa de objetos que no existen, repetidos, pesos mal y campos que sobran', () => {
    const errores = validarRastrillo({
      objetos: [
        { objeto: 'brujula_magicaa', peso: 1, precio: 200 },
        { objeto: 'mano_de_mono', peso: 0, precio: 160 },
        { objeto: 'mano_de_mono', peso: 1, precio: 160, nombre: 'Mano' },
      ],
    });

    expect(errores.some(e => e.includes('no existe en el catálogo'))).toBe(true);
    expect(errores.some(e => e.includes('el peso debe ser'))).toBe(true);
    expect(errores.some(e => e.includes('repetido'))).toBe(true);
    expect(errores.some(e => e.includes('"nombre" sobra'))).toBe(true);
  });

  it('un objeto del rastrillo tiene que costar más de lo que te dan al venderlo', () => {
    const venta = OBJETOS.find(o => o.id === 'brujula_magica')!.precioVenta;

    expect(validarRastrillo({ objetos: [{ objeto: 'brujula_magica', peso: 1, precio: venta }] })[0]).toContain('tiene que costar más');
  });

  it('avisa si la lista falta o está vacía', () => {
    expect(validarRastrillo({ objetos: [] })).toEqual(['rastrillo: falta la lista de "objetos" o está vacía.']);
  });
});
