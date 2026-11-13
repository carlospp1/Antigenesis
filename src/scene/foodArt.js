// Comida en 2D (canvas → textura → Sprite): no hace falta malla 3D para una hoja o una baya.
import * as THREE from 'three';

const mats = {};

function paint(draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  draw(cv.getContext('2d'));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
}

function ensure() {
  if (mats.leaf) return mats;
  mats.leaf = paint(g => {
    g.translate(32, 32); g.rotate(-0.5);
    g.fillStyle = '#7cc443';
    g.beginPath(); g.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3f7a1e'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-18, 0); g.quadraticCurveTo(0, -4, 18, 0); g.stroke();
  });
  mats.berry = paint(g => {
    g.fillStyle = '#e0383e';
    g.beginPath(); g.arc(32, 36, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a7a28';
    g.beginPath(); g.ellipse(32, 20, 8, 4, 0, 0, Math.PI * 2); g.fill();
  });
  mats.seed = paint(g => {
    g.fillStyle = '#e2bf78';
    g.beginPath(); g.ellipse(32, 32, 18, 10, 0.4, 0, Math.PI * 2); g.fill();
  });
  mats.gold = paint(g => {
    g.translate(32, 32); g.rotate(-0.5);
    g.fillStyle = '#ffcf4a';
    g.beginPath(); g.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff3c4';
    g.beginPath(); g.arc(6, -2, 4, 0, Math.PI * 2); g.fill();
  });
  // la que vuela a la boca: sin depthTest para que no la tape la reina
  mats.fly = {};
  for (const k of ['leaf', 'berry', 'seed', 'gold']) {
    mats.fly[k] = mats[k].clone();
    mats.fly[k].depthTest = false;
    mats.fly[k].depthWrite = false;
  }
  return mats;
}

/** Sprite de comida para llevar a cuestas (o para el vuelo). */
export function makeFoodSprite(type = 'leaf', fly = false) {
  const m = ensure();
  const mat = fly ? (m.fly[type] || m.fly.leaf) : (m[type] || m.leaf);
  const s = new THREE.Sprite(mat);
  s.scale.set(0.42, 0.42, 1);
  s.visible = false;
  s.renderOrder = fly ? 60 : 5;
  s.castShadow = false;
  return s;
}

export function setFoodSprite(sprite, type, fly = false) {
  const m = ensure();
  sprite.material = fly ? (m.fly[type] || m.fly.leaf) : (m[type] || m.leaf);
}
