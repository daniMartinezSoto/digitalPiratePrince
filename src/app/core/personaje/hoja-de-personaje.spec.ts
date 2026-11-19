import { crearPartida } from '../partida/crear-partida';
import { fuerzaActual } from '../condiciones/consultas';
import { hojaDePersonaje } from './hoja-de-personaje';

describe('hojaDePersonaje (la hoja lista para enseñar)', () => {
  it('trae los datos del personaje con el nombre bonito del sobrenombre', () => {
    const { estado } = crearPartida(123, 'Marta', 'mujer');
    const hoja = hojaDePersonaje(estado.jugador);
    expect(hoja.nombre).toBe('Marta');
    expect(hoja.retrato).toBe('mujer');
    expect(hoja.sobrenombre.id).toBe(estado.jugador.sobrenombre);
    expect(hoja.sobrenombre.nombre).not.toBe(estado.jugador.sobrenombre); // "El fuerte", no "el_fuerte"
    expect(hoja.sobrenombre.descripcion.length).toBeGreaterThan(0);
    expect(hoja.vida).toBe(estado.jugador.vida);
    expect(hoja.oro).toBe(50);
  });

  it('la fuerza sale de la consulta (con el amuleto), no del campo de la hoja', () => {
    const { estado } = crearPartida(7, 'Marta'); // "el maldito"
    expect(hojaDePersonaje(estado.jugador).fuerza).toBe(fuerzaActual(estado.jugador));
  });

  it('"el maldito" enseña su amuleto y sus partes como condiciones con nombre', () => {
    const { estado } = crearPartida(7, 'Marta');
    const condiciones = hojaDePersonaje(estado.jugador).condiciones;
    expect(condiciones.some(c => c.id === 'amuleto_maldito')).toBe(true);
    expect(condiciones.every(c => c.nombre !== c.id)).toBe(true);
  });

  it('"el hermano" enseña a su seguidor con el nombre del tipo y marcado como vital', () => {
    const { estado } = crearPartida(30, 'Marta');
    const [seguidor] = hojaDePersonaje(estado.jugador).seguidores;
    expect(seguidor.vital).toBe(true);
    expect(seguidor.inseparable).toBe(true);
    expect(seguidor.tipo).not.toBe(estado.jugador.seguidores[0].tipo);
  });

  it('con retrato de mujer, el sobrenombre sale en femenino ("La afortunada")', () => {
    const hombre = hojaDePersonaje(crearPartida(3, 'Mateo', 'hombre').estado.jugador); // el afortunado
    const mujer = hojaDePersonaje(crearPartida(3, 'Marta', 'mujer').estado.jugador);
    expect(hombre.sobrenombre.nombre).toBe('El afortunado');
    expect(mujer.sobrenombre.nombre).toBe('La afortunada');
  });

  it('la descripción del afortunado dice que solo vale en combate', () => {
    const hoja = hojaDePersonaje(crearPartida(3, 'Marta').estado.jugador);
    expect(hoja.sobrenombre.descripcion).toContain('solo en combate');
  });

  it('las partes del amuleto dicen dentro de qué van ("Amuleto maldito")', () => {
    const { estado } = crearPartida(45, 'Marta'); // el maldito: carisma + ambición desmedida
    const condiciones = hojaDePersonaje(estado.jugador).condiciones;
    expect(condiciones.find(c => c.id === 'amuleto_maldito')?.dentroDe).toBeUndefined();
    const partes = condiciones.filter(c => c.origen === 'parte');
    expect(partes.map(c => c.nombre).sort()).toEqual(['Ambición desmedida', 'Carisma']);
    expect(partes.every(c => c.dentroDe === 'Amuleto maldito')).toBe(true);
  });

  it('cada condición trae lo que implica (su descripción del catálogo)', () => {
    const { estado } = crearPartida(45, 'Marta');
    const condiciones = hojaDePersonaje(estado.jugador).condiciones;
    expect(condiciones.length).toBeGreaterThan(0);
    expect(condiciones.every(c => c.descripcion.length > 0)).toBe(true);
  });
});
