// Estado compartido entre los módulos de la escena.
export const ctx = {
  scene: null,
  camera: null,
  renderer: null,
  host: null,
  /** estado de la partida y valores derivados del fotograma actual */
  G: null,
  D: null,
  time: 0,
  /** hay hormigas peleando en primera línea */
  fighting: false
};

export const rnd = (a, b) => a + Math.random() * (b - a);

/** Teléfono o tablet: ahí se aligera el dibujo. */
export const mobile = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
