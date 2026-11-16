import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { Dados } from '../dados/dados';
import type { Jugador } from '../estado/jugador';
import { calcularModificador } from '../modificadores/calcular-modificador';
import { crearPartida } from '../partida/crear-partida';
import { tieneVinculoNativo } from '../personaje/vinculo-nativo';
import { crearSeguidor } from '../seguidores/crear-seguidor';
import { condicionesVigentes, tieneCondicion, type FuentesDeCondiciones } from './condiciones-vigentes';
import { comidaPorDia, condicionesQueProhiben, estaProhibido, famaObjetivoActual } from './consultas';
import { validarOtorga } from './validar-otorga';
import sobrenombres from '../../data/personaje/sobrenombres.json';

// Un jugador sin nada especial ("el fuerte" no otorga nada), con los cambios que queramos.
function jugadorCon(cambios: Partial<Jugador> = {}): Jugador {
  return { ...crearPartida(1, 'Prueba').estado.jugador, sobrenombre: 'el_fuerte', famaObjetivo: 10, ...cambios };
}

const ids = (jugador: Jugador, fuentes?: FuentesDeCondiciones) => condicionesVigentes(jugador, fuentes).map(v => v.id);

// Fuentes de prueba: un sobrenombre, un objeto y una habilidad que otorgan condiciones.
const FUENTES: FuentesDeCondiciones = {
  sobrenombres: [{ id: 'el_fuerte' }, { id: 'el_gafe', otorga: ['mala_pata'] }],
  objetos: [{ id: 'trebol', otorga: ['buena_suerte'] }, { id: 'piedra' }, { id: 'herradura', otorga: ['buena_suerte', 'peso'] }],
  habilidades: [{ id: 'cantar', otorga: ['alegria'] }, { id: 'nada' }],
};

function seguidorCon(id: string, habilidades: string[]) {
  return { id, tipo: 'x', nombre: id, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades };
}

describe('condicionesVigentes', () => {
  it('sin nada, no hay ninguna', () => {
    expect(condicionesVigentes(jugadorCon(), FUENTES)).toEqual([]);
  });

  describe('apuntadas (las que están en la hoja del personaje)', () => {
    it('salen con origen "apuntada", en el orden en que las tiene', () => {
      const jugador = jugadorCon({ condiciones: [{ id: 'tormenta' }, { id: 'escorbuto' }] });

      expect(condicionesVigentes(jugador, FUENTES)).toEqual([
        { id: 'tormenta', origen: 'apuntada' },
        { id: 'escorbuto', origen: 'apuntada' },
      ]);
    });

    it('si tienen los turnos contados, se dicen', () => {
      const jugador = jugadorCon({ condiciones: [{ id: 'tormenta', turnosRestantes: 2 }] });

      expect(condicionesVigentes(jugador, FUENTES)).toEqual([{ id: 'tormenta', origen: 'apuntada', turnosRestantes: 2 }]);
    });
  });

  describe('partes (las que van dentro de otra: el amuleto maldito)', () => {
    const conAmuleto = jugadorCon({
      condiciones: [{ id: 'amuleto_maldito', partes: ['fuerza_letal', 'hambre_insaciable'] }],
    });

    it('salen justo detrás de la condición que las lleva, diciendo dentro de cuál van', () => {
      expect(condicionesVigentes(conAmuleto, FUENTES)).toEqual([
        { id: 'amuleto_maldito', origen: 'apuntada' },
        { id: 'fuerza_letal', origen: 'parte', dentroDe: 'amuleto_maldito' },
        { id: 'hambre_insaciable', origen: 'parte', dentroDe: 'amuleto_maldito' },
      ]);
    });

    it('si se quita la condición que las lleva, desaparecen con ella', () => {
      const sinAmuleto = { ...conAmuleto, condiciones: [] };

      expect(condicionesVigentes(sinAmuleto, FUENTES)).toEqual([]);
    });
  });

  describe('otorgadas (las que le dan sus cosas mientras las tiene)', () => {
    it('por el sobrenombre', () => {
      expect(condicionesVigentes(jugadorCon({ sobrenombre: 'el_gafe' }), FUENTES)).toEqual([{ id: 'mala_pata', origen: 'otorgada' }]);
    });

    it('por un objeto que lleva', () => {
      expect(ids(jugadorCon({ inventario: [{ id: 'trebol' }] }), FUENTES)).toEqual(['buena_suerte']);
    });

    it('un objeto puede otorgar varias', () => {
      expect(ids(jugadorCon({ inventario: [{ id: 'herradura' }] }), FUENTES)).toEqual(['buena_suerte', 'peso']);
    });

    it('un objeto que no otorga nada no molesta', () => {
      expect(ids(jugadorCon({ inventario: [{ id: 'piedra' }] }), FUENTES)).toEqual([]);
    });

    it('por la habilidad de un seguidor', () => {
      const jugador = jugadorCon({ seguidores: [seguidorCon('a', ['nada', 'cantar'])] });

      expect(ids(jugador, FUENTES)).toEqual(['alegria']);
    });

    it('al perder el objeto, la condición desaparece sola', () => {
      const con = jugadorCon({ inventario: [{ id: 'trebol' }] });
      const sin = { ...con, inventario: [] };

      expect(tieneCondicion(con, 'buena_suerte', FUENTES)).toBe(true);
      expect(tieneCondicion(sin, 'buena_suerte', FUENTES)).toBe(false);
    });

    it('si se la dan dos cosas, sale una sola vez', () => {
      const jugador = jugadorCon({ inventario: [{ id: 'trebol' }, { id: 'herradura' }, { id: 'trebol' }] });

      expect(ids(jugador, FUENTES)).toEqual(['buena_suerte', 'peso']);
    });

    it('si se la dan dos cosas y pierde una, la sigue teniendo', () => {
      const jugador = jugadorCon({ inventario: [{ id: 'herradura' }] });

      expect(tieneCondicion(jugador, 'buena_suerte', FUENTES)).toBe(true);
    });

    it('si además la tiene apuntada, cuenta como apuntada (y sale una vez)', () => {
      const jugador = jugadorCon({ condiciones: [{ id: 'buena_suerte' }], inventario: [{ id: 'trebol' }] });

      expect(condicionesVigentes(jugador, FUENTES)).toEqual([{ id: 'buena_suerte', origen: 'apuntada' }]);
    });
  });

  it('orden completo: apuntadas con sus partes, y después sobrenombre, objetos y seguidores', () => {
    const jugador = jugadorCon({
      sobrenombre: 'el_gafe',
      condiciones: [{ id: 'amuleto_maldito', partes: ['fuerza_letal'] }, { id: 'tormenta' }],
      inventario: [{ id: 'trebol' }],
      seguidores: [seguidorCon('a', ['cantar'])],
    });

    expect(ids(jugador, FUENTES)).toEqual(['amuleto_maldito', 'fuerza_letal', 'tormenta', 'mala_pata', 'buena_suerte', 'alegria']);
  });

  it('no modifica al jugador', () => {
    const jugador = jugadorCon({ condiciones: [{ id: 'amuleto_maldito', partes: ['fuerza_letal'] }], inventario: [{ id: 'trebol' }] });
    const copia = structuredClone(jugador);

    condicionesVigentes(jugador, FUENTES);

    expect(jugador).toEqual(copia);
  });
});

describe('vínculo nativo (con los catálogos del juego)', () => {
  const nativo = crearSeguidor('nativo', [], new Dados(1));

  it('es una condición del catálogo', () => {
    expect(CONDICIONES.some(c => c.id === 'vinculo_nativo')).toBe(true);
  });

  it('la otorgan "el nativo", el amuleto kalinago y el seguidor nativo', () => {
    expect(ids(jugadorCon({ sobrenombre: 'el_nativo' }))).toEqual(['vinculo_nativo']);
    expect(ids(jugadorCon({ inventario: [{ id: 'amuleto_kalinago' }] }))).toEqual(['vinculo_nativo']);
    expect(ids(jugadorCon({ seguidores: [nativo] }))).toEqual(['vinculo_nativo']);
  });

  it('con las tres cosas a la vez, el icono sale una sola vez...', () => {
    const jugador = jugadorCon({ sobrenombre: 'el_nativo', inventario: [{ id: 'amuleto_kalinago' }], seguidores: [nativo] });

    expect(condicionesVigentes(jugador)).toEqual([{ id: 'vinculo_nativo', origen: 'otorgada' }]);
  });

  it('...pero los +1 de aldea siguen sumando los tres', () => {
    const jugador = jugadorCon({ sobrenombre: 'el_nativo', inventario: [{ id: 'amuleto_kalinago' }], seguidores: [nativo] });

    expect(calcularModificador(jugador, 'audiencia_aldea')).toBe(3);
  });

  it('si el seguidor nativo se va (o muere), el vínculo desaparece', () => {
    const con = jugadorCon({ seguidores: [nativo] });
    const sin = { ...con, seguidores: [] };

    expect(tieneVinculoNativo(con)).toBe(true);
    expect(tieneVinculoNativo(sin)).toBe(false);
  });

  it('un jugador cualquiera no lo tiene', () => {
    expect(tieneVinculoNativo(jugadorCon())).toBe(false);
  });
});

describe('las reglas miran las condiciones vigentes (con los catálogos del juego)', () => {
  const amuleto = (...partes: string[]) => jugadorCon({ condiciones: [{ id: 'amuleto_maldito', partes }] });

  it('hambre insaciable dentro del amuleto: 2 reservas de comida al día', () => {
    expect(comidaPorDia(amuleto('hambre_insaciable'))).toBe(2);
    expect(comidaPorDia(jugadorCon())).toBe(1);
  });

  it('ambición desmedida dentro del amuleto: hacen falta 12 de fama', () => {
    expect(famaObjetivoActual(amuleto('ambicion_desmedida'))).toBe(12);
  });

  it('hedor nauseabundo dentro del amuleto: prohibidos los nuevos seguidores', () => {
    expect(estaProhibido(amuleto('hedor_nauseabundo'), 'nuevos_seguidores')).toBe(true);
    expect(condicionesQueProhiben(amuleto('hedor_nauseabundo'), 'nuevos_seguidores')).toEqual(['hedor_nauseabundo']);
  });

  it('rechazo a la autoridad dentro del amuleto: prohibido solicitar audiencia', () => {
    expect(estaProhibido(amuleto('rechazo_a_la_autoridad'), 'solicitar_audiencia')).toBe(true);
  });

  it('sin el amuleto, todo vuelve solo a lo normal', () => {
    const sin = { ...amuleto('hambre_insaciable', 'ambicion_desmedida'), condiciones: [] };

    expect(comidaPorDia(sin)).toBe(1);
    expect(famaObjetivoActual(sin)).toBe(10);
  });

  it('los bonificadores de una condición que va dentro de otra también cuentan', () => {
    // "pistas_criatura" da +1 contra el mal; aquí la metemos dentro de otra solo para probarlo.
    const jugador = jugadorCon({ condiciones: [{ id: 'amuleto_maldito', partes: ['pistas_criatura'] }] });

    expect(calcularModificador(jugador, 'el_mal')).toBe(1);
  });
});

describe('validarOtorga', () => {
  const VALIDAS = ['vinculo_nativo', 'tormenta'];

  it('sin "otorga" no hay errores', () => {
    expect(validarOtorga(undefined, 'Objeto "x"', VALIDAS)).toEqual([]);
  });

  it('acepta condiciones que existen', () => {
    expect(validarOtorga(['vinculo_nativo', 'tormenta'], 'Objeto "x"', VALIDAS)).toEqual([]);
  });

  it('avisa de una condición que no existe', () => {
    expect(validarOtorga(['vinculo_natibo'], 'Objeto "x"', VALIDAS).join(' | ')).toContain(
      'Objeto "x": otorga la condición "vinculo_natibo", que no existe',
    );
  });

  it('avisa si está vacío o no es una lista', () => {
    expect(validarOtorga([], 'Objeto "x"', VALIDAS).join(' | ')).toContain('"otorga" debe ser una lista con al menos una');
    expect(validarOtorga('vinculo_nativo', 'Objeto "x"', VALIDAS).join(' | ')).toContain('"otorga" debe ser una lista con al menos una');
  });

  it('por defecto comprueba contra el catálogo del juego', () => {
    expect(validarOtorga(['vinculo_nativo'], 'Objeto "x"')).toEqual([]);
    expect(validarOtorga(['no_existe'], 'Objeto "x"')).toHaveLength(1);
  });

  it('lo que otorgan los sobrenombres de sobrenombres.json existe en el catálogo', () => {
    for (const sobrenombre of sobrenombres as { id: string; otorga?: unknown }[]) {
      expect(validarOtorga(sobrenombre.otorga, `Sobrenombre "${sobrenombre.id}"`)).toEqual([]);
    }
  });
});
