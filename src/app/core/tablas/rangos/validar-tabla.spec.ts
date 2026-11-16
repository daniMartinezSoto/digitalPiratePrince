import { validarTabla } from './validar-tabla';
import type { Tabla } from './tabla';

// Una tabla correcta que vamos estropeando en cada test.
function tablaBuena(): Tabla {
  return {
    id: 'prueba',
    dado: '1d6',
    filas: [
      { min: 1, max: 1, texto: 'Nada' },
      { min: 2, max: 5, efectos: [{ tipo: 'oro', cantidad: '2d6' }] },
      { min: 6, max: 6, evento: 'algo_bueno' },
    ],
  };
}

describe('validarTabla', () => {
  it('una tabla correcta no tiene errores', () => {
    expect(validarTabla(tablaBuena())).toEqual([]);
  });

  it('no importa el orden en que estén escritas las filas', () => {
    const tabla = tablaBuena();
    tabla.filas.reverse();
    expect(validarTabla(tabla)).toEqual([]);
  });

  describe('rangos', () => {
    it('detecta un hueco', () => {
      const tabla = tablaBuena();
      tabla.filas[1] = { min: 2, max: 4, texto: 'x' }; // falta el 5
      expect(validarTabla(tabla).join()).toMatch(/hueco.*falta el 5/);
    });

    it('detecta filas que se pisan', () => {
      const tabla = tablaBuena();
      tabla.filas[2] = { min: 5, max: 6, texto: 'x' }; // el 5 está en dos filas
      expect(validarTabla(tabla).join()).toMatch(/se pisan/);
    });

    it('detecta que la tabla se queda corta para el dado (añadiste una fila pero no cambiaste el dado, o al revés)', () => {
      const tabla = tablaBuena();
      tabla.dado = '1d7'; // saca hasta 7, pero la tabla acaba en 6
      expect(validarTabla(tabla).join()).toMatch(/como máximo 7.*acaba en 6/);
    });

    it('detecta que la tabla empieza donde el dado no llega', () => {
      const tabla = tablaBuena();
      tabla.dado = '3d6'; // saca de 3 a 18
      const errores = validarTabla(tabla).join();
      expect(errores).toMatch(/como mínimo 3.*empieza en 1/);
      expect(errores).toMatch(/como máximo 18.*acaba en 6/);
    });

    it('detecta una fila con min mayor que max', () => {
      const tabla = tablaBuena();
      tabla.filas[1] = { min: 5, max: 2, texto: 'x' };
      expect(validarTabla(tabla).join()).toMatch(/"min" es mayor que "max"/);
    });

    it('detecta una tabla sin filas', () => {
      expect(validarTabla({ id: 'vacia', dado: '1d6', filas: [] }).join()).toMatch(/no tiene filas/);
    });
  });

  describe('dado e id', () => {
    it('detecta un dado mal escrito', () => {
      const tabla = tablaBuena();
      tabla.dado = '1D6';
      expect(validarTabla(tabla).join()).toMatch(/el dado "1D6" no es válido/);
    });

    it('detecta un id con mayúsculas o espacios', () => {
      const tabla = tablaBuena();
      tabla.id = 'Buscar Informacion';
      expect(validarTabla(tabla).join()).toMatch(/minúsculas/);
    });
  });

  describe('contenido de las filas', () => {
    it('detecta una fila vacía', () => {
      const tabla = tablaBuena();
      tabla.filas[0] = { min: 1, max: 1 };
      expect(validarTabla(tabla).join()).toMatch(/fila 1: está vacía/);
    });

    it('detecta un tipo de efecto mal escrito', () => {
      const tabla = tablaBuena();
      tabla.filas[1].efectos = [{ tipo: 'orro', cantidad: 5 } as never];
      expect(validarTabla(tabla).join()).toMatch(/fila 2-5: el tipo de efecto "orro" no existe/);
    });

    it('detecta una cantidad que no es un número ni un dado', () => {
      const tabla = tablaBuena();
      tabla.filas[1].efectos = [{ tipo: 'oro', cantidad: 'dos' }];
      expect(validarTabla(tabla).join()).toMatch(/la cantidad de "oro" no es válida/);
    });

    it('acepta cantidades negativas, también con dados', () => {
      const tabla = tablaBuena();
      tabla.filas[1].efectos = [{ tipo: 'vida', cantidad: -1 }, { tipo: 'oro', cantidad: '-1d6' }];
      expect(validarTabla(tabla)).toEqual([]);
    });

    it('detecta un nombre de evento con mayúsculas o espacios', () => {
      const tabla = tablaBuena();
      tabla.filas[2].evento = 'Taberna Clandestina';
      expect(validarTabla(tabla).join()).toMatch(/el evento "Taberna Clandestina"/);
    });

    it('enseña todos los errores a la vez, no solo el primero', () => {
      const tabla = tablaBuena();
      tabla.filas[0] = { min: 1, max: 1 };                     // fila vacía
      tabla.filas[2].evento = 'Mal';                           // evento mal escrito
      expect(validarTabla(tabla)).toHaveLength(2);
    });
  });

  describe('operaciones, destinos y fin de partida', () => {
    function conEfectos(efectos: unknown[]): Tabla {
      const tabla = tablaBuena();
      tabla.filas[1].efectos = efectos as never;
      return tabla;
    }

    it('acepta todas las formas correctas', () => {
      const tabla = conEfectos([
        { tipo: 'oro', operacion: 'mitad' },
        { tipo: 'vida', operacion: 'maximo', destino: 'todos' },
        { tipo: 'comida', operacion: 'todo' },
        { tipo: 'vida', operacion: 'fijar', cantidad: 1 },
        { tipo: 'vida', cantidad: '-1d6', destino: 'seguidor_azar' },
        { tipo: 'vida', cantidad: -2, destino: 'seguidor_elegido' },
        { tipo: 'oro', cantidad: '1d6x10+5' },
        { tipo: 'ganar_partida' },
        { tipo: 'perder_partida' },
      ]);
      expect(validarTabla(tabla)).toEqual([]);
    });

    it('detecta una operación que no existe', () => {
      expect(validarTabla(conEfectos([{ tipo: 'oro', operacion: 'doble' }])).join()).toMatch(/operación "doble" no existe/);
    });

    it('detecta que falta la cantidad al sumar o fijar', () => {
      expect(validarTabla(conEfectos([{ tipo: 'oro', operacion: 'fijar' }])).join()).toMatch(/cantidad de "oro" no es válida/);
    });

    it('detecta una cantidad en mitad, maximo o todo', () => {
      expect(validarTabla(conEfectos([{ tipo: 'oro', operacion: 'mitad', cantidad: 5 }])).join()).toMatch(/"mitad" no lleva cantidad/);
    });

    it('detecta "maximo" en un recurso sin máximo (oro, fama)', () => {
      expect(validarTabla(conEfectos([{ tipo: 'oro', operacion: 'maximo' }])).join()).toMatch(/"oro" no tiene máximo/);
    });

    it('detecta fijar en negativo', () => {
      expect(validarTabla(conEfectos([{ tipo: 'vida', operacion: 'fijar', cantidad: -1 }])).join()).toMatch(/número negativo/);
    });

    it('acepta "siNoHay" en un efecto a un seguidor al azar', () => {
      const tabla = conEfectos([
        { tipo: 'vida', operacion: 'todo', destino: 'seguidor_azar', siNoHay: [{ tipo: 'tripulacion', cantidad: '-1d6' }] },
      ]);
      expect(validarTabla(tabla)).toEqual([]);
    });

    it('detecta un "siNoHay" en un efecto que no va a un seguidor al azar', () => {
      const tabla = conEfectos([{ tipo: 'vida', cantidad: -1, destino: 'todos', siNoHay: [{ tipo: 'oro', cantidad: 1 }] }]);
      expect(validarTabla(tabla).join()).toMatch(/"siNoHay" solo tiene sentido con el destino "seguidor_azar"/);
    });

    it('detecta un "siNoHay" vacío, con efectos mal escritos o con otro "siNoHay" dentro', () => {
      const base = { tipo: 'vida', cantidad: -1, destino: 'seguidor_azar' };
      expect(validarTabla(conEfectos([{ ...base, siNoHay: [] }])).join()).toMatch(/"siNoHay" debe ser una lista/);
      expect(validarTabla(conEfectos([{ ...base, siNoHay: [{ tipo: 'tripulasion', cantidad: -1 }] }])).join()).toMatch(
        /siNoHay: el tipo de efecto "tripulasion" no existe/,
      );
      expect(validarTabla(conEfectos([{ ...base, siNoHay: [{ ...base, siNoHay: [{ tipo: 'oro', cantidad: 1 }] }] }])).join()).toMatch(
        /no puede llevar otro "siNoHay" dentro/,
      );
    });

    it('detecta un destino que no existe', () => {
      expect(validarTabla(conEfectos([{ tipo: 'vida', cantidad: -1, destino: 'barco' }])).join()).toMatch(/destino "barco" no existe/);
    });

    it('detecta un destino de seguidores en algo que no es la vida', () => {
      expect(validarTabla(conEfectos([{ tipo: 'oro', cantidad: 5, destino: 'todos' }])).join()).toMatch(/solo la vida/);
    });

    it('detecta ganar o perder la partida con cosas de más', () => {
      expect(validarTabla(conEfectos([{ tipo: 'perder_partida', cantidad: 1 }])).join()).toMatch(/"perder_partida" no lleva/);
    });

    it('el tipo antiguo "perder_mitad_oro" ya no existe', () => {
      expect(validarTabla(conEfectos([{ tipo: 'perder_mitad_oro' }])).join()).toMatch(/"perder_mitad_oro" no existe/);
    });
  });

  describe('características (fuerza, ingenio, vidaMax)', () => {
    function conEfectos(efectos: unknown[]): Tabla {
      const tabla = tablaBuena();
      tabla.filas[1].efectos = efectos as never;
      return tabla;
    }

    it('se pueden subir, bajar y fijar', () => {
      const tabla = conEfectos([
        { tipo: 'fuerza', cantidad: 1 },
        { tipo: 'ingenio', cantidad: -1 },
        { tipo: 'vidaMax', cantidad: 4 },
        { tipo: 'fuerza', operacion: 'fijar', cantidad: 2 },
      ]);
      expect(validarTabla(tabla)).toEqual([]);
    });

    it('no admiten "todo" porque nunca bajan de 1', () => {
      expect(validarTabla(conEfectos([{ tipo: 'fuerza', operacion: 'todo' }])).join()).toMatch(/característica y nunca baja de 1/);
    });

    it('no se pueden fijar en 0', () => {
      expect(validarTabla(conEfectos([{ tipo: 'ingenio', operacion: 'fijar', cantidad: 0 }])).join()).toMatch(/nunca bajan de 1/);
    });

    it('no admiten destino de seguidores', () => {
      expect(validarTabla(conEfectos([{ tipo: 'fuerza', cantidad: 1, destino: 'todos' }])).join()).toMatch(/solo la vida/);
    });
  });

  describe('objetos, condiciones, turnos perdidos y banderas', () => {
    function conEfectos(efectos: unknown[]): Tabla {
      const tabla = tablaBuena();
      tabla.filas[1].efectos = efectos as never;
      return tabla;
    }
    const erroresDe = (efecto: unknown) => validarTabla(conEfectos([efecto])).join(' | ');

    it('acepta todas las formas correctas (con ids reales de los catálogos)', () => {
      const tabla = conEfectos([
        { tipo: 'ganar_objeto', objeto: 'mano_de_mono' },
        { tipo: 'perder_objeto', objeto: 'idolo_dorado' },
        { tipo: 'poner_condicion', condicion: 'escorbuto' },
        { tipo: 'poner_condicion', condicion: 'tormenta', turnos: 2 },
        { tipo: 'poner_condicion', condicion: 'lluvias', turnos: '1d3' },
        { tipo: 'quitar_condicion', condicion: 'escorbuto' },
        { tipo: 'quitar_condicion', categoria: 'maldicion' },
        { tipo: 'perder_turnos', cantidad: 1 },
        { tipo: 'perder_turnos', cantidad: '1d3' },
        { tipo: 'bandera', bandera: 'emporio_bob_derrotado' },
      ]);
      expect(validarTabla(tabla)).toEqual([]);
    });

    it('detecta un objeto que no está en el catálogo', () => {
      expect(erroresDe({ tipo: 'ganar_objeto', objeto: 'mano_de_mona' })).toMatch(
        /el objeto "mano_de_mona" no existe en el catálogo de objetos/,
      );
    });

    it('detecta que falta el objeto', () => {
      expect(erroresDe({ tipo: 'perder_objeto' })).toMatch(/falta el "objeto"/);
    });

    it('detecta una condición que no está en el catálogo', () => {
      expect(erroresDe({ tipo: 'poner_condicion', condicion: 'escorbutto' })).toMatch(
        /la condición "escorbutto" no existe en el catálogo de condiciones/,
      );
    });

    it('detecta turnos en 0, negativos o mal escritos', () => {
      expect(erroresDe({ tipo: 'poner_condicion', condicion: 'tormenta', turnos: 0 })).toMatch(/los turnos/);
      expect(erroresDe({ tipo: 'poner_condicion', condicion: 'tormenta', turnos: '-1d3' })).toMatch(/los turnos/);
    });

    it('quitar_condicion lleva una condición o una categoría, no las dos ni ninguna', () => {
      expect(erroresDe({ tipo: 'quitar_condicion' })).toMatch(/una de las dos/);
      expect(erroresDe({ tipo: 'quitar_condicion', condicion: 'escorbuto', categoria: 'enfermedad' })).toMatch(/una de las dos/);
    });

    it('detecta una categoría que no existe al quitar condiciones', () => {
      expect(erroresDe({ tipo: 'quitar_condicion', categoria: 'maldición' })).toMatch(/la categoría "maldición" no existe/);
    });

    it('detecta turnos perdidos en 0 o negativos', () => {
      expect(erroresDe({ tipo: 'perder_turnos', cantidad: 0 })).toMatch(/perder_turnos/);
      expect(erroresDe({ tipo: 'perder_turnos', cantidad: -1 })).toMatch(/perder_turnos/);
    });

    it('detecta una bandera mal escrita', () => {
      expect(erroresDe({ tipo: 'bandera', bandera: 'Bob derrotado' })).toMatch(/la bandera debe ser/);
    });

    it('detecta campos que sobran (p. ej. una cantidad en ganar_objeto)', () => {
      expect(erroresDe({ tipo: 'ganar_objeto', objeto: 'mano_de_mono', cantidad: 2 })).toMatch(/sobra "cantidad"/);
    });
  });
});
