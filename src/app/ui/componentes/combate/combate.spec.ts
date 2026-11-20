import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import { abrir, boton, escribir, prepararJuego, pulsar } from '../../probar-pantallas';

type Harness = Awaited<ReturnType<typeof abrir>>;

async function pulsarYEsperar(harness: Harness, texto: string): Promise<void> {
  pulsar(harness.routeNativeElement!, texto);
  await harness.fixture.whenStable();
}

/** Ataca hasta que el combate (normal o el abordaje) termine. */
async function atacarHastaElFinal(harness: Harness, terminado: () => boolean): Promise<void> {
  for (let i = 0; i < 80 && !terminado(); i++) {
    await pulsarYEsperar(harness, 'Atacar');
  }
}

describe('combates de prueba', () => {
  it('combate normal: empezar, huir desactivado en la primera ronda, atacar hasta el final y cerrar', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    escribir(pantalla, 'select[name=prueba-enemigo]', 'pescador');
    await pulsarYEsperar(harness, 'Empezar combate');

    expect(store.estado()?.mundo.combate).not.toBeNull();
    expect(pantalla.textContent).toContain('Combate · ronda 0');
    expect(boton(pantalla, 'Huir').disabled).toBe(true);
    expect(pantalla.textContent).toContain('Hay que pelear al menos una ronda');
    expect(pantalla.textContent).not.toContain('Empezar el día'); // el día se queda parado

    await atacarHastaElFinal(harness, () => store.estado()!.mundo.combate?.resultado != null);
    expect(pantalla.textContent).toContain('EL COMBATE HA TERMINADO');
    expect(pantalla.textContent).toContain('Ronda 1');
    await pulsarYEsperar(harness, 'Cerrar el combate');

    expect(store.estado()?.mundo.combate).toBeNull();
    expect(store.estado()?.mundo.fase).toBe('inicio'); // el día sigue donde estaba
    expect(boton(pantalla, 'Empezar el día')).toBeTruthy();
  });

  it('un objeto de combate se usa desde el combate (sin gastar el ataque)', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'ganar_objeto', objeto: 'ron' }], d));
    const harness = await abrir('/partida');
    escribir(harness.routeNativeElement!, 'select[name=prueba-enemigo]', 'jaguar');
    await pulsarYEsperar(harness, 'Empezar combate');
    await pulsarYEsperar(harness, 'Usar Ron');

    expect(harness.routeNativeElement!.textContent).toContain('Usas: Ron');
    expect(store.estado()?.mundo.combate?.ronda).toBe(0);
    expect(store.estado()?.mundo.combate?.bonificador).toBeGreaterThan(0);
  });

  it('combate naval: disparar hasta hundir la chalupa y ver el resumen', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    escribir(pantalla, 'select[name=prueba-barco]', 'chalupa_de_pescadores');
    await pulsarYEsperar(harness, 'Empezar combate naval');
    expect(pantalla.textContent).toContain('Combate naval contra Chalupa de pescadores');

    for (let i = 0; i < 30 && !store.estado()!.mundo.combateNaval?.resultado; i++) {
      await pulsarYEsperar(harness, 'Disparar');
    }
    expect(pantalla.textContent).toContain('Disparas');
    await pulsarYEsperar(harness, 'Cerrar el combate naval');
    expect(store.estado()?.mundo.combateNaval).toBeNull();
    expect(pantalla.textContent).toContain('Fin del combate contra Chalupa de pescadores');
  });

  it('combate naval con abordaje: aparece el combate normal y se cierra desde el naval', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    escribir(pantalla, 'select[name=prueba-barco]', 'chalupa_de_pescadores');
    await pulsarYEsperar(harness, 'Empezar combate naval');
    await pulsarYEsperar(harness, 'Abordar'); // con resistencia 1, se puede abordar desde el principio
    expect(pantalla.textContent).toContain('Abordaje');
    expect(pantalla.textContent).toContain('¡Al abordaje!');

    await atacarHastaElFinal(harness, () => store.estado()!.mundo.combate?.resultado != null || store.estado()!.mundo.finPartida != null);
    if (!store.estado()!.mundo.finPartida) {
      expect(() => boton(pantalla, 'Cerrar el combate')).toThrow(); // el abordaje no se cierra solo
      await pulsarYEsperar(harness, 'Cerrar el combate naval');
      expect(store.estado()?.mundo.combate).toBeNull();
      expect(store.estado()?.mundo.combateNaval).toBeNull();
      expect(pantalla.textContent).toContain('abordándolo');
    }
  });
});

describe('usar y tirar objetos', () => {
  it('el ungüento se usa en la fase de acción y se gasta', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'ganar_objeto', objeto: 'unguento' }, { tipo: 'vida', cantidad: -6 }], d));
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    const usar = () => pantalla.querySelector('button[name=usar-0]') as HTMLButtonElement;

    expect(usar().disabled).toBe(true); // aún no es la fase de acción
    await pulsarYEsperar(harness, 'Empezar el día');
    expect(usar().disabled).toBe(false);
    const vida = store.estado()!.jugador.vida;
    usar().click();
    await harness.fixture.whenStable();

    expect(store.estado()!.jugador.vida).toBeGreaterThan(vida);
    expect(store.estado()!.jugador.inventario).toEqual([]); // tenía 1 uso: se agota
    expect(store.estado()!.mundo.fase).toBe('accion'); // usarlo no gasta la acción
  });

  it('tirar un objeto pide confirmación', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'ganar_objeto', objeto: 'ron' }], d));
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    (pantalla.querySelector('button[name=tirar-0]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    await pulsarYEsperar(harness, 'No');
    expect(store.estado()!.jugador.inventario).toHaveLength(1);

    (pantalla.querySelector('button[name=tirar-0]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    await pulsarYEsperar(harness, 'Sí, tirar');
    expect(store.estado()!.jugador.inventario).toEqual([]);
    expect(pantalla.textContent).toContain('Tiras: Ron');
  });
});
