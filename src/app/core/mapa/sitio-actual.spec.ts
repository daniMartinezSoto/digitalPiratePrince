import type { Estado } from '../estado/estado';
import type { Marca } from '../estado/mundo';
import { crearPartida } from '../partida/crear-partida';
import type { Coordenada } from './mapa';
import { casillaBloqueada, casillasMarcadas, mapaActual, rasgoEn, sitioActual, sitioEn } from './sitio-actual';

// Casillas del primer mapa de prueba usadas aquí:
//   6,0 inicio (jungla profunda, sin agua al lado) · 7,2 el barco (costa, al SE de La Habana)
//   6,2 La Habana (puerto principal, playa) · 14,11 Cala Ventura (puerto normal, sobre jungla)
//   18,7 aldea · 20,3 monasterio · 18,2 guarida · 12,5 naufragio · 20,7 ruinas

function partida(cambios: { posicion?: Coordenada; marcas?: Marca[] } = {}): Estado {
  const { estado } = crearPartida(123, 'Marta');
  return { ...estado, mundo: { ...estado.mundo, ...cambios } };
}

const c = (col: number, fila: number) => ({ col, fila });

describe('el sitio sale del mapa', () => {
  it('al empezar: a pie, a la intemperie, en jungla profunda, sin agua al lado', () => {
    expect(sitioActual(partida())).toEqual({
      lugar: 'intemperie',
      hex: c(6, 0),
      juntoAlAgua: false,
      terreno: 'jungla_profunda',
      aBordo: false,
      guaridaSinExplorar: false,
    });
  });

  it('en la casilla del barco vas a bordo', () => {
    const sitio = sitioActual(partida({ posicion: c(7, 2) }));

    expect(sitio).toMatchObject({ lugar: 'barco', aBordo: true, juntoAlAgua: true, terreno: 'costa' });
  });

  it('un puerto principal es puerto y dice cuál es', () => {
    expect(sitioEn(partida(), c(6, 2), false)).toMatchObject({ lugar: 'puerto', puertoPrincipal: 'la_habana', juntoAlAgua: true, terreno: 'playa' });
  });

  it('una casilla con puerto es puerto aunque su terreno sea jungla (y no es principal)', () => {
    const sitio = sitioEn(partida(), c(14, 11), false);

    expect(sitio).toMatchObject({ lugar: 'puerto', terreno: 'jungla', rasgoDelMapa: 'puerto' });
    expect(sitio.puertoPrincipal).toBeUndefined();
  });

  it('aldea, monasterio, naufragio y ruinas', () => {
    const e = partida();

    expect(sitioEn(e, c(18, 7), false).lugar).toBe('aldea');
    expect(sitioEn(e, c(20, 3), false).lugar).toBe('monasterio');
    expect(sitioEn(e, c(12, 5), false)).toMatchObject({ lugar: 'intemperie', rasgo: 'naufragio' });
    expect(sitioEn(e, c(20, 7), false)).toMatchObject({ lugar: 'intemperie', rasgo: 'ruinas' });
  });

  describe('las guaridas piratas', () => {
    it('sin explorar: a la intemperie, esperando a E038', () => {
      expect(sitioEn(partida(), c(18, 2), false)).toMatchObject({ lugar: 'intemperie', guaridaSinExplorar: true, rasgoDelMapa: 'guarida_pirata' });
    });

    it('neutral: funciona como un puerto pirata', () => {
      const e = partida({ marcas: [{ ...c(18, 2), tipo: 'guarida_neutral' }] });

      expect(sitioEn(e, c(18, 2), false)).toMatchObject({ lugar: 'guarida', guaridaSinExplorar: false });
    });

    it('abandonada: deja de ser guarida y queda su terreno (para el resto de la partida)', () => {
      const e = partida({ marcas: [{ ...c(18, 2), tipo: 'rasgo_cambiado', rasgo: 'ninguno' }] });

      expect(rasgoEn(e, c(18, 2))).toBeUndefined();
      expect(sitioEn(e, c(18, 2), false)).toMatchObject({ lugar: 'intemperie', terreno: 'jungla_profunda', guaridaSinExplorar: false });
    });

    it('unas ruinas que resultaron ser una ciudad pirata pasan a ser guarida neutral', () => {
      const e = partida({
        marcas: [
          { ...c(20, 7), tipo: 'rasgo_cambiado', rasgo: 'guarida_pirata' },
          { ...c(20, 7), tipo: 'guarida_neutral' },
        ],
      });

      expect(rasgoEn(e, c(20, 7))).toBe('guarida_pirata');
      expect(sitioEn(e, c(20, 7), false)).toMatchObject({ lugar: 'guarida' });
      expect(sitioEn(e, c(20, 7), false).rasgo).toBeUndefined(); // ya no se pueden registrar como ruinas
    });

    it('hostil (bloqueada): ni guarida ni "sin explorar"', () => {
      const e = partida({ marcas: [{ ...c(18, 2), tipo: 'casilla_bloqueada' }] });

      expect(casillaBloqueada(e, c(18, 2))).toBe(true);
      expect(sitioEn(e, c(18, 2), false).guaridaSinExplorar).toBe(false);
    });
  });

  it('cualquier casilla puede cambiar de rasgo: una aldea nueva en la jungla (si hay varios cambios, manda el último)', () => {
    const e = partida({
      marcas: [
        { ...c(6, 0), tipo: 'rasgo_cambiado', rasgo: 'puerto' },
        { ...c(6, 0), tipo: 'rasgo_cambiado', rasgo: 'aldea' },
      ],
    });

    expect(sitioActual(e)).toMatchObject({ lugar: 'aldea', rasgoDelMapa: 'aldea' });
  });

  it('las marcas solo afectan a su casilla', () => {
    const e = partida({ marcas: [{ ...c(0, 0), tipo: 'rasgo_cambiado', rasgo: 'ninguno' }] });

    expect(rasgoEn(e, c(18, 2))).toBe('guarida_pirata');
    expect(casillaBloqueada(e, c(0, 0))).toBe(false);
  });

  it('avisa si la casilla cae fuera del mapa', () => {
    expect(() => sitioEn(partida(), c(40, 0), false)).toThrow(/fuera del mapa/);
  });

  describe('el mapa para dibujarlo', () => {
    it('sin cambios, es el mismo mapa del JSON', () => {
      const e = partida();
      expect(mapaActual(e)).toBe(mapaActual(e));
      expect(mapaActual(e).casillas[0]).toEqual({ col: 0, fila: 0, terreno: 'jungla_profunda', rasgo: 'guarida_pirata', variante: 0 });
    });

    it('con casillas cambiadas: la aldea nueva aparece y la guarida abandonada desaparece', () => {
      const e = partida({
        marcas: [
          { ...c(6, 0), tipo: 'rasgo_cambiado', rasgo: 'aldea' },
          { ...c(18, 2), tipo: 'rasgo_cambiado', rasgo: 'ninguno' },
        ],
      });
      const mapa = mapaActual(e);
      expect(mapa.casillas[0 * 30 + 6].rasgo).toBe('aldea');
      expect(mapa.casillas[2 * 30 + 18].rasgo).toBeUndefined();
      expect(mapa.casillas[2 * 30 + 6].rasgo).toBe('puerto'); // lo demás, igual
    });

    it('las casillas bloqueadas (roca) y las aldeas ofendidas (X roja), sin repetir', () => {
      const e = partida({
        marcas: [
          { ...c(7, 0), tipo: 'casilla_bloqueada' },
          { ...c(18, 7), tipo: 'echado_de_la_aldea' },
          { ...c(18, 7), tipo: 'audiencia_vetada' },
          { ...c(6, 2), tipo: 'audiencia_vetada' }, // un puerto: no es una aldea ofendida
        ],
      });
      expect(casillasMarcadas(e)).toEqual({ bloqueadas: [c(7, 0)], ofendidas: [c(18, 7)] });
    });
  });
});
