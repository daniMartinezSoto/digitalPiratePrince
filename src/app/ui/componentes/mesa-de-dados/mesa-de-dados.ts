import { Component, computed, inject } from '@angular/core';
import { opcionesDeApuesta, type Apuesta } from '../../../core/guarida/apuestas';
import { apostarALosDados, levantarseDeLaMesa } from '../../../core/guarida/dados';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { lineasDeApuesta, lineasSimples } from '../../textos/lineas-del-registro';
import { textoDeApuesta } from '../../textos/textos';

// SENTADO A LA MESA DE DADOS (pantalla de pruebas): se apuesta tantas veces como se quiera hasta
// levantarse de la mesa.
@Component({
  selector: 'app-mesa-de-dados',
  templateUrl: './mesa-de-dados.html',
  styleUrl: './mesa-de-dados.css',
})
export class MesaDeDados {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

  protected readonly apuestas = computed(() => {
    const estado = this.store.estado();
    return estado?.mundo.accionEnCurso?.tipo === 'dados'
      ? opcionesDeApuesta(estado).map(b => ({ ...b, texto: textoDeApuesta(b.apuesta, b.cantidad) }))
      : null;
  });

  protected apostar(apuesta: Apuesta): void {
    this.jugar.hacer((e, d) => apostarALosDados(e, apuesta, d), lineasDeApuesta);
  }

  protected levantarse(): void {
    this.jugar.hacer((e, d) => levantarseDeLaMesa(e, d), (r, n) => lineasSimples('Te levantas de la mesa', r, n));
  }
}
