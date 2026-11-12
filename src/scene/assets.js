// Carga de modelos .glb (public/models) y normalización a la escala del juego.
// Cada modelo se gira para que mire hacia +X, se escala a una longitud fija,
// se centra y se apoya en y = 0. Si falla, la criatura usa la geometría procedimental.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL;

/**
 * yaw: giro (radianes) para que la cabeza mire a +X.
 * length: longitud total en X, en las mismas unidades que la hormiga procedimental (≈0,8).
 * front: si se indica, la punta delantera se coloca en esta x (para la reina).
 * jaw: dónde pegar las mandíbulas de la mutación (x relativa a la punta, y absoluta).
 * recolor: nuevo color por nombre de material del .glb.
 */
// Las hormigas y la reina no van aquí: son mallas de arcilla (geometry.js),
// porque los .glb low-poly no coinciden con el nido.
export const MODELS = {
  termite: { url: 'models/termite.glb', yaw: 0, length: 0.95, recolor: { 'Mat.14': '#ead8a4', 'Mat.3': '#c98a3c' } },
  roach: { url: 'models/roach.glb', yaw: 0, length: 1.2 },
  spider: { url: 'models/spider.glb', yaw: Math.PI / 2, length: 2.5 },
  beetle: { url: 'models/beetle.glb', yaw: Math.PI / 2, length: 2.6 },
  mantis: { url: 'models/mantis.glb', yaw: -Math.PI / 2, length: 2.4 },
  // un solo pie del par de zapatillas, de perfil con la punta hacia el nido (izquierda)
  shoe: { url: 'models/shoe.glb', yaw: 0.96, length: 1, half: 'left' }
};

const templates = {};

function toLambert(m, recolor) {
  const n = new THREE.MeshLambertMaterial({
    name: m.name, color: m.color ? m.color.clone() : new THREE.Color('#ffffff'), map: m.map || null,
    vertexColors: !!m.vertexColors, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side
  });
  if (m.emissive) n.emissive.copy(m.emissive);
  if (recolor && recolor[m.name]) n.color.set(recolor[m.name]);
  return n;
}

function normalize(gltf, def) {
  const model = gltf.scene, holder = new THREE.Group();
  let skinned = false;
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); // algunos .glb no traen normales
    const conv = m => toLambert(m, def.recolor);
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    if (o.isSkinnedMesh) { skinned = true; o.frustumCulled = false; }
  });
  if (def.half) { // el .glb trae un par: me quedo con las piezas de un lado
    model.updateMatrixWorld(true);
    const all = new THREE.Box3().setFromObject(model, true), mid = (all.min.x + all.max.x) / 2, drop = [];
    model.traverse(o => { if (o.isMesh) { const c = new THREE.Box3().setFromObject(o, true).getCenter(new THREE.Vector3()); if ((c.x > mid) === (def.half === 'left')) drop.push(o); } });
    for (const o of drop) o.parent.remove(o);
  }
  holder.add(model);
  model.rotation.y = def.yaw || 0;

  const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
  holder.updateMatrixWorld(true);
  box.setFromObject(model, true).getSize(size);
  model.scale.multiplyScalar(def.length / Math.max(1e-6, size.x));
  holder.updateMatrixWorld(true);
  box.setFromObject(model, true).getCenter(center);
  model.position.x -= def.front != null ? box.max.x - def.front : center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  holder.updateMatrixWorld(true);
  box.setFromObject(model, true);
  return { root: holder, clips: gltf.animations || [], skinned, box: box.clone() };
}

/** Carga todos los modelos. Nunca rechaza: los que fallen quedan sin plantilla. */
export async function loadModels(onProgress) {
  const loader = new GLTFLoader(), keys = Object.keys(MODELS);
  let done = 0;
  await Promise.all(keys.map(async k => {
    try {
      const gltf = await loader.loadAsync(BASE + MODELS[k].url);
      templates[k] = normalize(gltf, MODELS[k]);
    } catch (e) {
      console.warn('[antigenesis] no se pudo cargar ' + MODELS[k].url + ', uso geometría procedimental', e);
    }
    onProgress && onProgress(++done / keys.length, k);
  }));
  return Object.keys(templates);
}

export const hasModel = k => !!templates[k];
export const modelBox = k => templates[k] && templates[k].box;

/** Copia lista para la escena. Comparte geometría y materiales con la plantilla. */
export function instance(k) {
  const t = templates[k];
  if (!t) return null;
  return { obj: t.skinned ? SkeletonUtils.clone(t.root) : t.root.clone(), clips: t.clips, box: t.box };
}
