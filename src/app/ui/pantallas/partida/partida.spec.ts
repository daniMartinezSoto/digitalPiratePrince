import { hojaDePersonaje } from '../../../core/personaje/hoja-de-personaje';
import { AlmacenEnMemoria } from '../../../core/guardado/almacen-en-memoria';
import { abrir, prepararJuego, pulsar, urlActual } from '../../probar-pantallas';

describe('pantalla Partida', () => {
  it('enseña la hoja del personaje, la semilla, el día y la fase', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 482913);
    const harness = await abrir('/partida');
    const texto = harness.routeNativeElement!.textContent!;
    const hoja = hojaDePersonaje(store.estado()!.jugador);
    expect(texto).toContain('Marta');
    expect(texto).toContain(hoja.sobrenombre.nombre);
    expect(texto).toContain('482913');
    expect(texto).toContain(`Vida: ${hoja.vida} / ${hoja.vidaMax}`);
    expect(texto).toContain('Día 1');
    expect(texto).toContain('fase: inicio');
  });

  it('enseña al seguidor de "el hermano"', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 30);
    const harness = await abrir('/partida');
    expect(harness.routeNativeElement!.textContent).toContain(store.estado()!.jugador.seguidores[0].nombre);
  });

  it('abandonar pide confirmación; "No" no hace nada', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 1);
    const harness = await abrir('/partida');
    pulsar(harness.routeNativeElement!, 'Abandonar');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).toContain('¿Seguro?');
    pulsar(harness.routeNativeElement!, 'No');
    await harness.fixture.whenStable();
    expect(store.hayPartidaEnCurso()).toBe(true);
  });

  it('abandonar de verdad: partida terminada, a la crónica, y botón para empezar otra', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 1);
    const harness = await abrir('/partida');
    pulsar(harness.routeNativeElement!, 'Abandonar');
    await harness.fixture.whenStable();
    pulsar(harness.routeNativeElement!, 'Sí, abandonar');
    await harness.fixture.whenStable();
    expect(store.hayPartidaEnCurso()).toBe(false);
    expect(store.cronica()).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('PARTIDA TERMINADA · DERROTA: has abandonado');
    pulsar(harness.routeNativeElement!, 'Nueva partida');
    await harness.fixture.whenStable();
    expect(urlActual()).toBe('/nueva-partida');
  });

  it('enseña los avisos del guardado y se pueden descartar', async () => {
    const almacen = new AlmacenEnMemoria();
    const store = prepararJuego(almacen);
    almacen.fallarAlEscribir = true;
    store.nuevaPartida('Marta', 'mujer', 1);
    const harness = await abrir('/partida');
    expect(harness.routeNativeElement!.textContent).toContain('No se ha podido guardar');
    pulsar(harness.routeNativeElement!, 'Entendido');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).not.toContain('No se ha podido guardar');
  });
});
