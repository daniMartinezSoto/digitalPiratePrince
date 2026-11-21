import { obtenerMapa } from '../../../core/mapa/cargar-mapas';
import { casillasParaPintar, direcciones } from './casillas-para-pintar';

describe('casillas para pintar el mapa', () => {
  const mapa = obtenerMapa('primer-mapa-prueba');
  const casillas = casillasParaPintar(mapa);
  const en = (c: number, r: number) => casillas[r * mapa.columnas + c];

  it('las 6 direcciones salen de las cuentas de core (N primero)', () => {
    expect(direcciones(6)[0]).toEqual([0, -1]);
    expect(direcciones(7)[2]).toEqual([1, 1]); // SE en columna impar
  });

  it('una por casilla, con su posición: las columnas impares bajan media casilla', () => {
    expect(casillas).toHaveLength(600);
    expect(en(0, 0)).toMatchObject({ wx: 0, wz: 0 });
    expect(en(1, 0).wx).toBe(1.5);
    expect(en(1, 0).wz).toBeCloseTo(Math.sqrt(3) / 2);
  });

  it('distingue los puertos principales de los normales', () => {
    expect(en(23, 18)).toMatchObject({ lugar: 'puerto_principal', nombre: 'Port Royal' });
    expect(en(14, 11)).toMatchObject({ lugar: 'puerto', nombre: 'Cala Ventura' });
  });

  it('marca el agua, la casilla de inicio y las zonas de barcos', () => {
    expect(en(6, 0)).toMatchObject({ inicio: true, agua: false });
    expect(casillas.filter(c => c.inicio)).toHaveLength(1);
    expect(casillas.filter(c => c.eventosDeBarco).every(c => c.agua)).toBe(true);
  });
});
