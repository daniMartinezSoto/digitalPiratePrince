import { TestBed } from '@angular/core/testing';
import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import { lanzarEventos } from '../../../core/eventos/motor';
import type { Efecto } from '../../../core/tablas/efecto';
import type { JuegoStore } from '../../../store/juego.store';
import { abrir, boton, prepararJuego, pulsar } from '../../probar-pantallas';
import { Jugar } from '../../servicios/jugar';
import { TrampasDeEventos } from '../../servicios/trampas-de-eventos';

// La ventana de eventos de la pantalla de pruebas (Sprint 10, paso 5), con el deseo de verdad.

type Harness = Awaited<ReturnType<typeof abrir>>;

async function pulsarYEsperar(harness: Harness, texto: string): Promise<void> {
  pulsar(harness.routeNativeElement!, texto);
  await harness.fixture.whenStable();
}

function ventana(harness: Harness): HTMLElement | null {
  return harness.routeNativeElement!.querySelector('app-ventana-de-evento section.ventana');
}

/** Partida nueva (sin evento al empezar), con estos efectos, en la fase de acción y con el deseo abierto. */
async function conElDeseo(store: JuegoStore, efectos: Efecto[] = []): Promise<Harness> {
  store.nuevaPartida('Marta', 'mujer', 555);
  if (efectos.length) store.ejecutar((e, d) => aplicarEfectos(e, efectos, d));
  store.ejecutar((e, d) => lanzarEventos({ ...e, mundo: { ...e.mundo, fase: 'accion' } }, ['deseo'], d));
  return abrir('/partida');
}

describe('ventana de eventos', () => {
  it('sale encima del mapa con el título, el texto y las opciones; lo demás espera', async () => {
    const store = prepararJuego();
    const harness = await conElDeseo(store);
    const raiz = harness.routeNativeElement!;

    expect(ventana(harness)!.textContent).toContain('Deseo');
    expect(ventana(harness)!.textContent).toContain('djinn');
    expect(ventana(harness)!.querySelectorAll('.botones button')).toHaveLength(9);
    expect(raiz.querySelector('.barra')!.textContent).toContain('Evento en curso');
    expect(raiz.textContent).toContain('Hay un evento en curso: resuélvelo en la ventana del mapa.');
  });

  it('elegir una opción enseña lo que ha cambiado; "Continuar" cierra la ventana y lo apunta todo', async () => {
    const store = prepararJuego();
    const harness = await conElDeseo(store);
    const oro = store.estado()!.jugador.oro;

    await pulsarYEsperar(harness, 'Deseo de riqueza. +200 monedas de oro');
    expect(store.estado()!.jugador.oro).toBe(oro + 200);
    expect(ventana(harness)!.textContent).toContain('200');

    await pulsarYEsperar(harness, 'Continuar');
    expect(ventana(harness)).toBeNull();
    expect(store.estado()!.mundo.pilaEventos).toEqual([]);
    expect(harness.routeNativeElement!.querySelector('app-registro')!.textContent).toContain('Deseo: Eliges: «Deseo de riqueza. +200 monedas de oro»');
  });

  it('una opción desactivada sale con su motivo', async () => {
    const store = prepararJuego();
    const harness = await conElDeseo(store, [{ tipo: 'ganar_objeto', objeto: 'idolo_antediluviano' }]);

    const ídolo = boton(ventana(harness)!, 'Deseo de conocimiento prohibido. Obtienes el ídolo antediluviano (Ya lo tienes)');
    expect(ídolo.disabled).toBe(true);
  });

  // (Lo de "evento sin programar → pendiente" lo prueba enganche.spec.ts: el deseo ya no lleva a ninguno.)
  it('una opción que lleva a otro evento: la ventana pasa a ese evento', async () => {
    const store = prepararJuego();
    const harness = await conElDeseo(store);

    await pulsarYEsperar(harness, 'Deseo de poder. Consigues un objeto mágico');

    expect(ventana(harness)!.textContent).toContain('Tesoro mágico');
  });

  it('se puede plegar para mirar el mapa y volver a abrir (sin cerrar el evento)', async () => {
    const store = prepararJuego();
    const harness = await conElDeseo(store);

    await pulsarYEsperar(harness, 'Plegar');
    expect(ventana(harness)).toBeNull();
    expect(store.estado()!.mundo.pilaEventos).toHaveLength(1);

    await pulsarYEsperar(harness, 'Evento: Deseo (volver a la ventana)');
    expect(ventana(harness)).not.toBeNull();
  });

  it('con la mano de mono, al aparecer se puede evitar', async () => {
    const store = prepararJuego();
    const harness = await conElDeseo(store, [{ tipo: 'ganar_objeto', objeto: 'mano_de_mono' }]);

    expect(ventana(harness)!.textContent).toContain('Evitar el evento (mano de mono, quedan');
    await pulsarYEsperar(harness, 'Seguir');
    expect(ventana(harness)!.querySelectorAll('.botones button')).toHaveLength(9);
  });

  it('cualquier botón cuya regla trae eventos los mete en la pila (la puerta de Jugar)', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');

    // Las líneas de la regla reciben en "eventos" solo los pendientes (los programados abren la ventana).
    TestBed.inject(Jugar).hacer(
      e => ({ estado: { ...e, mundo: { ...e.mundo, fase: 'accion' as const } }, eventos: ['deseo', 'cueva'] }),
      r => ['Prueba', ...r.eventos.map(ev => `  Evento pendiente: ${ev}`)],
    );
    await harness.fixture.whenStable();

    expect(ventana(harness)!.textContent).toContain('djinn');
    const registro = harness.routeNativeElement!.querySelector('app-registro')!.textContent!;
    expect(registro).toContain('Evento pendiente: cueva');
    expect(registro).toContain('Evento: Deseo');
    expect(registro).not.toContain('Evento pendiente: deseo');
  });
});

describe('panel de la derecha plegable', () => {
  it('al plegarlo se esconde (y el mapa ocupa todo el ancho); al desplegarlo vuelve', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const raiz = harness.routeNativeElement!;

    await pulsarYEsperar(harness, 'Plegar el panel ▶');
    expect((raiz.querySelector('aside.panel') as HTMLElement).hidden).toBe(true);
    expect(raiz.classList).toContain('panel-plegado'); // raiz es la propia pantalla de la partida

    await pulsarYEsperar(harness, '◀ Desplegar el panel');
    expect((raiz.querySelector('aside.panel') as HTMLElement).hidden).toBe(false);
  });
});

describe('ventana de eventos: botones con sabor, sin tanto "Continuar" y la muerte (22-nov)', () => {
  /** Partida nueva con el borracho abierto, con esta vida. */
  async function conElBorracho(store: JuegoStore, vida: number): Promise<Harness> {
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'vida', operacion: 'fijar', cantidad: vida }], d));
    store.ejecutar((e, d) => lanzarEventos({ ...e, mundo: { ...e.mundo, fase: 'accion' } }, ['borracho'], d));
    return abrir('/partida');
  }

  it('el chequeo pone "Chequeo de Fuerza"; el resultado se queda arriba y el siguiente sale debajo', async () => {
    const store = prepararJuego();
    const harness = await conElBorracho(store, 10);
    TestBed.inject(TrampasDeEventos).proximaTirada.set(6);

    await pulsarYEsperar(harness, 'Chequeo de Fuerza');
    const texto = ventana(harness)!.textContent!;
    expect(texto).toContain('Pierdes 1 punto de vida por tropiezos y caídas.');
    expect(texto).toContain('Otro traspié');
    expect(boton(harness.routeNativeElement!, 'Chequeo de Fuerza')).toBeTruthy();
    expect(texto).not.toContain('Continuar');
  });

  it('al morir, la ventana se queda con lo que ha pasado y por qué; "Ver el final" la quita', async () => {
    const store = prepararJuego();
    const harness = await conElBorracho(store, 1);
    TestBed.inject(TrampasDeEventos).proximaTirada.set(6);

    await pulsarYEsperar(harness, 'Chequeo de Fuerza');
    expect(store.estado()!.mundo.finPartida).toMatchObject({ resultado: 'derrota' });
    const texto = ventana(harness)!.textContent!;
    expect(texto).toContain('Pierdes 1 punto de vida por tropiezos y caídas.');
    expect(texto).toContain('te abres la cabeza contra un barril');

    await pulsarYEsperar(harness, 'Ver el final');
    expect(ventana(harness)).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('PARTIDA TERMINADA');
    expect(harness.routeNativeElement!.textContent).toContain('te abres la cabeza contra un barril');
  });
});
