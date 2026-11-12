// PLANO ANTERIOR (fondo pintado nest2.png), guardado como referencia. El juego usa layout.js (mapa 3D).
// Plano de la escena en PÍXELES DE LA IMAGEN DE FONDO (public/bg/nest.jpg, 1672×941).
// x crece a la derecha, y crece hacia abajo, igual que en un editor de imágenes.
// Si cambias el fondo, ajusta estos números (pulsa C en el juego para ver las colisiones).

// Fondo actual: nest2.jpg (ilustración). El plano del fondo anterior está en layout.nest1.js.
export const IMG = { url: 'bg/nest2.png', w: 1672, h: 941 };

/** Zonas por las que se puede caminar (polígonos). */
export const ZONES = {
  // franja de tierra y hierba encima del corte (no en el borde: así se ve que la pisan)
  surface: [[0, 220], [700, 224], [890, 224], [1672, 218], [1672, 256], [890, 256], [0, 258]],
  // pozo desde el agujero, pegado a la pared del fondo, hasta el suelo de la cámara
  tunnel: [[748, 226], [834, 226], [848, 330], [862, 430], [848, 530], [838, 618], [748, 618], [738, 530], [722, 430], [734, 330]],
  // suelo visible de la cámara
  chamber: [[205, 650], [280, 618], [450, 604], [650, 600], [800, 598], [1000, 600], [1200, 605], [1380, 622], [1458, 660], [1462, 720], [1400, 760], [1200, 772], [950, 776], [700, 775], [450, 768], [270, 748], [195, 710]]
};

/** Puntos de paso entre zonas. */
export const NAV = {
  hole: [790, 238],
  t1: [790, 340],
  t2: [792, 470],
  floorIn: [792, 612]
};

/** Comida en la superficie: la hierba de la izquierda (a la misma distancia del agujero que la fresa) y la fresa de la derecha. */
export const FOOD = [
  { x: 165, y: 238, type: 'leaf', r: 36 },
  { x: 1420, y: 234, type: 'berry', r: 34 }
];

/** La reina y sus montones de cría. */
export const QUEEN = { x: 840, y: 700, yaw: -0.35, size: 265 };
export const EGG_PILE = { x: 540, y: 712 };
/** Despensa: montón de comida guardada (la jalea), en el extremo izquierdo de la cámara. */
export const PANTRY = { x: 360, y: 706 };
export const LARVA_PILE = { x: 1200, y: 708 };
export const REFUGE = { x0: 470, x1: 1220, y0: 725, y1: 765 };

/** Combate en la superficie: guardia a la derecha del agujero, enemigos llegando desde la derecha. */
export const GUARD = { x: 900, y: 228, dx: 50, dy: 15, cols: 4 };
export const FOE_LINE = { x: 1060, y: 230, dx: 58, dy: 12, cols: 4, spawnX: 1780 };
export const BOSS_POS = { x: 1290, y: 244 };

/** Tamaño en píxeles de una unidad de modelo (las hormigas miden ≈1 unidad). */
export const SIZE = { ants: 108, termite: 104, spider: 120, beetle: 116, egg: 205, larva: 150 };

/** Cuántas hormigas se dibujan como máximo (la simulación cuenta todas). */
export const CAP = { ants: 28 };

/** Píxeles por unidad de velocidad de la simulación. */
export const PX = 58;

/** Profundidad: más abajo en la imagen = más cerca de la cámara. */
export const ZK = 4;

/** Perspectiva falsa: tamaño e inclinación según la zona y la altura en la imagen. */
export function depthScale(y) {
  if (y < 320) return 0.86 + 0.14 * clamp01((y - 191) / 70);
  return 0.86 + 0.2 * clamp01((y - 600) / 195);
}
export function tiltFor(y) { return y < 320 ? 0.32 : 0.62; }

export const clamp01 = v => Math.max(0, Math.min(1, v));
