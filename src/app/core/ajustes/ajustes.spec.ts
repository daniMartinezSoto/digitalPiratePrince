import { IDS_TIRADA } from '../modificadores/id-tirada';
import { AJUSTES } from './ajustes';

describe('ajustes', () => {
  it('la probabilidad de evento al viajar es un porcentaje entre 0 y 100', () => {
    expect(AJUSTES.probabilidadEventoAlViajar).toBeGreaterThanOrEqual(0);
    expect(AJUSTES.probabilidadEventoAlViajar).toBeLessThanOrEqual(100);
  });

  it('la comida máxima es un número entero mayor que 0', () => {
    expect(Number.isInteger(AJUSTES.comidaMaxima)).toBe(true);
    expect(AJUSTES.comidaMaxima).toBeGreaterThan(0);
  });

  it('la comida máxima no es menor que la comida con la que se empieza (5)', () => {
    expect(AJUSTES.comidaMaxima).toBeGreaterThanOrEqual(5);
  });

  it('el bonificador por fama solo usa tiradas que existen y "cada X" es un entero de 1 o más', () => {
    const conocidas: readonly string[] = IDS_TIRADA;
    for (const [tirada, cada] of Object.entries(AJUSTES.bonificadorPorFama)) {
      expect(conocidas, `bonificadorPorFama usa una tirada que no existe: "${tirada}"`).toContain(tirada);
      expect(Number.isInteger(cada) && cada >= 1, `"${tirada}": "cada X de fama" debe ser un entero de 1 o más`).toBe(true);
    }
  });
});
