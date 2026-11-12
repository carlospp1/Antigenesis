// Una criatura (hormiga, reina o enemigo) con la misma interfaz tanto si usa
// un modelo .glb como si usa la geometría procedimental de respaldo.
//   c.g          grupo a posicionar en la escena (mirando a +X)
//   c.phase      fase del paso; quien la mueve decide la velocidad
//   c.step(moving, amp, dt)   anima un fotograma
//   c.setJaw(on) muestra u oculta las mandíbulas de la mutación (soldados)
import * as THREE from 'three';
import { GEO, MAT } from './geometry.js';
import { instance } from './assets.js';
import { buildAnt, animateAnt, setAntJaw, ANT_LOOKS } from './antRig.js';
import { hasGlbAnt, buildGlbAnt, animateGlbAnt, setGlbJaw, hasSolidAnt, buildSolidAnt } from './glbAnt.js';

const RIGS = { evo0: ANT_LOOKS.ant, evo1: ANT_LOOKS.evo1, evo2: ANT_LOOKS.evo2, evo3: ANT_LOOKS.evo3, evo4: ANT_LOOKS.evo4, evo5: ANT_LOOKS.evo5, evo6: ANT_LOOKS.evo6, antGold: ANT_LOOKS.gold, ants: ANT_LOOKS.ant, queen: ANT_LOOKS.queen, rival: ANT_LOOKS.rival, rivalQ: ANT_LOOKS.rivalQ, bachaco: ANT_LOOKS.bachaco, bachacoS: ANT_LOOKS.bachacoS };

const CLIP = { walk: /walk|run/i, idle: /idle/i, attack: /attack|bite/i };

export function createCreature(kind, scale = 1) {
  // «evo1:gold» = hormiga de esa etapa recoloreada en oro
  const [baseKind, variant] = kind.split(':'), gold = variant === 'gold';
  kind = baseKind;
  const g = new THREE.Group();
  const c = { g, kind, phase: Math.random() * 6, model: null, rig: null, body: null, mixer: null, actions: {}, current: null, jaw: null };
  const inst = RIGS[kind] ? null : instance(kind);

  const solidKind = { queen: 'queen', queenV: 'queenVenomax', queenF: 'queenFinal', evo0: 'base', ants: 'base', evo1: 'soldier', evo2: 'venator', evo3: 'venomax', evo4: 'apexia', evo5: 'titanis', evo6: 'fiera' }[kind] || null;
  const glbKind = kind === 'queen' || kind === 'queenV' || kind === 'queenF' ? 'queen' : /^(ants|evo\d|antGold)$/.test(kind) ? 'worker' : null;
  if (solidKind && hasSolidAnt(solidKind)) { // formas propias y las tres reinas: el .glb entero
    c.ant = buildSolidAnt(solidKind, { gold });
    g.add(c.ant.root);
    c.front = c.ant.front; c.height = Math.min(0.42, c.ant.height);
    c.mouth = c.ant.mouthLocal; c.holder = c.ant.body; // lo que lleva va en la boca y se mueve con el cuerpo
  } else if (glbKind && hasGlbAnt(glbKind)) { // modelo ilustrado (.glb) con piezas animadas por código
    const look = kind === 'antGold' || gold ? { gold: true } : /^evo[1-9]/.test(kind) ? RIGS[kind] : null;
    c.ant = buildGlbAnt(glbKind, look);
    g.add(c.ant.root);
    c.front = c.ant.front; c.height = Math.min(0.35, c.ant.height);
  } else if (RIGS[kind]) { // hormigas y reina: esqueleto articulado en código
    c.ant = buildAnt(gold ? ANT_LOOKS.gold : RIGS[kind]);
    g.add(c.ant.root);
    c.front = 0.42 * RIGS[kind].headS; c.height = 0.3;
  } else if (inst) {
    c.rig = new THREE.Group();
    c.rig.add(inst.obj);
    g.add(c.rig);
    c.model = inst.obj;
    c.front = inst.box.max.x;
    c.height = inst.box.max.y;
    if (inst.clips.length) {
      c.mixer = new THREE.AnimationMixer(inst.obj);
      for (const clip of inst.clips) for (const k in CLIP) if (!c.actions[k] && CLIP[k].test(clip.name)) c.actions[k] = c.mixer.clipAction(clip);
    }
  } else {
    const geo = GEO[kind] || GEO.termite; // respaldo si un .glb no carga
    c.body = new THREE.Mesh(geo.body, MAT.v);
    c.la = new THREE.Mesh(geo.la, MAT.v);
    c.lb = new THREE.Mesh(geo.lb, MAT.v);
    c.body.castShadow = true;
    g.add(c.body, c.la, c.lb);
    c.body.geometry.computeBoundingBox();
    const b = c.body.geometry.boundingBox;
    c.front = b.max.x; c.height = b.max.y;
  }
  g.scale.setScalar(scale);

  c.play = name => {
    const a = c.actions[name] || c.actions.walk || c.actions.idle;
    if (!a || a === c.current) return;
    a.reset().fadeIn(0.25).play();
    if (c.current) c.current.fadeOut(0.25);
    c.current = a;
  };

  c.step = (moving, amp, dt = 0, mode) => {
    const A = amp || 0.045, k = moving ? 1 : 0.15, s = Math.sin(c.phase), co = Math.cos(c.phase);
    if (c.ant) { (c.ant.glb ? animateGlbAnt : animateAnt)(c.ant, c.phase, moving, dt, mode); return; }
    if (c.mixer) { // modelo con esqueleto: usa sus propias animaciones
      c.play(mode || (moving ? 'walk' : 'idle'));
      c.mixer.update(dt);
      return;
    }
    if (c.rig) { // modelo rígido: balanceo al caminar
      c.rig.position.y = Math.abs(s) * A * 0.55 * k;
      c.rig.rotation.x = s * A * 1.6 * k;
      c.rig.rotation.z = co * A * 0.5 * k;
      c.rig.position.x = s * A * 0.25 * k;
      return;
    }
    c.la.position.x = s * A * k; c.lb.position.x = -s * A * k;
    c.la.position.y = Math.max(0, co) * A * 0.4 * k; c.lb.position.y = Math.max(0, -co) * A * 0.4 * k;
  };

  return c;
}

/** Mutación «Mandíbula reforzada»: en el modelo se añaden mandíbulas; en el respaldo se cambia la geometría. */
export function setJaw(c, on, procGeo, jawDef) {
  if (c.ant) { (c.ant.glb ? setGlbJaw : setAntJaw)(c.ant, on); return; }
  if (c.body) {
    c.body.geometry = procGeo.body; c.la.geometry = procGeo.la; c.lb.geometry = procGeo.lb;
    return;
  }
  if (on && !c.jaw) {
    c.jaw = new THREE.Mesh(GEO.jaw, MAT.v);
    c.jaw.position.set(c.front + (jawDef ? jawDef.x : 0), jawDef ? jawDef.y : 0.1, 0);
    c.jaw.castShadow = true;
    c.rig.add(c.jaw);
  }
  if (c.jaw) c.jaw.visible = on;
  c.rig.scale.setScalar(on ? 1.12 : 1);
}
