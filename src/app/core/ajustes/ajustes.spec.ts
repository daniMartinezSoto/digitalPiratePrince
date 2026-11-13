import { AJUSTES } from './ajustes';

describe('ajustes', () => {
  it('la probabilidad de evento al viajar es un porcentaje entre 0 y 100', () => {
    expect(AJUSTES.probabilidadEventoAlViajar).toBeGreaterThanOrEqual(0);
    expect(AJUSTES.probabilidadEventoAlViajar).toBeLessThanOrEqual(100);
  });
});
