import { Component, computed, inject, signal } from '@angular/core';
import { objetosUsablesAhora } from '../../../core/objetos/consultas';
import { tirarObjeto } from '../../../core/objetos/tirar-objeto';
import { usarObjeto } from '../../../core/objetos/usar-objeto';
import { hayCombate } from '../../../core/combate/hay-combate';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { lineasSimples } from '../../textos/lineas-del-registro';
import { nombreDeObjeto } from '../../textos/textos';

// TUS OBJETOS (pantalla de pruebas): "Usar" los que se usan en la fase de acción (sin gastarla:
// el ungüento...) y "Tirar" cualquiera (pide confirmación: no se recupera). Los de combate se usan
// desde el combate.
@Component({
  selector: 'app-objetos',
  templateUrl: './objetos.html',
  styleUrl: './objetos.css',
})
export class Objetos {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

  protected readonly confirmandoTirar = signal<number | null>(null);

  protected readonly objetos = computed(() => {
    const estado = this.store.estado();
    if (!estado) return [];
    const usables = objetosUsablesAhora(estado);
    const sePuedeTirar = !estado.mundo.finPartida && !hayCombate(estado);
    return estado.jugador.inventario.map((o, posicion) => ({
      posicion,
      nombre: nombreDeObjeto(o.id),
      usos: o.usosRestantes,
      usable: usables.includes(posicion),
      sePuedeTirar,
    }));
  });

  protected usar(posicion: number, nombre: string): void {
    this.jugar.hacer((e, d) => usarObjeto(e, posicion, d), (r, n) => lineasSimples(`Usas: ${nombre}`, r, n));
  }

  protected tirar(posicion: number, nombre: string): void {
    this.confirmandoTirar.set(null);
    this.jugar.hacer((e, d) => tirarObjeto(e, posicion, d), (r, n) => lineasSimples(`Tiras: ${nombre}`, r, n));
  }
}
