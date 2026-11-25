import { TestBed } from '@angular/core/testing';
import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import { AlmacenEnMemoria } from '../../../core/guardado/almacen-en-memoria';
import type { Efecto } from '../../../core/tablas/efecto';
import type { JuegoStore } from '../../../store/juego.store';
import { abrir, boton, escribir, ponerEn, prepararJuego, pulsar, type SitioDePrueba } from '../../probar-pantallas';

type Harness = Awaited<ReturnType<typeof abrir>>;

async function pulsarYEsperar(harness: Harness, texto: string): Promise<void> {
  pulsar(harness.routeNativeElement!, texto);
  await harness.fixture.whenStable();
}

async function cambiarYEsperar(harness: Harness, selector: string, valor: string): Promise<void> {
  escribir(harness.routeNativeElement!, selector, valor);
  await harness.fixture.whenStable();
}

/** Botones cuyo texto empieza por eso (los precios cambian). */
function botonQueEmpieza(raiz: HTMLElement, inicio: string): HTMLButtonElement {
  const b = [...raiz.querySelectorAll('button')].find(x => (x.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(inicio));
  if (!b) throw new Error(`No hay ningún botón que empiece por "${inicio}"`);
  return b;
}

async function pulsarQueEmpieza(harness: Harness, inicio: string): Promise<void> {
  botonQueEmpieza(harness.routeNativeElement!, inicio).click();
  await harness.fixture.whenStable();
}

/** Partida nueva con estos efectos aplicados, abierta y ya en la fase de acción en ese lugar. */
async function enLaAccion(store: JuegoStore, lugar: SitioDePrueba, efectos: Efecto[], semilla = 555): Promise<Harness> {
  store.nuevaPartida('Marta', 'mujer', semilla);
  if (efectos.length) store.ejecutar((e, d) => aplicarEfectos(e, efectos, d));
  ponerEn(store, lugar);
  const harness = await abrir('/partida');
  await pulsarYEsperar(harness, 'Empezar el día');
  return harness;
}

describe('pantalla Partida: acciones de varios pasos', () => {
  it('mercado: entrar, comprar comida, vender un objeto y salir', async () => {
    const store = prepararJuego();
    const harness = await enLaAccion(store, 'puerto', [{ tipo: 'ganar_objeto', objeto: 'unguento' }]);
    await pulsarYEsperar(harness, 'Ir al mercado');
    expect(store.estado()?.mundo.accionEnCurso?.tipo).toBe('mercado');
    expect(harness.routeNativeElement!.textContent).toContain('Rastrillo de hoy');

    const comida = store.estado()!.jugador.comida;
    await pulsarQueEmpieza(harness, 'Comprar 1 de comida');
    expect(store.estado()!.jugador.comida).toBe(comida + 1);

    await pulsarQueEmpieza(harness, 'Vender Ungüento curativo');
    expect(store.estado()!.jugador.inventario).toEqual([]);

    await pulsarYEsperar(harness, 'Salir del mercado');
    expect(store.estado()?.mundo.accionEnCurso).toBeNull();
    expect(store.estado()?.mundo.fase).toBe('comida');
  });

  it('mercado: con el inventario lleno, se marca qué tirar y se compra lo del rastrillo', async () => {
    const store = prepararJuego();
    const lleno: Efecto[] = Array.from({ length: 6 }, () => ({ tipo: 'ganar_objeto', objeto: 'unguento' }) as Efecto);
    const harness = await enLaAccion(store, 'puerto', [{ tipo: 'oro', cantidad: 500 }, ...lleno]);
    await pulsarYEsperar(harness, 'Ir al mercado');
    const pantalla = harness.routeNativeElement!;
    expect(pantalla.textContent).toContain('No te cabe');

    for (const nombre of ['tirar-0', 'tirar-1']) {
      const casilla = pantalla.querySelector(`input[name=${nombre}]`) as HTMLInputElement;
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change'));
    }
    await harness.fixture.whenStable();
    const comprarRastrillo = [...pantalla.querySelectorAll('button')].find(
      b => b.textContent!.trim().startsWith('Comprar') && !b.textContent!.includes('de comida'),
    )!;
    comprarRastrillo.click();
    await harness.fixture.whenStable();
    const inventario = store.estado()!.jugador.inventario.map(o => o.id);
    expect(inventario.filter(id => id !== 'unguento')).toHaveLength(1); // lo del rastrillo ya está dentro
    expect(pantalla.textContent).toContain('Hoy no queda nada en el rastrillo');
  });

  it('al recargar a mitad del mercado, se sigue dentro', async () => {
    const almacen = new AlmacenEnMemoria();
    const store = prepararJuego(almacen);
    const harness = await enLaAccion(store, 'puerto', []);
    await pulsarYEsperar(harness, 'Ir al mercado');

    TestBed.resetTestingModule(); // "recargar la página"
    const otra = prepararJuego(almacen);
    const otraVez = await abrir('/partida');
    expect(otra.estado()?.mundo.accionEnCurso?.tipo).toBe('mercado');
    expect(otraVez.routeNativeElement!.textContent).toContain('Salir del mercado');
  });

  it('contratar marineros: se elige cuántos', async () => {
    const store = prepararJuego();
    const harness = await enLaAccion(store, 'puerto', [{ tipo: 'tripulacion', cantidad: -10 }]);
    await pulsarYEsperar(harness, 'Contratar marineros');
    const tripulacion = store.estado()!.jugador.tripulacion;
    await cambiarYEsperar(harness, 'input[name=cantidad]', '3');
    await pulsarQueEmpieza(harness, 'Contratar 3');
    expect(store.estado()!.jugador.tripulacion).toBe(tripulacion + 3);
    expect(store.estado()?.mundo.fase).toBe('comida');
  });

  it('buscar seguidor con el grupo lleno: se despide a uno y entra el nuevo', async () => {
    const store = prepararJuego();
    const dos: Efecto[] = Array.from({ length: 2 }, () => ({ tipo: 'ganar_seguidor', seguidor: 'forzudo' }) as Efecto);
    const harness = await enLaAccion(store, 'puerto', [{ tipo: 'oro', cantidad: 300 }, ...dos], 2);
    await pulsarYEsperar(harness, 'Buscar seguidor');
    expect(store.estado()?.mundo.accionEnCurso?.tipo).toBe('seguidor');
    expect(harness.routeNativeElement!.textContent).toContain('El grupo está lleno');

    const despedido = store.estado()!.jugador.seguidores[0];
    await cambiarYEsperar(harness, 'select[name=despedir]', despedido.id);
    await pulsarQueEmpieza(harness, 'Contratar');
    const nombres = store.estado()!.jugador.seguidores.map(s => s.nombre);
    expect(nombres).toHaveLength(2);
    expect(nombres).not.toContain(despedido.nombre);
    expect(harness.routeNativeElement!.textContent).toContain(`Despides a ${despedido.nombre}`);
    expect(store.estado()?.mundo.fase).toBe('comida');
  });

  it('buscar seguidor y rechazarlo', async () => {
    const store = prepararJuego();
    const dos: Efecto[] = Array.from({ length: 2 }, () => ({ tipo: 'ganar_seguidor', seguidor: 'forzudo' }) as Efecto);
    const harness = await enLaAccion(store, 'puerto', [{ tipo: 'oro', cantidad: 300 }, ...dos], 2);
    await pulsarYEsperar(harness, 'Buscar seguidor');
    await pulsarYEsperar(harness, 'Rechazar');
    expect(store.estado()?.jugador.seguidores).toHaveLength(2);
    expect(store.estado()?.mundo.fase).toBe('comida');
  });

  it('dados: sentarse, apostar varias veces y levantarse', async () => {
    const store = prepararJuego();
    const harness = await enLaAccion(store, 'guarida', [{ tipo: 'oro', cantidad: 200 }]);
    await pulsarYEsperar(harness, 'Jugar a los dados');
    expect(store.estado()?.mundo.accionEnCurso?.tipo).toBe('dados');
    await pulsarYEsperar(harness, 'Apostar 10');
    await pulsarYEsperar(harness, 'Apostar 10');
    expect(harness.routeNativeElement!.textContent).toContain('Dados (apuestas 10)');
    await pulsarYEsperar(harness, 'Levantarse de la mesa');
    expect(store.estado()?.mundo.fase).toBe('comida');
  });

  it('pulso: se elige la apuesta y se ve el chequeo', async () => {
    const store = prepararJuego();
    const harness = await enLaAccion(store, 'guarida', [{ tipo: 'oro', cantidad: 200 }]);
    await pulsarYEsperar(harness, 'Echar un pulso');
    expect(boton(harness.routeNativeElement!, 'Cancelar')).toBeTruthy();
    await pulsarYEsperar(harness, 'Apostar 25');
    const texto = harness.routeNativeElement!.textContent!;
    expect(texto).toContain('Pulso (apuestas 25)');
    expect(texto).toContain('Chequeo de fuerza');
    expect(store.estado()?.mundo.fase).toBe('comida');
  });

  it('buscar información en un puerto: se puede sobornar', async () => {
    const store = prepararJuego();
    const harness = await enLaAccion(store, 'puerto', [{ tipo: 'oro', cantidad: -25 }]); // se queda con 25
    await pulsarYEsperar(harness, 'Buscar información');
    expect(boton(harness.routeNativeElement!, 'Sobornar 20 (+2)').disabled).toBe(false);
    expect(boton(harness.routeNativeElement!, 'Sobornar 30 (+3)').disabled).toBe(true);
    await pulsarYEsperar(harness, 'Sobornar 10 (+1)');
    expect(harness.routeNativeElement!.textContent).toContain('Buscar información (1 soborno(s))');
    expect(store.estado()?.mundo.fase).toBe('comida');
  });

  it('buscar información: "Cancelar" vuelve a la lista de acciones', async () => {
    const store = prepararJuego();
    const harness = await enLaAccion(store, 'puerto', []);
    await pulsarYEsperar(harness, 'Buscar información');
    await pulsarYEsperar(harness, 'Cancelar');
    expect(boton(harness.routeNativeElement!, 'Pescar')).toBeTruthy();
    expect(store.estado()?.mundo.fase).toBe('accion');
  });
});
