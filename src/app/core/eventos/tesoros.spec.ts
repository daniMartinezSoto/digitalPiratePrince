import { capacidadInventarioActual, espaciosLibres, motivoParaNoSoltar, objetosUsablesAhora } from '../objetos/consultas';
import { usarObjeto } from '../objetos/usar-objeto';
import { motivoParaNoReparar, reparar } from '../acciones/reparar';
import { accionesDisponibles } from '../acciones/acciones-disponibles';
import type { Sitio } from '../acciones/accion';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { crearPersonaje } from '../personaje/crear-personaje';
import { continuarEvento, lanzarEventos, tirarDadosDelEvento, vistaDelEvento } from './motor';
import sobrenombres from '../../data/personaje/sobrenombres.json';
import { AMULETO_MALDITO } from '../amuleto-maldito/cargar-amuleto-maldito';

// Sprint 12, bloque 1 (tesoros): cofre (E021), tesoro (E036), tesoro mágico (E037), trampa (E029),
// maldición (E022) y amuleto maldito (E027), con los eventos reales de data/eventos/ y el motor.
// Y los objetos nuevos que piden: la mochila sin fondo, el loro, el kit, el anillo... y el heredero.

function hermano(): Seguidor {
  return { id: 'hermano', tipo: 'forzudo', nombre: 'Hermano', ataque: 3, resistencia: 10, resistenciaMaxima: 10, habilidades: [], inseparable: true, vital: true };
}

function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: {
      ...estado.jugador,
      sobrenombre: 'el_fuerte',
      fuerza: 3,
      ingenio: 3,
      vida: 10,
      vidaMax: 18,
      oro: 50,
      fama: 0,
      comida: 5,
      tripulacion: 20,
      tripulacionMax: 40,
      inventario: [],
      seguidores: [],
      condiciones: [],
      ...cambios,
    },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

/** Lanza el evento y tira su dado con el resultado trucado (como la trampa "fijar la próxima tirada"). */
function tirar(id: string, sale: number, estado = estadoCon()) {
  const dados = new Dados(1);
  const lanzado = lanzarEventos(estado, [id], dados).estado;
  return tirarDadosDelEvento(lanzado, dados, { resultadoTrucado: sale });
}

describe('el tesoro (E036) y la muy mala suerte', () => {
  it('sin mala suerte, un 5 es la bomba de humo', () => {
    const r = tirar('tesoro', 5);
    expect(r.estado.jugador.inventario.map(o => o.id)).toEqual(['bomba_de_humo']);
  });

  it('con muy mala suerte la tirada lleva −3: un 8 se queda en 5', () => {
    const r = tirar('tesoro', 8, estadoCon({ condiciones: [{ id: 'muy_mala_suerte' }] }));
    expect(vistaDelEvento(r.estado)!.lectura!.tirada).toMatchObject({ modificador: -3, total: 5 });
    expect(r.estado.jugador.inventario.map(o => o.id)).toEqual(['bomba_de_humo']);
  });

  it('con muy mala suerte, si queda por debajo de 1 salta la trampa (E029)', () => {
    const r = tirar('tesoro', 3, estadoCon({ condiciones: [{ id: 'muy_mala_suerte' }] }));
    const siguiente = continuarEvento(r.estado, new Dados(1));
    expect(vistaDelEvento(siguiente.estado)!.titulo).toBe('Trampa');
  });

  it('un 9-10 da uno de los objetos del emporio de Bob, directamente', () => {
    const r = tirar('tesoro', 9);
    const bob = ['medicina', 'bigote_falso', 'loro_parlante', 'ron', 'kit_de_reparaciones', 'ropajes_caros', 'ropajes_de_pirata', 'biblia', 'red_de_pesca', 'perfume'];
    expect(r.estado.jugador.inventario).toHaveLength(1);
    expect(bob).toContain(r.estado.jugador.inventario[0].id);
  });
});

describe('el tesoro mágico (E037)', () => {
  it('es 2d6 y el 12 es la lira: +2 de fama en total', () => {
    const r = tirar('tesoro_magico', 12);
    expect(r.estado.jugador.inventario.map(o => o.id)).toEqual(['lira_de_las_sirenas']);
    expect(r.estado.jugador.fama).toBe(2);
  });

  it('el ídolo y la lira son únicos: si ya la tienes, el 12 cuenta como el 11 (anillo); si ya tienes el ídolo, el 3 como el 4 (poción)', () => {
    const conLira = tirar('tesoro_magico', 12, estadoCon({ inventario: [{ id: 'lira_de_las_sirenas' }] }));
    expect(conLira.estado.jugador.inventario.map(o => o.id)).toEqual(['lira_de_las_sirenas', 'anillo_de_los_deseos']);
    const conIdolo = tirar('tesoro_magico', 3, estadoCon({ inventario: [{ id: 'idolo_antediluviano' }] }));
    expect(conIdolo.estado.jugador.inventario.map(o => o.id)).toEqual(['idolo_antediluviano', 'pocion_magica']);
  });

  it('la medicina y el ungüento no se pueden usar con la vida llena', () => {
    const lleno = estadoCon({ vida: 18, inventario: [{ id: 'medicina', usosRestantes: 1 }] });
    expect(objetosUsablesAhora(lleno)).toEqual([]);
    expect(objetosUsablesAhora({ ...lleno, jugador: { ...lleno.jugador, vida: 10 } })).toEqual([0]);
  });

  it('la mochila sin fondo no se puede tirar ni vender si sin ella no cabe lo demás', () => {
    const muchos = ['ron', 'ron', 'ron', 'ron', 'ron', 'ron', 'ron'].map(id => ({ id, usosRestantes: 1 }));
    const jugador = estadoCon({ inventario: [{ id: 'mochila_sin_fondo' }, ...muchos] }).jugador;
    expect(motivoParaNoSoltar(jugador, 0)).toBe('mochila_llena');
    expect(motivoParaNoSoltar(jugador, 1)).toBeUndefined();
    const pocos = estadoCon({ inventario: [{ id: 'mochila_sin_fondo' }, { id: 'ron', usosRestantes: 1 }] }).jugador;
    expect(motivoParaNoSoltar(pocos, 0)).toBeUndefined();
  });

  it('el 5 da el punto de fama de objeto mágico y lleva al amuleto maldito', () => {
    const r = tirar('tesoro_magico', 5);
    expect(r.estado.jugador.fama).toBe(1);
    expect(vistaDelEvento(continuarEvento(r.estado, new Dados(1)).estado)!.titulo).toBe('Amuleto maldito');
  });
});

describe('el amuleto maldito (E027)', () => {
  it('se tiran 2d6 a la vista: el primer dado es la bendición y el segundo la maldición', () => {
    const dados = new Dados(4);
    const salido = lanzarEventos(estadoCon(), ['amuleto_maldito'], dados).estado;
    expect(vistaDelEvento(salido)!.tirada).toMatchObject({ dado: '2d6' });
    const r = tirarDadosDelEvento(salido, dados);
    const [b, m] = vistaDelEvento(r.estado)!.lectura!.tirada!.dados;
    const amuleto = r.estado.jugador.condiciones.find(c => c.id === 'amuleto_maldito')!;
    const esperadas = [AMULETO_MALDITO.bendiciones[b - 1], AMULETO_MALDITO.maldiciones[m - 1]].flatMap(x => (x.condicion ? [x.condicion] : []));
    expect(amuleto.partes).toEqual(esperadas);
  });
});

describe('el 2 del tesoro mágico: "pensabas que era mágico, pero no"', () => {
  it('lleva al tesoro normal, que se tira solo y no enseña la tirada', () => {
    const r = tirar('tesoro_magico', 2);
    expect(r.estado.jugador.inventario).toEqual([]); // aún no: primero se lee el "uy..."
    const tesoro = continuarEvento(r.estado, new Dados(1));
    const vista = vistaDelEvento(tesoro.estado)!;
    expect(vista.titulo).toBe('Tesoro');
    expect(vista.modo).not.toBe('tirada'); // no hay botón de tirar
    expect(vista.lectura!.tirada).toBeUndefined(); // ni dados a la vista
    expect(vista.lectura!.texto).toBeTruthy(); // pero sí lo que ha tocado
  });
});

describe('la maldición (E022)', () => {
  it('el 1 es el maleficio del pirata, con +2 de fama', () => {
    const r = tirar('maldicion', 1);
    expect(r.estado.jugador.condiciones.map(c => c.id)).toEqual(['maleficio_del_pirata']);
    expect(r.estado.jugador.fama).toBe(2);
  });

  it('si ya tienes el maleficio del pirata, el 1 cuenta como el 2 (maleficio del oro)', () => {
    const r = tirar('maldicion', 1, estadoCon({ condiciones: [{ id: 'maleficio_del_pirata' }] }));
    expect(r.estado.jugador.oro).toBe(0);
    expect(r.estado.jugador.fama).toBe(0);
  });

  it('el 4 te deja con 5 de tripulación como mucho (si tienes 3, sigues con 3)', () => {
    expect(tirar('maldicion', 4).estado.jugador.tripulacion).toBe(5);
    expect(tirar('maldicion', 4, estadoCon({ tripulacion: 3 })).estado.jugador.tripulacion).toBe(3);
  });

  it('el 5 es el maleficio del tonto: −1 de ingenio que dura (se cura en el monasterio)', () => {
    const r = tirar('maldicion', 5);
    expect(r.estado.jugador.condiciones.map(c => c.id)).toEqual(['maleficio_del_tonto']);
  });
});

describe('la trampa (E029)', () => {
  it('el 3: −3 de vida y −3 de comida, sin perder turnos', () => {
    const r = tirar('trampa', 3);
    expect(r.estado.jugador).toMatchObject({ vida: 7, comida: 2, fasesAccionPerdidas: 0 });
  });

  it('el 2 mata a un seguidor al azar: si es el hermano, pierdes la partida', () => {
    const r = tirar('trampa', 2, estadoCon({ seguidores: [hermano()] }));
    expect(r.estado.mundo.finPartida).toMatchObject({ resultado: 'derrota' });
  });
});

describe('los objetos nuevos', () => {
  const dados = () => new Dados(3);

  it('el inventario tiene 6 huecos, y la mochila sin fondo (que no ocupa) da 4 más', () => {
    const estado = estadoCon();
    expect(capacidadInventarioActual(estado.jugador)).toBe(6);
    const conMochila = aplicarEfectos(estado, [{ tipo: 'ganar_objeto', objeto: 'mochila_sin_fondo' }], dados()).estado;
    expect(capacidadInventarioActual(conMochila.jugador)).toBe(10);
    expect(espaciosLibres(conMochila.jugador)).toBe(10);
  });

  it('el loro da +1 de fama mientras lo llevas y se pierde al venderlo', () => {
    const conLoro = aplicarEfectos(estadoCon(), [{ tipo: 'ganar_objeto', objeto: 'loro_parlante' }], dados()).estado;
    expect(conLoro.jugador.fama).toBe(1);
    expect(aplicarEfectos(conLoro, [{ tipo: 'vender_objeto', posicion: 0 }], dados()).estado.jugador.fama).toBe(0);
  });

  it('el kit da la acción Reparar el barco: gasta la acción, +1d6 de tripulación y espera 3 días', () => {
    const sitio: Sitio = { lugar: 'barco' };
    expect(motivoParaNoReparar(estadoCon(), sitio)).toEqual({ motivo: 'sin_kit' });

    const estado = estadoCon({ inventario: [{ id: 'kit_de_reparaciones' }] });
    expect(objetosUsablesAhora(estado)).toEqual([]); // no es un objeto que se usa
    expect(accionesDisponibles(estado, sitio).find(a => a.accion === 'reparar')).toEqual({ accion: 'reparar', disponible: true });
    expect(motivoParaNoReparar(estado, { lugar: 'puerto' })).toEqual({ motivo: 'solo_a_bordo' }); // el barco se repara a bordo

    const r = reparar(estado, sitio, dados());
    expect(r.estado.jugador.tripulacion).toBe(20 + r.tirada!.total);
    expect(r.estado.mundo.fase).not.toBe('accion'); // ha gastado la acción del día
    const manana = { ...r.estado, mundo: { ...r.estado.mundo, fase: 'accion' as const, dia: estado.mundo.dia + 1 } };
    expect(motivoParaNoReparar(manana, sitio)).toEqual({ motivo: 'espera', faltanDias: 2 });
    const tresDiasDespues = { ...manana, mundo: { ...manana.mundo, dia: estado.mundo.dia + 3 } };
    expect(motivoParaNoReparar(tresDiasDespues, sitio)).toBeUndefined();
  });

  it('la biblia solo se puede usar con alguna maldición (si no, no se gasta)', () => {
    const sinMaldicion = estadoCon({ inventario: [{ id: 'biblia', usosRestantes: 1 }] });
    expect(objetosUsablesAhora(sinMaldicion)).toEqual([]);
    expect(() => usarObjeto(sinMaldicion, 0, dados())).toThrow(/maldicion/);

    const maldito = estadoCon({ inventario: [{ id: 'biblia', usosRestantes: 1 }], condiciones: [{ id: 'maleficio_del_pirata' }] });
    expect(objetosUsablesAhora(maldito)).toEqual([0]);
    const usado = usarObjeto(maldito, 0, dados()).estado;
    expect(usado.jugador.condiciones).toEqual([]);
    expect(usado.jugador.inventario).toEqual([]);
  });

  it('el anillo de los deseos lanza el deseo y se gasta', () => {
    const r = usarObjeto(estadoCon({ inventario: [{ id: 'anillo_de_los_deseos', usosRestantes: 1 }] }), 0, dados());
    expect(r.eventos).toEqual(['deseo']);
    expect(r.estado.jugador.inventario).toEqual([]);
  });

  it('el heredero empieza con un objeto de su lista y sin fama', () => {
    const lista = (sobrenombres.find(s => s.id === 'el_heredero') as { objetoInicialEntre?: string[] }).objetoInicialEntre!;
    const herederos = Array.from({ length: 300 }, (_, i) => crearPersonaje('Prueba', new Dados(i + 1))).filter(j => j.sobrenombre === 'el_heredero');
    expect(herederos.length).toBeGreaterThan(0);
    for (const j of herederos) {
      expect(j.inventario).toHaveLength(1);
      expect(lista).toContain(j.inventario[0].id);
      expect(j.fama).toBe(0);
    }
    expect(lista).not.toContain('idolo_antediluviano');
    expect(lista).not.toContain('anillo_de_los_deseos');
  });
});
