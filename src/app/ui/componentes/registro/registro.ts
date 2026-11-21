import { Component, computed, inject, input } from '@angular/core';
import { Registro } from '../../servicios/registro';

// EL REGISTRO (pantalla de pruebas): la lista de lo que va pasando, lo más nuevo arriba. Solo pinta.
// Con "ultimas", solo las N entradas más nuevas (el resumen de abajo del panel).
@Component({
  selector: 'app-registro',
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class RegistroDeLaPartida {
  readonly ultimas = input<number | null>(null);
  private readonly registro = inject(Registro);
  protected readonly textos = computed(() => {
    const entradas = this.registro.entradas(), n = this.ultimas();
    return (n === null ? entradas : entradas.slice(0, n)).map(entrada => `Día ${entrada.dia} · ${entrada.lineas.join('\n')}`);
  });
}
