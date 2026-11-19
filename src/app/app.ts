import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// La raíz de la aplicación: solo deja sitio a la pantalla que toque (ui/rutas.ts).
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
