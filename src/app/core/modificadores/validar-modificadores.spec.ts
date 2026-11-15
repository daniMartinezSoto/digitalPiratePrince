import { validarModificadores } from './validar-modificadores';

describe('validarModificadores', () => {
  const donde = 'Objeto "prueba"';

  it('sin modificadores no hay errores', () => {
    expect(validarModificadores(undefined, donde)).toEqual([]);
  });

  it('modificadores correctos, también negativos, no tienen errores', () => {
    expect(validarModificadores({ audiencia_aldea: 1, pesca: -1 }, donde)).toEqual([]);
  });

  it('detecta una tirada que no existe y empieza el mensaje con "donde"', () => {
    const [error] = validarModificadores({ pezca: 1 }, donde);
    expect(error).toMatch(/^Objeto "prueba": .*tirada "pezca", que no existe/);
  });

  it('detecta un bonificador que no es un número entero', () => {
    expect(validarModificadores({ pesca: 1.5 }, donde).join()).toMatch(/debe ser un número entero/);
  });

  it('detecta "modificadores" que no es una lista de tiradas', () => {
    expect(validarModificadores(['pesca'], donde).join()).toMatch(/"modificadores" debe ser/);
    expect(validarModificadores(3, donde).join()).toMatch(/"modificadores" debe ser/);
  });
});
