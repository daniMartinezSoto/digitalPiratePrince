import { Component, inject, signal } from '@angular/core';
import { CONDICIONES } from '../../../core/catalogos/cargar-condiciones';
import { OBJETOS } from '../../../core/catalogos/cargar-objetos';
import { TIPOS_SEGUIDOR } from '../../../core/catalogos/cargar-seguidores';
import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import type { Efecto } from '../../../core/tablas/efecto';
import { Jugar } from '../../servicios/jugar';
import { lineasSimples } from '../../textos/lineas-del-registro';

// TRAMPAS DE PRUEBA (solo la pantalla de pruebas, no existirán en el juego): cambian la partida a mano
// para poder probar cosas sin esperar a que pasen (contratar marineros, el hambre, el mercado lleno...).
// Usan aplicarEfectos, así que respetan las mismas reglas que el juego (topes, fin de partida...).
@Component({
  selector: 'app-trampas',
  templateUrl: './trampas.html',
  styleUrl: './trampas.css',
})
export class Trampas {
  private readonly jugar = inject(Jugar);

  protected readonly objetos = OBJETOS.map(o => ({ id: o.id, nombre: o.nombre }));
  protected readonly condiciones = CONDICIONES.map(c => ({ id: c.id, nombre: `${c.nombre} (${c.categoria})` }));
  protected readonly seguidores = TIPOS_SEGUIDOR.map(t => ({ id: t.id, nombre: t.nombre }));

  protected readonly objeto = signal(OBJETOS[0]?.id ?? '');
  protected readonly condicion = signal(CONDICIONES[0]?.id ?? '');
  protected readonly seguidor = signal(TIPOS_SEGUIDOR[0]?.id ?? '');

  protected aplicar(titulo: string, efectos: Efecto[]): void {
    this.jugar.hacer((e, d) => aplicarEfectos(e, efectos, d), (r, n) => lineasSimples(`Trampa: ${titulo}`, r, n));
  }

  protected darObjeto(): void {
    this.aplicar('ganar objeto', [{ tipo: 'ganar_objeto', objeto: this.objeto() }]);
  }

  protected ponerCondicion(): void {
    this.aplicar('poner condición', [{ tipo: 'poner_condicion', condicion: this.condicion() }]);
  }

  protected quitarCondicion(): void {
    this.aplicar('quitar condición', [{ tipo: 'quitar_condicion', condicion: this.condicion() }]);
  }

  protected darSeguidor(): void {
    this.aplicar('ganar seguidor', [{ tipo: 'ganar_seguidor', seguidor: this.seguidor() }]);
  }
}
