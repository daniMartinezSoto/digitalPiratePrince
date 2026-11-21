// HERRAMIENTAS DE DIBUJO DEL MAPA: ruido (para el papel y la costa irregular), campos a baja
// resolución, desenfoque y distancia a la costa. Copiadas tal cual del HTML de referencia
// (docs/ContextoMapa/mapa.html). Son solo dibujo: nada de reglas del juego.

/** Número pseudoaleatorio FIJO entre 0 y 1 para (a, b, c): el mismo mapa sale siempre igual. */
export const hash = (a: number, b: number, c: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

const PERM = new Uint8Array(512);
{
  let s = 1234567;
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

/** Ruido de valor suave (0..1). */
export function vn(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
  const a = PERM[PERM[X] + Y], b = PERM[PERM[X + 1] + Y], c = PERM[PERM[X] + Y + 1], d = PERM[PERM[X + 1] + Y + 1];
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), ab = a + (b - a) * u;
  return (ab + (c + (d - c) * u - ab) * v) / 255;
}

/** Ruido fractal (varias capas de vn). */
export function fbm(x: number, y: number, o: number): number {
  let s = 0, a = 0.5, f = 1, t = 0;
  for (let i = 0; i < o; i++) {
    s += a * vn(x * f, y * f);
    t += a;
    f *= 2.03;
    a *= 0.5;
  }
  return s / t;
}

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Un campo de números a baja resolución (1 valor cada f píxeles). */
export interface Campo {
  w: number;
  h: number;
  f: number;
  d: Float32Array;
}

export function field(LW: number, LH: number, f: number): Campo {
  const w = Math.ceil(LW / f) + 1, h = Math.ceil(LH / f) + 1;
  return { w, h, f, d: new Float32Array(w * h) };
}

/** Lee un campo en el píxel (x, y) con interpolación bilineal. */
export function S(F: Campo, x: number, y: number): number {
  let fx = x / F.f, fy = y / F.f;
  const w = F.w, h = F.h;
  if (fx < 0) fx = 0;
  if (fy < 0) fy = 0;
  if (fx > w - 1.001) fx = w - 1.001;
  if (fy > h - 1.001) fy = h - 1.001;
  const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * w + x0, d = F.d;
  return (d[i] * (1 - tx) + d[i + 1] * tx) * (1 - ty) + (d[i + w] * (1 - tx) + d[i + w + 1] * tx) * ty;
}

export function boxBlur(F: Campo, r: number): void {
  r = Math.round(r);
  if (r < 1) return;
  const w = F.w, h = F.h, a = F.d, b = new Float32Array(w * h), n = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[o + x] = acc / n;
        acc += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / n;
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
}

// Distancia euclídea exacta (Felzenszwalb) hasta el píxel más cercano con mask == val
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

export function edt(mask: Uint8Array, w: number, h: number, val: number): Float32Array {
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(w * h), out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = mask[y * w + x] === val ? 0 : 1e20;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}
