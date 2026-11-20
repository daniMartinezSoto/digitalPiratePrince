import { Component, inject, signal } from '@angular/core';
import { BARCOS } from '../../../core/catalogos/cargar-barcos';
import { ENEMIGOS } from '../../../core/catalogos/cargar-enemigos';
import { iniciarCombate } from '../../../core/combate/combate';
import type { Sorpresa } from '../../../core/estado/combate';
import { iniciarCombateNaval } from '../../../core/combate-naval/combate-naval';
import { Jugar } from '../../servicios/jugar';
import { describirSuceso } from '../../textos/textos-de-combate';

// COMBATES DE PRUEBA (solo la pantalla de pruebas): en el juego, los combates los lanzarán los
// eventos (Sprint 10). Aquí se elige el enemigo (o el barco) y las opciones, y se empieza.
@Component({
  selector: 'app-combate-de-prueba',
  templateUrl: './combate-de-prueba.html',
  styleUrl: './combate-de-prueba.css',
})
export class CombateDePrueba {
  private readonly jugar = inject(Jugar);

  protected readonly enemigos = ENEMIGOS.map(e => ({ id: e.id, texto: `${e.nombre} (${e.ataque}/${e.resistencia})` }));
  protected readonly barcos = BARCOS.map(b => ({ id: b.id, texto: `${b.nombre} (daño ${b.dano}, resistencia ${b.resistencia})` }));

  protected readonly enemigo = signal(ENEMIGOS[0]?.id ?? '');
  protected readonly cantidad = signal(1);
  protected readonly puedeHuir = signal(true);
  protected readonly noMortal = signal(false);
  protected readonly sorpresa = signal<Sorpresa | ''>('');
  protected readonly barco = signal(BARCOS[0]?.id ?? '');

  protected elegirCantidad(texto: string): void {
    const n = Math.floor(Number(texto));
    this.cantidad.set(Number.isFinite(n) ? Math.max(1, Math.min(4, n)) : 1);
  }

  protected empezar(): void {
    const pedido = { enemigo: this.enemigo(), cantidad: this.cantidad() };
    const sorpresa = this.sorpresa();
    const opciones = { puedeHuir: this.puedeHuir(), noMortal: this.noMortal(), ...(sorpresa ? { sorpresa } : {}) };
    this.jugar.hacer(
      (e, d) => ({ estado: iniciarCombate(e, [pedido], d, opciones) }),
      r => {
        const enemigos = r.estado.mundo.combate?.enemigos.map(x => `${x.nombre} (${x.ataque}/${x.resistencia})`).join(', ') ?? '';
        const lineas = [`¡Combate de prueba! Contra: ${enemigos}`];
        if (!opciones.puedeHuir) lineas.push('  No se puede huir.');
        if (opciones.noMortal) lineas.push('  No es a muerte.');
        if (sorpresa) lineas.push('  ' + describirSuceso({ tipo: 'emboscada', quien: sorpresa }, {}));
        return lineas;
      },
    );
  }

  protected empezarNaval(): void {
    const barco = this.barco();
    this.jugar.hacer(
      (e, d) => ({ estado: iniciarCombateNaval(e, barco, d) }),
      r => {
        const c = r.estado.mundo.combateNaval;
        return [`¡Combate naval de prueba! Contra: ${c?.nombre} (daño ${c?.dano}, resistencia ${c?.resistencia})`];
      },
    );
  }
}
