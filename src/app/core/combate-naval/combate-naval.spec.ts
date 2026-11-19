import { comprobarQueSePuedeActuar } from '../acciones/accion';
import { accionesDisponibles } from '../acciones/acciones-disponibles';
import type { Condicion } from '../catalogos/condicion';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import { iniciarCombate } from '../combate/combate';
import { hayCombate } from '../combate/hay-combate';
import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import type { ResultadoCombateNaval } from '../estado/combate-naval';
import type { Estado } from '../estado/estado';
import { crearPartida } from '../partida/crear-partida';
import { comer } from '../turno/comer';
import { cerrarCombateNaval, disparar, iniciarCombateNaval } from './combate-naval';

// Partida de prueba: sobrenombre sin efectos, 40 de tripulación, 50 de oro, sin seguidores ni condiciones.
function partida(cambios: Partial<Estado['jugador']> = {}): Estado {
  const { estado } = crearPartida(1, 'Ana');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_conformista', tripulacion: 40, tripulacionMax: 40, oro: 50, fama: 0, seguidores: [], condiciones: [], ...cambios },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

// Un combate naval ya empezado contra un barco de daño fijo (no gasta dados).
function contra(idBarco: string, cambios: Partial<Estado['jugador']> = {}): Estado {
  return iniciarCombateNaval(partida(cambios), idBarco, dadosTrucados([]));
}

// Atajo para los tests de cerrar: un combate naval que ya ha terminado así.
function terminado(idBarco: string, resultado: ResultadoCombateNaval, tripulacionPerdida = 0): Estado {
  const estado = contra(idBarco);
  return { ...estado, mundo: { ...estado.mundo, combateNaval: { ...estado.mundo.combateNaval!, resistencia: 0, tripulacionPerdida, resultado } } };
}

describe('iniciarCombateNaval', () => {
  it('copia del catálogo el barco: nombre, daño y resistencia; sin gastar dados si el daño es fijo', () => {
    const dados = dadosTrucados([]);
    const estado = iniciarCombateNaval(partida(), 'fragata_de_la_marina', dados);

    expect(estado.mundo.combateNaval).toEqual({
      barco: 'fragata_de_la_marina',
      nombre: 'Fragata de la marina',
      dano: 4,
      resistencia: 4,
      resistenciaMaxima: 4,
      ronda: 0,
      tripulacionPerdida: 0,
      acabasDeFallarLaHuida: false,
      abordaje: null,
      resultado: null,
    });
    expect(dados.restantes()).toBe(0);
  });

  it('el daño con dados (el barco pirata, "1d6") se tira una vez al empezar', () => {
    const estado = iniciarCombateNaval(partida(), 'barco_pirata_hostil', dadosTrucados([5]));

    expect(estado.mundo.combateNaval!.dano).toBe(5);
  });

  it('avisa si el barco no existe', () => {
    expect(() => iniciarCombateNaval(partida(), 'barco_de_bob', dadosTrucados([]))).toThrow(/no existe el barco "barco_de_bob"/);
  });

  it('no se puede empezar con otro combate en marcha, naval o normal, ni con la partida terminada', () => {
    expect(() => iniciarCombateNaval(contra('barco_negrero'), 'fragata_de_la_marina', dadosTrucados([]))).toThrow(/ya hay un combate en curso/);
    const conJaguar = iniciarCombate(partida(), [{ enemigo: 'jaguar' }], dadosTrucados([]));
    expect(() => iniciarCombateNaval(conJaguar, 'barco_negrero', dadosTrucados([]))).toThrow(/ya hay un combate en curso/);
    const acabada: Estado = { ...partida(), mundo: { ...partida().mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };
    expect(() => iniciarCombateNaval(acabada, 'barco_negrero', dadosTrucados([]))).toThrow(/la partida ya ha terminado/);
  });
});

describe('disparar (duelo de cañones)', () => {
  it('si sacas más, el barco pierde 1 de resistencia y tú no pierdes nada', () => {
    const { estado, duelo, cambios } = disparar(contra('fragata_de_la_marina'), dadosTrucados([5, 2]));

    expect(duelo).toEqual({ tiradas: [{ tuDado: 5, bonificador: 0, total: 5, suDado: 2 }], ganador: 'jugador', danoAlBarco: 1, reduccionCasco: 0, tripulacionPerdida: 0 });
    expect(estado.mundo.combateNaval!.resistencia).toBe(3);
    expect(estado.mundo.combateNaval!.ronda).toBe(1);
    expect(estado.jugador.tripulacion).toBe(40);
    expect(cambios).toEqual([]);
  });

  it('si sacas menos, pierdes tanta tripulación como su daño', () => {
    const { estado, duelo, cambios } = disparar(contra('fragata_de_la_marina'), dadosTrucados([2, 5]));

    expect(duelo.ganador).toBe('barco');
    expect(duelo.tripulacionPerdida).toBe(4);
    expect(estado.jugador.tripulacion).toBe(36);
    expect(estado.mundo.combateNaval!.resistencia).toBe(4);
    expect(estado.mundo.combateNaval!.tripulacionPerdida).toBe(4);
    expect(cambios).toEqual([{ tipo: 'recurso', recurso: 'tripulacion', antes: 40, despues: 36 }]);
  });

  it('la tripulación perdida se va sumando ronda a ronda', () => {
    const primera = disparar(contra('fragata_de_la_marina'), dadosTrucados([1, 2])).estado;
    const segunda = disparar(primera, dadosTrucados([3, 6])).estado;

    expect(segunda.mundo.combateNaval!.tripulacionPerdida).toBe(8);
    expect(segunda.mundo.combateNaval!.ronda).toBe(2);
  });

  it('los empates se repiten en la misma ronda (y se guardan para enseñarlos)', () => {
    const dados = dadosTrucados([3, 3, 6, 6, 2, 4]);
    const { estado, duelo } = disparar(contra('fragata_de_la_marina'), dados);

    expect(duelo.tiradas.map(t => [t.total, t.suDado])).toEqual([[3, 3], [6, 6], [2, 4]]);
    expect(duelo.ganador).toBe('barco');
    expect(estado.mundo.combateNaval!.ronda).toBe(1);
    expect(dados.restantes()).toBe(0);
  });

  it('suma tus bonificadores de "disparo_naval" (una futura mejora: cañones +1)', () => {
    const canones: Condicion = { id: 'canones_de_prueba', nombre: 'Cañones', descripcion: '+1 al disparo.', categoria: 'otra', modificadores: { disparo_naval: 1 } };
    const estado = contra('fragata_de_la_marina', { condiciones: [{ id: 'canones_de_prueba' }] });

    // 3 + 1 = 4 contra 4: empate; después 2 + 1 = 3 contra 2: ganas.
    const { duelo } = disparar(estado, dadosTrucados([3, 4, 2, 2]), { objetos: OBJETOS, condiciones: [canones] });

    expect(duelo.tiradas).toEqual([
      { tuDado: 3, bonificador: 1, total: 4, suDado: 4 },
      { tuDado: 2, bonificador: 1, total: 3, suDado: 2 },
    ]);
    expect(duelo.ganador).toBe('jugador');
  });

  it('al dejar su resistencia a 0 lo hundes: victoria, y ya no se puede disparar', () => {
    const { estado } = disparar(contra('chalupa_de_pescadores'), dadosTrucados([4, 1]));

    expect(estado.mundo.combateNaval!.resistencia).toBe(0);
    expect(estado.mundo.combateNaval!.resultado).toBe('victoria');
    expect(() => disparar(estado, dadosTrucados([6, 1]))).toThrow(/el combate naval ya ha terminado/);
  });

  it('la chalupa (daño 0) no te quita tripulación aunque pierdas el duelo', () => {
    const { estado, duelo, cambios } = disparar(contra('chalupa_de_pescadores'), dadosTrucados([1, 6]));

    expect(duelo.ganador).toBe('barco');
    expect(duelo.tripulacionPerdida).toBe(0);
    expect(estado.jugador.tripulacion).toBe(40);
    expect(cambios).toEqual([]);
  });

  it('si tu tripulación llega a 0, pierdes la partida y el combate queda en derrota', () => {
    const { estado, duelo } = disparar(contra('fragata_de_la_marina', { tripulacion: 3 }), dadosTrucados([1, 6]));

    expect(duelo.tripulacionPerdida).toBe(3);
    expect(estado.jugador.tripulacion).toBe(0);
    expect(estado.mundo.combateNaval!.resultado).toBe('derrota');
    expect(estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'tripulacion' });
  });

  it('sin combate naval, avisa', () => {
    expect(() => disparar(partida(), dadosTrucados([1, 2]))).toThrow(/no hay ningún combate naval en curso/);
  });
});

describe('cerrarCombateNaval', () => {
  it('victoria: cobra la recompensa del barco, devuelve sus eventos y quita el combate', () => {
    const cierre = cerrarCombateNaval(terminado('fragata_de_la_marina', 'victoria', 8), new Dados(7));

    expect(cierre.resultado).toBe('victoria');
    expect(cierre.tripulacionPerdida).toBe(8);
    expect(cierre.eventos).toEqual(['cofre']);
    expect(cierre.estado.mundo.combateNaval).toBeNull();
    expect(cierre.estado.jugador.fama).toBe(1);
    // 2d6x10 de oro: entre 20 y 120 más.
    expect(cierre.estado.jugador.oro).toBeGreaterThanOrEqual(70);
    expect(cierre.estado.jugador.oro).toBeLessThanOrEqual(170);
    expect(cierre.cambios.map(c => (c.tipo === 'recurso' ? c.recurso : c.tipo))).toEqual(['fama', 'oro']);
  });

  it('un evento puede salir repetido: el galeón da dos cofres', () => {
    expect(cerrarCombateNaval(terminado('galeon_del_tesoro', 'victoria'), new Dados(7)).eventos).toEqual(['cofre', 'cofre']);
  });

  it('la chalupa no da nada (salvo una mancha en tu conciencia)', () => {
    const cierre = cerrarCombateNaval(terminado('chalupa_de_pescadores', 'victoria'), dadosTrucados([]));

    expect(cierre.cambios).toEqual([]);
    expect(cierre.eventos).toEqual([]);
  });

  it('si has perdido la partida, ni recompensa ni eventos', () => {
    const perdido = terminado('fragata_de_la_marina', 'derrota', 40);
    const estado: Estado = { ...perdido, mundo: { ...perdido.mundo, finPartida: { resultado: 'derrota', motivo: 'tripulacion' } } };
    const cierre = cerrarCombateNaval(estado, dadosTrucados([]));

    expect(cierre.resultado).toBe('derrota');
    expect(cierre.tripulacionPerdida).toBe(40);
    expect(cierre.cambios).toEqual([]);
    expect(cierre.eventos).toEqual([]);
    expect(cierre.estado.mundo.combateNaval).toBeNull();
  });

  it('avisa si no hay combate naval o si todavía no ha terminado', () => {
    expect(() => cerrarCombateNaval(partida(), dadosTrucados([]))).toThrow(/no hay ningún combate naval/);
    expect(() => cerrarCombateNaval(contra('barco_negrero'), dadosTrucados([]))).toThrow(/todavía no ha terminado/);
  });
});

describe('mientras hay un combate naval, todo lo demás espera', () => {
  it('hayCombate lo detecta', () => {
    expect(hayCombate(partida())).toBe(false);
    expect(hayCombate(contra('barco_negrero'))).toBe(true);
  });

  it('las acciones salen desactivadas con el motivo "combate_en_curso" y no se puede actuar', () => {
    const estado = contra('barco_negrero');
    const acciones = accionesDisponibles(estado, { lugar: 'barco', juntoAlAgua: true });

    expect(acciones.every(a => !a.disponible && a.motivo === 'combate_en_curso')).toBe(true);
    expect(() => comprobarQueSePuedeActuar(estado, 'pescar')).toThrow(/hay un combate en curso/);
  });

  it('no se puede comer hasta terminarlo', () => {
    const estado = contra('barco_negrero');
    const enLaComida: Estado = { ...estado, mundo: { ...estado.mundo, fase: 'comida' } };

    expect(() => comer(enLaComida, 'reservas', 'barco', dadosTrucados([]))).toThrow(/hay un combate en curso/);
  });
});

describe('mejoras del barco (condiciones de la categoría "mejora")', () => {
  it('cañones buenos: +1 a tu dado en el duelo', () => {
    const { duelo } = disparar(contra('fragata_de_la_marina', { condiciones: [{ id: 'canones_buenos' }] }), dadosTrucados([3, 3]));

    expect(duelo.tiradas).toEqual([{ tuDado: 3, bonificador: 1, total: 4, suDado: 3 }]);
    expect(duelo.ganador).toBe('jugador');
  });

  it('casco reforzado: cada duelo perdido cuesta 1 marinero menos', () => {
    const { estado, duelo } = disparar(contra('fragata_de_la_marina', { condiciones: [{ id: 'casco_reforzado' }] }), dadosTrucados([1, 6]));

    expect(duelo.reduccionCasco).toBe(1);
    expect(duelo.tripulacionPerdida).toBe(3);
    expect(estado.jugador.tripulacion).toBe(37);
  });

  it('casco reforzado: si el barco hace daño, siempre pierdes al menos 1; con daño 0, nada', () => {
    const conCasco = { condiciones: [{ id: 'casco_reforzado' }] };
    const debil = { ...contra('barco_negrero', conCasco) };
    const deUno: Estado = { ...debil, mundo: { ...debil.mundo, combateNaval: { ...debil.mundo.combateNaval!, dano: 1 } } };

    expect(disparar(deUno, dadosTrucados([1, 6])).duelo).toMatchObject({ reduccionCasco: 0, tripulacionPerdida: 1 });
    expect(disparar(contra('chalupa_de_pescadores', conCasco), dadosTrucados([1, 6])).duelo).toMatchObject({ reduccionCasco: 0, tripulacionPerdida: 0 });
  });

  it('las mejoras no son maldiciones: rezar no se las lleva (categoría "mejora")', () => {
    const fichas = CONDICIONES.filter(c => ['canones_buenos', 'casco_reforzado', 'velas_nuevas'].includes(c.id));

    expect(fichas.map(c => c.categoria)).toEqual(['mejora', 'mejora', 'mejora']);
  });
});
