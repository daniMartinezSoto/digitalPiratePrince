import { Component, model } from '@angular/core';
import { LUGARES, RASGOS, TERRENOS_AL_RASO } from '../../../core/turno/lugar';
import { PUERTOS_PRINCIPALES } from '../../../core/viaje/puertos-principales';
import { NOMBRE_DE_LUGAR, NOMBRE_DE_RASGO, NOMBRE_DE_TERRENO } from '../../textos/textos';
import type { Ubicacion } from '../../ubicacion';

// "¿DÓNDE ESTÁS?" (pantalla de pruebas): los selectores provisionales hasta que exista el mapa.
// Solo cambia la ubicación elegida en la pantalla; no toca la partida.
@Component({
  selector: 'app-donde-estas',
  templateUrl: './donde-estas.html',
  styleUrl: './donde-estas.css',
})
export class DondeEstas {
  readonly ubicacion = model.required<Ubicacion>();

  protected readonly lugares = LUGARES.map(id => ({ id, nombre: NOMBRE_DE_LUGAR[id] }));
  protected readonly terrenos = TERRENOS_AL_RASO.map(id => ({ id, nombre: NOMBRE_DE_TERRENO[id] }));
  protected readonly rasgos = [
    { id: 'ninguno', nombre: 'Ninguno' },
    ...RASGOS.map(id => ({ id, nombre: NOMBRE_DE_RASGO[id] })),
  ];

  protected readonly nombreDelPuerto = (id: string) => PUERTOS_PRINCIPALES.find(p => p.id === id)?.nombre ?? id;

  /** Cambiar algo a mano es "estar en otro sitio": deja de estar en el puerto principal al que llegó. */
  protected cambiar<K extends keyof Ubicacion>(campo: K, valor: Ubicacion[K]): void {
    this.ubicacion.update(u => ({ ...u, [campo]: valor, puerto: undefined }));
  }

  protected numero(texto: string): number {
    const n = Number(texto);
    return Number.isInteger(n) ? n : 0;
  }
}
