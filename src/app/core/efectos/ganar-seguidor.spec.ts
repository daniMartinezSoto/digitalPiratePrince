import { AJUSTES } from '../ajustes/ajustes';
import type { Condicion } from '../catalogos/condicion';
import type { TipoSeguidor } from '../catalogos/tipo-seguidor';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import type { Efecto } from '../tablas/efecto';
import { aplicarEfectos, type CatalogosEfectos } from './aplicar-efectos';

// Tests del efecto "se une un seguidor" (ganar_seguidor) de aplicarEfectos.

function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', ...cambios } };
}

function seguidor(id: string, inseparable = false): Seguidor {
  const s: Seguidor = { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
  return inseparable ? { ...s, inseparable: true } : s;
}

// Un grupo con el máximo de seguidores: viejo_1, viejo_2...
function grupoLleno(): Seguidor[] {
  return Array.from({ length: AJUSTES.maximoSeguidores }, (_, i) => seguidor(`viejo_${i + 1}`));
}

const UN_FORZUDO: Efecto = { tipo: 'ganar_seguidor', seguidor: 'forzudo' };

// Catálogo de prueba con una condición que prohíbe nuevos seguidores y pocos nombres.
const TIPOS: TipoSeguidor[] = [{ id: 'grumete', nombre: 'Grumete', descripcion: 'x', ataque: 2, resistencia: 10, habilidades: [] }];
const CONDICIONES: Condicion[] = [
  { id: 'hedor', nombre: 'Hedor nauseabundo', descripcion: 'x', categoria: 'maldicion', prohibe: ['nuevos_seguidores'] },
];
const CATALOGOS: CatalogosEfectos = { objetos: [], condiciones: CONDICIONES, seguidores: TIPOS, nombres: { hombres: ['Ana'], mujeres: ['Blas'] } };

describe('aplicarEfectos: se une un seguidor', () => {
  describe('con sitio en el grupo', () => {
    it('el seguidor entra en el grupo con los números de su ficha y un nombre', () => {
      const { estado } = aplicarEfectos(estadoCon(), [UN_FORZUDO], new Dados(1));

      expect(estado.jugador.seguidores).toHaveLength(1);
      const forzudo = estado.jugador.seguidores[0];
      expect(forzudo.id).toBe('forzudo_1');
      expect(forzudo.tipo).toBe('forzudo');
      expect(forzudo.ataque).toBe(3);
      expect(forzudo.resistencia).toBe(10);
      expect(forzudo.nombre.length).toBeGreaterThan(0);
    });

    it('avisa de que se ha unido', () => {
      const { cambios } = aplicarEfectos(estadoCon(), [UN_FORZUDO], new Dados(1));

      expect(cambios).toEqual([{ tipo: 'seguidor_se_une', seguidor: 'forzudo_1' }]);
    });

    it('se pone al final del grupo, detrás de los que ya había', () => {
      const estado = estadoCon({ seguidores: [seguidor('viejo_1')] });

      const { estado: nuevo } = aplicarEfectos(estado, [UN_FORZUDO], new Dados(1));

      expect(nuevo.jugador.seguidores.map(s => s.id)).toEqual(['viejo_1', 'forzudo_1']);
    });

    it('dos del mismo tipo: forzudo_1 y forzudo_2, con nombres distintos', () => {
      const { estado } = aplicarEfectos(estadoCon(), [UN_FORZUDO, UN_FORZUDO], new Dados(1));

      const [uno, dos] = estado.jugador.seguidores;
      expect([uno.id, dos.id]).toEqual(['forzudo_1', 'forzudo_2']);
      expect(uno.nombre).not.toBe(dos.nombre);
    });

    it('puede unirse como inseparable', () => {
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'bruja_vudu', inseparable: true };

      const { estado } = aplicarEfectos(estadoCon(), [efecto], new Dados(1));

      expect(estado.jugador.seguidores[0].inseparable).toBe(true);
    });

    it('si no se dice, no es inseparable', () => {
      const { estado } = aplicarEfectos(estadoCon(), [UN_FORZUDO], new Dados(1));

      expect('inseparable' in estado.jugador.seguidores[0]).toBe(false);
    });

    it('si había sitio, no se despide a nadie aunque el efecto lo diga', () => {
      const estado = estadoCon({ seguidores: [seguidor('viejo_1')] });
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'forzudo', despedir: 'viejo_1' };

      const { estado: nuevo, cambios } = aplicarEfectos(estado, [efecto], new Dados(1));

      expect(nuevo.jugador.seguidores.map(s => s.id)).toEqual(['viejo_1', 'forzudo_1']);
      expect(cambios).toEqual([{ tipo: 'seguidor_se_une', seguidor: 'forzudo_1' }]);
    });

    it('no modifica el estado que recibe', () => {
      const estado = estadoCon({ seguidores: [seguidor('viejo_1')] });
      const copia = structuredClone(estado);

      aplicarEfectos(estado, [UN_FORZUDO], new Dados(1));

      expect(estado).toEqual(copia);
    });

    it('gasta un número del generador (el del nombre)', () => {
      const dados = new Dados(3);
      const testigo = new Dados(3);

      aplicarEfectos(estadoCon(), [UN_FORZUDO], dados);
      testigo.entero(0, 1);

      expect(dados.obtenerEstado()).toBe(testigo.obtenerEstado());
    });

    it('avisa con un error si el tipo de seguidor no existe', () => {
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'forzuda' };

      expect(() => aplicarEfectos(estadoCon(), [efecto], new Dados(1))).toThrow(/no existe el tipo de seguidor "forzuda"/);
    });
  });

  describe('con el grupo lleno', () => {
    it('si no se despide a nadie, el nuevo no entra y se avisa', () => {
      const estado = estadoCon({ seguidores: grupoLleno() });

      const { estado: nuevo, cambios } = aplicarEfectos(estado, [UN_FORZUDO], new Dados(1));

      expect(nuevo.jugador.seguidores.map(s => s.id)).toEqual(estado.jugador.seguidores.map(s => s.id));
      expect(cambios).toEqual([{ tipo: 'seguidor_no_se_une', tipoSeguidor: 'forzudo', motivo: 'grupo_lleno' }]);
    });

    it('si no entra, no gasta ningún número del generador', () => {
      const dados = new Dados(3);
      const estadoInicial = dados.obtenerEstado();

      aplicarEfectos(estadoCon({ seguidores: grupoLleno() }), [UN_FORZUDO], dados);

      expect(dados.obtenerEstado()).toBe(estadoInicial);
    });

    it('despidiendo a uno, ese se va y el nuevo entra', () => {
      const estado = estadoCon({ seguidores: grupoLleno() });
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'forzudo', despedir: 'viejo_2' };

      const { estado: nuevo, cambios } = aplicarEfectos(estado, [efecto], new Dados(1));

      const ids = nuevo.jugador.seguidores.map(s => s.id);
      expect(ids).toHaveLength(AJUSTES.maximoSeguidores);
      expect(ids).not.toContain('viejo_2');
      expect(ids[ids.length - 1]).toBe('forzudo_1');
      expect(cambios).toEqual([
        { tipo: 'seguidor_despedido', seguidor: 'viejo_2' },
        { tipo: 'seguidor_se_une', seguidor: 'forzudo_1' },
      ]);
    });

    it('a un inseparable no se le puede despedir: es un error', () => {
      const grupo = grupoLleno();
      grupo[0] = seguidor('hermano', true);
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'forzudo', despedir: 'hermano' };

      expect(() => aplicarEfectos(estadoCon({ seguidores: grupo }), [efecto], new Dados(1))).toThrow(/es inseparable/);
    });

    it('despedir a alguien que no está en el grupo es un error', () => {
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'forzudo', despedir: 'fantasma' };

      expect(() => aplicarEfectos(estadoCon({ seguidores: grupoLleno() }), [efecto], new Dados(1))).toThrow(
        /no está en el grupo/,
      );
    });
  });

  describe('con una condición que prohíbe nuevos seguidores', () => {
    it('el seguidor no entra y se avisa del motivo', () => {
      const estado = estadoCon({ condiciones: [{ id: 'hedor' }] });
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'grumete' };

      const { estado: nuevo, cambios } = aplicarEfectos(estado, [efecto], new Dados(1), CATALOGOS);

      expect(nuevo.jugador.seguidores).toEqual([]);
      expect(cambios).toEqual([{ tipo: 'seguidor_no_se_une', tipoSeguidor: 'grumete', motivo: 'prohibido' }]);
    });

    it('con el grupo lleno tampoco se despide a nadie: la prohibición va primero', () => {
      const estado = estadoCon({ condiciones: [{ id: 'hedor' }], seguidores: grupoLleno() });
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'grumete', despedir: 'viejo_1' };

      const { estado: nuevo, cambios } = aplicarEfectos(estado, [efecto], new Dados(1), CATALOGOS);

      expect(nuevo.jugador.seguidores).toHaveLength(AJUSTES.maximoSeguidores);
      expect(cambios).toEqual([{ tipo: 'seguidor_no_se_une', tipoSeguidor: 'grumete', motivo: 'prohibido' }]);
    });

    it('sin la condición, con ese mismo catálogo sí entra, con un nombre de la lista de prueba', () => {
      const efecto: Efecto = { tipo: 'ganar_seguidor', seguidor: 'grumete' };

      const { estado } = aplicarEfectos(estadoCon(), [efecto], new Dados(1), CATALOGOS);

      expect(['Ana', 'Blas']).toContain(estado.jugador.seguidores[0].nombre);
    });
  });

  // Sprint 10: el deseo de amistad da un seguidor de un tipo al azar entre TODOS los del catálogo.
  describe('de un tipo al azar ("al_azar")', () => {
    const AL_AZAR: Efecto = { tipo: 'ganar_seguidor', seguidor: 'al_azar', inseparable: true };
    const DOS_TIPOS: TipoSeguidor[] = [
      { id: 'grumete', nombre: 'Grumete', descripcion: 'x', ataque: 2, resistencia: 10, habilidades: [] },
      { id: 'cocinera', nombre: 'Cocinera', descripcion: 'x', ataque: 1, resistencia: 8, habilidades: [] },
    ];
    const CON_DOS_TIPOS: CatalogosEfectos = { ...CATALOGOS, seguidores: DOS_TIPOS };

    it('entra un seguidor de uno de los tipos del catálogo, inseparable si lo dice el efecto', () => {
      const { estado } = aplicarEfectos(estadoCon(), [AL_AZAR], new Dados(1), CON_DOS_TIPOS);

      const nuevo = estado.jugador.seguidores[0];
      expect(['grumete', 'cocinera']).toContain(nuevo.tipo);
      expect(nuevo.inseparable).toBe(true);
    });

    it('con dados distintos salen tipos distintos (de verdad es al azar)', () => {
      const tipos = new Set<string>();
      for (let semilla = 1; semilla <= 30; semilla++) {
        const { estado } = aplicarEfectos(estadoCon(), [AL_AZAR], new Dados(semilla), CON_DOS_TIPOS);
        tipos.add(estado.jugador.seguidores[0].tipo);
      }
      expect([...tipos].sort()).toEqual(['cocinera', 'grumete']);
    });

    it('con el grupo lleno no entra, y el aviso dice qué tipo había salido', () => {
      const { estado, cambios } = aplicarEfectos(estadoCon({ seguidores: grupoLleno() }), [AL_AZAR], new Dados(1), CON_DOS_TIPOS);

      expect(estado.jugador.seguidores.map(s => s.id)).toEqual(grupoLleno().map(s => s.id));
      expect(cambios).toHaveLength(1);
      expect(cambios[0]).toMatchObject({ tipo: 'seguidor_no_se_une', motivo: 'grupo_lleno' });
      expect(['grumete', 'cocinera']).toContain((cambios[0] as { tipoSeguidor: string }).tipoSeguidor);
    });

    it('con el catálogo de verdad, el tipo es uno de data/seguidores.json', () => {
      const { estado } = aplicarEfectos(estadoCon(), [AL_AZAR], new Dados(3));

      expect(estado.jugador.seguidores).toHaveLength(1);
      expect(estado.jugador.seguidores[0].tipo).not.toBe('al_azar');
    });
  });
});
