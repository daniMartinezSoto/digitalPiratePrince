import type { Tabla } from './tabla';
import { validarTabla } from './validar-tabla';

// Tests del revisor de tablas para el efecto "se une un seguidor" (ganar_seguidor).

// Una tabla correcta de una sola fila con ese efecto.
function tablaCon(efecto: unknown): Tabla {
  return { id: 'prueba', dado: '1d6', filas: [{ min: 1, max: 6, efectos: [efecto] as never }] };
}

const erroresDe = (efecto: unknown) => validarTabla(tablaCon(efecto)).join(' | ');

describe('validarTabla: se une un seguidor', () => {
  it('acepta un seguidor del catálogo', () => {
    expect(erroresDe({ tipo: 'ganar_seguidor', seguidor: 'nativo' })).toBe('');
  });

  it('acepta que sea inseparable (o que diga que no lo es)', () => {
    expect(erroresDe({ tipo: 'ganar_seguidor', seguidor: 'bruja_vudu', inseparable: true })).toBe('');
    expect(erroresDe({ tipo: 'ganar_seguidor', seguidor: 'bruja_vudu', inseparable: false })).toBe('');
  });

  it('detecta un seguidor que no está en el catálogo', () => {
    expect(erroresDe({ tipo: 'ganar_seguidor', seguidor: 'natibo' })).toMatch(
      /el seguidor "natibo" no existe en el catálogo de seguidores/,
    );
  });

  it('detecta que falta el seguidor', () => {
    expect(erroresDe({ tipo: 'ganar_seguidor' })).toMatch(/falta el "seguidor"/);
  });

  it('detecta un "inseparable" que no es true o false', () => {
    expect(erroresDe({ tipo: 'ganar_seguidor', seguidor: 'nativo', inseparable: 'si' })).toMatch(
      /"inseparable" debe ser true o false/,
    );
  });

  it('"despedir" no se escribe en el JSON: lo elige el jugador durante la partida', () => {
    expect(erroresDe({ tipo: 'ganar_seguidor', seguidor: 'nativo', despedir: 'forzudo_1' })).toMatch(/sobra "despedir"/);
  });

  it('detecta otros campos que sobran', () => {
    expect(erroresDe({ tipo: 'ganar_seguidor', seguidor: 'nativo', cantidad: 2 })).toMatch(/sobra "cantidad"/);
  });
});
