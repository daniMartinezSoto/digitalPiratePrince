import { validarObjetos } from './validar-objeto';
import type { Objeto } from './objeto';

// Objetos correctos que vamos estropeando en cada test.
function manoDeMono(): Objeto {
  return {
    id: 'mano_de_mono',
    nombre: 'Mano de mono',
    descripcion: 'Puedes evitar hasta dos eventos. Descártala después.',
    tipo: 'activo',
    usosMaximos: 2,
    cuandoSeUsa: 'evento',
    precioVenta: 80,
    magico: true,
  };
}

function idoloDorado(): Objeto {
  return {
    id: 'idolo_dorado',
    nombre: 'Ídolo dorado',
    descripcion: 'Un gigantesco ídolo de oro con joyas engarzadas.',
    tipo: 'pasivo',
    espacios: 4,
    precioVenta: 800,
  };
}

function amuletoKalinago(): Objeto {
  return {
    id: 'amuleto_kalinago',
    nombre: 'Amuleto kalinago',
    descripcion: 'Los nativos te reciben mejor.',
    tipo: 'pasivo',
    precioVenta: 40,
    modificadores: { audiencia_aldea: 1 },
  };
}

// Atajo: valida un catálogo de un solo objeto y junta los errores en un texto.
function erroresDe(objeto: unknown): string {
  return validarObjetos([objeto as Objeto]).join(' | ');
}

describe('validarObjetos', () => {
  it('un catálogo correcto no tiene errores', () => {
    expect(validarObjetos([manoDeMono(), idoloDorado(), amuletoKalinago()])).toEqual([]);
  });

  it('un catálogo vacío no tiene errores', () => {
    expect(validarObjetos([])).toEqual([]);
  });

  describe('id, nombre y descripción', () => {
    it('detecta un id repetido', () => {
      expect(validarObjetos([manoDeMono(), manoDeMono()]).join()).toMatch(/"mano_de_mono" está repetido/);
    });

    it('detecta un id con mayúsculas o espacios', () => {
      expect(erroresDe({ ...manoDeMono(), id: 'Mano de mono' })).toMatch(/minúsculas/);
    });

    it('detecta que falta el nombre o la descripción', () => {
      expect(erroresDe({ ...manoDeMono(), nombre: '' })).toMatch(/falta el nombre/);
      expect(erroresDe({ ...manoDeMono(), descripcion: '   ' })).toMatch(/falta la descripción/);
    });

    it('detecta una imagen que no es un texto', () => {
      expect(erroresDe({ ...manoDeMono(), imagen: 5 })).toMatch(/imagen/);
    });
  });

  describe('tipo y usos', () => {
    it('detecta un tipo que no existe', () => {
      expect(erroresDe({ ...manoDeMono(), tipo: 'consumible' })).toMatch(/tipo "consumible" no existe/);
    });

    it('un objeto activo necesita usos', () => {
      const sinUsos = manoDeMono();
      delete sinUsos.usosMaximos;
      expect(erroresDe(sinUsos)).toMatch(/es activo, así que necesita "usosMaximos"/);
    });

    it('los usos deben ser un entero de 1 o más', () => {
      expect(erroresDe({ ...manoDeMono(), usosMaximos: 0 })).toMatch(/usosMaximos/);
      expect(erroresDe({ ...manoDeMono(), usosMaximos: 1.5 })).toMatch(/usosMaximos/);
    });

    it('un objeto pasivo no lleva usos', () => {
      expect(erroresDe({ ...idoloDorado(), usosMaximos: 3 })).toMatch(/es pasivo \(permanente\)/);
    });
  });

  describe('espacios, precio y mágico', () => {
    it('detecta espacios en 0 o con decimales', () => {
      expect(erroresDe({ ...idoloDorado(), espacios: 0 })).toMatch(/espacios/);
      expect(erroresDe({ ...idoloDorado(), espacios: 2.5 })).toMatch(/espacios/);
    });

    it('detecta un precio de venta en 0 o negativo', () => {
      expect(erroresDe({ ...idoloDorado(), precioVenta: 0 })).toMatch(/precio de venta/);
      expect(erroresDe({ ...idoloDorado(), precioVenta: -10 })).toMatch(/precio de venta/);
    });

    it('detecta "magico" que no es true o false', () => {
      expect(erroresDe({ ...manoDeMono(), magico: 'si' })).toMatch(/"magico" debe ser true o false/);
    });
  });

  describe('bonificadores', () => {
    it('detecta un bonificador sobre una tirada que no existe', () => {
      expect(erroresDe({ ...amuletoKalinago(), modificadores: { audiencia_aldeaa: 1 } })).toMatch(
        /tirada "audiencia_aldeaa", que no existe/,
      );
    });

    it('detecta un bonificador que no es un número entero', () => {
      expect(erroresDe({ ...amuletoKalinago(), modificadores: { audiencia_aldea: '1' } })).toMatch(
        /debe ser un número entero/,
      );
    });

    it('detecta "modificadores" escrito como lista en vez de como tiradas', () => {
      expect(erroresDe({ ...amuletoKalinago(), modificadores: ['audiencia_aldea'] })).toMatch(/"modificadores" debe ser/);
    });
  });

  it('enseña todos los errores a la vez, no solo el primero', () => {
    const mal = { ...idoloDorado(), nombre: '', espacios: 0, precioVenta: 0 };
    expect(validarObjetos([mal as Objeto])).toHaveLength(3);
  });
});
