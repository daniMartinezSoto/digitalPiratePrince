import type { Condicion } from '../catalogos/condicion';
import { OBJETOS } from '../catalogos/cargar-objetos';
import { atacar } from '../combate/combate';
import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import {
  abordar,
  cerrarCombateNaval,
  disparar,
  huirDelCombateNaval,
  iniciarCombateNaval,
  opcionesDeCombateNaval,
  resistenciaParaAbordar,
} from './combate-naval';

// Partida de prueba: sobrenombre sin efectos, 15 PV, 40 de tripulación, 50 de oro, 5 de comida, sin seguidores.
function partida(cambios: Partial<Estado['jugador']> = {}): Estado {
  const { estado } = crearPartida(1, 'Ana');
  return {
    ...estado,
    jugador: {
      ...estado.jugador,
      sobrenombre: 'el_conformista', vida: 15, vidaMax: 15, tripulacion: 40, tripulacionMax: 40, oro: 50, comida: 5, fama: 0,
      seguidores: [], condiciones: [], diasSinComer: 0, ...cambios,
    },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

function contra(idBarco: string, cambios: Partial<Estado['jugador']> = {}): Estado {
  return iniciarCombateNaval(partida(cambios), idBarco, dadosTrucados([]));
}

// El combate naval con la resistencia del barco cambiada (para no tener que disparar hasta ahí).
function conResistencia(estado: Estado, resistencia: number): Estado {
  return { ...estado, mundo: { ...estado.mundo, combateNaval: { ...estado.mundo.combateNaval!, resistencia } } };
}

// Un combate naval tras una ronda de disparos ganada (ya se puede intentar huir).
function trasUnaRonda(idBarco = 'fragata_de_la_marina'): Estado {
  return disparar(contra(idBarco), dadosTrucados([5, 2])).estado;
}

// Un abordaje que ya ha terminado así (atajo: los enemigos caen sin jugar las rondas).
function abordajeTerminado(idBarco: string, resultado: 'victoria' | 'derrota', cambios: Partial<Estado['jugador']> = {}): Estado {
  const abordado = abordar(conResistencia(contra(idBarco, cambios), 1), new Dados(3));
  const combate = abordado.mundo.combate!;
  return {
    ...abordado,
    mundo: { ...abordado.mundo, combate: { ...combate, enemigos: combate.enemigos.map(e => ({ ...e, resistencia: resultado === 'victoria' ? 0 : e.resistencia })), resultado } },
  };
}

function seguidor(id: string): Seguidor {
  return { id, tipo: id.replace(/_\d+$/, ''), nombre: `Nombre de ${id}`, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
}

// Una condición de prueba con bonificador (como serán las mejoras del barco).
function condicion(id: string, modificadores: Condicion['modificadores']): Condicion {
  return { id, nombre: id, descripcion: 'De prueba.', categoria: 'otra', modificadores };
}

describe('huir del combate naval', () => {
  it('no se puede en la primera ronda', () => {
    const estado = contra('fragata_de_la_marina');

    expect(opcionesDeCombateNaval(estado).huir).toEqual({ disponible: false, motivo: 'primera_ronda' });
    expect(() => huirDelCombateNaval(estado, dadosTrucados([6]))).toThrow(/ahora no se puede huir \(primera_ronda\)/);
  });

  it('con 3-6 huyes; al cerrar salta el daño en la bodega (E006)', () => {
    const intento = huirDelCombateNaval(trasUnaRonda(), dadosTrucados([3]));

    expect(intento).toMatchObject({ dado: 3, bonificador: 0, total: 3, huye: true });
    expect(intento.estado.mundo.combateNaval!.resultado).toBe('huida');

    const cierre = cerrarCombateNaval(intento.estado, dadosTrucados([]));
    expect(cierre.resultado).toBe('huida');
    expect(cierre.eventos).toEqual(['dano_en_la_bodega']);
    expect(cierre.resumen).toMatchObject({ resultado: 'huida', forma: null, eventos: ['dano_en_la_bodega'] });
    expect(cierre.estado.mundo.combateNaval).toBeNull();
  });

  it('con 1-2 no pasa nada más, pero hay que disparar otra ronda antes de volver a intentarlo', () => {
    const intento = huirDelCombateNaval(trasUnaRonda(), dadosTrucados([2]));

    expect(intento.huye).toBe(false);
    expect(intento.estado.jugador.tripulacion).toBe(40);
    expect(intento.estado.mundo.combateNaval!.resultado).toBeNull();
    expect(opcionesDeCombateNaval(intento.estado).huir).toEqual({ disponible: false, motivo: 'acabas_de_fallar' });
    expect(() => huirDelCombateNaval(intento.estado, dadosTrucados([6]))).toThrow(/acabas_de_fallar/);

    const otraRonda = disparar(intento.estado, dadosTrucados([1, 4])).estado;
    expect(opcionesDeCombateNaval(otraRonda).huir).toEqual({ disponible: true });
  });

  it('suma los bonificadores de "huida_naval" (una futura mejora: velas nuevas)', () => {
    const catalogos = { objetos: OBJETOS, condiciones: [condicion('velas_de_prueba', { huida_naval: 1 })] };
    const estado = disparar(contra('fragata_de_la_marina', { condiciones: [{ id: 'velas_de_prueba' }] }), dadosTrucados([5, 2]), catalogos).estado;

    const intento = huirDelCombateNaval(estado, dadosTrucados([2]), catalogos);

    expect(intento).toMatchObject({ dado: 2, bonificador: 1, total: 3, huye: true });
  });
});

describe('abordar', () => {
  it('se puede con la resistencia a la mitad, redondeando hacia arriba', () => {
    expect(resistenciaParaAbordar(5)).toBe(3);
    expect(resistenciaParaAbordar(6)).toBe(3);
    expect(resistenciaParaAbordar(4)).toBe(2);
    expect(resistenciaParaAbordar(1)).toBe(1);
  });

  it('con más de la mitad, el botón sale desactivado y dice a partir de cuándo se podrá', () => {
    const estado = contra('fragata_de_la_marina');

    expect(opcionesDeCombateNaval(estado).abordar).toEqual({ disponible: false, motivo: 'resistencia_alta', resistenciaParaAbordar: 2 });
    expect(() => abordar(estado, new Dados(1))).toThrow(/ahora no se puede abordar \(resistencia_alta\)/);
    expect(opcionesDeCombateNaval(conResistencia(estado, 2)).abordar).toEqual({ disponible: true, resistenciaParaAbordar: 2 });
  });

  it('la chalupa (resistencia 1) se puede abordar desde el principio', () => {
    expect(opcionesDeCombateNaval(contra('chalupa_de_pescadores')).abordar.disponible).toBe(true);
  });

  it('empieza un combate normal contra su tripulación, del que no se puede huir', () => {
    // Uno contra dos pescadores: el jugador se empareja con el primero (un número del sorteo).
    const estado = abordar(contra('chalupa_de_pescadores'), dadosTrucados([0]));

    expect(estado.mundo.combate!.enemigos.map(e => e.nombre)).toEqual(['Pescador 1', 'Pescador 2']);
    expect(estado.mundo.combate!.puedeHuir).toBe(false);
    expect(estado.mundo.combateNaval!.abordaje).toEqual({ vida: 15, seguidores: [] });
  });

  it('mientras se aborda, no se puede disparar ni huir, y no se puede cerrar hasta que acabe', () => {
    const estado = abordar(contra('chalupa_de_pescadores'), dadosTrucados([0]));

    expect(opcionesDeCombateNaval(estado)).toEqual({
      disparar: false,
      huir: { disponible: false, motivo: 'abordaje_en_curso' },
      abordar: { disponible: false, motivo: 'abordaje_en_curso', resistenciaParaAbordar: 1 },
    });
    expect(() => disparar(estado, dadosTrucados([6, 1]))).toThrow(/se está abordando el barco/);
    expect(() => cerrarCombateNaval(estado, dadosTrucados([]))).toThrow(/el abordaje todavía no ha terminado/);
  });

  it('se pelea con el combate normal y, al ganarlo, victoria abordando con su botín (la chalupa: +1d6 comida)', () => {
    // Todo doses: tú aciertas siempre 2 de daño y los pescadores (1-2 fallan) nunca te dan.
    let estado = abordar(contra('chalupa_de_pescadores'), dadosTrucados([0]));
    const dados = dadosTrucados(Array(40).fill(2));
    while (!estado.mundo.combate!.resultado) {
      estado = atacar(estado, dados).estado;
    }
    expect(estado.mundo.combate!.resultado).toBe('victoria');

    // 4 = la comida del botín; 100 = no hay fiesta.
    const cierre = cerrarCombateNaval(estado, dadosTrucados([4, 100]));

    expect(cierre.resultado).toBe('victoria');
    expect(cierre.estado.mundo.combate).toBeNull();
    expect(cierre.estado.mundo.combateNaval).toBeNull();
    expect(cierre.estado.jugador.comida).toBe(9);
    expect(cierre.resumen).toEqual({
      barco: 'chalupa_de_pescadores',
      nombre: 'Chalupa de pescadores',
      resultado: 'victoria',
      forma: 'abordado',
      tripulacionPerdida: 0,
      vidaPerdida: 0,
      seguidoresCaidos: [],
      oroGanado: 0,
      famaGanada: 0,
      comidaGanada: 4,
      eventos: [],
    });
  });

  it('el resumen cuenta lo que costó el abordaje: vida perdida y seguidores caídos', () => {
    const forzudo = seguidor('forzudo_1');
    const terminado = abordajeTerminado('fragata_de_la_marina', 'victoria', { seguidores: [forzudo] });
    // Lo que pasó en la cubierta: el jugador perdió 6 PV y el forzudo cayó.
    const tras: Estado = { ...terminado, jugador: { ...terminado.jugador, vida: 9, seguidores: [] } };

    const { resumen } = cerrarCombateNaval(tras, new Dados(5));

    expect(resumen.forma).toBe('abordado');
    expect(resumen.vidaPerdida).toBe(6);
    expect(resumen.seguidoresCaidos).toEqual([{ id: 'forzudo_1', nombre: 'Nombre de forzudo_1' }]);
    expect(resumen.famaGanada).toBe(1);
    // 2d6x10 de la recompensa + 1d6x10 del botín: entre 30 y 180.
    expect(resumen.oroGanado).toBeGreaterThanOrEqual(30);
    expect(resumen.oroGanado).toBeLessThanOrEqual(180);
    expect(resumen.eventos[0]).toBe('cofre');
  });

  it('abordando, la tirada de tesoro (el fantasma: 50 %): con 50 o menos sale, con 51 no', () => {
    const conTesoro = cerrarCombateNaval(abordajeTerminado('barco_fantasma', 'victoria'), dadosTrucados([50, 100]));
    const sinTesoro = cerrarCombateNaval(abordajeTerminado('barco_fantasma', 'victoria'), dadosTrucados([51, 100]));

    expect(conTesoro.eventos).toEqual(['amuleto_fantasmal', 'tesoro']);
    expect(sinTesoro.eventos).toEqual(['amuleto_fantasmal']);
    expect(conTesoro.resumen.famaGanada).toBe(1);
    expect(conTesoro.resumen.oroGanado).toBe(0);
  });

  it('hundiéndolo a cañonazos no hay botín de abordaje ni tirada de tesoro', () => {
    const hundido = disparar(contra('barco_fantasma'), dadosTrucados([6, 1])).estado;
    const casi = conResistencia(hundido, 1);
    const final = disparar(casi, dadosTrucados([6, 1])).estado;

    const cierre = cerrarCombateNaval(final, dadosTrucados([100]));

    expect(cierre.resumen.forma).toBe('hundido');
    expect(cierre.eventos).toEqual(['amuleto_fantasmal']);
  });

  it('si caes en el abordaje, pierdes la partida: derrota, sin recompensas ni eventos', () => {
    const terminado = abordajeTerminado('fragata_de_la_marina', 'derrota');
    const muerto: Estado = {
      ...terminado,
      jugador: { ...terminado.jugador, vida: 0 },
      mundo: { ...terminado.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } },
    };

    const cierre = cerrarCombateNaval(muerto, dadosTrucados([]));

    expect(cierre.resultado).toBe('derrota');
    expect(cierre.resumen).toMatchObject({ resultado: 'derrota', forma: null, vidaPerdida: 15, eventos: [] });
    expect(cierre.cambios).toEqual([]);
    expect(cierre.estado.mundo.combate).toBeNull();
    expect(cierre.estado.mundo.combateNaval).toBeNull();
  });
});

describe('velas nuevas (mejora del barco)', () => {
  it('+1 al dado de huida: con un 2 también huyes', () => {
    const estado = disparar(contra('fragata_de_la_marina', { condiciones: [{ id: 'velas_nuevas' }] }), dadosTrucados([5, 2])).estado;

    expect(huirDelCombateNaval(estado, dadosTrucados([2]))).toMatchObject({ dado: 2, bonificador: 1, total: 3, huye: true });
  });
});
