import { crearPartida } from '../core/partida/crear-partida';
import { CLAVES_DE_GUARDADO } from '../core/guardado/almacen';
import { AlmacenEnMemoria } from '../core/guardado/almacen-en-memoria';
import { guardarPartida } from '../core/guardado/guardar-partida';
import { abrir, prepararJuego, urlActual } from './probar-pantallas';

describe('rutas del juego', () => {
  it('sin partida, al abrir el juego va a crear personaje', async () => {
    prepararJuego();
    await abrir('/');
    expect(urlActual()).toBe('/nueva-partida');
  });

  it('con una partida guardada, al abrir el juego va a la partida', async () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir(CLAVES_DE_GUARDADO.partida, guardarPartida(crearPartida(1, 'Marta').estado));
    prepararJuego(almacen);
    await abrir('/');
    expect(urlActual()).toBe('/partida');
  });

  it('sin partida no se puede entrar en /partida', async () => {
    prepararJuego();
    await abrir('/partida');
    expect(urlActual()).toBe('/nueva-partida');
  });

  it('con una partida en curso no se puede entrar en /nueva-partida', async () => {
    prepararJuego().nuevaPartida('Marta');
    await abrir('/nueva-partida');
    expect(urlActual()).toBe('/partida');
  });

  it('una dirección que no existe lleva al principio', async () => {
    prepararJuego();
    await abrir('/esto-no-existe');
    expect(urlActual()).toBe('/nueva-partida');
  });
});
