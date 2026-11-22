import { AJUSTES } from '../ajustes/ajustes';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { continuarEvento, elegirOpcion, lanzarEventos, vistaDelEvento, type ResultadoMotor } from './motor';

// El deseo (E041), el primer evento de verdad (Sprint 10, paso 3): una prueba por cada opción,
// con el evento real de data/eventos/deseo.json y el motor.

function seguidor(id: string, resistencia = 4): Seguidor {
  return { id, tipo: 'forzudo', nombre: id, ataque: 3, resistencia, resistenciaMaxima: 10, habilidades: [] };
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

/** Lanza el deseo y pulsa la opción "indice" (0 = la primera). */
function pedirDeseo(indice: number, estado = estadoCon(), dados = new Dados(1)): ResultadoMotor {
  const lanzado = lanzarEventos(estado, ['deseo'], dados);
  return elegirOpcion(lanzado.estado, indice, dados);
}

describe('el deseo (E041)', () => {
  it('aparece el djinn con las 9 opciones, todas disponibles en una partida normal', () => {
    const r = lanzarEventos(estadoCon(), ['deseo'], new Dados(1));
    const vista = vistaDelEvento(r.estado)!;

    expect(vista.modo).toBe('opciones');
    expect(vista.titulo).toBe('Deseo');
    expect(vista.texto).toContain('djinn');
    expect(vista.opciones).toHaveLength(9);
    expect(vista.opciones!.every(o => o.disponible)).toBe(true);
  });

  it('1. vitalidad: +4 de vida máxima, sin curar', () => {
    const r = pedirDeseo(0);
    expect(r.estado.jugador.vidaMax).toBe(22);
    expect(r.estado.jugador.vida).toBe(10);
  });

  it('2. fama: +2', () => {
    expect(pedirDeseo(1).estado.jugador.fama).toBe(2);
  });

  it('3. riqueza: +200 de oro', () => {
    expect(pedirDeseo(2).estado.jugador.oro).toBe(250);
  });

  it('4. fuerza: +1', () => {
    expect(pedirDeseo(3).estado.jugador.fuerza).toBe(4);
  });

  it('4 y 5. fuerza o ingenio ya al máximo (5): salen desactivadas (decidido por el autor)', () => {
    const r = lanzarEventos(estadoCon({ fuerza: 5, ingenio: 5 }), ['deseo'], new Dados(1));
    expect(vistaDelEvento(r.estado)!.opciones![3]).toMatchObject({ disponible: false, motivo: 'al_maximo' });
    expect(vistaDelEvento(r.estado)!.opciones![4]).toMatchObject({ disponible: false, motivo: 'al_maximo' });
  });

  it('5. con ingenio 4 y súper cerebro (+2) ya estás al máximo: desactivada', () => {
    const conAmuleto = estadoCon({ ingenio: 4, condiciones: [{ id: 'amuleto_maldito', partes: ['super_cerebro', 'hedor_nauseabundo'] }] });
    const r = lanzarEventos(conAmuleto, ['deseo'], new Dados(1));
    expect(vistaDelEvento(r.estado)!.opciones![4]).toMatchObject({ disponible: false, motivo: 'al_maximo' });
  });

  it('5. ingenio: +1', () => {
    expect(pedirDeseo(4).estado.jugador.ingenio).toBe(4);
  });

  it('6. poder: el tesoro mágico aún no existe, así que termina y sale como pendiente', () => {
    const r = pedirDeseo(5);
    expect(r.pendientes).toEqual(['tesoro_magico']);
    expect(r.terminado).toBe(true);
  });

  describe('7. conocimiento prohibido', () => {
    it('da el ídolo antediluviano (y su punto de fama, porque es mágico)', () => {
      const r = pedirDeseo(6);
      expect(r.estado.jugador.inventario).toEqual([{ id: 'idolo_antediluviano' }]);
      expect(r.estado.jugador.fama).toBe(1);
    });

    it('si ya lo tienes, sale desactivada', () => {
      const r = lanzarEventos(estadoCon({ inventario: [{ id: 'idolo_antediluviano' }] }), ['deseo'], new Dados(1));
      expect(vistaDelEvento(r.estado)!.opciones![6]).toMatchObject({ disponible: false, motivo: 'ya_lo_tienes' });
    });
  });

  describe('8. amistad', () => {
    it('se une un seguidor de un tipo cualquiera del catálogo, que nunca te abandona', () => {
      const r = pedirDeseo(7);
      expect(r.estado.jugador.seguidores).toHaveLength(1);
      expect(r.estado.jugador.seguidores[0].inseparable).toBe(true);
    });

    it('con el grupo lleno, sale desactivada (decidido por el autor)', () => {
      const lleno = Array.from({ length: AJUSTES.maximoSeguidores }, (_, i) => seguidor(`s_${i + 1}`));
      const r = lanzarEventos(estadoCon({ seguidores: lleno }), ['deseo'], new Dados(1));
      expect(vistaDelEvento(r.estado)!.opciones![7]).toMatchObject({ disponible: false, motivo: 'grupo_lleno' });
    });

    it('con el hedor nauseabundo (no puedes tener más seguidores), también desactivada', () => {
      const r = lanzarEventos(estadoCon({ condiciones: [{ id: 'hedor_nauseabundo' }] }), ['deseo'], new Dados(1));
      expect(vistaDelEvento(r.estado)!.opciones![7]).toMatchObject({ disponible: false, motivo: 'prohibido' });
    });
  });

  it('9. protección: todo el grupo se cura del todo, la tripulación al máximo y +10 de comida', () => {
    const r = pedirDeseo(8, estadoCon({ comida: 1, seguidores: [seguidor('forzudo_1', 4)] }));

    expect(r.estado.jugador.vida).toBe(18);
    expect(r.estado.jugador.seguidores[0].resistencia).toBe(10);
    expect(r.estado.jugador.tripulacion).toBe(40);
    expect(r.estado.jugador.comida).toBe(11);
  });

  it('9. protección: la comida no pasa de su máximo (AJUSTES.comidaMaxima)', () => {
    expect(pedirDeseo(8).estado.jugador.comida).toBe(AJUSTES.comidaMaxima);
  });

  it('tras elegir se ve lo que ha cambiado y, al continuar, el evento termina', () => {
    const r = pedirDeseo(2);
    expect(vistaDelEvento(r.estado)).toMatchObject({ modo: 'continuar' });
    expect(vistaDelEvento(r.estado)!.lectura!.cambios).toEqual([{ tipo: 'recurso', recurso: 'oro', antes: 50, despues: 250 }]);

    const fin = continuarEvento(r.estado, new Dados(1));
    expect(fin.terminado).toBe(true);
    expect(fin.estado.mundo.pilaEventos).toEqual([]);
  });
});
