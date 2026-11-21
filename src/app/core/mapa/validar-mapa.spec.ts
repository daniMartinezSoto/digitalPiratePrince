import type { Casilla, Mapa } from './mapa';
import { validarMapa } from './validar-mapa';

// Mapa de juguete de 4 × 2: arriba playa, abajo agua; los 4 puertos principales en tierra.
function mapaDePrueba(cambios: Partial<Mapa> = {}): Mapa {
  const casillas: Casilla[] = [];
  for (let fila = 0; fila < 2; fila++) {
    for (let col = 0; col < 4; col++) casillas.push({ col, fila, terreno: fila === 0 ? 'playa' : 'costa' });
  }
  const nombres = ['La Habana', 'Nassau', 'Tortuga', 'Port Royal'];
  const ids = ['la_habana', 'nassau', 'tortuga', 'port_royal'];
  const puertosPrincipales = ids.map((id, col) => ({ id, nombre: nombres[col], col, fila: 0 }));
  for (const p of puertosPrincipales) Object.assign(casillas[p.col], { rasgo: 'puerto', nombre: p.nombre });
  return { id: 'juguete', nombre: 'Juguete', columnas: 4, filas: 2, inicio: { col: 0, fila: 0 }, puertosPrincipales, casillas, ...cambios };
}

describe('revisor de mapas', () => {
  it('un mapa bien hecho no tiene errores', () => {
    expect(validarMapa(mapaDePrueba())).toEqual([]);
  });

  it('el número de casillas tiene que cuadrar con columnas × filas', () => {
    expect(validarMapa(mapaDePrueba({ filas: 3 }))).toEqual(['mapa "juguete": tiene 8 casillas y deberían ser 12']);
  });

  it('la casilla de inicio tiene que estar dentro y en tierra', () => {
    expect(validarMapa(mapaDePrueba({ inicio: { col: 0, fila: 1 } }))).toEqual(['mapa "juguete": la casilla de inicio es agua (se empieza a pie)']);
    expect(validarMapa(mapaDePrueba({ inicio: { col: 9, fila: 0 } }))).toEqual(['mapa "juguete": la casilla de inicio cae fuera del mapa']);
  });

  it('tiene que haber 4 puertos principales, cada uno en una casilla de puerto', () => {
    const mapa = mapaDePrueba();
    const tres = mapaDePrueba({ puertosPrincipales: mapa.puertosPrincipales.slice(0, 3) });
    expect(validarMapa(tres)).toEqual(['mapa "juguete": tiene 3 puertos principales y tienen que ser 4']);

    const movido = mapaDePrueba({ puertosPrincipales: [...mapa.puertosPrincipales.slice(0, 3), { id: 'port_royal', nombre: 'Port Royal', col: 3, fila: 1 }] });
    expect(validarMapa(movido)).toEqual(['mapa "juguete": el puerto principal Port Royal (3,1) no está en una casilla de puerto']);
  });

  it('revisa cada casilla: terreno, lugares en tierra, nombres, zonas de barcos y campos que sobran', () => {
    const mapa = mapaDePrueba();
    mapa.casillas[4] = { col: 0, fila: 1, terreno: 'costa', rasgo: 'aldea' };
    mapa.casillas[5] = { col: 1, fila: 1, terreno: 'lava' as never };
    mapa.casillas[6] = { col: 2, fila: 1, terreno: 'costa', eventosDeBarco: true };
    mapa.casillas[0] = { ...mapa.casillas[0], eventosDeBarco: true };
    (mapa.casillas[7] as unknown as Record<string, unknown>)['tesoro'] = true;

    expect(validarMapa(mapa)).toEqual([
      'mapa "juguete", casilla 0,0: una zona de barcos tiene que ser agua',
      'mapa "juguete", casilla 0,1: un aldea no puede estar en el agua',
      'mapa "juguete", casilla 1,1: terreno desconocido "lava"',
      'mapa "juguete", casilla 3,1: campo que sobra "tesoro"',
    ]);
  });

  it('las casillas van fila a fila', () => {
    const mapa = mapaDePrueba();
    [mapa.casillas[4], mapa.casillas[5]] = [mapa.casillas[5], mapa.casillas[4]];

    expect(validarMapa(mapa)).toEqual([
      'mapa "juguete": la casilla en la posición 4 dice ser 1,1 (van fila a fila)',
      'mapa "juguete": la casilla en la posición 5 dice ser 0,1 (van fila a fila)',
    ]);
  });
});
