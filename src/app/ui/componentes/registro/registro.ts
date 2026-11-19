import { Component, computed, inject } from '@angular/core';
import { Registro } from '../../servicios/registro';

// EL REGISTRO (pantalla de pruebas): la lista de lo que va pasando, lo más nuevo arriba. Solo pinta.
@Component({
  selector: 'app-registro',
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class RegistroDeLaPartida {
  private readonly registro = inject(Registro);
  protected readonly textos = computed(() =>
    this.registro.entradas().map(entrada => `Día ${entrada.dia} · ${entrada.lineas.join('\n')}`),
  );
}
