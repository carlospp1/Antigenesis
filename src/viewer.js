// Visor de calibración: muestra cada modelo normalizado junto a su versión procedimental.
import * as THREE from 'three';
import { buildProcedural } from './scene/geometry.js';
import { loadModels, MODELS } from './scene/assets.js';
import { createCreature } from './scene/creature.js';

const SCALE = { roach: 1.4, mantis: 1.5, shoe: 2.5,  workers: 1, soldiers: 1.3, queen: 2.8, termite: 1.35, spider: 1.5, beetle: 1.5 };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#5d4636');
scene.add(new THREE.HemisphereLight('#fff6dc', '#7a5636', 0.85 * Math.PI));
const sun = new THREE.DirectionalLight('#fff0d0', 0.7 * Math.PI); sun.position.set(4, 10, 6); scene.add(sun);

buildProcedural();
await loadModels();

const only = new URLSearchParams(location.search).get('only'), keys = only ? only.split(',') : Object.keys(MODELS), gap = 4.6, cams = [], items = [];
keys.forEach((k, i) => {
  const x = (i - (keys.length - 1) / 2) * gap;
  const m = createCreature(k, SCALE[k]); m.g.position.set(x, 0, -1.4); scene.add(m.g);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(x - 1.5, 0.02, 0.2), 3, 0xf0b84c, 0.4, 0.25); scene.add(arrow);
  items.push({ m, k, x });
});
// procedimentales debajo, para comparar
import('./scene/geometry.js').then(({ GEO, MAT }) => {
  keys.forEach((k, i) => {
    const x = (i - (keys.length - 1) / 2) * gap, geo = GEO[k], g = new THREE.Group();
    if (!geo) return;
    g.add(new THREE.Mesh(geo.body, MAT.v), new THREE.Mesh(geo.la, MAT.v), new THREE.Mesh(geo.lb, MAT.v));
    g.scale.setScalar(SCALE[k]); g.position.set(x, 0, 1.8); scene.add(g);
  });
});
const grid = new THREE.GridHelper(40, 40, 0x8a6a50, 0x6a5040); scene.add(grid);

const side = new THREE.PerspectiveCamera(30, 1, 0.1, 200), top = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
const W = keys.length * gap;
side.position.set(0, 3.5, 22); side.lookAt(0, 0.6, 0);
top.position.set(0, 26, 0.01); top.lookAt(0, 0, 0);
cams.push(side, top);

const labels = items.map(it => { const d = document.createElement('div'); d.className = 'lbl'; d.textContent = it.k; document.body.appendChild(d); return d; });
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta(), w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); renderer.setScissorTest(true);
  for (const it of items) { it.m.phase += dt * 8; it.m.step(true, 0.05, dt); }
  cams.forEach((c, i) => {
    const y = i === 0 ? h / 2 : 0;
    c.aspect = w / (h / 2); c.fov = 2 * Math.atan(W / 2 / 22 / c.aspect) * 180 / Math.PI + 6; c.updateProjectionMatrix();
    renderer.setViewport(0, y, w, h / 2); renderer.setScissor(0, y, w, h / 2); renderer.render(scene, c);
  });
  items.forEach((it, i) => { const p = new THREE.Vector3(it.x, 0, 3.4).project(top); labels[i].style.left = (p.x * 0.5 + 0.5) * w + 'px'; labels[i].style.top = (h / 2 + (-p.y * 0.5 + 0.5) * h / 2) + 'px'; });
}
frame();
window.__ready = true;
