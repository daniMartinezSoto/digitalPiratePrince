import { AJUSTES } from '../ajustes/ajustes';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import type { Efecto } from '../tablas/efecto';
import { aplicarEfectos } from './aplicar-efectos';

// ---------------------------------------------------------------------------
// Ayudas para los tests
// ---------------------------------------------------------------------------

// Un estado de partida normal con los valores del jugador que queramos cambiar.
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', ...cambios } };
}

function seguidor(id: string, resistencia = 10): Seguidor {
  return { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia, resistenciaMaxima: 10, habilidades: [] };
}

// Aplica efectos y devuelve el jugador resultante (lo que miramos en casi todos los tests).
function aplicar(estado: Estado, ...efectos: Efecto[]): Jugador {
  return aplicarEfectos(estado, efectos, new Dados(1)).jugador;
}

describe('aplicarEfectos', () => {
  // -------------------------------------------------------------------------
  describe('lo básico', () => {
    it('no modifica el estado que recibe: devuelve uno nuevo', () => {
      const estado = estadoCon({ oro: 50 });
      const copia = structuredClone(estado);

      const nuevo = aplicarEfectos(estado, [{ tipo: 'oro', cantidad: 20 }], new Dados(1));

      expect(estado).toEqual(copia);
      expect(nuevo.jugador.oro).toBe(70);
    });

    it('sin efectos, el estado queda igual', () => {
      const estado = estadoCon();
      expect(aplicarEfectos(estado, [], new Dados(1))).toEqual(estado);
    });

    it('aplica varios efectos en orden', () => {
      // 50 de oro → +20 = 70 → mitad = 35
      const j = aplicar(estadoCon({ oro: 50 }), { tipo: 'oro', cantidad: 20 }, { tipo: 'oro', operacion: 'mitad' });
      expect(j.oro).toBe(35);
    });
  });

  // -------------------------------------------------------------------------
  describe('recursos: sumar y restar con sus límites', () => {
    it('suma y resta normalmente', () => {
      const j = aplicar(estadoCon({ oro: 50, comida: 5 }), { tipo: 'oro', cantidad: 20 }, { tipo: 'comida', cantidad: -2 });
      expect(j.oro).toBe(70);
      expect(j.comida).toBe(3);
    });

    it('la tripulación no pasa de su máximo (38 + 5 = 40)', () => {
      expect(aplicar(estadoCon({ tripulacion: 38, tripulacionMax: 40 }), { tipo: 'tripulacion', cantidad: 5 }).tripulacion).toBe(40);
    });

    it('la vida no pasa de la vida máxima', () => {
      expect(aplicar(estadoCon({ vida: 14, vidaMax: 15 }), { tipo: 'vida', cantidad: 5 }).vida).toBe(15);
    });

    it('la comida no pasa de AJUSTES.comidaMaxima', () => {
      expect(aplicar(estadoCon({ comida: 18 }), { tipo: 'comida', cantidad: 15 }).comida).toBe(AJUSTES.comidaMaxima);
    });

    it('el oro y la fama no tienen tope', () => {
      const j = aplicar(estadoCon({ oro: 900, fama: 9 }), { tipo: 'oro', cantidad: 500 }, { tipo: 'fama', cantidad: 3 });
      expect(j.oro).toBe(1400);
      expect(j.fama).toBe(12);
    });

    it('ningún recurso baja de 0 (15 de oro − 20 = 0)', () => {
      const j = aplicar(estadoCon({ oro: 15, tripulacion: 3, vida: 2 }),
        { tipo: 'oro', cantidad: -20 }, { tipo: 'tripulacion', cantidad: -10 }, { tipo: 'vida', cantidad: -5 });
      expect(j.oro).toBe(0);
      expect(j.tripulacion).toBe(0);
      expect(j.vida).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('operaciones', () => {
    it('fijar deja el recurso en ese valor', () => {
      expect(aplicar(estadoCon({ vida: 12 }), { tipo: 'vida', operacion: 'fijar', cantidad: 1 }).vida).toBe(1);
    });

    it('fijar también respeta los topes', () => {
      expect(aplicar(estadoCon({ tripulacion: 20, tripulacionMax: 40 }), { tipo: 'tripulacion', operacion: 'fijar', cantidad: 99 }).tripulacion).toBe(40);
    });

    it('mitad redondea hacia abajo (te roban la mitad: 15 → 7)', () => {
      expect(aplicar(estadoCon({ oro: 15 }), { tipo: 'oro', operacion: 'mitad' }).oro).toBe(7);
    });

    it('maximo sube al máximo (curarse del todo)', () => {
      const j = aplicar(estadoCon({ vida: 3, vidaMax: 15, comida: 2 }), { tipo: 'vida', operacion: 'maximo' }, { tipo: 'comida', operacion: 'maximo' });
      expect(j.vida).toBe(15);
      expect(j.comida).toBe(AJUSTES.comidaMaxima);
    });

    it('todo lo deja a 0 (tu oro se convierte en ceniza)', () => {
      expect(aplicar(estadoCon({ oro: 120 }), { tipo: 'oro', operacion: 'todo' }).oro).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('características (fuerza, ingenio, vida máxima)', () => {
    it('suben y bajan', () => {
      const j = aplicar(estadoCon({ fuerza: 3, ingenio: 3 }), { tipo: 'fuerza', cantidad: 1 }, { tipo: 'ingenio', cantidad: -1 });
      expect(j.fuerza).toBe(4);
      expect(j.ingenio).toBe(2);
    });

    it('nunca bajan de 1', () => {
      const j = aplicar(estadoCon({ fuerza: 2, vidaMax: 15 }), { tipo: 'fuerza', cantidad: -5 }, { tipo: 'vidaMax', cantidad: -20 });
      expect(j.fuerza).toBe(1);
      expect(j.vidaMax).toBe(1);
    });

    it('subir la vida máxima no cura (Gran fortaleza: +4 de vida máxima)', () => {
      const j = aplicar(estadoCon({ vida: 10, vidaMax: 15 }), { tipo: 'vidaMax', cantidad: 4 });
      expect(j.vidaMax).toBe(19);
      expect(j.vida).toBe(10);
    });

    it('si la vida máxima baja por debajo de la vida, la vida baja con ella', () => {
      const j = aplicar(estadoCon({ vida: 15, vidaMax: 15 }), { tipo: 'vidaMax', cantidad: -3 });
      expect(j.vidaMax).toBe(12);
      expect(j.vida).toBe(12);
    });
  });

  // -------------------------------------------------------------------------
  describe('a quién afecta la vida (destino)', () => {
    it('"todos": el jugador y cada seguidor', () => {
      const j = aplicar(estadoCon({ vida: 10, seguidores: [seguidor('a', 10), seguidor('b', 6)] }),
        { tipo: 'vida', cantidad: -2, destino: 'todos' });
      expect(j.vida).toBe(8);
      expect(j.seguidores.map(s => s.resistencia)).toEqual([8, 4]);
    });

    it('"todos" con curarse al máximo cura a todo el grupo', () => {
      const j = aplicar(estadoCon({ vida: 3, seguidores: [seguidor('a', 2)] }), { tipo: 'vida', operacion: 'maximo', destino: 'todos' });
      expect(j.vida).toBe(15);
      expect(j.seguidores[0].resistencia).toBe(10);
    });

    it('"seguidor_azar": a uno solo de los seguidores, y no al jugador', () => {
      const j = aplicar(estadoCon({ vida: 10, seguidores: [seguidor('a'), seguidor('b'), seguidor('c')] }),
        { tipo: 'vida', cantidad: -3, destino: 'seguidor_azar' });
      expect(j.vida).toBe(10);
      expect(j.seguidores.map(s => s.resistencia).sort()).toEqual([10, 10, 7]);
    });

    it('"seguidor_azar" sin seguidores no hace nada', () => {
      expect(aplicar(estadoCon({ vida: 10 }), { tipo: 'vida', cantidad: -3, destino: 'seguidor_azar' }).vida).toBe(10);
    });

    it('un seguidor que llega a 0 de resistencia muere y sale del grupo', () => {
      const j = aplicar(estadoCon({ seguidores: [seguidor('a', 2), seguidor('b', 10)] }), { tipo: 'vida', cantidad: -3, destino: 'todos' });
      expect(j.seguidores.map(s => s.id)).toEqual(['b']);
    });

    it('"seguidor_elegido" todavía no está disponible', () => {
      expect(() => aplicar(estadoCon({ seguidores: [seguidor('a')] }), { tipo: 'vida', cantidad: -1, destino: 'seguidor_elegido' }))
        .toThrow(/seguidor_elegido/);
    });
  });

  // -------------------------------------------------------------------------
  describe('objetos', () => {
    it('ganar un objeto lo mete en el inventario, con sus usos si los tiene', () => {
      const j = aplicar(estadoCon(), { tipo: 'ganar_objeto', objeto: 'mano_de_mono' }, { tipo: 'ganar_objeto', objeto: 'amuleto_kalinago' });
      expect(j.inventario).toEqual([{ id: 'mano_de_mono', usosRestantes: 2 }, { id: 'amuleto_kalinago' }]);
    });

    it('un objeto mágico da +1 de fama; uno normal no', () => {
      expect(aplicar(estadoCon({ fama: 0 }), { tipo: 'ganar_objeto', objeto: 'brujula_magica' }).fama).toBe(1);
      expect(aplicar(estadoCon({ fama: 0 }), { tipo: 'ganar_objeto', objeto: 'amuleto_kalinago' }).fama).toBe(0);
    });

    it('si no cabe, no entra (y un mágico que no entra no da fama)', () => {
      // Capacidad 5: el ídolo dorado ocupa 4 y la mano de mono 1 → lleno.
      const lleno = estadoCon({ capacidadInventario: 5, inventario: [{ id: 'idolo_dorado' }, { id: 'mano_de_mono', usosRestantes: 2 }] });
      const j = aplicar(lleno, { tipo: 'ganar_objeto', objeto: 'brujula_magica' });
      expect(j.inventario).toHaveLength(2);
      expect(j.fama).toBe(0);
    });

    it('cuenta los espacios de cada objeto: el ídolo dorado (4) no cabe si solo quedan 3 huecos', () => {
      const j = aplicar(estadoCon({ capacidadInventario: 5, inventario: [{ id: 'amuleto_kalinago' }, { id: 'brujula_magica' }] }),
        { tipo: 'ganar_objeto', objeto: 'idolo_dorado' });
      expect(j.inventario.map(o => o.id)).not.toContain('idolo_dorado');
    });

    it('perder un objeto lo saca del inventario (solo uno si hay varios iguales)', () => {
      const j = aplicar(estadoCon({ inventario: [{ id: 'amuleto_kalinago' }, { id: 'brujula_magica' }, { id: 'amuleto_kalinago' }] }),
        { tipo: 'perder_objeto', objeto: 'amuleto_kalinago' });
      expect(j.inventario.map(o => o.id)).toEqual(['brujula_magica', 'amuleto_kalinago']);
    });

    it('perder un objeto que no tienes no hace nada', () => {
      const j = aplicar(estadoCon({ inventario: [{ id: 'brujula_magica' }] }), { tipo: 'perder_objeto', objeto: 'idolo_dorado' });
      expect(j.inventario).toEqual([{ id: 'brujula_magica' }]);
    });

    it('lanza un error si el objeto no está en el catálogo', () => {
      expect(() => aplicar(estadoCon(), { tipo: 'ganar_objeto', objeto: 'objeto_inventado' })).toThrow(/objeto_inventado/);
    });
  });

  // -------------------------------------------------------------------------
  describe('condiciones', () => {
    it('poner una condición la añade, con o sin turnos', () => {
      const j = aplicar(estadoCon(), { tipo: 'poner_condicion', condicion: 'escorbuto' }, { tipo: 'poner_condicion', condicion: 'tormenta', turnos: 2 });
      expect(j.condiciones).toEqual([{ id: 'escorbuto' }, { id: 'tormenta', turnosRestantes: 2 }]);
    });

    it('una condición que ya tienes no se duplica: se queda la que dure más', () => {
      const conTormenta = estadoCon({ condiciones: [{ id: 'tormenta', turnosRestantes: 1 }] });
      expect(aplicar(conTormenta, { tipo: 'poner_condicion', condicion: 'tormenta', turnos: 3 }).condiciones)
        .toEqual([{ id: 'tormenta', turnosRestantes: 3 }]);
      expect(aplicar(conTormenta, { tipo: 'poner_condicion', condicion: 'tormenta' }).condiciones).toEqual([{ id: 'tormenta' }]);

      const larga = estadoCon({ condiciones: [{ id: 'tormenta', turnosRestantes: 5 }] });
      expect(aplicar(larga, { tipo: 'poner_condicion', condicion: 'tormenta', turnos: 2 }).condiciones)
        .toEqual([{ id: 'tormenta', turnosRestantes: 5 }]);
    });

    it('quitar una condición concreta', () => {
      const j = aplicar(estadoCon({ condiciones: [{ id: 'escorbuto' }, { id: 'tormenta' }] }), { tipo: 'quitar_condicion', condicion: 'escorbuto' });
      expect(j.condiciones).toEqual([{ id: 'tormenta' }]);
    });

    it('quitar "una maldición" quita solo una, la más antigua, y no toca las demás categorías', () => {
      const j = aplicar(estadoCon({ condiciones: [{ id: 'escorbuto' }, { id: 'el_mal' }, { id: 'maleficio_del_pirata' }] }),
        { tipo: 'quitar_condicion', categoria: 'maldicion' });
      expect(j.condiciones).toEqual([{ id: 'escorbuto' }, { id: 'maleficio_del_pirata' }]);
    });

    it('quitar una condición que no tienes no hace nada', () => {
      const j = aplicar(estadoCon({ condiciones: [{ id: 'escorbuto' }] }), { tipo: 'quitar_condicion', categoria: 'maldicion' });
      expect(j.condiciones).toEqual([{ id: 'escorbuto' }]);
    });

    it('lanza un error si la condición no está en el catálogo', () => {
      expect(() => aplicar(estadoCon(), { tipo: 'poner_condicion', condicion: 'inventada' })).toThrow(/inventada/);
    });
  });

  // -------------------------------------------------------------------------
  describe('turnos perdidos y banderas', () => {
    it('los turnos perdidos se suman al contador', () => {
      const j = aplicar(estadoCon({ fasesAccionPerdidas: 1 }), { tipo: 'perder_turnos', cantidad: 2 });
      expect(j.fasesAccionPerdidas).toBe(3);
    });

    it('una bandera se apunta en el mundo', () => {
      const nuevo = aplicarEfectos(estadoCon(), [{ tipo: 'bandera', bandera: 'emporio_bob_derrotado' }], new Dados(1));
      expect(nuevo.mundo.banderas['emporio_bob_derrotado']).toBe(true);
    });
  });
});
