import { Component, computed, inject, signal } from '@angular/core';
import { opcionesDeMarineros, pagarMarineros } from '../../../core/contratar/contratar';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { lineasSimples } from '../../textos/lineas-del-registro';

// CONTRATAR MARINEROS, paso 2 (pantalla de pruebas): el jugador elige cuántos (de 0 al máximo).
@Component({
  selector: 'app-marineros',
  templateUrl: './marineros.html',
  styleUrl: './marineros.css',
})
export class Marineros {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

  protected readonly opciones = computed(() => {
    const estado = this.store.estado();
    return estado?.mundo.accionEnCurso?.tipo === 'marineros' ? opcionesDeMarineros(estado) : null;
  });
  protected readonly cantidad = signal(0);

  protected elegir(texto: string, maximo: number): void {
    const n = Math.floor(Number(texto));
    this.cantidad.set(Number.isFinite(n) ? Math.max(0, Math.min(maximo, n)) : 0);
  }

  protected contratar(): void {
    const cantidad = this.cantidad();
    this.cantidad.set(0);
    this.jugar.hacer((e, d) => pagarMarineros(e, cantidad, d), (r, n) => lineasSimples(`Contratas ${cantidad} marinero(s)`, r, n));
  }
}
