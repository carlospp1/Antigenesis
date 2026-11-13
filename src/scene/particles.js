// Partículas: soplos (puff) y gotas de comida que vuelan a la boca de la reina (drop).
// Se lanzan desde un punto de la imagen; se mueven en el mundo 3D con velocidades pensadas en píxeles
// (cada partícula guarda cuánto mide un píxel donde nació).
import * as THREE from 'three';
import { ctx, rnd } from './context.js';
import { MAT } from './geometry.js';
import { W } from './world.js';
import { PXW } from './layout.js';

const parts = [], drops = [], snacks = [];
const SNACK = {};
let pi = 0;

/** Trozos de comida para dar de comer a la reina con un toque. */
function buildSnacks() {
  SNACK.geo = {
    leaf: new THREE.IcosahedronGeometry(0.5, 1).scale(1.5, 0.22, 1).rotateZ(0.4),
    berry: new THREE.SphereGeometry(0.5, 16, 12).scale(1, 1.15, 1),
    seed: new THREE.SphereGeometry(0.5, 14, 10).scale(1.5, 0.75, 0.8),
    gold: new THREE.IcosahedronGeometry(0.5, 1).scale(1.6, 0.3, 1.05).rotateZ(0.4)
  };
  SNACK.mat = {
    leaf: new THREE.MeshStandardMaterial({ color: '#7cc443', roughness: 0.5 }),
    berry: new THREE.MeshStandardMaterial({ color: '#e0383e', roughness: 0.25 }),
    seed: new THREE.MeshStandardMaterial({ color: '#e2bf78', roughness: 0.45 }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#c88a10', emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.2 })
  };
  // la comida que vuela a la reina se dibuja por delante de todo (no la tapa ni la reina ni el terreno)
  for (const k in SNACK.mat) { SNACK.mat[k].depthTest = false; SNACK.mat[k].depthWrite = false; }
  for (let i = 0; i < 32; i++) {
    const m = new THREE.Mesh(SNACK.geo.leaf, SNACK.mat.leaf); m.visible = false; m.renderOrder = 60; ctx.scene.add(m);
    snacks.push({ m, t: 1, a: new THREE.Vector3(), c: new THREE.Vector3(), b: null, size: 1, k: 1, spin: new THREE.Vector3(), done: null });
  }
}
let si = 0;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Lanza un trozo de comida desde un punto de la imagen hasta `target`
 * (un Vector3 de mundo que se lee en cada fotograma, porque la reina se mueve).
 * front: sale por delante de todo, entre la cámara y la reina, en la línea del dedo (al tocar a la reina).
 */
export function feedFly(fromX, fromY, target, onArrive, type, size, front) {
  const s = snacks[si++ % snacks.length], types = ['leaf', 'berry', 'seed'], k = SNACK.geo[type] ? type : types[Math.floor(Math.random() * 3)];
  s.m.geometry = SNACK.geo[k]; s.m.material = SNACK.mat[k];
  W(fromX, fromY, s.a); s.k = PXW; s.a.y += 20 * s.k;
  if (front) { // en la línea del dedo, a algo más de la mitad del camino entre la cámara y la boca
    const cam = ctx.camera.position, d = cam.distanceTo(target());
    s.a.sub(cam).normalize().multiplyScalar(d * 0.55).add(cam);
  }
  s.front = !!front;
  s.b = target; s.t = 0; s.size = size || rnd(28, 34); s.done = onArrive;
  s.spin.set(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6));
  s.m.visible = true; s.m.position.copy(s.a); s.m.scale.setScalar(0.01);
}

/** «Festín»: una lluvia de comida, desde arriba, que cae en la boca durante un par de segundos. */
export function feastRain(x, y, target, onBite) {
  const types = ['gold', 'berry', 'leaf', 'seed'];
  for (let i = 0; i < 12; i++) setTimeout(() => {
    feedFly(x + rnd(-120, 120), y + rnd(-170, -24), target, () => { if (onBite) onBite(); }, types[i % types.length], rnd(36, 58));
  }, i * 90);
}

function updateSnacks(dt) {
  for (const s of snacks) {
    if (s.t >= 1) continue;
    s.t = Math.min(1, s.t + dt / 0.6);
    const b = s.b(), e = ease(s.t);
    // arco: punto de control por encima del tramo, para que la comida «salte» hacia la boca
    s.c.copy(s.a).add(b).multiplyScalar(0.5); s.c.y += (s.front ? 30 : 70) * s.k + s.a.distanceTo(b) * 0.15;
    const u = 1 - e;
    s.m.position.set(u * u * s.a.x + 2 * u * e * s.c.x + e * e * b.x, u * u * s.a.y + 2 * u * e * s.c.y + e * e * b.y, u * u * s.a.z + 2 * u * e * s.c.z + e * e * b.z);
    s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt; s.m.rotation.z += s.spin.z * dt;
    const pop = Math.min(1, s.t / 0.15), shrink = s.t > 0.8 ? 1 - (s.t - 0.8) / 0.2 * 0.75 : 1;
    // la que sale por delante (cerca de la cámara) se ve del tamaño que tendrá en la boca, no gigante
    const near = s.front ? ctx.camera.position.distanceTo(s.m.position) / Math.max(1e-4, ctx.camera.position.distanceTo(b)) : 1;
    s.m.scale.setScalar(s.size * s.k * near * pop * (1 + Math.sin(Math.min(1, s.t / 0.15) * Math.PI) * 0.25) * shrink);
    if (s.t >= 1) { s.m.visible = false; if (s.done) s.done(); }
  }
}

export function buildParticles() {
  buildSnacks();
  const g = new THREE.IcosahedronGeometry(4.5, 0);
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(g, MAT.part.gold); m.visible = false; m.renderOrder = 5; ctx.scene.add(m);
    parts.push({ m, life: 0, max: 1, v: new THREE.Vector3(), g: 0, s: 1, k: 1 });
  }
}

/** spread en píxeles por segundo; up = impulso extra hacia arriba. */
export function puff(x, y, col, n, spread = 80, up = 0) {
  for (let i = 0; i < n; i++) {
    const p = parts[pi++ % parts.length];
    p.m.material = MAT.part[col]; p.m.visible = true;
    W(x + rnd(-6, 6), y + rnd(-4, 4), p.m.position);
    const k = (p.k = PXW), a = Math.random() * Math.PI * 2, h = rnd(-1, 1) * spread * k;
    p.m.position.y += 6 * k;
    p.v.set(Math.cos(a) * h, (rnd(0.4, 1.2) * spread + up) * k, Math.sin(a) * h * 0.6);
    p.max = p.life = rnd(0.5, 0.95); p.g = (col === 'dust' ? 260 : 120) * k; p.s = rnd(0.7, 1.4) * k;
  }
}

export function drop(x, y, tx, ty, delay) {
  const p = parts[pi++ % parts.length];
  p.life = 0; p.m.material = MAT.part.gold;
  const a = W(x, y), b = W(tx, ty);
  drops.push({ p, a, b, k: PXW, t: -delay });
}

export function updateParticles(dt) {
  updateSnacks(dt);
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; continue; }
    p.v.y -= p.g * dt; p.m.position.addScaledVector(p.v, dt);
    p.m.scale.setScalar(p.s * (p.life / p.max)); p.m.rotation.x += dt * 3;
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt * 2.2;
    if (d.t < 0) continue;
    if (d.t >= 1) { d.p.m.visible = false; drops.splice(i, 1); continue; }
    d.p.m.visible = true; d.p.m.position.lerpVectors(d.a, d.b, d.t);
    d.p.m.position.y += Math.sin(d.t * Math.PI) * 40 * d.k; d.p.m.scale.setScalar(1.6 * d.k);
  }
}
