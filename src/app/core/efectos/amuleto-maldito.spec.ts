import { validarHabilidades } from '../catalogos/validar-habilidad';
import { validarObjetos } from '../catalogos/validar-objeto';
import type { Habilidad } from '../catalogos/habilidad';
import type { Objeto } from '../catalogos/objeto';
import { comidaPorDia, estaProhibido } from '../condiciones/consultas';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import type { Efecto } from '../tablas/efecto';
import type { Tabla } from '../tablas/rangos/tabla';
import { validarTabla } from '../tablas/rangos/validar-tabla';
import { aplicarEfectos } from './aplicar-efectos';

// El amuleto maldito es UNA condición (cuenta como maldición) que lleva dentro dos mitades:
// una bendición y una maldición. Si se quita, se van las dos. Y la maldición "odio al dinero".
// (Aquí se prueba con dos maldiciones dentro; las bendiciones, en amuleto-maldito/amuleto-maldito.spec.ts.)

function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', ...cambios } };
}

const PONER_AMULETO: Efecto = { tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes: ['hambre_insaciable', 'hedor_nauseabundo'] };
const QUITAR_UNA_MALDICION: Efecto = { tipo: 'quitar_condicion', categoria: 'maldicion' };

describe('amuleto maldito: una condición con dos mitades dentro', () => {
  it('al ponerlo, se apunta UNA condición que lleva las dos dentro', () => {
    const { estado } = aplicarEfectos(estadoCon(), [PONER_AMULETO], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['hambre_insaciable', 'hedor_nauseabundo'] }]);
  });

  it('el chivato avisa del amuleto y de lo que lleva dentro', () => {
    const { cambios } = aplicarEfectos(estadoCon(), [PONER_AMULETO], new Dados(1));

    expect(cambios).toEqual([
      { tipo: 'condicion_puesta', condicion: 'amuleto_maldito', partes: ['hambre_insaciable', 'hedor_nauseabundo'] },
    ]);
  });

  it('mientras lo lleva, las dos mitades funcionan', () => {
    const { estado } = aplicarEfectos(estadoCon(), [PONER_AMULETO], new Dados(1));

    expect(comidaPorDia(estado.jugador)).toBe(2);
    expect(estaProhibido(estado.jugador, 'nuevos_seguidores')).toBe(true);
  });

  it('con hedor nauseabundo dentro del amuleto, un seguidor nuevo no entra', () => {
    const { estado, cambios } = aplicarEfectos(estadoCon(), [PONER_AMULETO, { tipo: 'ganar_seguidor', seguidor: 'forzudo' }], new Dados(1));

    expect(estado.jugador.seguidores).toEqual([]);
    expect(cambios[1]).toEqual({ tipo: 'seguidor_no_se_une', tipoSeguidor: 'forzudo', motivo: 'prohibido' });
  });

  it('"quitar una maldición" se lleva el amuleto ENTERO: las dos mitades dejan de funcionar', () => {
    const { estado, cambios } = aplicarEfectos(estadoCon(), [PONER_AMULETO, QUITAR_UNA_MALDICION], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([]);
    expect(comidaPorDia(estado.jugador)).toBe(1);
    expect(estaProhibido(estado.jugador, 'nuevos_seguidores')).toBe(false);
    expect(cambios[1]).toEqual({ tipo: 'condicion_quitada', condicion: 'amuleto_maldito' });
  });

  it('quitarlo por su nombre también se lo lleva entero', () => {
    const quitar: Efecto = { tipo: 'quitar_condicion', condicion: 'amuleto_maldito' };

    const { estado } = aplicarEfectos(estadoCon(), [PONER_AMULETO, quitar], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([]);
  });

  it('con otra maldición más antigua, "quitar una maldición" se lleva la más antigua y el amuleto se queda', () => {
    const estado = estadoCon({ condiciones: [{ id: 'maleficio_del_pirata' }] });

    const { estado: nuevo } = aplicarEfectos(estado, [PONER_AMULETO, QUITAR_UNA_MALDICION], new Dados(1));

    expect(nuevo.jugador.condiciones.map(c => c.id)).toEqual(['amuleto_maldito']);
  });

  it('si ya tiene un amuleto, se queda con el suyo: el nuevo no entra y se avisa', () => {
    const otro: Efecto = { tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes: ['ambicion_desmedida', 'muy_mala_suerte'] };

    const { estado, cambios } = aplicarEfectos(estadoCon(), [PONER_AMULETO, otro], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([{ id: 'amuleto_maldito', partes: ['hambre_insaciable', 'hedor_nauseabundo'] }]);
    expect(cambios).toHaveLength(2);
    expect(cambios[1]).toEqual({ tipo: 'condicion_no_puesta', condicion: 'amuleto_maldito', motivo: 'ya_la_tiene' });
  });

  it('las partes son una copia: no se comparten con el efecto', () => {
    const partes = ['hambre_insaciable'];
    const { estado } = aplicarEfectos(estadoCon(), [{ tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes }], new Dados(1));

    partes.push('otra');

    expect(estado.jugador.condiciones[0].partes).toEqual(['hambre_insaciable']);
  });

  it('una parte que no está en el catálogo es un error', () => {
    const efecto: Efecto = { tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes: ['no_existe'] };

    expect(() => aplicarEfectos(estadoCon(), [efecto], new Dados(1))).toThrow(/no existe la condición "no_existe"/);
  });

  it('una condición normal sigue apuntándose sin "partes"', () => {
    const { estado } = aplicarEfectos(estadoCon(), [{ tipo: 'poner_condicion', condicion: 'escorbuto' }], new Dados(1));

    expect(estado.jugador.condiciones).toEqual([{ id: 'escorbuto' }]);
  });
});

describe('odio al dinero: cada vez que ganas oro, ganas 1d6 menos', () => {
  const CON_ODIO = { condiciones: [{ id: 'amuleto_maldito', partes: ['odio_al_dinero'] }] };

  // Lo que saca el 1d6 con una semilla (el primer dado que se tira).
  const dadoDe = (semilla: number) => new Dados(semilla).tirar('1d6').total;

  it('gana el oro menos lo que salga en 1d6', () => {
    const dado = dadoDe(1);

    const { estado } = aplicarEfectos(estadoCon({ oro: 50, ...CON_ODIO }), [{ tipo: 'oro', cantidad: 20 }], new Dados(1));

    expect(estado.jugador.oro).toBe(50 + 20 - dado);
  });

  it('el chivato cuenta las dos cosas: lo que ganaba y lo que rechaza', () => {
    const dado = dadoDe(1);

    const { cambios } = aplicarEfectos(estadoCon({ oro: 50, ...CON_ODIO }), [{ tipo: 'oro', cantidad: 20 }], new Dados(1));

    expect(cambios).toEqual([
      { tipo: 'recurso', recurso: 'oro', antes: 50, despues: 70 },
      { tipo: 'recurso', recurso: 'oro', antes: 70, despues: 70 - dado, motivo: 'odio_al_dinero' },
    ]);
  });

  it('nunca pierde más de lo que ganaba: con +1 de oro se queda, como mucho, igual que estaba', () => {
    for (let semilla = 1; semilla <= 20; semilla++) {
      const { estado } = aplicarEfectos(estadoCon({ oro: 50, ...CON_ODIO }), [{ tipo: 'oro', cantidad: 1 }], new Dados(semilla));

      expect(estado.jugador.oro).toBe(50);
    }
  });

  it('perder oro no cambia: no es ganar', () => {
    const { estado } = aplicarEfectos(estadoCon({ oro: 50, ...CON_ODIO }), [{ tipo: 'oro', cantidad: -10 }], new Dados(1));

    expect(estado.jugador.oro).toBe(40);
  });

  it('"fijar" el oro tampoco: no es ganar', () => {
    const { estado } = aplicarEfectos(estadoCon({ oro: 50, ...CON_ODIO }), [{ tipo: 'oro', operacion: 'fijar', cantidad: 80 }], new Dados(1));

    expect(estado.jugador.oro).toBe(80);
  });

  it('ganar otra cosa (comida) no se ve afectado', () => {
    const { estado } = aplicarEfectos(estadoCon({ comida: 5, ...CON_ODIO }), [{ tipo: 'comida', cantidad: 3 }], new Dados(1));

    expect(estado.jugador.comida).toBe(8);
  });

  it('sin la maldición, gana el oro entero y no se tira ningún dado', () => {
    const dados = new Dados(1);
    const estadoInicial = dados.obtenerEstado();

    const { estado } = aplicarEfectos(estadoCon({ oro: 50 }), [{ tipo: 'oro', cantidad: 20 }], dados);

    expect(estado.jugador.oro).toBe(70);
    expect(dados.obtenerEstado()).toBe(estadoInicial);
  });

  it('al quitarse el amuleto, vuelve a ganar el oro entero', () => {
    const efectos: Efecto[] = [{ tipo: 'quitar_condicion', categoria: 'maldicion' }, { tipo: 'oro', cantidad: 20 }];

    const { estado } = aplicarEfectos(estadoCon({ oro: 50, ...CON_ODIO }), efectos, new Dados(1));

    expect(estado.jugador.oro).toBe(70);
  });

  it('un contable con odio al dinero: gana 2d6 más y después 1d6 menos', () => {
    const dados = new Dados(1);
    const extra = dados.tirar('2d6').total;
    const menos = dados.tirar('1d6').total;

    const { estado } = aplicarEfectos(estadoCon({ oro: 50, sobrenombre: 'el_contable', ...CON_ODIO }), [{ tipo: 'oro', cantidad: 20 }], new Dados(1));

    expect(estado.jugador.oro).toBe(50 + 20 + extra - menos);
  });
});

describe('revisores: "partes" en las tablas y "otorga" en objetos y habilidades', () => {
  function tablaCon(efecto: unknown): Tabla {
    return { id: 'prueba', dado: '1d6', filas: [{ min: 1, max: 6, efectos: [efecto] as never }] };
  }
  const erroresDeTabla = (efecto: unknown) => validarTabla(tablaCon(efecto)).join(' | ');

  it('una tabla puede poner el amuleto con sus partes', () => {
    expect(erroresDeTabla(PONER_AMULETO)).toBe('');
  });

  it('avisa de una parte que no está en el catálogo', () => {
    expect(erroresDeTabla({ tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes: ['ambre_insaciable'] })).toMatch(
      /la parte "ambre_insaciable" no existe en el catálogo de condiciones/,
    );
  });

  it('avisa si "partes" está vacío o no es una lista', () => {
    expect(erroresDeTabla({ tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes: [] })).toMatch(/"partes" debe ser una lista/);
    expect(erroresDeTabla({ tipo: 'poner_condicion', condicion: 'amuleto_maldito', partes: 'hambre_insaciable' })).toMatch(
      /"partes" debe ser una lista/,
    );
  });

  const objeto = (otorga: unknown) =>
    ({ id: 'collar', nombre: 'Collar', descripcion: 'x', tipo: 'pasivo', otorga }) as unknown as Objeto;
  const habilidad = (otorga: unknown) =>
    ({ id: 'guia', nombre: 'Guía', descripcion: 'x', tipo: 'pasiva', otorga }) as unknown as Habilidad;

  it('un objeto puede otorgar una condición que existe', () => {
    expect(validarObjetos([objeto(['vinculo_nativo'])])).toEqual([]);
  });

  it('avisa si un objeto otorga una condición que no existe', () => {
    expect(validarObjetos([objeto(['vinculo_natibo'])]).join(' | ')).toContain(
      'Objeto "collar": otorga la condición "vinculo_natibo", que no existe',
    );
  });

  it('una habilidad puede otorgar una condición que existe', () => {
    expect(validarHabilidades([habilidad(['vinculo_nativo'])])).toEqual([]);
  });

  it('avisa si una habilidad otorga una condición que no existe', () => {
    expect(validarHabilidades([habilidad(['vinculo_natibo'])]).join(' | ')).toContain(
      'Habilidad "guia": otorga la condición "vinculo_natibo", que no existe',
    );
  });
});
