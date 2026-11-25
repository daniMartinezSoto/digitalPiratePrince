import { Component, computed, inject, signal } from '@angular/core';
import { comprarComida, comprarEnRastrillo, opcionesDelMercado, salirDelMercado, venderComida, venderObjeto } from '../../../core/mercado/mercado';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { lineasSimples } from '../../textos/lineas-del-registro';
import { descripcionDeObjeto, nombreDeObjeto, TEXTO_DE_MOTIVO_DEL_MERCADO } from '../../textos/textos';

// DENTRO DEL MERCADO (pantalla de pruebas): cada botón es una cosa aparte y se pulsa las veces que
// se quiera hasta "Salir del mercado" (decisión del autor). Las opciones salen de opcionesDelMercado.
@Component({
  selector: 'app-mercado',
  templateUrl: './mercado.html',
  styleUrl: './mercado.css',
})
export class Mercado {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

  protected readonly opciones = computed(() => {
    const estado = this.store.estado();
    return estado?.mundo.accionEnCurso?.tipo === 'mercado' ? opcionesDelMercado(estado) : null;
  });
  protected readonly inventario = computed(() =>
    (this.store.estado()?.jugador.inventario ?? []).map((o, posicion) => ({ posicion, nombre: nombreDeObjeto(o.id), descripcion: descripcionDeObjeto(o.id) })),
  );
  /** Objetos marcados para tirar si lo del rastrillo no cabe (por su posición). */
  protected readonly paraTirar = signal<number[]>([]);
  protected readonly motivo = TEXTO_DE_MOTIVO_DEL_MERCADO;
  protected readonly nombreDeObjeto = nombreDeObjeto;
  protected readonly descripcionDeObjeto = descripcionDeObjeto;

  protected comprarComida(): void {
    this.jugar.hacer((e, d) => comprarComida(e, d), (r, n) => lineasSimples('Mercado: compras 1 de comida', r, n));
  }

  protected venderComida(): void {
    this.jugar.hacer((e, d) => venderComida(e, d), (r, n) => lineasSimples('Mercado: vendes 1 de comida', r, n));
  }

  protected vender(posicion: number, objeto: string): void {
    this.paraTirar.set([]);
    this.jugar.hacer((e, d) => venderObjeto(e, posicion, d), (r, n) => lineasSimples(`Mercado: vendes ${nombreDeObjeto(objeto)}`, r, n));
  }

  protected marcar(posicion: number, marcado: boolean): void {
    this.paraTirar.update(lista => (marcado ? [...lista, posicion] : lista.filter(p => p !== posicion)));
  }

  protected comprarEnRastrillo(objeto: string): void {
    const tirar = this.paraTirar();
    this.paraTirar.set([]);
    this.jugar.hacer(
      (e, d) => comprarEnRastrillo(e, d, tirar.length > 0 ? tirar : undefined),
      (r, n) => lineasSimples(`Rastrillo: compras ${nombreDeObjeto(objeto)}`, r, n),
    );
  }

  protected salir(): void {
    this.jugar.hacer((e, d) => salirDelMercado(e, d), (r, n) => lineasSimples('Sales del mercado', r, n));
  }
}
