import { AJUSTES } from '../ajustes/ajustes';
import type { Condicion } from '../catalogos/condicion';
import { Dados } from '../dados/dados';
import type { CatalogosEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { comer, opcionesDeComida } from './comer';

const PRECIO = AJUSTES.precioTaberna;

// Una partida en la fase de comida, con los valores del jugador que queramos.
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', vida: 15, comida: 5, oro: 50, ...cambios },
    mundo: { ...estado.mundo, fase: 'comida' },
  };
}

function seguidor(id: string, inseparable = false): Seguidor {
  const s: Seguidor = { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
  return inseparable ? { ...s, inseparable: true } : s;
}

// Catálogo de prueba con una maldición que pide 2 reservas al día.
const CATALOGO_HAMBRE_INSACIABLE: CatalogosEfectos = {
  objetos: [],
  condiciones: [
    { id: 'hambre', nombre: 'Hambre', descripcion: 'x', categoria: 'otra' },
    { id: 'hambre_insaciable', nombre: 'Hambre insaciable', descripcion: 'x', categoria: 'maldicion', ajustes: { comidaPorDia: 1 } },
  ] satisfies Condicion[],
};

const HAMBRE = { id: 'hambre' };

describe('opcionesDeComida', () => {
  it('en el barco, a la intemperie o en un monasterio no se puede pagar con oro', () => {
    expect(opcionesDeComida(estadoCon(), 'barco').pago).toBeNull();
    expect(opcionesDeComida(estadoCon(), 'intemperie').pago).toBeNull();
    expect(opcionesDeComida(estadoCon(), 'monasterio').pago).toBeNull();
  });

  it('en un puerto hay taberna, con su precio', () => {
    expect(opcionesDeComida(estadoCon(), 'puerto').pago).toEqual({ precio: PRECIO, alcanzaElOro: true });
  });

  it('en una aldea los nativos no aceptan monedas', () => {
    expect(opcionesDeComida(estadoCon(), 'aldea').pago).toBeNull();
  });

  it('en una aldea sí aceptan el oro de "el nativo", de quien lleva el amuleto kalinago o va con un seguidor nativo', () => {
    const pago = { precio: PRECIO, alcanzaElOro: true };
    expect(opcionesDeComida(estadoCon({ sobrenombre: 'el_nativo' }), 'aldea').pago).toEqual(pago);
    expect(opcionesDeComida(estadoCon({ inventario: [{ id: 'amuleto_kalinago' }] }), 'aldea').pago).toEqual(pago);
    expect(opcionesDeComida(estadoCon({ seguidores: [{ ...seguidor('a'), tipo: 'nativo', habilidades: ['guia_nativo'] }] }), 'aldea').pago).toEqual(pago);
  });

  it('si se puede pagar pero no llega el oro: la opción sale, pero avisa de que no le llega', () => {
    expect(opcionesDeComida(estadoCon({ oro: PRECIO - 1 }), 'puerto').pago).toEqual({ precio: PRECIO, alcanzaElOro: false });
  });

  it('dice cuántas reservas hacen falta y si llegan', () => {
    expect(opcionesDeComida(estadoCon({ comida: 5 }), 'barco')).toMatchObject({ necesarias: 1, reservas: 5, alcanzanLasReservas: true });
    expect(opcionesDeComida(estadoCon({ comida: 0 }), 'barco')).toMatchObject({ necesarias: 1, reservas: 0, alcanzanLasReservas: false });
  });

  it('con hambre insaciable hacen falta 2 reservas y pagar cuesta el doble', () => {
    const estado = estadoCon({ comida: 1, condiciones: [{ id: 'hambre_insaciable' }] });
    expect(opcionesDeComida(estado, 'puerto', CATALOGO_HAMBRE_INSACIABLE)).toEqual({
      necesarias: 2,
      reservas: 1,
      alcanzanLasReservas: false,
      pago: { precio: 2 * PRECIO, alcanzaElOro: true },
      invitado: false,
    });
  });
});

describe('comer', () => {
  // -------------------------------------------------------------------------
  describe('lo básico', () => {
    it('solo se puede llamar en la fase de comida', () => {
      const estado = estadoCon();
      const enAccion: Estado = { ...estado, mundo: { ...estado.mundo, fase: 'accion' } };
      expect(() => comer(enAccion, 'reservas', 'barco', new Dados(1))).toThrow(/solo se puede comer en la fase "comida".*"accion"/);
    });

    it('no se puede llamar si la partida ya ha terminado', () => {
      const estado = estadoCon();
      const terminada: Estado = { ...estado, mundo: { ...estado.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };
      expect(() => comer(terminada, 'reservas', 'barco', new Dados(1))).toThrow(/ya ha terminado/);
    });

    it('no modifica el estado que recibe: devuelve uno nuevo', () => {
      const estado = estadoCon({ comida: 0, seguidores: [seguidor('a')] });
      const copia = structuredClone(estado);
      comer(estado, 'reservas', 'barco', new Dados(1));
      expect(estado).toEqual(copia);
    });

    it('después de comer, la partida pasa a la fase de descanso', () => {
      expect(comer(estadoCon(), 'reservas', 'barco', new Dados(1)).estado.mundo.fase).toBe('descanso');
      expect(comer(estadoCon({ comida: 0 }), 'reservas', 'barco', new Dados(1)).estado.mundo.fase).toBe('descanso');
    });

    it('apunta en el estado por dónde van los dados', () => {
      const dados = new Dados(7);
      const r = comer(estadoCon({ comida: 0 }), 'reservas', 'barco', dados);
      expect(r.estado.mundo.estadoDados).toBe(dados.obtenerEstado());
    });
  });

  // -------------------------------------------------------------------------
  describe('comer con reservas', () => {
    it('gasta 1 reserva y no pasa nada más', () => {
      const r = comer(estadoCon({ comida: 5 }), 'reservas', 'barco', new Dados(1));
      expect(r.haComido).toBe(true);
      expect(r.estado.jugador.comida).toBe(4);
      expect(r.estado.jugador.vida).toBe(15);
      expect(r.cambios).toEqual([{ tipo: 'recurso', recurso: 'comida', antes: 5, despues: 4 }]);
      expect(r.eventos).toEqual([]);
    });

    it('con hambre insaciable gasta 2', () => {
      const estado = estadoCon({ comida: 5, condiciones: [{ id: 'hambre_insaciable' }] });
      const r = comer(estado, 'reservas', 'barco', new Dados(1), CATALOGO_HAMBRE_INSACIABLE);
      expect(r.haComido).toBe(true);
      expect(r.estado.jugador.comida).toBe(3);
    });

    it('en un puerto también se puede elegir gastar reservas en vez de ir a la taberna', () => {
      const r = comer(estadoCon({ comida: 5, oro: 50 }), 'reservas', 'puerto', new Dados(1));
      expect(r.estado.jugador.comida).toBe(4);
      expect(r.estado.jugador.oro).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  describe('comer pagando con oro', () => {
    it('paga el precio en oro y no gasta reservas', () => {
      const r = comer(estadoCon({ comida: 5, oro: 50 }), 'pagar', 'puerto', new Dados(1));
      expect(r.haComido).toBe(true);
      expect(r.estado.jugador.oro).toBe(50 - PRECIO);
      expect(r.estado.jugador.comida).toBe(5);
    });

    it('sirve aunque no queden reservas', () => {
      const r = comer(estadoCon({ comida: 0, oro: PRECIO }), 'pagar', 'puerto', new Dados(1));
      expect(r.haComido).toBe(true);
      expect(r.estado.jugador.oro).toBe(0);
      expect(r.estado.jugador.diasSinComer).toBe(0);
    });

    it('con hambre insaciable cuesta el doble', () => {
      const estado = estadoCon({ oro: 50, condiciones: [{ id: 'hambre_insaciable' }] });
      const r = comer(estado, 'pagar', 'puerto', new Dados(1), CATALOGO_HAMBRE_INSACIABLE);
      expect(r.estado.jugador.oro).toBe(50 - 2 * PRECIO);
    });

    it('en una aldea, "el nativo" puede cambiar oro por comida', () => {
      const r = comer(estadoCon({ sobrenombre: 'el_nativo', comida: 5, oro: 50 }), 'pagar', 'aldea', new Dados(1));
      expect(r.haComido).toBe(true);
      expect(r.estado.jugador.oro).toBe(50 - PRECIO);
      expect(r.estado.jugador.comida).toBe(5);
    });

    it('da error si ahí no se puede pagar con oro', () => {
      expect(() => comer(estadoCon(), 'pagar', 'barco', new Dados(1))).toThrow(/en "barco" no se puede pagar la comida con oro/);
      expect(() => comer(estadoCon(), 'pagar', 'aldea', new Dados(1))).toThrow(/en "aldea" no se puede pagar/);
    });

    it('da error si no llega el oro', () => {
      expect(() => comer(estadoCon({ oro: PRECIO - 1 }), 'pagar', 'puerto', new Dados(1))).toThrow(/la comida cuesta/);
    });
  });

  // -------------------------------------------------------------------------
  describe('hambre', () => {
    it('sin reservas: primer día sin comer, -1 PV y aparece la condición "hambre"', () => {
      const r = comer(estadoCon({ comida: 0 }), 'reservas', 'barco', new Dados(1));
      expect(r.haComido).toBe(false);
      expect(r.estado.jugador.diasSinComer).toBe(1);
      expect(r.estado.jugador.vida).toBe(14);
      expect(r.estado.jugador.condiciones).toEqual([HAMBRE]);
      expect(r.cambios).toContainEqual({ tipo: 'condicion_puesta', condicion: 'hambre' });
      expect(r.cambios).toContainEqual({ tipo: 'recurso', recurso: 'vida', antes: 15, despues: 14 });
    });

    it('el hambre es acumulativa: el segundo día -2 PV, el tercero -3', () => {
      const dia2 = comer(estadoCon({ comida: 0, vida: 14, diasSinComer: 1, condiciones: [HAMBRE] }), 'reservas', 'barco', new Dados(1));
      expect(dia2.estado.jugador.diasSinComer).toBe(2);
      expect(dia2.estado.jugador.vida).toBe(12);

      const dia3 = comer(estadoCon({ comida: 0, vida: 12, diasSinComer: 2, condiciones: [HAMBRE] }), 'reservas', 'barco', new Dados(1));
      expect(dia3.estado.jugador.diasSinComer).toBe(3);
      expect(dia3.estado.jugador.vida).toBe(9);
    });

    it('la condición "hambre" no se duplica', () => {
      const r = comer(estadoCon({ comida: 0, diasSinComer: 1, condiciones: [HAMBRE] }), 'reservas', 'barco', new Dados(1));
      expect(r.estado.jugador.condiciones).toEqual([HAMBRE]);
    });

    it('si las reservas no llegan, gasta las que tiene y pasa hambre igual', () => {
      const estado = estadoCon({ comida: 1, condiciones: [{ id: 'hambre_insaciable' }] });
      const r = comer(estado, 'reservas', 'barco', new Dados(1), CATALOGO_HAMBRE_INSACIABLE);
      expect(r.haComido).toBe(false);
      expect(r.estado.jugador.comida).toBe(0);
      expect(r.estado.jugador.diasSinComer).toBe(1);
      expect(r.estado.jugador.vida).toBe(14);
    });

    it('al comer se quita el hambre: los días sin comer vuelven a 0 y desaparece la condición', () => {
      const r = comer(estadoCon({ comida: 3, vida: 9, diasSinComer: 3, condiciones: [HAMBRE] }), 'reservas', 'barco', new Dados(1));
      expect(r.haComido).toBe(true);
      expect(r.estado.jugador.diasSinComer).toBe(0);
      expect(r.estado.jugador.condiciones).toEqual([]);
      expect(r.estado.jugador.vida).toBe(9); // comer no cura
      expect(r.cambios).toContainEqual({ tipo: 'condicion_quitada', condicion: 'hambre' });
    });

    it('comer pagando también quita el hambre', () => {
      const r = comer(estadoCon({ comida: 0, diasSinComer: 2, condiciones: [HAMBRE] }), 'pagar', 'puerto', new Dados(1));
      expect(r.estado.jugador.diasSinComer).toBe(0);
      expect(r.estado.jugador.condiciones).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('a punto de morir de hambre', () => {
    // Busca semillas con las que el primer 1d6 sale 1 (muere) o no (vive).
    function semillaCon(muere: boolean): number {
      for (let semilla = 1; semilla < 500; semilla++) {
        if ((new Dados(semilla).tirar('1d6').total === 1) === muere) {
          return semilla;
        }
      }
      throw new Error('no se ha encontrado una semilla');
    }

    it('si la vida aguanta, no se tira ningún dado de muerte', () => {
      const r = comer(estadoCon({ comida: 0, vida: 2 }), 'reservas', 'barco', new Dados(1));
      expect(r.tiradaDeMuerte).toBeUndefined();
      expect(r.estado.jugador.vida).toBe(1);
    });

    it('si el hambre le dejaría sin vida y saca un 1, muere', () => {
      const r = comer(estadoCon({ comida: 0, vida: 1 }), 'reservas', 'barco', new Dados(semillaCon(true)));
      expect(r.tiradaDeMuerte).toBe(1);
      expect(r.estado.jugador.vida).toBe(0);
      expect(r.estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'vida' });
      expect(r.estado.mundo.fase).toBe('comida'); // el día no sigue
      expect(r.eventos).toEqual([]);
    });

    it('si saca 2 o más, se queda con 1 PV y vive un día más', () => {
      const r = comer(estadoCon({ comida: 0, vida: 3, diasSinComer: 4, condiciones: [HAMBRE] }), 'reservas', 'barco', new Dados(semillaCon(false)));
      expect(r.tiradaDeMuerte).toBeGreaterThanOrEqual(2);
      expect(r.estado.jugador.vida).toBe(1);
      expect(r.estado.mundo.finPartida).toBeNull();
      expect(r.estado.mundo.fase).toBe('descanso');
    });
  });

  // -------------------------------------------------------------------------
  describe('seguidores y motín', () => {
    // Repite la fase de comida con muchas semillas y cuenta cuántas veces pasa algo.
    function contar(estado: Estado, pasa: (r: ReturnType<typeof comer>) => boolean): number {
      let veces = 0;
      for (let semilla = 1; semilla <= 1000; semilla++) {
        if (pasa(comer(estado, 'reservas', 'barco', new Dados(semilla)))) {
          veces++;
        }
      }
      return veces;
    }

    it('si ha comido, nadie se marcha y no hay motín', () => {
      const estado = estadoCon({ comida: 5, seguidores: [seguidor('a'), seguidor('b')] });
      expect(contar(estado, r => r.estado.jugador.seguidores.length < 2 || r.eventos.length > 0)).toBe(0);
    });

    it('el primer día sin comer, un seguidor se marcha más o menos el 20 % de las veces', () => {
      const estado = estadoCon({ comida: 0, seguidores: [seguidor('a')] });
      const veces = contar(estado, r => r.estado.jugador.seguidores.length === 0);
      expect(veces).toBeGreaterThan(150);
      expect(veces).toBeLessThan(250);
    });

    it('el primer día sin comer, hay motín más o menos el 20 % de las veces', () => {
      const veces = contar(estadoCon({ comida: 0 }), r => r.eventos.includes('motin'));
      expect(veces).toBeGreaterThan(150);
      expect(veces).toBeLessThan(250);
    });

    it('cuantos más días sin comer, más probable: el tercer día, más o menos el 40 %', () => {
      const estado = estadoCon({ comida: 0, diasSinComer: 2, condiciones: [HAMBRE], seguidores: [seguidor('a')] });
      const veces = contar(estado, r => r.estado.jugador.seguidores.length === 0);
      expect(veces).toBeGreaterThan(350);
      expect(veces).toBeLessThan(450);
    });

    it('a partir del noveno día sin comer se marchan seguro y hay motín seguro (tope 100 %)', () => {
      const estado = estadoCon({ comida: 0, vida: 15, diasSinComer: 8, condiciones: [HAMBRE], seguidores: [seguidor('a'), seguidor('b')] });
      const vivos = (r: ReturnType<typeof comer>) => !r.estado.mundo.finPartida;
      const total = contar(estado, vivos);
      expect(contar(estado, r => vivos(r) && r.estado.jugador.seguidores.length === 0 && r.eventos.includes('motin'))).toBe(total);
    });

    it('un seguidor inseparable no se marcha nunca', () => {
      const estado = estadoCon({ comida: 0, diasSinComer: 8, condiciones: [HAMBRE], seguidores: [seguidor('hermano', true), seguidor('b')] });
      expect(contar(estado, r => !r.estado.jugador.seguidores.some(s => s.id === 'hermano'))).toBe(0);
    });

    it('el seguidor que se marcha sale en los cambios como "se marcha", no como muerto', () => {
      const estado = estadoCon({ comida: 0, vida: 15, diasSinComer: 8, condiciones: [HAMBRE], seguidores: [seguidor('a')] });
      const r = comer(estado, 'reservas', 'barco', new Dados(1));
      if (!r.estado.mundo.finPartida) {
        expect(r.cambios).toContainEqual({ tipo: 'seguidor_se_marcha', seguidor: 'a' });
        expect(r.cambios.some(c => c.tipo === 'seguidor_muerto')).toBe(false);
      }
    });

    it('con la misma semilla pasa siempre lo mismo', () => {
      const estado = estadoCon({ comida: 0, diasSinComer: 3, condiciones: [HAMBRE], seguidores: [seguidor('a'), seguidor('b')] });
      expect(comer(estado, 'reservas', 'barco', new Dados(42))).toEqual(comer(estado, 'reservas', 'barco', new Dados(42)));
    });
  });
});
