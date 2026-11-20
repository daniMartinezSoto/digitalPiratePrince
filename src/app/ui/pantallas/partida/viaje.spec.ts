import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import { abrir, boton, escribir, prepararJuego, pulsar } from '../../probar-pantallas';

type Harness = Awaited<ReturnType<typeof abrir>>;

async function pulsarYEsperar(harness: Harness, texto: string): Promise<void> {
  pulsar(harness.routeNativeElement!, texto);
  await harness.fixture.whenStable();
}

async function elegir(harness: Harness, selector: string, valor: string): Promise<void> {
  escribir(harness.routeNativeElement!, selector, valor);
  await harness.fixture.whenStable();
}

async function viajarA(harness: Harness, terreno: string, lugar: string, puerto = ''): Promise<void> {
  await pulsarYEsperar(harness, 'Viajar…');
  await elegir(harness, 'select[name=viaje-terreno]', terreno);
  await elegir(harness, 'select[name=viaje-lugar]', lugar);
  if (puerto) await elegir(harness, 'select[name=viaje-puerto]', puerto);
  await pulsarYEsperar(harness, 'Viajar');
}

describe('pantalla Partida: viajar sin mapa, puertos y victoria', () => {
  it('viajar a Tortuga: gasta la acción, apunta el puerto y "¿dónde estás?" pasa a ser Tortuga', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    expect(pantalla.textContent).toContain('Puertos 0/4');

    await pulsarYEsperar(harness, 'Empezar el día');
    await viajarA(harness, 'playa', 'puerto', 'tortuga');

    expect(store.estado()?.mundo.fase).toBe('comida');
    expect(store.estado()?.mundo.puertosVisitados).toEqual(['tortuga']);
    expect(pantalla.textContent).toContain('Puertos 1/4');
    expect(pantalla.textContent).toContain('¡Primera visita a Tortuga!');
    expect(pantalla.textContent).toContain('Estás en Tortuga');
  });

  it('al llegar al 4.º puerto con 10 de fama, VICTORIA y a la crónica', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'fama', cantidad: 10 }], d));
    store.ejecutar(e => ({ estado: { ...e, mundo: { ...e.mundo, puertosVisitados: ['tortuga', 'port_royal', 'la_habana'] } } }));
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    await viajarA(harness, 'playa', 'puerto', 'nassau');

    expect(store.estado()?.mundo.finPartida).toEqual({ resultado: 'victoria', motivo: 'fama_y_puertos' });
    expect(harness.routeNativeElement!.textContent).toContain('PARTIDA TERMINADA · VICTORIA');
    expect(store.cronica()[0]).toMatchObject({ resultado: 'victoria', motivo: 'fama_y_puertos' });
  });

  it('con tormenta, "Viajar…" sale desactivado con su motivo', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    // La tormenta, ya en la fase de acción (al amanecer podría amainar).
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'poner_condicion', condicion: 'tormenta' }], d));
    await harness.fixture.whenStable();
    expect(boton(harness.routeNativeElement!, 'Viajar…').disabled).toBe(true);
    expect(harness.routeNativeElement!.textContent).toContain('No puedes: Tormenta');
  });

  it('en el agua solo se puede llegar a bordo', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    await pulsarYEsperar(harness, 'Viajar…');
    await elegir(harness, 'select[name=viaje-terreno]', 'alta_mar');
    const opciones = [...harness.routeNativeElement!.querySelectorAll('select[name=viaje-lugar] option')].map(o => o.getAttribute('value'));
    expect(opciones).toEqual(['barco']);
    await pulsarYEsperar(harness, 'Cancelar');
    expect(store.estado()?.mundo.fase).toBe('accion');
  });
});
