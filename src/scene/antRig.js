// Hormiga articulada hecha en código, con el aspecto brillante y redondeado del fondo pintado.
// Jerarquía real (no geometría fundida): cuerpo → tórax → cabeza → antenas y mandíbulas,
// y seis patas con cadera y rodilla. Así se animan por separado:
//   - marcha en trípode (tres patas apoyadas, tres en el aire), con rebote del cuerpo
//   - antenas que tantean, cabeza que mira, abdomen que respira y se balancea
//   - ataque: embestida de cabeza y mordiscos de mandíbula
// Mira hacia +X, apoyada en y = 0. Longitud ≈ 0,85 (igual que la hormiga de arcilla anterior).
import * as THREE from 'three';

const geoCache = {}, matCache = {};

function sphere(r, sx = 1, sy = 1, sz = 1) {
  const k = `s${r}_${sx}_${sy}_${sz}`;
  if (!geoCache[k]) geoCache[k] = new THREE.SphereGeometry(r, 28, 18).scale(sx, sy, sz);
  return geoCache[k];
}

/** Cápsula que va de (0,0,0) a (0,-len,0): se orienta girando su grupo padre. */
function capsule(r, len, r2) {
  const k = `c${r}_${len}_${r2}`;
  if (!geoCache[k]) {
    const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 4, 10);
    if (r2) { // se estrecha hacia la punta
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = THREE.MathUtils.clamp(-p.getY(i) / len + 0.5, 0, 1); p.setX(i, p.getX(i) * (1 - t * (1 - r2 / r))); p.setZ(i, p.getZ(i) * (1 - t * (1 - r2 / r))); }
      g.computeVertexNormals();
    }
    g.translate(0, -len / 2, 0);
    geoCache[k] = g;
  }
  return geoCache[k];
}

function chitin(color, gloss = 1) {
  const k = color + gloss;
  if (!matCache[k]) matCache[k] = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.42, metalness: 0, clearcoat: 0.9 * gloss, clearcoatRoughness: 0.18, sheen: 0.3, sheenColor: new THREE.Color('#ffb48a'), envMapIntensity: 0.7
  });
  return matCache[k];
}
const eyeMat = () => matCache.eye || (matCache.eye = new THREE.MeshPhysicalMaterial({ color: '#0d0705', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 }));
const glintMat = () => matCache.glint || (matCache.glint = new THREE.MeshBasicMaterial({ color: '#fff8ee' }));

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

/**
 * Paletas: hormiga roja de la referencia y reina con el gáster crema a rayas.
 */
export const ANT_LOOKS = {
  gold: { head: '#f2c14a', thorax: '#e0a838', gaster: '#c98a22', legs: '#a8701a', stripe: null, size: 1, gasterS: 1, headS: 1 },
  evo1: { head: '#e0501e', thorax: '#c8401a', gaster: '#8e2610', legs: '#6a1c0c', stripe: null, size: 1.08, gasterS: 1.05, headS: 1.05 },
  evo2: { head: '#bc6a2c', thorax: '#a65a26', gaster: '#703818', legs: '#5a2a12', stripe: null, size: 1.12, gasterS: 0.95, headS: 1.4, jaw: true },
  evo3: { head: '#3e1c10', thorax: '#4c2414', gaster: '#2a120a', legs: '#2a140c', stripe: null, size: 1.2, gasterS: 1.2, headS: 1.2 },
  evo4: { head: '#8a5426', thorax: '#744620', gaster: '#4c2c14', legs: '#5a3418', stripe: null, size: 1.22, gasterS: 0.95, headS: 1.35, jaw: true },
  evo5: { head: '#c8342a', thorax: '#2c1a16', gaster: '#1a100c', legs: '#6e2618', stripe: null, size: 1.32, gasterS: 1.1, headS: 1.5, jaw: true },
  evo6: { head: '#e8542e', thorax: '#40204a', gaster: '#2c1636', legs: '#4c1c40', stripe: '#e8a040', size: 1.45, gasterS: 1.2, headS: 1.6, jaw: true },
  ant: { head: '#9b3a22', thorax: '#8a3220', gaster: '#5e1f14', legs: '#4a170e', stripe: null, size: 1, gasterS: 1, headS: 1 },
  queen: { head: '#9e3c22', thorax: '#8e3622', gaster: '#f2dcb4', legs: '#5a1d10', stripe: '#d9b07a', size: 1, gasterS: 2.1, headS: 1.18 },
  // enemigos de la primera era: hormigas negras rivales y su reina
  rival: { head: '#0e0b0a', thorax: '#0c0908', gaster: '#080606', legs: '#070505', stripe: null, size: 1, gasterS: 1, headS: 1.05 },
  rivalQ: { head: '#100c0b', thorax: '#0d0a09', gaster: '#1c1513', legs: '#080606', stripe: '#3a2c26', size: 1, gasterS: 2.1, headS: 1.2 },
  // segunda era: bachacos (hormigas cortadoras), cabezones y rojizos
  bachaco: { head: '#c0521f', thorax: '#a8441b', gaster: '#7a3015', legs: '#6e2a12', stripe: null, size: 1, gasterS: 0.95, headS: 1.4, jaw: true },
  bachacoS: { head: '#a83c16', thorax: '#8f3514', gaster: '#62240f', legs: '#561f0c', stripe: null, size: 1, gasterS: 1, headS: 1.9, jaw: true }
};

export function buildAnt(look = ANT_LOOKS.ant) {
  const L = look, root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const rig = { root, body, legs: [], t: Math.random() * 10, jaw: 1, look: L };
  const cH = chitin(L.head), cT = chitin(L.thorax), cG = chitin(L.gaster, L.stripe ? 0.7 : 1), cL = chitin(L.legs, 0.6);

  // tórax (dos lóbulos) y peciolo
  body.add(mesh(sphere(0.085, 1.45, 0.95, 0.95), cT, 0.06, 0.2, 0));
  body.add(mesh(sphere(0.055, 1.1, 0.9, 0.9), cT, -0.05, 0.215, 0));
  body.add(mesh(sphere(0.032), cT, -0.11, 0.2, 0));

  // gáster: pivota en el peciolo para balancearse y respirar
  const gs = L.gasterS;
  rig.gaster = new THREE.Group(); rig.gaster.position.set(-0.13, 0.21, 0); body.add(rig.gaster);
  const gx = -0.15 * gs;
  rig.gaster.add(mesh(sphere(0.15 * Math.min(gs, 1.5), 1.3 * (gs > 1 ? 1.25 : 1), 1.02, 0.95), cG, gx, 0.02 * gs, 0));
  if (L.stripe) { // reina: anillos marcados como en la ilustración
    const cS = chitin(L.stripe, 0.6);
    for (let i = 0; i < 4; i++) {
      // anillo pegado a la superficie del elipsoide en esa x
      const R = 0.15 * Math.min(gs, 1.5), ax = R * 1.3 * 1.25, dx = (i - 1.5) * 0.12, f = Math.sqrt(Math.max(0.05, 1 - (dx / ax) ** 2));
      const ring = mesh(new THREE.TorusGeometry(1, 0.06, 10, 40), cS, gx + dx, 0.02 * gs, 0);
      ring.rotation.y = Math.PI / 2; ring.scale.set(R * 0.97 * f, R * 1.02 * f * 1.0, 0.35); rig.gaster.add(ring);
    }
  }

  // cabeza grande y brillante, con ojos de dibujo animado
  const hs = L.headS;
  rig.head = new THREE.Group(); rig.head.position.set(0.15, 0.23, 0); body.add(rig.head);
  rig.head.add(mesh(sphere(0.105 * hs, 1.12, 0.98, 1.02), cH, 0.09 * hs, 0.01, 0));
  for (const s of [1, -1]) {
    rig.head.add(mesh(sphere(0.038 * hs, 0.9, 1.05, 0.8), eyeMat(), 0.15 * hs, 0.045 * hs, s * 0.062 * hs));
    const glint = mesh(sphere(0.011 * hs), glintMat(), 0.175 * hs, 0.065 * hs, s * 0.058 * hs); glint.castShadow = false; rig.head.add(glint);
  }
  // antenas: dos segmentos con codo, cada uno en su pivote
  rig.antennae = [];
  for (const s of [1, -1]) {
    const base = new THREE.Group(); base.position.set(0.15 * hs, 0.08 * hs, s * 0.035 * hs); rig.head.add(base);
    base.rotation.set(s * -0.35, 0, -2.2);
    base.add(mesh(capsule(0.012, 0.16, 0.009), cL));
    const elbow = new THREE.Group(); elbow.position.set(0, -0.16, 0); base.add(elbow);
    elbow.rotation.z = 1.25;
    elbow.add(mesh(capsule(0.009, 0.13, 0.006), cL));
    elbow.add(mesh(sphere(0.014), cL, 0, -0.13, 0));
    rig.antennae.push({ base, elbow, s, b0: base.rotation.clone(), e0: elbow.rotation.z });
  }
  // mandíbulas
  rig.mand = [];
  for (const s of [1, -1]) {
    const m = new THREE.Group(); m.position.set(0.19 * hs, -0.04 * hs, s * 0.035 * hs); rig.head.add(m);
    const piece = mesh(capsule(0.016, 0.075, 0.008), cL); piece.rotation.set(0, 0, Math.PI / 2 + 0.25); m.add(piece);
    m.rotation.y = s * 0.45;
    rig.mand.push({ g: m, s, piece });
  }

  // patas: cadera (yaw + elevación) → fémur → rodilla → tibia. Mirando hacia +Z y espejadas para -Z.
  const HIPS = [[0.1, 0.85], [0.05, 0.05], [-0.01, -0.75]]; // x en el tórax, ángulo hacia delante/atrás
  let i = 0;
  for (const [hx, yaw] of HIPS) for (const s of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(hx, 0.185, s * 0.045); hip.rotation.order = 'YXZ';
    if (s < 0) hip.scale.z = -1;
    body.add(hip);
    const lift = new THREE.Group(); hip.add(lift);
    const femur = new THREE.Group(); femur.rotation.x = -2.15; lift.add(femur); // sube y sale hacia el lado
    femur.add(mesh(capsule(0.024, 0.15, 0.017), cL));
    femur.add(mesh(sphere(0.022), cL, 0, -0.15, 0));
    const knee = new THREE.Group(); knee.position.y = -0.15; knee.rotation.x = 1.75; femur.add(knee); // baja hasta el suelo
    knee.add(mesh(capsule(0.017, 0.2, 0.009), cL));
    rig.legs.push({ hip, lift, knee, side: s, group: 0, k0: knee.rotation.x, base: yaw });
    hip.rotation.y = -yaw * s;
    i++;
  }
  // grupos de trípode: delantera y trasera de un lado + media del otro
  rig.legs.forEach((l, j) => { const row = Math.floor(j / 2); l.group = (row % 2 === 0) === (l.side > 0) ? 0 : 1; });

  if (L.jaw) setAntJaw(rig, true);
  return rig;
}

/**
 * Anima un fotograma. phase: fase de la marcha (la mueve quien desplaza la hormiga).
 * mode: 'walk' | 'idle' | 'attack'.
 */
export function animateAnt(rig, phase, moving, dt, mode) {
  rig.t += dt;
  const t = rig.t, k = moving ? 1 : 0;
  rig.kk = (rig.kk ?? k) + (k - (rig.kk ?? k)) * Math.min(1, dt * 8); // suaviza el paso parado ↔ andando
  const w = rig.kk;

  for (const l of rig.legs) {
    const ph = phase + (l.group ? Math.PI : 0), sw = Math.sin(ph), up = Math.max(0, Math.cos(ph));
    l.hip.rotation.y = -l.base * l.side + sw * 0.38 * w * l.side;
    l.lift.rotation.x = -up * 0.42 * w;
    l.knee.rotation.x = l.k0 - up * 0.35 * w;
  }
  // el cuerpo rebota con cada apoyo y se mece un poco
  const bob = Math.abs(Math.sin(phase)) * 0.012 * w;
  rig.body.position.y = bob + Math.sin(t * 2.1) * 0.004 * (1 - w);
  rig.body.rotation.z = Math.sin(phase * 2) * 0.03 * w;
  rig.body.rotation.x = Math.sin(phase) * 0.04 * w;

  // gáster: respira en reposo y se balancea al andar
  rig.gaster.rotation.z = 0.12 + Math.sin(phase) * 0.06 * w + Math.sin(t * 1.7) * 0.03;
  rig.gaster.rotation.x = Math.sin(phase * 0.5) * 0.1 * w;
  const br = 1 + Math.sin(t * 2.3) * 0.025;
  rig.gaster.scale.set(br, br, br);

  // cabeza: mira de lado a lado; en ataque embiste
  const atk = mode === 'attack';
  rig.head.rotation.y = Math.sin(t * 0.9 + rig.root.id) * 0.18 * (1 - w * 0.6);
  rig.head.rotation.z = atk ? -0.25 + Math.max(0, Math.sin(t * 9)) * 0.4 : Math.sin(t * 1.3) * 0.06;
  rig.head.position.x = 0.15 + (atk ? Math.max(0, Math.sin(t * 9)) * 0.04 : 0);

  // antenas: tantean el aire, más rápido al andar
  for (const a of rig.antennae) {
    const f = t * (moving ? 7 : 3.2) + a.s * 1.3;
    a.base.rotation.x = a.b0.x + Math.sin(f) * 0.25;
    a.base.rotation.z = a.b0.z + Math.cos(f * 0.8) * 0.18;
    a.elbow.rotation.z = a.e0 + Math.sin(f * 1.4) * 0.3;
  }
  // mandíbulas: mastican en ataque, se mueven un poco al comer
  const bite = atk ? Math.abs(Math.sin(t * 14)) * 0.55 : Math.max(0, Math.sin(t * 2.5)) * 0.08;
  for (const m of rig.mand) m.g.rotation.y = m.s * (0.45 - bite * 0.9 + 0.15) * 1;
}

/** Mutación «Mandíbula reforzada»: mandíbulas grandes y claras, cabeza algo mayor. */
export function setAntJaw(rig, on) {
  const s = on ? 2.1 : 1;
  for (const m of rig.mand) { m.piece.scale.setScalar(s); m.piece.material = on ? chitin('#f0dcb0', 0.8) : chitin(rig.look.legs, 0.6); }
  rig.head.scale.setScalar(on ? 1.12 : 1);
}

/** Entorno suave para que el barniz brille como en la ilustración. */
export function glossEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const c = [], pos = sky.geometry.attributes.position, top = new THREE.Color('#fff2d6'), bot = new THREE.Color('#5a2a12');
  for (let i = 0; i < pos.count; i++) { const k = THREE.MathUtils.clamp(pos.getY(i) / 10 * 0.5 + 0.5, 0, 1); const col = bot.clone().lerp(top, k * k); c.push(col.r, col.g, col.b); }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  sc.add(sky);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5, 3.6) }));
  sun.position.set(5, 6, 6); sc.add(sun);
  const env = pm.fromScene(sc, 0.04).texture;
  pm.dispose();
  return env;
}
