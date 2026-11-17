import type { Sitio } from '../acciones/accion';
import { accionesDisponibles } from '../acciones/acciones-disponibles';
import { AJUSTES } from '../ajustes/ajustes';
import { comidaPorDia, vidaMaxActual } from '../condiciones/consultas';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { comer } from '../turno/comer';
import { descansar, opcionesDeDescanso } from '../turno/descansar';
import { descansarEnMonasterio, precioDescansoEnMonasterio, rezar } from './monasterio';

// El monasterio (paso 8 del Sprint 6): rezar (te quita todas las maldiciones) y descansar
// (todo el grupo; 20 de oro + 5 por seguidor; recuperan toda la vida y esa noche duermen allí sin pagar).

const EN_MONASTERIO: Sitio = { lugar: 'monasterio' };

/** Partida del influyente en la fase de acción, con lo que se le cambie. */
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

function seguidor(id: string, resistencia = 10): Seguidor {
  return { id, tipo: 'forzudo', nombre: id, ataque: 3, resistencia, resistenciaMaxima: 10, habilidades: [] };
}

const disponibilidad = (estado: Estado, accion: string) => accionesDisponibles(estado, EN_MONASTERIO).find(a => a.accion === accion);

describe('rezar', () => {
  it('quita TODAS las maldiciones (el amuleto entero también) y deja lo demás', () => {
    const inicial = estadoCon({
      condiciones: [
        { id: 'el_mal' },
        { id: 'escorbuto' },
        { id: 'amuleto_maldito', partes: ['fuerza_letal', 'hambre_insaciable'] },
        { id: 'maleficio_del_pirata' },
      ],
    });
    const { estado, cambios } = rezar(inicial, EN_MONASTERIO, new Dados(1));

    expect(estado.jugador.condiciones).toEqual([{ id: 'escorbuto' }]);
    expect(comidaPorDia(estado.jugador)).toBe(1);
    expect(cambios).toEqual([
      { tipo: 'condicion_quitada', condicion: 'el_mal' },
      { tipo: 'condicion_quitada', condicion: 'amuleto_maldito' },
      { tipo: 'condicion_quitada', condicion: 'maleficio_del_pirata' },
    ]);
  });

  it('al perder el amuleto con gran fortaleza, la vida vuelve a su tope', () => {
    const inicial = estadoCon({ vida: 19, condiciones: [{ id: 'amuleto_maldito', partes: ['gran_fortaleza', 'avaricioso'] }] });
    const { estado } = rezar(inicial, EN_MONASTERIO, new Dados(1));

    expect(estado.jugador.vida).toBe(15);
  });

  it('termina la acción: toca comer', () => {
    const { estado } = rezar(estadoCon({ condiciones: [{ id: 'el_mal' }] }), EN_MONASTERIO, new Dados(1));

    expect(estado.mundo.fase).toBe('comida');
  });

  it('sin maldiciones sale desactivada ("No tienes ninguna maldición") y da error', () => {
    const limpio = estadoCon({ condiciones: [{ id: 'escorbuto' }] });

    expect(disponibilidad(limpio, 'rezar')).toEqual({ accion: 'rezar', disponible: false, motivo: 'sin_maldiciones' });
    expect(() => rezar(limpio, EN_MONASTERIO, new Dados(1))).toThrow(/ninguna maldición/);
  });

  it('con alguna maldición, disponible', () => {
    expect(disponibilidad(estadoCon({ condiciones: [{ id: 'el_mal' }] }), 'rezar')?.disponible).toBe(true);
  });

  it('solo en un monasterio', () => {
    expect(() => rezar(estadoCon({ condiciones: [{ id: 'el_mal' }] }), { lugar: 'puerto' }, new Dados(1))).toThrow(/solo se puede en un monasterio/);
  });
});

describe('descansar en el monasterio (todo el grupo)', () => {
  it('cuesta 20 de oro + 5 por cada seguidor', () => {
    expect(precioDescansoEnMonasterio(estadoCon())).toBe(20);
    expect(precioDescansoEnMonasterio(estadoCon({ seguidores: [seguidor('a'), seguidor('b'), seguidor('c')] }))).toBe(35);
  });

  it('todos recuperan toda la vida, se cobra el precio y toca comer', () => {
    const inicial = estadoCon({ oro: 50, vida: 5, seguidores: [seguidor('a', 3), seguidor('b', 10)] });
    const { estado, cambios } = descansarEnMonasterio(inicial, EN_MONASTERIO, new Dados(1));

    expect(estado.jugador.vida).toBe(15);
    expect(estado.jugador.seguidores.map(s => s.resistencia)).toEqual([10, 10]);
    expect(estado.jugador.oro).toBe(20);
    expect(estado.mundo.fase).toBe('comida');
    expect(cambios).toEqual([
      { tipo: 'recurso', recurso: 'oro', antes: 50, despues: 20 },
      { tipo: 'recurso', recurso: 'vida', antes: 5, despues: 15 },
      { tipo: 'resistencia_seguidor', seguidor: 'a', antes: 3, despues: 10 },
    ]);
  });

  it('basta con que esté herido uno: descansa todo el grupo y paga lo mismo', () => {
    const inicial = estadoCon({ oro: 50, vida: 15, seguidores: [seguidor('a', 9)] });
    const { estado } = descansarEnMonasterio(inicial, EN_MONASTERIO, new Dados(1));

    expect(estado.jugador.seguidores[0].resistencia).toBe(10);
    expect(estado.jugador.oro).toBe(25);
  });

  it('con gran fortaleza, el jugador se cura hasta 19', () => {
    const inicial = estadoCon({ oro: 50, vida: 8, condiciones: [{ id: 'amuleto_maldito', partes: ['gran_fortaleza', 'avaricioso'] }] });
    const { estado } = descansarEnMonasterio(inicial, EN_MONASTERIO, new Dados(1));

    expect(estado.jugador.vida).toBe(vidaMaxActual(estado.jugador));
    expect(estado.jugador.vida).toBe(19);
  });

  it('desactivada si nadie está herido ("Nadie necesita descansar") o no le llega el oro para todo el grupo', () => {
    const conDos = { seguidores: [seguidor('a', 3), seguidor('b')] }; // 30 de oro

    expect(disponibilidad(estadoCon({ vida: 15 }), 'descansar_en_monasterio')?.motivo).toBe('nadie_herido');
    expect(disponibilidad(estadoCon({ vida: 15, oro: 29, ...conDos }), 'descansar_en_monasterio')?.motivo).toBe('sin_oro');
    expect(disponibilidad(estadoCon({ vida: 15, oro: 30, ...conDos }), 'descansar_en_monasterio')?.disponible).toBe(true);
  });

  it('error si se intenta sin heridos o sin oro', () => {
    expect(() => descansarEnMonasterio(estadoCon({ vida: 15 }), EN_MONASTERIO, new Dados(1))).toThrow(/nadie_herido/);
    expect(() => descansarEnMonasterio(estadoCon({ vida: 5, oro: 10 }), EN_MONASTERIO, new Dados(1))).toThrow(/sin_oro/);
  });

  it('solo en un monasterio', () => {
    expect(() => descansarEnMonasterio(estadoCon({ vida: 5 }), { lugar: 'puerto' }, new Dados(1))).toThrow(/solo se puede en un monasterio/);
  });
});

describe('la noche ya pagada', () => {
  /** Descansa en el monasterio, come y queda listo para la fase de descanso. */
  function trasDescansar(cambios: Partial<Jugador>): Estado {
    const dados = new Dados(1);
    const tras = descansarEnMonasterio(estadoCon(cambios), EN_MONASTERIO, dados).estado;
    return comer(tras, 'reservas', 'monasterio', dados).estado;
  }

  it('queda apuntado que el grupo tiene la noche pagada', () => {
    expect(trasDescansar({ oro: 60, vida: 5 }).mundo.nochePagada).toBe(true);
  });

  it('esa noche solo hay una opción: dormir todos en el monasterio, gratis', () => {
    const estado = trasDescansar({ oro: 60, vida: 5, seguidores: [seguidor('a', 3), seguidor('b')] });

    expect(opcionesDeDescanso(estado, 'monasterio')).toEqual([{ eleccion: 'techo_todos', precio: 0, alcanzaElOro: true }]);
  });

  it('también sin seguidores', () => {
    expect(opcionesDeDescanso(trasDescansar({ oro: 60, vida: 5 }), 'monasterio')).toEqual([{ eleccion: 'techo_todos', precio: 0, alcanzaElOro: true }]);
  });

  it('duermen allí sin pagar ni eventos, pueden dormir genial, y al acabar el día se olvida', () => {
    const estado = trasDescansar({ oro: 60, vida: 5, seguidores: [seguidor('a', 3)] });
    const noche = descansar(estado, 'techo_todos', 'monasterio', new Dados(1));

    expect(noche.estado.jugador.oro).toBe(estado.jugador.oro);
    expect(noche.eventos).toEqual([]);
    expect(noche.haDormidoGenial).toBeDefined();
    expect(noche.estado.mundo.nochePagada).toBe(false);
    expect(noche.estado.mundo.dia).toBe(2);
  });

  it('sin haber descansado, dormir en el monasterio se paga como siempre', () => {
    const { estado } = crearPartida(1, 'Prueba');
    const deNoche: Estado = { ...estado, mundo: { ...estado.mundo, fase: 'descanso' } };

    expect(opcionesDeDescanso(deNoche, 'monasterio')[0]).toEqual({ eleccion: 'techo_solo', precio: AJUSTES.precioMonasterio, alcanzaElOro: true });
  });
});
