// Plano de la escena en PÍXELES DE LA IMAGEN DE FONDO (public/bg/nest.jpg, 1672×941).
// x crece a la derecha, y crece hacia abajo, igual que en un editor de imágenes.
// Si cambias el fondo, ajusta estos números (pulsa C en el juego para ver las colisiones).

export const IMG = { url: 'bg/nest.jpg', w: 1672, h: 941 };

/** Zonas por las que se puede caminar (polígonos). */
export const ZONES = {
  // franja de hierba delante de la piedra y del montículo
  surface: [[0, 258], [540, 262], [660, 268], [900, 266], [1250, 258], [1672, 254], [1672, 294], [900, 294], [0, 296]],
  // pozo vertical desde el agujero hasta el techo de la cámara
  tunnel: [[752, 262], [818, 262], [832, 330], [850, 420], [826, 530], [772, 530], [738, 420], [752, 330]],
  // suelo visible de la cámara
  chamber: [[330, 610], [372, 566], [480, 540], [650, 528], [900, 522], [1120, 528], [1300, 545], [1388, 580], [1404, 630], [1350, 668], [1150, 688], [900, 693], [650, 690], [430, 680], [338, 652]]
};

/** Puntos de paso entre zonas. */
export const NAV = {
  hole: [786, 268],
  t1: [788, 330],
  t2: [794, 410],
  floorIn: [800, 532]
};

/** Comida en la superficie: el trébol de la izquierda y la fresa de la derecha. */
export const FOOD = [
  { x: 110, y: 276, type: 'leaf', r: 40 },
  { x: 1245, y: 272, type: 'berry', r: 26 }
];

/** La reina y sus montones de cría. */
export const QUEEN = { x: 840, y: 618, yaw: -0.35, size: 265 };
export const EGG_PILE = { x: 534, y: 628 };
/** Despensa: montón de comida guardada (la jalea), en el extremo izquierdo de la cámara. */
export const PANTRY = { x: 400, y: 622 };
export const LARVA_PILE = { x: 1238, y: 624 };
export const REFUGE = { x0: 540, x1: 1140, y0: 640, y1: 688 };

/** Combate en la superficie: guardia a la derecha del agujero, enemigos llegando desde la derecha. */
export const GUARD = { x: 862, y: 260, dx: 50, dy: 15, cols: 4 };
export const FOE_LINE = { x: 1040, y: 262, dx: 58, dy: 12, cols: 4, spawnX: 1780 };
export const BOSS_POS = { x: 1290, y: 276 };

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
  if (y < 320) return 0.86 + 0.14 * clamp01((y - 225) / 70);
  return 0.86 + 0.2 * clamp01((y - 520) / 175);
}
export function tiltFor(y) { return y < 320 ? 0.32 : 0.62; }

export const clamp01 = v => Math.max(0, Math.min(1, v));
