// La despensa: un montón de hojas, fresas y semillas en el extremo izquierdo de la cámara.
// Crece con la jalea guardada (escala logarítmica, para que se note al principio y no tape el nido al final).
import * as THREE from 'three';
import { ctx } from './context.js';
import { PANTRY, PXW } from './layout.js';
import { W } from './world.js';

const MAX = 34;
const items = [];
let group = null, pop = 0, shown = 0, px = 1;

export function buildPantry() {
  group = new THREE.Group();
  // el montón se diseñó en píxeles de imagen: el grupo los pasa a unidades del mundo
  W(PANTRY.x, PANTRY.y, group.position);
  px = PXW;
  group.scale.setScalar(px);
  ctx.scene.add(group);
  const geo = {
    leaf: new THREE.IcosahedronGeometry(0.5, 1).scale(1.6, 0.25, 1.05),
    berry: new THREE.SphereGeometry(0.5, 16, 12).scale(1, 1.15, 1),
    seed: new THREE.SphereGeometry(0.5, 14, 10).scale(1.5, 0.75, 0.8)
  };
  const mat = {
    leaf: new THREE.MeshStandardMaterial({ color: '#79b844', roughness: 0.55 }),
    berry: new THREE.MeshStandardMaterial({ color: '#d8363c', roughness: 0.3 }),
    seed: new THREE.MeshStandardMaterial({ color: '#dcb670', roughness: 0.45 })
  };
  const types = ['leaf', 'berry', 'seed'];
  // montón: capas en espiral, cada vez más altas y estrechas
  for (let i = 0; i < MAX; i++) {
    const layer = Math.floor(Math.sqrt(i)), a = i * 2.4, r = Math.max(0, 52 - layer * 11) * Math.sqrt((i % 7 + 1) / 7);
    const t = types[i % 3], m = new THREE.Mesh(geo[t], mat[t]);
    const s = t === 'leaf' ? 30 : t === 'berry' ? 22 : 18;
    m.position.set(Math.cos(a) * r, 8 + layer * 11, Math.sin(a) * r * 0.55);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    m.scale.setScalar(s); m.userData.s = s; m.visible = false;
    group.add(m); items.push(m);
  }
}

/** Punto (en el mundo) donde cae lo que se guarda: la cima del montón. */
export function pantryTop(out = new THREE.Vector3()) {
  const layer = Math.floor(Math.sqrt(Math.max(1, shown)));
  out.set(0, 14 + layer * 11, 0);
  return group.localToWorld(out);
}

/** Dónde se colocan las hormigas para dejar la comida (en la imagen). */
export const pantryDrop = () => ({ x: PANTRY.x + 62, y: PANTRY.y + 14 });

export function pantryPop() { pop = 1; }

export function updatePantry(dt) {
  const j = Math.max(0, ctx.G.jelly);
  const want = j < 1 ? 0 : Math.min(MAX, Math.round(3 + 5 * Math.log2(1 + j / 15)));
  shown = want;
  pop = Math.max(0, pop - dt * 3);
  const k = 1 + Math.sin(pop * Math.PI) * 0.12;
  items.forEach((m, i) => { m.visible = i < want; });
  group.scale.set(k * px, (1 + Math.sin(pop * Math.PI) * 0.06) * px, k * px);
}

/** Ancla de la etiqueta «Despensa». */
export const pantryAnchor = () => ({ x: PANTRY.x, y: PANTRY.y, up: 62 + Math.floor(Math.sqrt(Math.max(1, shown))) * 11 });
