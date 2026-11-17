import { CONDICIONES } from '../catalogos/cargar-condiciones';
import type { Condicion } from '../catalogos/condicion';
import { comidaPorDia, estaProhibido, famaObjetivoActual, fuerzaActual, ingenioActual, maximoSeguidoresActual, vidaMaxActual } from '../condiciones/consultas';
import { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { grupoLleno } from '../seguidores/consultas';
import type { Efecto } from '../tablas/efecto';
import type { AmuletoMaldito } from './amuleto-maldito';
import { AMULETO_MALDITO } from './cargar-amuleto-maldito';
import { recibirAmuletoMaldito } from './recibir-amuleto-maldito';
import { validarAmuletoMaldito } from './validar-amuleto-maldito';

// El amuleto maldito completo (paso 5a del Sprint 6): sus bendiciones, que se CALCULAN
// (la hoja del personaje no cambia), qué pasa al quitárselo, cómo se recibe y "el maldito".

// Semillas de crearPartida que dan "el maldito" (comprobadas): con cada una sale un amuleto distinto.
const MALDITO_DESEO_Y_HEDOR = 7;
const MALDITO_FORTALEZA_Y_ODIO = 87;
const MALDITO_CARISMA_Y_AMBICION = 45;

function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba'); // el influyente, sin condiciones
  return { ...estado, jugador: { ...estado.jugador, ...cambios } };
}

/** Un amuleto puesto a mano con esa bendición y esa maldición dentro. */
function conAmuleto(partes: string[], cambios: Partial<Jugador> = {}): Estado {
  return estadoCon({ condiciones: [{ id: 'amuleto_maldito', partes }], ...cambios });
}

function seguidor(id: string, inseparable = false): Seguidor {
  const s: Seguidor = { id, tipo: 'forzudo', nombre: id, ataque: 3, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
  return inseparable ? { ...s, inseparable: true } : s;
}

/** Un amuleto "trucado" con un solo resultado en cada lista: siempre sale ese. */
function amuletoFijo(bendicion: AmuletoMaldito['bendiciones'][number], maldicion: AmuletoMaldito['maldiciones'][number]): AmuletoMaldito {
  return { bendiciones: [bendicion], maldiciones: [maldicion] };
}

// Gran fortaleza (la de la tabla real, con su "curarse del todo") + una maldición cualquiera.
const AMULETO_FORTALEZA = amuletoFijo(AMULETO_MALDITO.bendiciones[2], { condicion: 'hambre_insaciable' });

const QUITAR_UNA_MALDICION: Efecto = { tipo: 'quitar_condicion', categoria: 'maldicion' };

describe('bendiciones del amuleto: se calculan, la hoja no cambia', () => {
  it('fuerza letal: +1 de fuerza mientras lo lleva', () => {
    const estado = conAmuleto(['fuerza_letal', 'hambre_insaciable'], { fuerza: 3 });

    expect(fuerzaActual(estado.jugador)).toBe(4);
    expect(estado.jugador.fuerza).toBe(3);
  });

  it('súper cerebro: +2 de ingenio mientras lo lleva', () => {
    const estado = conAmuleto(['super_cerebro', 'hambre_insaciable'], { ingenio: 2 });

    expect(ingenioActual(estado.jugador)).toBe(4);
    expect(estado.jugador.ingenio).toBe(2);
  });

  it('gran fortaleza: +4 de vida máxima mientras lo lleva', () => {
    const estado = conAmuleto(['gran_fortaleza', 'hambre_insaciable']);

    expect(vidaMaxActual(estado.jugador)).toBe(19);
    expect(estado.jugador.vidaMax).toBe(15);
  });

  it('carisma: puede llevar 1 seguidor más', () => {
    const estado = conAmuleto(['carisma', 'hambre_insaciable']);

    expect(maximoSeguidoresActual(estado.jugador)).toBe(4);
  });

  it('piel de piedra: de momento solo es la ficha (la regla llega con el combate)', () => {
    const estado = conAmuleto(['piel_de_piedra', 'hambre_insaciable'], { fuerza: 3, ingenio: 3 });

    expect([fuerzaActual(estado.jugador), ingenioActual(estado.jugador), vidaMaxActual(estado.jugador)]).toEqual([3, 3, 15]);
    expect(maximoSeguidoresActual(estado.jugador)).toBe(3);
  });

  it('sin amuleto, las consultas dan los valores de la hoja', () => {
    const estado = estadoCon({ fuerza: 2, ingenio: 4 });

    expect([fuerzaActual(estado.jugador), ingenioActual(estado.jugador), vidaMaxActual(estado.jugador)]).toEqual([2, 4, 15]);
    expect(maximoSeguidoresActual(estado.jugador)).toBe(3);
  });

  it('fuerza, ingenio y vida máxima nunca bajan de 1, ni el máximo de seguidores de 0', () => {
    const debilidad: Condicion = {
      id: 'debilidad',
      nombre: 'Debilidad',
      descripcion: 'Prueba',
      categoria: 'maldicion',
      ajustes: { fuerza: -9, ingenio: -9, vidaMax: -99, maximoSeguidores: -9 },
    };
    const jugador = estadoCon({ condiciones: [{ id: 'debilidad' }] }).jugador;

    expect(fuerzaActual(jugador, [debilidad])).toBe(1);
    expect(ingenioActual(jugador, [debilidad])).toBe(1);
    expect(vidaMaxActual(jugador, [debilidad])).toBe(1);
    expect(maximoSeguidoresActual(jugador, [debilidad])).toBe(0);
  });
});

describe('el tope de la vida y del grupo usan los valores actuales', () => {
  it('con gran fortaleza, curarse puede pasar de 15 hasta 19', () => {
    const { estado } = aplicarEfectos(conAmuleto(['gran_fortaleza', 'hambre_insaciable']), [{ tipo: 'vida', cantidad: 10 }], new Dados(1));

    expect(estado.jugador.vida).toBe(19);
  });

  it('con gran fortaleza, "vida al máximo" deja la vida en 19', () => {
    const inicial = conAmuleto(['gran_fortaleza', 'hambre_insaciable'], { vida: 3 });
    const { estado } = aplicarEfectos(inicial, [{ tipo: 'vida', operacion: 'maximo' }], new Dados(1));

    expect(estado.jugador.vida).toBe(19);
  });

  it('sin gran fortaleza, el tope sigue siendo 15', () => {
    const { estado } = aplicarEfectos(estadoCon(), [{ tipo: 'vida', cantidad: 10 }], new Dados(1));

    expect(estado.jugador.vida).toBe(15);
  });

  it('con carisma entra un 4.º seguidor', () => {
    const inicial = conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: [seguidor('a'), seguidor('b'), seguidor('c')] });
    const { estado, cambios } = aplicarEfectos(inicial, [{ tipo: 'ganar_seguidor', seguidor: 'forzudo' }], new Dados(1));

    expect(estado.jugador.seguidores).toHaveLength(4);
    expect(cambios.map(c => c.tipo)).toEqual(['seguidor_se_une']);
  });

  it('con carisma y 4 seguidores, ya no entra un 5.º', () => {
    const cuatro = [seguidor('a'), seguidor('b'), seguidor('c'), seguidor('d')];
    const inicial = conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: cuatro });
    const { cambios } = aplicarEfectos(inicial, [{ tipo: 'ganar_seguidor', seguidor: 'forzudo' }], new Dados(1));

    expect(cambios).toEqual([{ tipo: 'seguidor_no_se_une', tipoSeguidor: 'forzudo', motivo: 'grupo_lleno' }]);
  });

  it('grupoLleno tiene en cuenta el carisma', () => {
    const tres = [seguidor('a'), seguidor('b'), seguidor('c')];

    expect(grupoLleno(estadoCon({ seguidores: tres }).jugador)).toBe(true);
    expect(grupoLleno(conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: tres }).jugador)).toBe(false);
  });

  it('un "+1 de fuerza" de un evento cambia la hoja y se suma a lo del amuleto', () => {
    const inicial = conAmuleto(['fuerza_letal', 'hambre_insaciable'], { fuerza: 3 });
    const { estado } = aplicarEfectos(inicial, [{ tipo: 'fuerza', cantidad: 1 }], new Dados(1));

    expect(estado.jugador.fuerza).toBe(4);
    expect(fuerzaActual(estado.jugador)).toBe(5);
  });
});

describe('al quitarse el amuleto, todo vuelve a lo normal', () => {
  it('se van la bendición y la maldición: fuerza y comida vuelven a su valor', () => {
    const inicial = conAmuleto(['fuerza_letal', 'hambre_insaciable'], { fuerza: 3 });
    const { estado } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([]);
    expect(fuerzaActual(estado.jugador)).toBe(3);
    expect(comidaPorDia(estado.jugador)).toBe(1);
  });

  it('gran fortaleza: si tenía 19 de vida, baja a 15 y el chivato lo cuenta', () => {
    const inicial = conAmuleto(['gran_fortaleza', 'hambre_insaciable'], { vida: 19 });
    const { estado, cambios } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], new Dados(1));

    expect(estado.jugador.vida).toBe(15);
    expect(cambios).toEqual([
      { tipo: 'condicion_quitada', condicion: 'amuleto_maldito' },
      { tipo: 'recurso', recurso: 'vida', antes: 19, despues: 15 },
    ]);
  });

  it('gran fortaleza: si tenía menos vida que 15, se queda como estaba', () => {
    const inicial = conAmuleto(['gran_fortaleza', 'hambre_insaciable'], { vida: 12 });
    const { estado, cambios } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], new Dados(1));

    expect(estado.jugador.vida).toBe(12);
    expect(cambios).toHaveLength(1);
  });

  it('carisma: con 4 seguidores, se marcha uno y el chivato dice por qué', () => {
    const cuatro = [seguidor('a'), seguidor('b'), seguidor('c'), seguidor('d')];
    const inicial = conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: cuatro });
    const { estado, cambios } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], new Dados(1));

    const seQueda = estado.jugador.seguidores.map(s => s.id);
    const seVa = ['a', 'b', 'c', 'd'].find(id => !seQueda.includes(id));
    expect(seQueda).toHaveLength(3);
    expect(cambios).toEqual([
      { tipo: 'condicion_quitada', condicion: 'amuleto_maldito' },
      { tipo: 'seguidor_se_marcha', seguidor: seVa, motivo: 'carisma_perdido' },
    ]);
  });

  it('carisma: el que se marcha es al azar (con distintas semillas no es siempre el mismo)', () => {
    const cuatro = [seguidor('a'), seguidor('b'), seguidor('c'), seguidor('d')];
    const inicial = conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: cuatro });
    const seVan = new Set<string>();
    for (let semilla = 1; semilla <= 40; semilla++) {
      const { cambios } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], new Dados(semilla));
      const marcha = cambios.find(c => c.tipo === 'seguidor_se_marcha');
      if (marcha && 'seguidor' in marcha) {
        seVan.add(marcha.seguidor);
      }
    }

    expect(seVan.size).toBe(4);
  });

  it('carisma: un inseparable nunca entra en el sorteo', () => {
    const cuatro = [seguidor('hermano', true), seguidor('b'), seguidor('c'), seguidor('d')];
    const inicial = conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: cuatro });
    for (let semilla = 1; semilla <= 40; semilla++) {
      const { estado } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], new Dados(semilla));

      expect(estado.jugador.seguidores.map(s => s.id)).toContain('hermano');
      expect(estado.jugador.seguidores).toHaveLength(3);
    }
  });

  it('carisma: si todos son inseparables, no se marcha nadie', () => {
    const cuatro = [seguidor('a', true), seguidor('b', true), seguidor('c', true), seguidor('d', true)];
    const inicial = conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: cuatro });
    const { estado } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], new Dados(1));

    expect(estado.jugador.seguidores).toHaveLength(4);
  });

  it('carisma: con 3 o menos seguidores no se marcha nadie ni se gastan dados', () => {
    const inicial = conAmuleto(['carisma', 'hambre_insaciable'], { seguidores: [seguidor('a'), seguidor('b')] });
    const dados = new Dados(1);
    const antes = dados.obtenerEstado();
    const { estado } = aplicarEfectos(inicial, [QUITAR_UNA_MALDICION], dados);

    expect(estado.jugador.seguidores).toHaveLength(2);
    expect(dados.obtenerEstado()).toBe(antes);
  });
});

describe('recibirAmuletoMaldito', () => {
  it('pone UNA condición con la bendición y la maldición que tocaron dentro', () => {
    const amuleto = amuletoFijo({ condicion: 'fuerza_letal' }, { condicion: 'hambre_insaciable' });
    const { estado, tiradas, eventos } = recibirAmuletoMaldito(estadoCon(), new Dados(1), undefined, amuleto);

    expect(estado.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['fuerza_letal', 'hambre_insaciable'] }]);
    expect(tiradas).toEqual({ bendicion: 1, maldicion: 1 });
    expect(eventos).toEqual([]);
  });

  it('el chivato avisa del amuleto y de lo que lleva dentro', () => {
    const amuleto = amuletoFijo({ condicion: 'super_cerebro' }, { condicion: 'ambicion_desmedida' });
    const { cambios } = recibirAmuletoMaldito(estadoCon(), new Dados(1), undefined, amuleto);

    expect(cambios).toEqual([{ tipo: 'condicion_puesta', condicion: 'amuleto_maldito', partes: ['super_cerebro', 'ambicion_desmedida'] }]);
  });

  it('gran fortaleza: al recibirlo se cura del todo, ya con la vida máxima aumentada', () => {
    const { estado } = recibirAmuletoMaldito(estadoCon({ vida: 6 }), new Dados(1), undefined, AMULETO_FORTALEZA);

    expect(estado.jugador.vida).toBe(19);
    expect(estado.jugador.vidaMax).toBe(15);
  });

  it('odio al dinero: al recibirlo pierde todo su oro', () => {
    const amuleto = amuletoFijo({ condicion: 'fuerza_letal' }, AMULETO_MALDITO.maldiciones[3]);
    const { estado, cambios } = recibirAmuletoMaldito(estadoCon({ oro: 80 }), new Dados(1), undefined, amuleto);

    expect(estado.jugador.oro).toBe(0);
    expect(cambios).toContainEqual({ tipo: 'recurso', recurso: 'oro', antes: 80, despues: 0 });
  });

  it('odio al dinero: después, cada vez que gana oro gana 1d6 menos', () => {
    const amuleto = amuletoFijo({ condicion: 'fuerza_letal' }, AMULETO_MALDITO.maldiciones[3]);
    const conAmuletoPuesto = recibirAmuletoMaldito(estadoCon(), new Dados(1), undefined, amuleto).estado;
    const { estado } = aplicarEfectos(conAmuletoPuesto, [{ tipo: 'oro', cantidad: 20 }], new Dados(1));

    expect(estado.jugador.oro).toBeGreaterThanOrEqual(14);
    expect(estado.jugador.oro).toBeLessThanOrEqual(19);
  });

  it('deseo: el amuleto lleva solo la maldición y el deseo queda como evento pendiente', () => {
    const amuleto = amuletoFijo({ evento: 'deseo' }, { condicion: 'hedor_nauseabundo' });
    const { estado, eventos } = recibirAmuletoMaldito(estadoCon(), new Dados(1), undefined, amuleto);

    expect(estado.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['hedor_nauseabundo'] }]);
    expect(eventos).toEqual(['deseo']);
  });

  it('si ya lleva un amuleto, no recibe otro, avisa y no se tira ningún dado', () => {
    const inicial = conAmuleto(['fuerza_letal', 'hambre_insaciable']);
    const dados = new Dados(1);
    const antes = dados.obtenerEstado();
    const resultado = recibirAmuletoMaldito(inicial, dados);

    expect(resultado.estado).toEqual(inicial);
    expect(resultado.cambios).toEqual([{ tipo: 'condicion_no_puesta', condicion: 'amuleto_maldito', motivo: 'ya_la_tiene' }]);
    expect(resultado.tiradas).toBeNull();
    expect(dados.obtenerEstado()).toBe(antes);
  });

  it('gasta exactamente dos números del generador (bendición y maldición)', () => {
    const dados = new Dados(5);
    const testigo = new Dados(5);
    recibirAmuletoMaldito(estadoCon(), dados);
    testigo.tirar('1d6');
    testigo.tirar('1d6');

    expect(dados.obtenerEstado()).toBe(testigo.obtenerEstado());
  });

  it('el dado elige la posición en la lista: lo que dicen las tiradas es lo que lleva dentro', () => {
    for (let semilla = 1; semilla <= 30; semilla++) {
      const { estado, tiradas, eventos } = recibirAmuletoMaldito(estadoCon(), new Dados(semilla));
      const bendicion = AMULETO_MALDITO.bendiciones[tiradas!.bendicion - 1];
      const maldicion = AMULETO_MALDITO.maldiciones[tiradas!.maldicion - 1];
      const esperadas = [bendicion.condicion, maldicion.condicion].filter(c => c !== undefined);

      expect(estado.jugador.condiciones[0].partes).toEqual(esperadas);
      expect(eventos).toEqual(bendicion.evento ? [bendicion.evento] : []);
    }
  });

  it('con muchas semillas salen las 6 bendiciones y las 6 maldiciones', () => {
    const bendiciones = new Set<number>();
    const maldiciones = new Set<number>();
    for (let semilla = 1; semilla <= 200; semilla++) {
      const { tiradas } = recibirAmuletoMaldito(estadoCon(), new Dados(semilla));
      bendiciones.add(tiradas!.bendicion);
      maldiciones.add(tiradas!.maldicion);
    }

    expect(bendiciones.size).toBe(6);
    expect(maldiciones.size).toBe(6);
  });

  it('un evento que pone el amuleto directamente (poner_condicion) tampoco puede poner un segundo: avisa', () => {
    const inicial = conAmuleto(['fuerza_letal', 'hambre_insaciable']);
    const otro: Efecto = { tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes: ['carisma', 'hedor_nauseabundo'] };
    const { estado, cambios } = aplicarEfectos(inicial, [otro], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['fuerza_letal', 'hambre_insaciable'] }]);
    expect(cambios).toEqual([{ tipo: 'condicion_no_puesta', condicion: 'amuleto_maldito', motivo: 'ya_la_tiene' }]);
  });

  it('otra tormenta estando ya en una tormenta no avisa (no se pierde nada)', () => {
    const inicial = estadoCon({ condiciones: [{ id: 'tormenta' }] });
    const { estado, cambios } = aplicarEfectos(inicial, [{ tipo: 'poner_condicion', condicion: 'tormenta' }], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([{ id: 'tormenta' }]);
    expect(cambios).toEqual([]);
  });

  it('no toca el estado que recibe', () => {
    const inicial = estadoCon({ vida: 6, oro: 80 });
    const copia = structuredClone(inicial);
    recibirAmuletoMaldito(inicial, new Dados(1), undefined, AMULETO_FORTALEZA);

    expect(inicial).toEqual(copia);
  });
});

describe('validarAmuletoMaldito', () => {
  it('las tablas del juego (data/amuleto-maldito.json) están bien', () => {
    expect(validarAmuletoMaldito(AMULETO_MALDITO)).toEqual([]);
  });

  it('las tablas del juego tienen 6 bendiciones y 6 maldiciones, como el libro', () => {
    expect(AMULETO_MALDITO.bendiciones).toHaveLength(6);
    expect(AMULETO_MALDITO.maldiciones).toHaveLength(6);
  });

  it('avisa de una condición que no existe y de una de otra categoría', () => {
    const errores = validarAmuletoMaldito({
      bendiciones: [{ condicion: 'fuerza_letall' }],
      maldiciones: [{ condicion: 'carisma' }],
    });

    expect(errores).toHaveLength(2);
    expect(errores[0]).toContain('"fuerza_letall" no existe');
    expect(errores[1]).toContain('es de categoría "bendicion" y aquí debe ser "maldicion"');
  });

  it('cada resultado necesita una condición o un evento, no las dos cosas ni ninguna', () => {
    const errores = validarAmuletoMaldito({
      bendiciones: [{ condicion: 'carisma', evento: 'deseo' }],
      maldiciones: [{}],
    });

    expect(errores).toHaveLength(2);
    expect(errores.every(e => e.includes('uno de los dos'))).toBe(true);
  });

  it('avisa de listas vacías o que faltan', () => {
    expect(validarAmuletoMaldito({ bendiciones: [] })).toHaveLength(2);
  });

  it('revisa los efectos de "alRecibir" y los campos que sobran', () => {
    const errores = validarAmuletoMaldito({
      bendiciones: [{ condicion: 'carisma', alRecibir: [{ tipo: 'oroo', cantidad: 5 }], nombre: 'Carisma' }],
      maldiciones: [{ condicion: 'hedor_nauseabundo' }],
    });

    expect(errores).toHaveLength(2);
    expect(errores.some(e => e.includes('"nombre" sobra'))).toBe(true);
    expect(errores.some(e => e.includes('"oroo" no existe'))).toBe(true);
  });

  it('todas las condiciones de las tablas tienen su ficha en el catálogo', () => {
    const ids = [...AMULETO_MALDITO.bendiciones, ...AMULETO_MALDITO.maldiciones].flatMap(r => (r.condicion ? [r.condicion] : []));

    expect(ids.every(id => CONDICIONES.some(c => c.id === id))).toBe(true);
  });
});

describe('"el maldito" empieza con su amuleto', () => {
  it('la partida empieza con el amuleto puesto, con lo que tocó dentro', () => {
    const { estado } = crearPartida(MALDITO_CARISMA_Y_AMBICION, 'Marta');

    expect(estado.jugador.sobrenombre).toBe('el_maldito');
    expect(estado.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['carisma', 'ambicion_desmedida'] }]);
    expect(maximoSeguidoresActual(estado.jugador)).toBe(4);
    expect(famaObjetivoActual(estado.jugador)).toBe(12);
  });

  it('si le toca el deseo, sale como evento pendiente al empezar', () => {
    const partida = crearPartida(MALDITO_DESEO_Y_HEDOR, 'Marta');

    expect(partida.eventos).toEqual(['deseo']);
    expect(partida.estado.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['hedor_nauseabundo'] }]);
  });

  it('los demás sobrenombres empiezan sin amuleto y sin eventos pendientes', () => {
    for (let semilla = 1; semilla <= 60; semilla++) {
      const partida = crearPartida(semilla, 'Marta');
      if (partida.estado.jugador.sobrenombre !== 'el_maldito') {
        expect(partida.estado.jugador.condiciones).toEqual([]);
        expect(partida.eventos).toEqual([]);
      }
    }
  });

  it('con la misma semilla sale siempre el mismo amuleto, y estadoDados continúa la secuencia', () => {
    const a = crearPartida(MALDITO_FORTALEZA_Y_ODIO, 'Marta');
    const b = crearPartida(MALDITO_FORTALEZA_Y_ODIO, 'Marta');
    const recuperado = new Dados(a.estado.mundo.estadoDados);

    expect(a.estado).toEqual(b.estado);
    expect(recuperado.tirar('2d6')).toEqual(a.dados.tirar('2d6'));
  });

  it('de principio a fin: empieza fuerte y sin oro, gana menos oro, y en el monasterio vuelve todo a lo normal', () => {
    // Gran fortaleza + odio al dinero.
    const { estado: inicial, dados } = crearPartida(MALDITO_FORTALEZA_Y_ODIO, 'Marta');
    expect(inicial.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['gran_fortaleza', 'odio_al_dinero'] }]);
    expect(inicial.jugador.vida).toBe(19);
    expect(inicial.jugador.oro).toBe(0);

    // Gana 30 de oro: le llega 1d6 menos.
    const conOro = aplicarEfectos(inicial, [{ tipo: 'oro', cantidad: 30 }], dados).estado;
    expect(conOro.jugador.oro).toBeGreaterThanOrEqual(24);
    expect(conOro.jugador.oro).toBeLessThan(30);

    // "Rezar" en el monasterio: quita una maldición, y se lleva el amuleto entero.
    const { estado: libre, cambios } = aplicarEfectos(conOro, [QUITAR_UNA_MALDICION], dados);
    expect(libre.jugador.condiciones).toEqual([]);
    expect(libre.jugador.vida).toBe(15);
    expect(vidaMaxActual(libre.jugador)).toBe(15);
    expect(cambios.map(c => c.tipo)).toEqual(['condicion_quitada', 'recurso']);

    // Ya sin odio al dinero, gana el oro entero.
    const despues = aplicarEfectos(libre, [{ tipo: 'oro', cantidad: 30 }], dados).estado;
    expect(despues.jugador.oro).toBe(libre.jugador.oro + 30);
    expect(estaProhibido(despues.jugador, 'nuevos_seguidores')).toBe(false);
  });
});
