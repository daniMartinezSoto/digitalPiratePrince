import type { Condicion } from '../catalogos/condicion';
import { Dados } from '../dados/dados';
import type { CondicionActiva } from '../estado/condicion-activa';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import type { Tabla } from '../tablas/rangos/tabla';
import { iniciarTurno, type CatalogosTurno } from './iniciar-turno';

// ---------------------------------------------------------------------------
// Catálogo de prueba (inventado para los tests, no es el del juego).
// Las tablas usan "1d1" (un dado que siempre saca 1) para saber qué fila sale.
// ---------------------------------------------------------------------------

const TABLAS_PRUEBA: Tabla[] = [
  { id: 'amaina', dado: '1d1', filas: [
    { min: 1, max: 1, texto: 'La tormenta amaina.', efectos: [{ tipo: 'quitar_condicion', condicion: 'tormenta' }] },
  ] },
  { id: 'sigue', dado: '1d1', filas: [{ min: 1, max: 1, texto: 'El mal tiempo continúa.' }] },
  { id: 'persisten', dado: '1d1', filas: [
    { min: 1, max: 1, texto: 'Las lluvias persisten, pierdes tu fase de acción.', efectos: [
      { tipo: 'perder_turnos', cantidad: 1 },
      { tipo: 'quitar_condicion', condicion: 'lluvias' },
    ] },
  ] },
  // "el_mal" es también un id de tirada: admite bonificadores (las pistas).
  { id: 'el_mal', dado: '1d1', filas: [
    { min: 1, max: 1, texto: 'La criatura ataca.', efectos: [{ tipo: 'tripulacion', cantidad: -1 }] },
    { min: 2, max: 2, texto: 'Expulsas a la criatura.', evento: 'amuleto_maldito', efectos: [
      { tipo: 'quitar_condicion', condicion: 'el_mal' },
      { tipo: 'quitar_condicion', condicion: 'pistas' },
      { tipo: 'fama', cantidad: 1 },
    ] },
  ] },
  { id: 'peste', dado: '1d1', filas: [{ min: 1, max: 1, texto: 'La peste arrasa.', efectos: [{ tipo: 'tripulacion', operacion: 'todo' }] }] },
  { id: 'azar', dado: '1d6', filas: [{ min: 1, max: 6, texto: 'Algo pasa.', efectos: [{ tipo: 'oro', cantidad: '2d6' }] }] },
];

const CONDICIONES_PRUEBA: Condicion[] = [
  { id: 'tormenta', nombre: 'Tormenta', descripcion: 'x', categoria: 'clima', prohibe: ['viajar'], cadaTurno: { tabla: 'amaina' } },
  { id: 'niebla', nombre: 'Niebla', descripcion: 'x', categoria: 'clima', cadaTurno: { tabla: 'sigue' } },
  { id: 'lluvias', nombre: 'Lluvias', descripcion: 'x', categoria: 'clima', cadaTurno: { tabla: 'persisten' } },
  { id: 'el_mal', nombre: 'El mal', descripcion: 'x', categoria: 'maldicion',
    cadaTurno: { efectos: [{ tipo: 'tripulacion', cantidad: -1 }], tabla: 'el_mal' } },
  { id: 'pistas', nombre: 'Pistas', descripcion: 'x', categoria: 'otra', modificadores: { el_mal: 1 } },
  { id: 'fuga', nombre: 'Vía de agua', descripcion: 'x', categoria: 'otra', cadaTurno: { efectos: [{ tipo: 'tripulacion', cantidad: -2 }] } },
  { id: 'peste', nombre: 'Peste', descripcion: 'x', categoria: 'enfermedad', cadaTurno: { tabla: 'peste' } },
  { id: 'azar', nombre: 'Azar', descripcion: 'x', categoria: 'otra', cadaTurno: { tabla: 'azar' } },
  { id: 'maleficio', nombre: 'Maleficio', descripcion: 'x', categoria: 'maldicion' },
];

const CATALOGOS: CatalogosTurno = { objetos: [], condiciones: CONDICIONES_PRUEBA, tablas: TABLAS_PRUEBA };

// Una partida recién creada, con las condiciones y los valores del jugador que queramos.
function estadoCon(condiciones: (string | CondicionActiva)[], cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  const activas = condiciones.map(c => (typeof c === 'string' ? { id: c } : c));
  // Las cuentas de estos tests se hicieron con 15 PV (la vida inicial era 15 hasta el Sprint 7; ahora es 18).
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', tripulacion: 30, vida: 15, vidaMax: 15, condiciones: activas, ...cambios } };
}

function seguidor(id: string): Seguidor {
  return { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
}

function amanecer(estado: Estado) {
  return iniciarTurno(estado, new Dados(1), CATALOGOS);
}

describe('iniciarTurno', () => {
  // -------------------------------------------------------------------------
  describe('lo básico', () => {
    it('sin condiciones: no pasa nada y el día pasa a la fase de acción', () => {
      const r = amanecer(estadoCon([]));
      expect(r.parte).toEqual([]);
      expect(r.eventos).toEqual([]);
      expect(r.accionPerdida).toBe(false);
      expect(r.estado.mundo.fase).toBe('accion');
      expect(r.estado.mundo.dia).toBe(1);
    });

    it('no modifica el estado que recibe: devuelve uno nuevo', () => {
      const estado = estadoCon(['el_mal', 'tormenta']);
      const copia = structuredClone(estado);
      amanecer(estado);
      expect(estado).toEqual(copia);
    });

    it('solo se puede llamar en la fase de inicio', () => {
      const estado = estadoCon([]);
      const enComida: Estado = { ...estado, mundo: { ...estado.mundo, fase: 'comida' } };
      expect(() => amanecer(enComida)).toThrow(/solo se puede empezar el turno en la fase "inicio".*"comida"/);
    });

    it('no se puede llamar dos veces seguidas (un solo amanecer por día)', () => {
      const r = amanecer(estadoCon(['fuga']));
      expect(() => amanecer(r.estado)).toThrow(/fase "inicio"/);
    });

    it('no se puede llamar si la partida ya ha terminado', () => {
      const estado = estadoCon([]);
      const terminada: Estado = { ...estado, mundo: { ...estado.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };
      expect(() => amanecer(terminada)).toThrow(/ya ha terminado/);
    });

    it('avisa si el jugador tiene una condición que no está en el catálogo', () => {
      expect(() => amanecer(estadoCon(['inventada']))).toThrow(/"inventada".*no está en el catálogo/);
    });

    it('una condición que no hace nada cada turno no sale en el parte', () => {
      const r = amanecer(estadoCon(['maleficio']));
      expect(r.parte).toEqual([]);
      expect(r.estado.jugador.condiciones).toEqual([{ id: 'maleficio' }]);
    });
  });

  // -------------------------------------------------------------------------
  describe('lo que hace cada condición', () => {
    it('efectos fijos: la vía de agua quita 2 de tripulación', () => {
      const r = amanecer(estadoCon(['fuga']));
      expect(r.estado.jugador.tripulacion).toBe(28);
      expect(r.parte).toEqual([
        { condicion: 'fuga', cambios: [{ tipo: 'recurso', recurso: 'tripulacion', antes: 30, despues: 28 }] },
      ]);
    });

    it('tirada diaria: la tormenta amaina y se quita', () => {
      const r = amanecer(estadoCon(['tormenta']));
      expect(r.estado.jugador.condiciones).toEqual([]);
      expect(r.parte).toEqual([
        {
          condicion: 'tormenta',
          tirada: { tabla: 'amaina', dados: [1], modificador: 0, total: 1, texto: 'La tormenta amaina.' },
          cambios: [{ tipo: 'condicion_quitada', condicion: 'tormenta' }],
        },
      ]);
    });

    it('tirada diaria sin efectos: la niebla sigue, y sale en el parte con su texto', () => {
      const r = amanecer(estadoCon(['niebla']));
      expect(r.estado.jugador.condiciones).toEqual([{ id: 'niebla' }]);
      expect(r.parte[0].tirada?.texto).toBe('El mal tiempo continúa.');
      expect(r.parte[0].cambios).toEqual([]);
    });

    it('efectos fijos y tirada: el mal quita 1 de tripulación y luego tira en su tabla', () => {
      const r = amanecer(estadoCon(['el_mal']));
      // -1 fijo, y la fila 1 de la tabla quita otro.
      expect(r.estado.jugador.tripulacion).toBe(28);
      expect(r.parte[0].tirada).toEqual({ tabla: 'el_mal', dados: [1], modificador: 0, total: 1, texto: 'La criatura ataca.' });
      expect(r.parte[0].cambios).toEqual([
        { tipo: 'recurso', recurso: 'tripulacion', antes: 30, despues: 29 },
        { tipo: 'recurso', recurso: 'tripulacion', antes: 29, despues: 28 },
      ]);
    });

    it('la tirada lleva los bonificadores del jugador: con las pistas, +1 en la tabla de el mal', () => {
      const r = amanecer(estadoCon(['el_mal', 'pistas']));
      expect(r.parte[0].tirada).toEqual({ tabla: 'el_mal', dados: [1], modificador: 1, total: 2, texto: 'Expulsas a la criatura.' });
      expect(r.estado.jugador.condiciones).toEqual([]);
      expect(r.estado.jugador.fama).toBe(1);
    });

    it('si la fila manda a un evento, lo devuelve como pendiente', () => {
      expect(amanecer(estadoCon(['el_mal', 'pistas'])).eventos).toEqual(['amuleto_maldito']);
      expect(amanecer(estadoCon(['el_mal'])).eventos).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('varias condiciones', () => {
    it('actúan de la más antigua a la más nueva', () => {
      const r = amanecer(estadoCon(['fuga', 'tormenta', 'el_mal']));
      expect(r.parte.map(p => p.condicion)).toEqual(['fuga', 'tormenta', 'el_mal']);
      expect(r.estado.jugador.tripulacion).toBe(26); // -2 de la vía de agua, -1 y -1 del mal
    });

    it('una condición que otra se ha llevado esa mañana ya no hace nada', () => {
      // El mal se resuelve y se lleva las pistas; la niebla, detrás, sí actúa.
      const r = amanecer(estadoCon(['el_mal', 'pistas', 'niebla']));
      expect(r.parte.map(p => p.condicion)).toEqual(['el_mal', 'niebla']);
    });

    it('si la partida termina a mitad de la mañana, las condiciones que quedan no actúan', () => {
      const r = amanecer(estadoCon(['peste', 'fuga', 'tormenta']));
      expect(r.estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'tripulacion', causa: { tipo: 'condicion', condicion: 'peste' } });
      expect(r.parte.map(p => p.condicion)).toEqual(['peste']);
      expect(r.estado.jugador.condiciones.map(c => c.id)).toEqual(['peste', 'fuga', 'tormenta']);
      expect(r.estado.mundo.fase).toBe('inicio'); // el día no sigue
    });

    it('si los efectos fijos acaban la partida, ya no se tira en la tabla', () => {
      const r = amanecer(estadoCon(['el_mal'], { tripulacion: 1 }));
      expect(r.estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'tripulacion', causa: { tipo: 'condicion', condicion: 'el_mal' } });
      expect(r.parte[0].tirada).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('condiciones con los turnos contados', () => {
    it('cada amanecer se le resta un turno', () => {
      const r = amanecer(estadoCon([{ id: 'maleficio', turnosRestantes: 3 }]));
      expect(r.estado.jugador.condiciones).toEqual([{ id: 'maleficio', turnosRestantes: 2 }]);
      expect(r.parte).toEqual([]); // restar un día no es una noticia
    });

    it('al llegar a 0 se quita, y sale en el parte', () => {
      const r = amanecer(estadoCon([{ id: 'maleficio', turnosRestantes: 1 }]));
      expect(r.estado.jugador.condiciones).toEqual([]);
      expect(r.parte).toEqual([{ condicion: 'maleficio', cambios: [{ tipo: 'condicion_quitada', condicion: 'maleficio' }] }]);
    });

    it('el último día todavía actúa antes de quitarse', () => {
      const r = amanecer(estadoCon([{ id: 'fuga', turnosRestantes: 1 }]));
      expect(r.estado.jugador.tripulacion).toBe(28);
      expect(r.estado.jugador.condiciones).toEqual([]);
    });

    it('una condición sin turnos dura hasta que algo la quite', () => {
      const r = amanecer(estadoCon(['maleficio']));
      expect(r.estado.jugador.condiciones).toEqual([{ id: 'maleficio' }]);
    });
  });

  // -------------------------------------------------------------------------
  describe('fases de acción perdidas', () => {
    it('con una fase perdida: se gasta y el día pasa directo a la comida', () => {
      const r = amanecer(estadoCon([], { fasesAccionPerdidas: 1 }));
      expect(r.accionPerdida).toBe(true);
      expect(r.estado.mundo.fase).toBe('comida');
      expect(r.estado.jugador.fasesAccionPerdidas).toBe(0);
    });

    it('con varias, solo se gasta una por día', () => {
      const r = amanecer(estadoCon([], { fasesAccionPerdidas: 3 }));
      expect(r.accionPerdida).toBe(true);
      expect(r.estado.jugador.fasesAccionPerdidas).toBe(2);
    });

    it('las lluvias que persisten quitan la acción de ESE MISMO día', () => {
      const r = amanecer(estadoCon(['lluvias']));
      expect(r.parte[0].tirada?.texto).toBe('Las lluvias persisten, pierdes tu fase de acción.');
      expect(r.accionPerdida).toBe(true);
      expect(r.estado.mundo.fase).toBe('comida');
      expect(r.estado.jugador.fasesAccionPerdidas).toBe(0);
      expect(r.estado.jugador.condiciones).toEqual([]); // mañana despeja seguro
    });
  });

  // -------------------------------------------------------------------------
  describe('dados', () => {
    it('apunta en el estado por dónde van los dados', () => {
      const dados = new Dados(7);
      const r = iniciarTurno(estadoCon(['azar']), dados, CATALOGOS);
      expect(r.estado.mundo.estadoDados).toBe(dados.obtenerEstado());
    });

    it('con la misma semilla pasa siempre lo mismo', () => {
      const a = iniciarTurno(estadoCon(['azar', 'el_mal']), new Dados(42), CATALOGOS);
      const b = iniciarTurno(estadoCon(['azar', 'el_mal']), new Dados(42), CATALOGOS);
      expect(a).toEqual(b);
    });

    it('gasta los dados en orden fijo: primero el dado de la tabla y luego los de sus efectos', () => {
      const gemelo = new Dados(9);
      gemelo.tirar('1d6'); // el dado de la tabla "azar"
      const oro = gemelo.tirar('2d6').total;

      const r = iniciarTurno(estadoCon(['azar'], { oro: 0 }), new Dados(9), CATALOGOS);

      expect(r.estado.jugador.oro).toBe(oro);
    });
  });

  // -------------------------------------------------------------------------
  describe('con el catálogo real del juego', () => {
    it('el mal está a bordo: cada amanecer quita al menos 1 de tripulación y tira en su tabla', () => {
      const r = iniciarTurno(estadoCon(['el_mal']), new Dados(3));
      expect(r.parte[0].condicion).toBe('el_mal');
      expect(r.parte[0].tirada?.tabla).toBe('el_mal');
      expect(r.estado.jugador.tripulacion).toBeLessThan(30);
    });

    it('la tormenta acaba amainando', () => {
      const dados = new Dados(5);
      let estado = estadoCon(['tormenta']);
      let dias = 0;
      while (estado.jugador.condiciones.length > 0 && dias < 100) {
        const r = iniciarTurno(estado, dados);
        estado = { ...r.estado, mundo: { ...r.estado.mundo, fase: 'inicio' } }; // saltamos el resto del día
        dias++;
      }
      expect(estado.jugador.condiciones).toEqual([]);
      expect(dias).toBeLessThan(100);
    });

    it('el escorbuto sin seguidores solo puede quitar tripulación; con seguidores, puede matar a uno', () => {
      for (let semilla = 1; semilla <= 30; semilla++) {
        const solo = iniciarTurno(estadoCon(['escorbuto']), new Dados(semilla));
        expect(solo.estado.jugador.tripulacion).toBeLessThanOrEqual(30);
        expect(solo.estado.jugador.vida).toBe(15);

        const acompanado = iniciarTurno(estadoCon(['escorbuto'], { seguidores: [seguidor('a')] }), new Dados(semilla));
        const haMuerto = acompanado.estado.jugador.seguidores.length === 0;
        // Si muere el seguidor (fila 1), la tripulación no se toca.
        if (haMuerto) {
          expect(acompanado.estado.jugador.tripulacion).toBe(30);
        }
      }
    });
  });
});
