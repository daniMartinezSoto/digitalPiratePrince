import { Component, computed, inject } from '@angular/core';
import {
  abordar,
  cerrarCombateNaval,
  disparar,
  huirDelCombateNaval,
  opcionesDeCombateNaval,
} from '../../../core/combate-naval/combate-naval';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { lineasSimples } from '../../textos/lineas-del-registro';
import {
  lineasDeDuelo,
  lineasDeHuidaNaval,
  lineasDeResumenNaval,
  TEXTO_NO_ABORDAR,
  TEXTO_NO_HUIR_NAVAL,
} from '../../textos/textos-de-combate';
import { Combate } from '../combate/combate';
import { cerrarCombateDelEvento, eventoEsperaUnCombate, vistaDelEvento } from '../../../core/eventos/motor';
import { lineasDeEvento } from '../../textos/textos-de-eventos';

// EL COMBATE NAVAL (pantalla de pruebas): el barco enemigo, tu tripulación y los botones Disparar,
// Huir y Abordar. Durante el abordaje aparece el combate normal. Al terminar, "Cerrar el combate
// naval" cobra lo que toca y apunta el resumen (la futura pantalla de resultados).
@Component({
  selector: 'app-combate-naval',
  imports: [Combate],
  templateUrl: './combate-naval.html',
  styleUrl: './combate-naval.css',
})
export class CombateNaval {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

  protected readonly naval = computed(() => this.store.estado()?.mundo.combateNaval ?? null);
  protected readonly tripulacion = computed(() => this.store.estado()?.jugador.tripulacion ?? 0);
  protected readonly abordajeTerminado = computed(() => this.store.estado()?.mundo.combate?.resultado != null);
  protected readonly opciones = computed(() => {
    const estado = this.store.estado();
    return estado ? opcionesDeCombateNaval(estado) : null;
  });

  protected readonly textoNoHuir = TEXTO_NO_HUIR_NAVAL;
  protected readonly textoNoAbordar = TEXTO_NO_ABORDAR;

  protected disparar(): void {
    const nombre = this.naval()?.nombre ?? '';
    const ronda = (this.naval()?.ronda ?? 0) + 1;
    this.jugar.hacer(
      (e, d) => disparar(e, d),
      (r, n) => [...lineasDeDuelo(ronda, r.duelo, nombre), ...lineasSimples('', r, n).slice(1)],
    );
  }

  protected huir(): void {
    this.jugar.hacer((e, d) => huirDelCombateNaval(e, d), r => lineasDeHuidaNaval(r));
  }

  protected abordar(): void {
    this.jugar.hacer(
      (e, d) => ({ estado: abordar(e, d) }),
      r => [`¡Al abordaje! Contra: ${r.estado.mundo.combate?.enemigos.map(x => `${x.nombre} (${x.ataque}/${x.resistencia})`).join(', ')}`],
    );
  }

  protected cerrar(): void {
    const estado = this.store.estado();
    // Un combate naval que lanzó un evento lo cierra el motor: así el evento sigue por donde toque.
    if (estado && eventoEsperaUnCombate(estado)) {
      const evento = vistaDelEvento(estado)?.titulo ?? '';
      this.jugar.hacer(
        (e, d) => cerrarCombateDelEvento(e, d),
        (r, n) => lineasDeEvento(`${evento}: se cierra el combate naval`, vistaDelEvento(r.estado)?.lectura ?? null, r.pendientes, n),
      );
      return;
    }
    // r.eventos ya trae solo los pendientes (los programados abren la ventana de eventos).
    this.jugar.hacer((e, d) => cerrarCombateNaval(e, d), r => lineasDeResumenNaval({ ...r.resumen, eventos: r.eventos }));
  }
}
