import { Component, computed, inject } from '@angular/core';
import { ResultadoEnVentana } from '../../servicios/resultado-en-ventana';

// VENTANA DE RESULTADO, encima del mapa: lo que ha pasado con la última acción (ver ResultadoEnVentana).
// Sale por encima de las demás ventanas y se va sola: si la acción ha lanzado un evento, debajo
// queda el evento.

// La imagen de cada resultado (ruta dentro de public/), como la de los eventos. Sin ella, no sale nada.
// Para ponerla: deja el dibujo en public/eventos/ y escribe aquí su ruta ("pescar": "eventos/pescar.png").
const IMAGEN: Partial<Record<string, string>> = {};

@Component({
  selector: 'app-ventana-de-resultado',
  templateUrl: './ventana-de-resultado.html',
  styleUrl: './ventana-de-resultado.css',
})
export class VentanaDeResultado {
  private readonly resultados = inject(ResultadoEnVentana);

  protected readonly resultado = this.resultados.actual;
  protected readonly imagen = computed(() => {
    const r = this.resultado();
    return r ? IMAGEN[r.id] : undefined;
  });

  protected cerrar(): void {
    this.resultados.cerrar();
  }

  protected retener(): void {
    this.resultados.retener();
  }

  protected soltar(): void {
    this.resultados.soltar();
  }
}
