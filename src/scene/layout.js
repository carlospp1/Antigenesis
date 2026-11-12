// Plano de la escena. Los sitios se definen en el MUNDO 3D del mapa (x a la derecha, y arriba,
// z hacia la cámara; la superficie está a y≈0,21 y el suelo de la cueva a y≈-0,43) y al cargar se pasan
// a PÍXELES DE IMAGEN (1672×941), que es como piensa el resto del juego: la «imagen» es lo que ve la
// cámara de referencia (REF), de frente, como el fondo pintado de antes. Ver world.js y colliders.initLayout.
// Pulsa C en el juego para ver zonas y puntos de paso.
// El plano del fondo pintado anterior está en layout.nest2.js (y el de antes, en layout.nest1.js).

export const IMG = { w: 1672, h: 941 };

/** Mapa 3D y la cámara de referencia (posición, punto al que mira y apertura vertical en grados). */
export const MAP = { url: 'models/mapa-opt.glb', backdrop: 'bg/nest2.jpg' };
export const REF = { pos: [0, 0.4, 2.5], target: [0, -0.06, 0], fov: 25.5 };

/** Unidades del mundo por píxel de imagen para los tamaños (SIZE, efectos): las criaturas miden lo mismo en todo el mapa. */
export const PXW = 0.0013;

/**
 * Zonas por las que se puede caminar: terreno a la altura `h` dentro del polígono `xz` (planta del mundo).
 * Así las rocas, las hierbas altas y las fresas no se pisan.
 */
export const ZONES = {
  // césped y camino de arriba (sin el agujero)
  surface: { h: [0.17, 0.25], xz: [[-0.86, 0.66], [-0.86, -0.1], [-0.3, -0.25], [0.3, -0.3], [0.86, -0.1], [0.86, 0.66], [-0.02, 0.66], [-0.02, 0.1], [-0.2, 0.1], [-0.2, 0.66]] },
  // suelo de la cueva
  chamber: { h: [-0.46, -0.37], xz: [[-0.78, -0.5], [0.78, -0.5], [0.78, 0.55], [-0.78, 0.55]] }
};

/**
 * Raíz que cuelga del agujero hasta el suelo de la cueva: por ella suben y bajan.
 * La cueva es diáfana bajo el agujero, así que sin la raíz no habría por dónde trepar.
 */
export const ROOT = { r: 0.016, pts: [[-0.112, 0.214, 0.128], [-0.116, 0.17, 0.148], [-0.14, 0.07, 0.18], [-0.12, -0.06, 0.2], [-0.085, -0.19, 0.22], [-0.1, -0.31, 0.25], [-0.13, -0.405, 0.27]] };
/** De la superficie al borde del agujero, y del pie de la raíz al suelo. */
export const ROOT_TOP = [-0.112, 0.211, 0.085];
export const ROOT_FLOOR = [-0.1, -0.428, 0.36];
/**
 * El agujero parte la superficie en dos hasta el borde de delante: de un lado al otro se pasa por detrás
 * de él. Estos son los puntos de paso a su izquierda y a su derecha (mundo).
 */
export const HOLE_SIDES = { L: [-0.26, 0.211, 0.045], R: [0.04, 0.211, 0.045] };

/** Puntos de paso entre zonas (en la imagen). Se calculan al cargar a partir de la raíz. */
export const NAV = {};

/** Comida en la superficie: las hojas de la izquierda y la fresa de la derecha. `r`: radio en el mundo. */
export const FOOD = [
  { at: [-0.62, 0.21, 0.42], type: 'leaf', r: 0.05 },
  { at: [0.6, 0.21, 0.36], type: 'berry', r: 0.045 }
];
/** Franja de la superficie por la que pasean entre la comida y el agujero (z del mundo). */
export const SURF_BAND = { z: [0.3, 0.6] };

/** La reina y sus montones de cría, al fondo de la cueva (la parte de abajo de la pantalla la tapan los paneles). */
export const QUEEN = { at: [0.14, -0.43, -0.2], yaw: -0.35, size: 215 };
export const EGG_PILE = { at: [-0.34, -0.43, -0.2], dx: 0.045, dz: 0.05 };
/** Despensa: montón de comida guardada (la jalea), a la izquierda de la cueva. */
export const PANTRY = { at: [-0.6, -0.43, -0.05] };
export const LARVA_PILE = { at: [0.56, -0.43, -0.12], dx: 0.06, dz: 0.055 };
export const REFUGE = { a: [-0.3, -0.43, -0.05], b: [0.45, -0.43, 0.12] };

/** Combate en la superficie: guardia a la derecha del agujero, enemigos llegando desde el borde derecho. */
export const GUARD = { at: [0.04, 0.21, 0.5], dx: 0.075, dz: 0.06, cols: 5 };
export const FOE_LINE = { at: [0.34, 0.21, 0.5], dx: 0.085, dz: 0.07, cols: 4, spawn: [0.86, 0.21, 0.48] };
export const BOSS_POS = { at: [0.64, 0.21, 0.45] };

/** Tamaño de una unidad de modelo, en «píxeles» (× PXW = unidades del mundo). Las hormigas miden ≈1 unidad. */
export const SIZE = { ants: 100, termite: 96, spider: 112, beetle: 108, egg: 190, larva: 140 };

/** Cuántas hormigas se dibujan como máximo (la simulación cuenta todas). */
export const CAP = { ants: 28 };

/** Píxeles de imagen por unidad de velocidad de la simulación. */
export const PX = 80;

export const clamp01 = v => Math.max(0, Math.min(1, v));
