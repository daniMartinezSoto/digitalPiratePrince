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
  // Las cuentas de estos tests se hicieron con 15 PV (la vida inicial era 15 hasta el Sprint 7; ahora es 18).
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', vida: 15, vidaMax: 15, ...cambios } };
}

function seguidor(id: string, resistencia = 10): Seguidor {
  return { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia, resistenciaMaxima: 10, habilidades: [] };
}

// Aplica efectos y devuelve el jugador resultante (lo que miramos en casi todos los tests).
function aplicar(estado: Estado, ...efectos: Efecto[]): Jugador {
  return aplicarEfectos(estado, efectos, new Dados(1)).estado.jugador;
}

describe('aplicarEfectos', () => {
  // -------------------------------------------------------------------------
  describe('lo básico', () => {
    it('no modifica el estado que recibe: devuelve uno nuevo', () => {
      const estado = estadoCon({ oro: 50 });
      const copia = structuredClone(estado);

      const { estado: nuevo } = aplicarEfectos(estado, [{ tipo: 'oro', cantidad: 20 }], new Dados(1));

      expect(estado).toEqual(copia);
      expect(nuevo.jugador.oro).toBe(70);
    });

    it('sin efectos, el estado queda igual', () => {
      const estado = estadoCon();
      expect(aplicarEfectos(estado, [], new Dados(1))).toEqual({ estado, cambios: [] });
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
      // Cada uno por separado: con tripulación o vida a 0 la partida termina y no se aplicaría lo siguiente.
      expect(aplicar(estadoCon({ oro: 15 }), { tipo: 'oro', cantidad: -20 }).oro).toBe(0);
      expect(aplicar(estadoCon({ tripulacion: 3 }), { tipo: 'tripulacion', cantidad: -10 }).tripulacion).toBe(0);
      expect(aplicar(estadoCon({ vida: 2 }), { tipo: 'vida', cantidad: -5 }).vida).toBe(0);
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

    it('fuerza e ingenio no pasan de 5 (AJUSTES.caracteristicaMaxima, decidido por el autor el 22-nov)', () => {
      const j = aplicar(estadoCon({ fuerza: 5, ingenio: 4 }), { tipo: 'fuerza', cantidad: 1 }, { tipo: 'ingenio', cantidad: 3 });
      expect(j.fuerza).toBe(5);
      expect(j.ingenio).toBe(5);
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

    it('"seguidor_azar" sin seguidores y con "siNoHay": pasan los efectos de reemplazo', () => {
      // Escorbuto: muere un seguidor; si no tienes, pierdes tripulación.
      const j = aplicar(estadoCon({ tripulacion: 30 }), {
        tipo: 'vida', operacion: 'todo', destino: 'seguidor_azar',
        siNoHay: [{ tipo: 'tripulacion', cantidad: -4 }],
      });
      expect(j.tripulacion).toBe(26);
    });

    it('"seguidor_azar" con seguidores: muere uno y "siNoHay" se ignora', () => {
      const j = aplicar(estadoCon({ tripulacion: 30, seguidores: [seguidor('a'), seguidor('b')] }), {
        tipo: 'vida', operacion: 'todo', destino: 'seguidor_azar',
        siNoHay: [{ tipo: 'tripulacion', cantidad: -4 }],
      });
      expect(j.seguidores).toHaveLength(1);
      expect(j.tripulacion).toBe(30);
    });

    it('si el reemplazo de "siNoHay" deja la tripulación a 0, se pierde la partida', () => {
      const { estado, cambios } = aplicarEfectos(estadoCon({ tripulacion: 3 }), [{
        tipo: 'vida', operacion: 'todo', destino: 'seguidor_azar',
        siNoHay: [{ tipo: 'tripulacion', cantidad: -5 }],
      }], new Dados(1));
      expect(estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'tripulacion' });
      expect(cambios.map(c => c.tipo)).toEqual(['recurso', 'fin_partida']);
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
      const { estado } = aplicarEfectos(estadoCon(), [{ tipo: 'bandera', bandera: 'emporio_bob_derrotado' }], new Dados(1));
      expect(estado.mundo.banderas['emporio_bob_derrotado']).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('el contable', () => {
    it('cada vez que gana oro, gana 2d6 más', () => {
      const gemelo = new Dados(3);
      const extra = gemelo.tirar('1d6').total; // el contable es lo único que tira dados aquí

      const { estado } = aplicarEfectos(estadoCon({ sobrenombre: 'el_contable', oro: 50 }), [{ tipo: 'oro', cantidad: 20 }], new Dados(3));

      expect(estado.jugador.oro).toBe(70 + extra);
    });

    it('no gana nada extra al perder oro, al fijarlo ni con otros recursos', () => {
      const contable = estadoCon({ sobrenombre: 'el_contable', oro: 50, comida: 5 });
      expect(aplicar(contable, { tipo: 'oro', cantidad: -10 }).oro).toBe(40);
      expect(aplicar(contable, { tipo: 'oro', operacion: 'fijar', cantidad: 100 }).oro).toBe(100);
      expect(aplicar(contable, { tipo: 'comida', cantidad: 3 }).comida).toBe(8);
    });

    it('los demás sobrenombres no ganan nada extra', () => {
      expect(aplicar(estadoCon({ oro: 50 }), { tipo: 'oro', cantidad: 20 }).oro).toBe(70);
    });
  });

  // -------------------------------------------------------------------------
  describe('fin de partida', () => {
    it('mientras se juega, finPartida es null', () => {
      const { estado } = aplicarEfectos(estadoCon({ vida: 10 }), [{ tipo: 'vida', cantidad: -3 }], new Dados(1));
      expect(estado.mundo.finPartida).toBeNull();
    });

    it('si la vida llega a 0, derrota por vida', () => {
      const { estado } = aplicarEfectos(estadoCon({ vida: 2 }), [{ tipo: 'vida', cantidad: -5 }], new Dados(1));
      expect(estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'vida' });
    });

    it('si la tripulación llega a 0, derrota por tripulación', () => {
      const { estado } = aplicarEfectos(estadoCon({ tripulacion: 3 }), [{ tipo: 'tripulacion', cantidad: -3 }], new Dados(1));
      expect(estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'tripulacion' });
    });

    it('"ganar_partida" y "perder_partida" terminan la partida', () => {
      expect(aplicarEfectos(estadoCon(), [{ tipo: 'ganar_partida' }], new Dados(1)).estado.mundo.finPartida)
        .toEqual({ resultado: 'victoria', motivo: 'evento' });
      expect(aplicarEfectos(estadoCon(), [{ tipo: 'perder_partida' }], new Dados(1)).estado.mundo.finPartida)
        .toEqual({ resultado: 'derrota', motivo: 'evento' });
    });

    it('cuando la partida termina, los efectos que quedan ya no se aplican', () => {
      const { estado } = aplicarEfectos(estadoCon({ vida: 1, oro: 50 }),
        [{ tipo: 'vida', cantidad: -1 }, { tipo: 'oro', cantidad: 100 }], new Dados(1));
      expect(estado.jugador.oro).toBe(50);
    });

    it('si la partida ya había terminado, no se aplica nada', () => {
      const terminada = estadoCon({ oro: 50 });
      terminada.mundo = { ...terminada.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } };
      const { estado, cambios } = aplicarEfectos(terminada, [{ tipo: 'oro', cantidad: 100 }], new Dados(1));
      expect(estado.jugador.oro).toBe(50);
      expect(cambios).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('el chivato: la lista de cambios reales', () => {
    const cambiosDe = (estado: Estado, ...efectos: Efecto[]) => aplicarEfectos(estado, efectos, new Dados(1)).cambios;

    it('cuenta lo que cambió DE VERDAD: +5 de tripulación con 38 de 40 es de 38 a 40', () => {
      expect(cambiosDe(estadoCon({ tripulacion: 38, tripulacionMax: 40 }), { tipo: 'tripulacion', cantidad: 5 }))
        .toEqual([{ tipo: 'recurso', recurso: 'tripulacion', antes: 38, despues: 40 }]);
    });

    it('si no cambia nada (ya estabas al máximo), no apunta nada', () => {
      expect(cambiosDe(estadoCon({ vida: 15, vidaMax: 15 }), { tipo: 'vida', cantidad: 3 })).toEqual([]);
    });

    it('el oro extra del contable aparece aparte, con su motivo', () => {
      const gemelo = new Dados(3);
      const extra = gemelo.tirar('1d6').total;

      const { cambios } = aplicarEfectos(estadoCon({ sobrenombre: 'el_contable', oro: 50 }), [{ tipo: 'oro', cantidad: 20 }], new Dados(3));

      expect(cambios).toEqual([
        { tipo: 'recurso', recurso: 'oro', antes: 50, despues: 70 },
        { tipo: 'recurso', recurso: 'oro', antes: 70, despues: 70 + extra, motivo: 'contable' },
      ]);
    });

    it('objetos: ganado (con su fama si es mágico), perdido y "no cabe"', () => {
      expect(cambiosDe(estadoCon({ fama: 0 }), { tipo: 'ganar_objeto', objeto: 'brujula_magica' })).toEqual([
        { tipo: 'objeto_ganado', objeto: 'brujula_magica' },
        { tipo: 'recurso', recurso: 'fama', antes: 0, despues: 1, motivo: 'objeto_magico' },
      ]);
      expect(cambiosDe(estadoCon({ inventario: [{ id: 'amuleto_kalinago' }] }), { tipo: 'perder_objeto', objeto: 'amuleto_kalinago' }))
        .toEqual([{ tipo: 'objeto_perdido', objeto: 'amuleto_kalinago' }]);
      expect(cambiosDe(estadoCon({ capacidadInventario: 3 }), { tipo: 'ganar_objeto', objeto: 'idolo_dorado' }))
        .toEqual([{ tipo: 'objeto_no_cabe', objeto: 'idolo_dorado' }]);
    });

    it('condiciones puestas y quitadas', () => {
      expect(cambiosDe(estadoCon(), { tipo: 'poner_condicion', condicion: 'tormenta', turnos: 2 }))
        .toEqual([{ tipo: 'condicion_puesta', condicion: 'tormenta', turnos: 2 }]);
      expect(cambiosDe(estadoCon({ condiciones: [{ id: 'el_mal' }] }), { tipo: 'quitar_condicion', categoria: 'maldicion' }))
        .toEqual([{ tipo: 'condicion_quitada', condicion: 'el_mal' }]);
    });

    it('seguidores heridos y muertos', () => {
      expect(cambiosDe(estadoCon({ vida: 10, seguidores: [seguidor('a', 5), seguidor('b', 2)] }), { tipo: 'vida', cantidad: -2, destino: 'todos' }))
        .toEqual([
          { tipo: 'recurso', recurso: 'vida', antes: 10, despues: 8 },
          { tipo: 'resistencia_seguidor', seguidor: 'a', antes: 5, despues: 3 },
          { tipo: 'resistencia_seguidor', seguidor: 'b', antes: 2, despues: 0 },
          { tipo: 'seguidor_muerto', seguidor: 'b' },
        ]);
    });

    it('turnos perdidos, banderas y fin de partida', () => {
      expect(cambiosDe(estadoCon(), { tipo: 'perder_turnos', cantidad: 1 }, { tipo: 'bandera', bandera: 'bob_derrotado' }))
        .toEqual([{ tipo: 'turnos_perdidos', cantidad: 1 }, { tipo: 'bandera', bandera: 'bob_derrotado' }]);
      expect(cambiosDe(estadoCon({ vida: 1 }), { tipo: 'vida', cantidad: -1 })).toEqual([
        { tipo: 'recurso', recurso: 'vida', antes: 1, despues: 0 },
        { tipo: 'fin_partida', fin: { resultado: 'derrota', motivo: 'vida' } },
      ]);
    });
  });
});
