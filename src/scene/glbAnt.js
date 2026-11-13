// Hormigas a partir de los .glb ilustrados (public/models/ant_worker.glb y ant_queen.glb).
// Los modelos no traen animaciones, pero cada pieza viene suelta y con nombre
// (Leg_1_Upper, Antenna_L_Tip, Mandible_R, Abdomen_…), así que se agrupan en pivotes
// y se animan por código con la misma interfaz que el esqueleto de antRig.js.
//
// Los .glb vienen con Z hacia arriba y la cabeza hacia +Y; se giran para que, como el resto
// del juego, la cabeza mire a +X y arriba sea +Y.
//
// Para volver a las hormigas hechas en código basta con poner USE_GLB_ANTS = false.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { skinLegs, skinMaterial } from './legSkin.js';
import { mobile } from './context.js';
import { thin } from './geometry.js';

/** Se puede cambiar en Ajustes (se guarda en el navegador y se aplica al recargar). */
export const USE_GLB_ANTS = (() => { try { return localStorage.getItem('antigenesis.antModel') !== 'code'; } catch (e) { return true; } })();

const BASE = import.meta.env.BASE_URL;
// diseños actuales (kawaii); los anteriores siguen en models/ant_worker.glb y models/ant_queen.glb
// reina: v2 (los diseños anteriores siguen en models/ant_queen_kawaii.glb y models/ant_queen.glb)
// obrera: v3 marrón (anteriores: models/ant_worker_kawaii.glb y models/ant_worker.glb)
const FILES = { worker: 'models/ant_worker_v3.glb', queen: 'models/ant_queen_v2.glb' };
/** Hormiga sin evolucionar y reina: malla entera (una sola pieza, sin esqueleto). */
const SOLID = { base: 'models/hormiga-base.glb', soldier: 'models/hormiga-evo2.glb', venator: 'models/hormiga-evo3.glb', venomax: 'models/hormiga-evo4.glb', apexia: 'models/hormiga-evo5.glb', titanis: 'models/hormiga-evo6.glb', fiera: 'models/hormiga-evo7.glb', queen: 'models/reina-base.glb', queenVenomax: 'models/reina-veneno.glb', queenFinal: 'models/reina-final.glb' };
/** Longitud final en unidades del juego (la hormiga de código mide ≈0,85). */
const LENGTH = { worker: 0.9, queen: 0.95, base: 0.92, soldier: 0.95, venator: 1.02, venomax: 1.08, apexia: 1.14, titanis: 1.17, fiera: 1.2, queenSolid: 1.05, queenVenomax: 1.15, queenFinal: 1.28 };
/**
 * Modelos de una sola superficie (patas soldadas al cuerpo): las patas se deforman en el shader (legSkin.js).
 * hip: distancia del pie a la cadera por la superficie, en fracción de la altura ([delanteras, resto]).
 */
const SKIN = {
  base: { hip: 0.27 },
  soldier: { hip: 0.36, foot: 0.07, raise: 0.32, swing: 0.22, lift: 0.35 },
  venator: { hip: 0.36, foot: 0.06, swing: 0.22, lift: 0.35 },
  venomax: { hip: 0.45, foot: 0.12, swing: 0.22, lift: 0.35 },
  apexia: { hip: 0.45, foot: 0.06, swing: 0.22, lift: 0.35 },
  titanis: { hip: 0.45, foot: 0.06, swing: 0.22, lift: 0.35 },
  fiera: { hip: 0.5, foot: 0.1, swing: 0.22, lift: 0.35 },
  queen: { hip: [0.46, 0.36] },
  queenVenomax: { hip: [0.46, 0.36], foot: 0.08 },
  queenFinal: { hip: [0.46, 0.36], foot: 0.1 }
};
const templates = {};
const solidTemplates = {};
const firstMesh = o => { let m = null; o.traverse(x => { if (!m && x.isMesh) m = x; }); return m; };

export async function loadGlbAnts() {
  if (!USE_GLB_ANTS) return [];
  const loader = new GLTFLoader();
  await Promise.all([
    ...Object.keys(FILES).map(async k => {
      try {
        const scene = (await loader.loadAsync(BASE + FILES[k])).scene;
        if (mobile()) scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) { const t = thin(o.geometry); if (t !== o.geometry) o.geometry = t; } });
        templates[k] = scene;
      }
      catch (e) { console.warn('[antigenesis] no se pudo cargar ' + FILES[k] + ', uso las hormigas de código', e); }
    }),
    ...Object.keys(SOLID).map(async k => {
      try {
        const scene = (await loader.loadAsync(BASE + SOLID[k])).scene;
        scene.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; matte(o.material);
          if (mobile() && !o.isSkinnedMesh) { const t = thin(o.geometry); if (t !== o.geometry) o.geometry = t; }
        });
        if (SKIN[k]) {
          const mesh = firstMesh(scene);
          scene.userData.skin = mesh && skinLegs(mesh.geometry, SKIN[k]);
        } else splitSolidLegs(scene);
        scene.userData.eyes = findEyes(scene, k);
        solidTemplates[k] = scene;
      } catch (e) { console.warn('[antigenesis] no se pudo cargar ' + SOLID[k], e); }
    })
  ]);
  return Object.keys(templates);
}

export const hasGlbAnt = k => USE_GLB_ANTS && !!templates[k];
export const hasSolidAnt = k => USE_GLB_ANTS && !!solidTemplates[k];

/** Sin barniz: los .glb traen mapa metálico y el entorno les pone un reflejo de plástico. */
function matte(material) {
  for (const m of Array.isArray(material) ? material : [material]) {
    if (!m) continue;
    m.metalness = 0; m.roughness = 1;
    m.metalnessMap = null; m.roughnessMap = null;
    m.envMapIntensity = 0;
  }
}

/**
 * Hormiga dorada: el mismo modelo con el cuerpo en oro. Cada material toma un dorado tan claro
 * u oscuro como su color original (así conserva el dibujo de bandas y patas) y algo de brillo
 * metálico. Ojos, boca, lengua y mejillas no se tocan.
 */
const KEEP_FACE = /white|outline|iris|pupil|mouth|tongue|blush|eye|sparkle|shine/i;
const goldCache = new Map();
function goldMaterial(m) {
  if (goldCache.has(m)) return goldCache.get(m);
  const g = m.clone(), c = m.color;
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;            // luminancia (lineal)
  const t = Math.min(1, Math.sqrt(lum / 0.5));                        // 0 = lo más oscuro, 1 = lo más claro
  g.color.setHSL(0.105 + t * 0.03, 0.9, 0.2 + t * 0.42, THREE.SRGBColorSpace); // oro viejo → oro claro
  g.metalness = 0.45; g.roughness = 0.3; g.envMapIntensity = 0.9;
  g.emissive = new THREE.Color('#5a3a00'); g.emissiveIntensity = 0.25; // que no se apague en la sombra
  goldCache.set(m, g);
  return g;
}
function goldify(model) {
  model.traverse(o => { if (o.isMesh && !KEEP_FACE.test(o.material.name)) o.material = goldMaterial(o.material); });
}

/** Separa una geometría en sus piezas conexas (comparten atributos; cada una con su propio índice). */
function splitComponents(geo) {
  const P = geo.attributes.position, n = P.count;
  const idx = geo.index ? geo.index.array : Uint32Array.from({ length: n }, (_, i) => i);
  const par = new Int32Array(n).map((_, i) => i);
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
  for (let t = 0; t < idx.length; t += 3) { join(idx[t], idx[t + 1]); join(idx[t], idx[t + 2]); }
  const seen = new Map(); // vértices duplicados en las costuras
  for (let i = 0; i < n; i++) {
    const key = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4);
    if (seen.has(key)) join(seen.get(key), i); else seen.set(key, i);
  }
  const tris = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); if (!tris.has(r)) tris.set(r, []); tris.get(r).push(idx[t], idx[t + 1], idx[t + 2]); }
  return [...tris.values()].map(list => {
    const g = new THREE.BufferGeometry();
    for (const name in geo.attributes) g.setAttribute(name, geo.attributes[name]);
    g.setIndex(list);
    const box = new THREE.Box3(), v = new THREE.Vector3();
    for (const i of list) box.expandByPoint(v.fromBufferAttribute(P, i));
    g.boundingBox = box; g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    return { geo: g, box, list };
  });
}

/**
 * Las mallas enteras traen las patas como piezas sueltas dentro de algunos materiales:
 *   hormiga.glb        leg_up y leg_tip (solo patas) + la rodilla dentro de «tan»
 *   hormiga-reina.glb  rose, gold y coral (patas, pero también antenas, corona y gorguera)
 *   hormiga-soldado.glb dark, tan y foot (patas, pero también cabeza, tórax, antenas y anillos)
 *   hormiga-venator.glb maroon, maroon_d, orange y cream (patas mezcladas con el cuerpo)
 *   hormiga-venomax.glb y su reina  mag, mag_d, orange, cream y lime (patas mezcladas con el cuerpo)
 *   hormiga-apexia.glb            los mismos materiales; los pies de cream llegan un poco más arriba
 *   hormiga-titanis.glb           mag, orange y cream (las seis patas, tres piezas cada una)
 *   hormiga-apexia-fiera.glb      igual que la apexia
 *   hormiga-reina-final.glb       mag, cream, lime y gold (el oro ya entra como pata en la reina base)
 * Se parten en piezas, se quedan las que están a un lado del cuerpo y abajo, se agrupan por pata
 * (lado + fila) y se marca la cadera (el punto más cercano al cuerpo) para animarlas.
 * Coordenadas del archivo: Y arriba, cabeza hacia +Z, lados en ±X.
 */
const LEG_ONLY = /^(leg_up|leg_tip)$/, LEG_MIXED = /^(tan|rose|gold|coral|dark|foot|maroon|maroon_d|orange|cream|mag|mag_d|lime)$/;
function splitSolidLegs(scene) {
  const meshes = [];
  scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  const legs = {};
  const keyOf = c => (c.x < 0 ? 'L' : 'R') + (c.z > 0.3 ? 0 : c.z < -0.3 ? 2 : 1);
  for (const m of meshes) {
    const name = m.material.name;
    if (!LEG_ONLY.test(name) && !LEG_MIXED.test(name)) continue;
    const parts = splitComponents(m.geometry), rest = [];
    for (const p of parts) {
      const c = p.box.getCenter(new THREE.Vector3());
      const inner = p.box.min.x > 0 ? p.box.min.x : p.box.max.x < 0 ? -p.box.max.x : 0; // distancia al eje del cuerpo
      // z > -1.8: los lóbulos traseros quedan al lado del abdomen, lejos de las patas.
      // En cream, la reina venomax trae un adorno a media altura que no es pata: valen los pies (bajos) y las piezas altas de la reina base.
      const sideLow = Math.abs(c.x) > 0.5 && c.y < 1.7 && c.z > -1.8 && inner > 0.1;
      const creamOk = name !== 'cream' || p.box.max.y < 0.8 || p.box.min.y > 1.0;
      const isLeg = LEG_ONLY.test(name) || (sideLow && creamOk);
      if (!isLeg) { rest.push(...p.list); continue; }
      const piece = new THREE.Mesh(p.geo, m.material);
      piece.castShadow = true;
      piece.position.copy(m.position); piece.quaternion.copy(m.quaternion); piece.scale.copy(m.scale);
      const key = keyOf(c);
      piece.userData.leg = key;
      m.parent.add(piece);
      const L = legs[key] ||= { key, side: c.x < 0 ? -1 : 1, hip: null, inner: Infinity };
      if (inner < L.inner) { L.inner = inner; L.hip = new THREE.Vector3(L.side * inner, c.y, c.z); L.first = piece; }
      piece.userData.c = c; piece.userData.top = p.box.max.y;
      (L.pieces ||= []).push(piece);
    }
    if (rest.length) { const g = m.geometry.clone(); g.setIndex(rest); m.geometry = g; }
    else m.removeFromParent();
  }
  for (const k in legs) {
    if (legs[k].pieces.length < 2) { for (const p of legs[k].pieces) delete p.userData.leg; continue; } // suelta: no es una pata
    const L = legs[k];
    // rodilla: la pieza más alta después de la de la cadera; lo que cuelga por debajo es la tibia
    const knee = L.pieces.filter(p => p !== L.first).sort((a, b) => b.userData.top - a.userData.top)[0];
    for (const p of L.pieces) {
      p.userData.hip = L.hip;
      p.userData.knee = knee.userData.c;
      p.userData.tibia = p !== L.first && p !== knee && p.userData.c.y < knee.userData.c.y;
    }
  }
}

/* ---------- ojos de muerta (las reinas): párpado del color de la cara y una X encima ---------- */
/**
 * Dónde están los ojos, en coordenadas del archivo (Y arriba, cara hacia +Z).
 * reina-base.glb es una sola malla con los ojos pintados en la textura: se dan a mano (vista de frente) y
 * se busca la superficie de la cara con un rayo. En los modelos por piezas salen de las piezas del ojo.
 */
const EYES = { queen: { pts: [[-0.17, 0.075], [0.14, 0.085]], r: 0.082, skin: '#d2475d' } };
const EYE_PARTS = /^(white|iris|pupil)$/;
function findEyes(scene, kind) {
  scene.updateMatrixWorld(true);
  const def = EYES[kind];
  if (def) {
    const rc = new THREE.Raycaster(), out = [];
    for (const [x, y] of def.pts) {
      rc.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
      const h = rc.intersectObject(scene, true)[0];
      if (!h) continue;
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 0, 1);
      if (n.z < 0.2) n.set(0, 0, 1);
      out.push({ p: h.point.clone(), n, r: def.r });
    }
    return out.length ? { list: out, skin: def.skin } : null;
  }
  // por piezas: cada lado (x < 0, x > 0) con sus piezas blanco / iris / pupila
  const sides = { L: new THREE.Box3(), R: new THREE.Box3() };
  let skin = null;
  scene.traverse(o => {
    if (!o.isMesh) return;
    if (EYE_PARTS.test(o.material.name)) { const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); sides[c.x < 0 ? 'L' : 'R'].union(b); }
    if (!skin && /^(head|mag|tan|rose)$/.test(o.material.name)) skin = '#' + o.material.color.getHexString();
  });
  const list = [];
  for (const k in sides) {
    const b = sides[k];
    if (b.isEmpty()) continue;
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    list.push({ p: new THREE.Vector3(c.x, c.y, b.max.z), n: new THREE.Vector3(0, 0, 1), r: Math.max(sz.x, sz.y) * 0.55 });
  }
  return list.length ? { list, skin: skin || '#b4405a' } : null;
}
function buildDeadEyes(model, eyes) {
  if (!eyes) return null;
  const g = new THREE.Group();
  const lid = new THREE.MeshStandardMaterial({ color: eyes.skin, roughness: 0.8 });
  const ink = new THREE.MeshBasicMaterial({ color: '#2a0d12' });
  for (const e of eyes.list) {
    const s = new THREE.Group();
    s.position.copy(e.p).addScaledVector(e.n, 0.006);
    s.lookAt(e.p.clone().addScaledVector(e.n, 1));
    const patch = new THREE.Mesh(new THREE.CircleGeometry(e.r, 28), lid);
    s.add(patch);
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(e.r * 1.75, e.r * 0.34), ink);
      bar.rotation.z = a; bar.position.z = 0.003;
      s.add(bar);
    }
    g.add(s);
  }
  g.visible = false;
  model.add(g);
  return g;
}

/**
 * Hormiga de una sola malla (hormiga.glb / hormiga-reina.glb).
 * El archivo viene con Y hacia arriba y la cabeza hacia +Z; +90° en Y la pone mirando a +X.
 * Las patas se separan al cargar (splitSolidLegs): la base camina en trípode y la reina come con las delanteras.
 */
export function buildSolidAnt(kind, opts = {}) {
  const model = solidTemplates[kind].clone(true);
  if (opts.gold) goldify(model);
  const deadEyes = buildDeadEyes(model, solidTemplates[kind].userData.eyes);
  const turn = new THREE.Group();
  turn.rotation.y = Math.PI / 2;
  turn.add(model);
  const root = new THREE.Group(), body = new THREE.Group();
  body.add(turn); root.add(body);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn), size = box.getSize(new THREE.Vector3());
  const len = kind === 'queen' ? LENGTH.queenSolid : LENGTH[kind] || LENGTH.base;
  const k = len / Math.max(size.x, 1e-6);
  turn.scale.setScalar(k);
  root.updateMatrixWorld(true);
  box.setFromObject(turn);
  // apoyada en los pies: la punta más baja de las patas va a y=0 (gorgueras o mandíbulas
  // que cuelgan por debajo de los pies, como en la reina final, no la levantan)
  const feet = new THREE.Box3();
  model.traverse(o => { if (o.isMesh && o.userData.leg) feet.expandByObject(o); });
  const ground = feet.isEmpty() ? box.min.y : feet.min.y;
  turn.position.set(-(box.min.x + box.max.x) / 2, -ground, -(box.min.z + box.max.z) / 2);
  const height = box.max.y - ground;
  const rig = { root, body, legs: [], antennae: [], mand: [], t: Math.random() * 10, glb: true, front: len / 2, height };
  root.updateMatrixWorld(true);

  // patas: un pivote por pata en la cadera (coordenadas del archivo, dentro del padre de las piezas)
  const byLeg = {};
  model.traverse(o => { if (o.isMesh && o.userData.leg) (byLeg[o.userData.leg] ||= []).push(o); });
  // patas deformadas en el shader: los pivotes solo guardan los ángulos que pone la animación
  const skin = solidTemplates[kind].userData.skin;
  if (skin) {
    const mesh = firstMesh(model);
    for (const s of skin) rig.legs.push({ pv: new THREE.Object3D(), knee: new THREE.Object3D(), side: s.side, row: s.row, solid: true, hipAt: s.hip, kneeAt: s.knee, group: (s.row % 2 === 0) === (s.side < 0) ? 0 : 1 });
    mesh.onBeforeRender = skinMaterial(mesh, rig.legs);
    rig.skin = true;
    rig.swing = SKIN[kind]?.swing; rig.lift = SKIN[kind]?.lift; // amplitud del paso propia del modelo (si la tiene)
    rig.idle = SKIN[kind]?.idle; // reina: pose de reposo de las patas delanteras (el modelo las trae levantadas hacia la cara)
  }
  for (const key in byLeg) {
    const parts = byLeg[key], hip = parts[0].userData.hip;
    if (!hip) continue;
    const side = key[0] === 'L' ? -1 : 1, row = +key[1];
    const pv = pivot(parts[0].parent, hip, parts);
    pv.updateMatrixWorld(true);
    const knee = pivot(pv, new THREE.Vector3().copy(parts[0].userData.knee).sub(hip), parts.filter(o => o.userData.tibia)); // rodilla dentro de la cadera
    rig.legs.push({ pv, knee, side, row, solid: true, group: (row % 2 === 0) === (side < 0) ? 0 : 1 });
  }
  // boca: centro de la pieza «mouth» o, si no hay (soldado), entre los colmillos; en coordenadas de la hormiga
  const mouthBox = new THREE.Box3(), fangBox = new THREE.Box3();
  model.traverse(o => {
    if (!o.isMesh) return;
    if (o.material.name === 'mouth') mouthBox.expandByObject(o);
    if (o.material.name === 'fang') fangBox.expandByObject(o);
  });
  const mb = !mouthBox.isEmpty() ? mouthBox : !fangBox.isEmpty() ? fangBox : null;
  if (mb) rig.mouthLocal = root.worldToLocal(mb.getCenter(new THREE.Vector3()));
  rig.mouthAt = (out = new THREE.Vector3()) => { root.updateMatrixWorld(true); return root.localToWorld(out.set(rig.front * 0.88, height * 0.36, 0)); };
  /** Muerta: los ojos se tapan con párpados y una X encima. */
  rig.setDeadEyes = on => { if (deadEyes) deadEyes.visible = on; };
  return rig;
}

const tmp = new THREE.Vector3();
const centerOf = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());

/** Crea un pivote en `at` (coordenadas del modelo) y mete dentro las piezas, sin moverlas. */
function pivot(parent, at, parts) {
  const p = new THREE.Group();
  p.position.copy(at);
  parent.add(p);
  p.updateMatrixWorld(true);
  for (const o of parts) p.attach(o);
  return p;
}

/**
 * Tintes: las piezas rojas del modelo toman el color de la evolución; la dorada lo cambia todo a oro.
 * look: { head, thorax, gaster, legs } de antRig, o { gold: true }.
 */
function recolor(model, look) {
  if (!look) return;
  const gold = new THREE.Color('#f2c14a'), base = look.head && new THREE.Color(look.head);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    const c = o.material.color, hsl = {};
    c.getHSL(hsl);
    const reddish = (hsl.h < 0.06 || hsl.h > 0.94) && hsl.s > 0.35;
    if (look.gold) {
      if (!/eye|pupil|iris|sparkle|shine|sclera|mouth|smile/i.test(o.name)) { c.lerp(gold, reddish ? 0.85 : 0.45); o.material.metalness = 0.35; o.material.roughness = 0.3; }
    } else if (base && reddish) c.lerp(base, 0.75);
  });
}

export function buildGlbAnt(kind, look) {
  const src = templates[kind];
  const P = kind === 'queen' ? 'Queen_' : '';
  const model = src.clone(true);
  recolor(model, look);
  // el barniz del entorno quemaba los colores pastel del modelo: menos reflejo
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; if (!look) o.material = o.material.clone(); if (!look?.gold) matte(o.material); } });

  // ---- encajar: Z arriba / +Y delante  →  Y arriba / +X delante, longitud fija y patas en el suelo
  const fix = new THREE.Group();
  fix.add(model);
  fix.rotation.set(-Math.PI / 2, 0, 0);
  const turn = new THREE.Group(); turn.rotation.y = -Math.PI / 2; turn.add(fix);
  const root = new THREE.Group(), body = new THREE.Group();
  body.add(turn); root.add(body);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn), size = box.getSize(new THREE.Vector3());
  const k = LENGTH[kind] / Math.max(size.x, 1e-6);
  turn.scale.setScalar(k);
  root.updateMatrixWorld(true);
  box.setFromObject(turn);
  turn.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  root.updateMatrixWorld(true);

  // ---- piezas por nombre (vale para los dos juegos de modelos: «Leg_1_Upper» o «Worker_leg_L1_upper»)
  const top = [];
  model.traverse(o => { if (o.isMesh && (o.parent === model || o.parent?.parent === model)) top.push(o); });
  const grab = re => top.filter(o => re.test(o.name));
  const one = re => grab(re)[0];
  const toModel = v => v.applyMatrix4(model.matrixWorld.clone().invert());
  const rig = { root, body, legs: [], antennae: [], mand: [], t: Math.random() * 10, glb: true, look: look || {} };

  // abdomen (o gáster): pivote en el peciolo
  const abd = grab(/abdomen|gaster/i), pet = one(/petiole|waist/i);
  if (abd.length && pet) rig.gaster = pivot(model, toModel(centerOf(pet)), abd);

  // patas: se agrupan por nombre (L1…R3 o 1…6); la cadera es la pieza «hip» o la superior, hacia el cuerpo
  const legKeys = {};
  for (const o of grab(/leg_/i)) {
    const m = o.name.match(/leg_([LR]?\d)/i);
    if (m) (legKeys[m[1].toUpperCase()] ||= []).push(o);
  }
  for (const key in legKeys) {
    const parts = legKeys[key];
    const hipPart = parts.find(o => /hip|coxa/i.test(o.name)) || parts.find(o => /upper/i.test(o.name)) || parts[0];
    const c = toModel(centerOf(hipPart)), hip = c.clone();
    if (!/hip|coxa/i.test(hipPart.name)) hip.x *= 0.55;
    rig.legs.push({ pv: pivot(model, hip, parts), side: c.x < 0 ? -1 : 1, row: c.y, group: 0 });
  }
  // trípodes: delantera y trasera de un lado + la del medio del otro
  const ys = rig.legs.map(l => l.row), hi = Math.max(...ys), lo = Math.min(...ys);
  rig.legs.forEach(l => { const r = l.row > hi - (hi - lo) * 0.25 ? 0 : l.row < lo + (hi - lo) * 0.25 ? 2 : 1; l.group = (r % 2 === 0) === (l.side < 0) ? 0 : 1; });

  // cabeza: cara, ojos, boca, mandíbulas, corona y antenas, con pivote en el cuello
  const headMesh = one(/(^|_)head$/i), thorax = one(/thorax$/i);
  if (headMesh && thorax) {
    const neck = toModel(centerOf(headMesh)).lerp(toModel(centerOf(thorax)), 0.45);
    rig.head = pivot(model, neck, grab(/head|muzzle|face|eye|smile|mouth|mandible|antenna|lash|crown/i));
  }
  root.updateMatrixWorld(true);
  const toHead = v => v.applyMatrix4((rig.head || model).matrixWorld.clone().invert());
  for (const S of ['L', 'R']) {
    const parts = grab(new RegExp('antenna_' + S + '_', 'i'));
    const base = parts.find(o => /base|socket/i.test(o.name)) || parts.find(o => /lower$/i.test(o.name)) || parts[0];
    if (base) rig.antennae.push({ pv: pivot(rig.head || model, toHead(centerOf(base)), parts), s: S === 'L' ? -1 : 1 });
    const m = one(new RegExp('mandible_' + S + '$', 'i'));
    if (m) rig.mand.push({ g: pivot(rig.head || model, toHead(centerOf(m)), grab(new RegExp('mandible_' + S + '(_|$)', 'i'))), s: S === 'L' ? -1 : 1, piece: m });
  }
  // boca: entre las mandíbulas o, si el modelo no tiene, la pieza «mouth»
  const mouth = one(/mouth|smile/i);
  const mv = new THREE.Vector3(), mw = new THREE.Vector3();
  rig.mouthAt = (out = new THREE.Vector3()) => {
    if (rig.mand.length >= 2) return out.copy(rig.mand[0].g.getWorldPosition(mv)).add(rig.mand[1].g.getWorldPosition(mw)).multiplyScalar(0.5);
    if (mouth) return new THREE.Box3().setFromObject(mouth).getCenter(out);
    return (rig.head || root).getWorldPosition(out);
  };
  rig.front = LENGTH[kind] / 2; rig.height = size.y * k;
  return rig;
}

/** Anima un fotograma: marcha en trípode, antenas, cabeza, mandíbulas y abdomen. Ejes del modelo: Z arriba, +Y delante. */
export function animateGlbAnt(rig, phase, moving, dt, mode) {
  rig.t += dt;
  const t = rig.t;
  rig.kk = (rig.kk ?? 0) + ((moving ? 1 : 0) - (rig.kk ?? 0)) * Math.min(1, dt * 8);
  const w = rig.kk, atk = mode === 'attack', climb = mode === 'climb';
  // trepando: brazadas más largas y altas, con el cuerpo balanceándose de lado a lado
  const reach = climb ? 1.7 : 1, raise = climb ? 1.6 : 1;

  for (const l of rig.legs) {
    const ph = phase + (l.group ? Math.PI : 0), sw = Math.sin(ph), up = Math.max(0, Math.cos(ph));
    if (l.solid) { // hormiga.glb: Y arriba, cabeza hacia +Z, patas hacia ±X
      l.pv.rotation.y = sw * (rig.swing ?? 0.4) * reach * w * -l.side;  // adelante / atrás
      l.pv.rotation.z = up * (rig.lift ?? 0.32) * raise * w * l.side;  // levanta la pata
      continue;
    }
    l.pv.rotation.z = sw * 0.42 * w * -l.side;   // adelante / atrás
    l.pv.rotation.y = up * 0.45 * w * -l.side;   // levanta la pata
  }
  rig.body.position.y = Math.abs(Math.sin(phase)) * 0.012 * w + Math.sin(t * 2.1) * 0.004 * (1 - w);
  rig.body.rotation.z = Math.sin(phase * 2) * 0.025 * w;
  rig.body.rotation.y = climb ? Math.sin(phase) * 0.16 * w : 0; // trepando: se balancea al tirar de cada brazada
  rig.body.rotation.x = climb ? Math.sin(phase * 2) * 0.05 * w : 0;
  // reposo: patas delanteras apoyadas (al comer, eatGesture pasa de esta pose a la de la boca)
  if (rig.idle && !(rig.ee > 0.001)) for (const l of rig.legs) if (l.row === 0) {
    l.pv.rotation.x = rig.idle.hx; l.pv.rotation.y = 0; l.pv.rotation.z = rig.idle.hz * l.side;
    l.knee.rotation.set(0, 0, rig.idle.knee * l.side);
  }
  if (rig.eat != null) eatGesture(rig, dt);

  if (rig.gaster) {
    rig.gaster.rotation.x = Math.sin(phase) * 0.08 * w + Math.sin(t * 1.7) * 0.03;
    rig.gaster.rotation.z = Math.sin(phase * 0.5) * 0.06 * w;
    const br = 1 + Math.sin(t * 2.3) * 0.03;
    rig.gaster.scale.set(br, br, br);
  }
  if (rig.head) {
    rig.head.rotation.z = Math.sin(t * 0.9 + rig.root.id) * 0.16 * (1 - w * 0.6);
    rig.head.rotation.x = atk ? -0.3 + Math.max(0, Math.sin(t * 9)) * 0.45 : Math.sin(t * 1.3) * 0.06;
  }
  for (const a of rig.antennae) {
    const f = t * (moving ? 7 : 3.2) + a.s * 1.3;
    a.pv.rotation.x = Math.sin(f) * 0.22;
    a.pv.rotation.y = Math.cos(f * 0.8) * 0.18 * a.s;
  }
  const bite = atk ? Math.abs(Math.sin(t * 14)) * 0.5 : Math.max(0, Math.sin(t * 2.5)) * 0.08;
  for (const m of rig.mand) m.g.rotation.z = m.s * bite;
}

/**
 * Comer (reina): las patas delanteras doblan la rodilla y llevan las puntas bajo la barbilla,
 * y las frotan por turnos como si giraran la comida; el cuerpo se inclina un poco hacia delante.
 * La postura (EAT) está buscada numéricamente para que ninguna parte de la pata entre en la cabeza
 * ni en el tórax, tampoco en los extremos del frotado. Más adelante (delante de la cara) no cabe:
 * la cadera queda bajo la cabeza y la pata tendría que atravesarla.
 * rig.eat: segundos que le quedan comiendo (lo pone quien le da de comer).
 */
const EAT = { hx: -0.124, hy: -0.025, hz: -0.104, knee: -1.047, rub: 0.2 };
/** Postura de comer de la reina de una pieza (reina-base.glb, patas deformadas en el shader). */
const NO_IDLE = { hx: 0, hz: 0, knee: 0 };
export const EAT_SKIN = { hx: -0.8, hy: 0, hz: -0.35, kx: -0.4, knee: -0.7, rub: 0.15 };
function eatGesture(rig, dt) {
  rig.eat = Math.max(0, rig.eat - dt);
  rig.ee = (rig.ee ?? 0) + ((rig.eat > 0 ? 1 : 0) - (rig.ee ?? 0)) * Math.min(1, dt * 6);
  const e = rig.ee;
  if (e < 0.001) return;
  const t = rig.t;
  for (const l of rig.legs) {
    if (!l.solid) continue;
    if (l.row === 0 && rig.skin) {
      const E = EAT_SKIN, I = rig.idle || NO_IDLE, rub = Math.sin(t * 9 + l.side * 1.6) * E.rub, r = 1 - e;
      l.pv.rotation.set(I.hx * r + (E.hx + rub) * e, E.hy * l.side * e, (I.hz * r + E.hz * e) * l.side);
      l.knee.rotation.set(E.kx * e, 0, (I.knee * r + (E.knee - rub) * e) * l.side);
    } else if (l.row === 0) {
      const rub = Math.sin(t * 9 + l.side * 1.6) * EAT.rub;
      l.pv.rotation.set(EAT.hx * e, EAT.hy * l.side * e, EAT.hz * l.side * e);
      l.knee.rotation.z = (EAT.knee + rub) * l.side * e;
    } else if (l.row === 1) {
      l.pv.rotation.y = -l.side * e * 0.15;                 // las del medio se recolocan
    }
  }
  rig.body.rotation.z -= e * 0.05;
  rig.body.position.y += e * 0.01;
}

/** Mutación «Mandíbula reforzada»: mandíbulas grandes. */
export function setGlbJaw(rig, on) {
  for (const m of rig.mand) m.g.scale.setScalar(on ? 1.9 : 1);
  if (rig.head) rig.head.scale.setScalar(on ? 1.1 : 1);
}
