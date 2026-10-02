import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAT } from '../sim/rules';
import type { School } from '../sim/types';

/**
 * The building around the mat.
 *
 * A dark fieldhouse with the mat pooled in light does two jobs at once: it looks
 * like the real thing on broadcast, and it keeps the eye on the two bodies that
 * matter. Crowd members are instanced and animated in the vertex shader so a full
 * house costs almost nothing on the CPU.
 */

export interface Gym {
  group: Group;
  /** Advance crowd motion and reaction. */
  update: (dt: number) => void;
  /** Spike the crowd's energy after a big moment, 0..1. */
  excite: (amount: number) => void;
}

const SHARED_TIME = { value: 0 };
const CROWD_ENERGY = { value: 0.12 };

function woodTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#44301f';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    g.fillStyle = `rgba(0,0,0,${0.18 + Math.random() * 0.1})`;
    g.fillRect(0, y, 512, 2);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,220,170,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * 512, y + Math.random() * 30, 40 + Math.random() * 90, 1);
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

function bannerTexture(lines: string[], bg: string, fg: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(12, 12, c.width - 24, c.height - 24);
  g.fillStyle = fg;
  g.textAlign = 'center';
  lines.forEach((line, i) => {
    const size = i === 0 ? 44 : 30;
    g.font = `bold ${size}px "Arial Black", Impact, sans-serif`;
    g.fillText(line, c.width / 2, 92 + i * 56);
  });
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

interface Seat {
  position: Vector3;
  yaw: number;
}

/** Four banks of risers facing the mat, with seats laid out on each step. */
function bleacherSeats(): { risers: Group; seats: Seat[] } {
  const risers = new Group();
  const seats: Seat[] = [];
  const stepDepth = 0.95;
  const stepRise = 0.42;
  const steps = 11;
  const benchHeight = 0.42;
  const inner = MAT.halfSize + 3.4;
  const width = 30;

  const riserMat = new MeshStandardMaterial({ color: '#232a36', roughness: 0.9 });
  const benchMat = new MeshStandardMaterial({ color: '#39445a', roughness: 0.8 });

  for (let side = 0; side < 4; side++) {
    const yaw = (side * Math.PI) / 2;
    const bank = new Group();
    bank.rotation.y = yaw;
    for (let s = 0; s < steps; s++) {
      const z = inner + s * stepDepth;
      const y = s * stepRise;
      const block = new Mesh(new BoxGeometry(width, stepRise + 0.02, stepDepth), riserMat);
      block.position.set(0, y + stepRise / 2, z);
      block.receiveShadow = true;
      bank.add(block);
      // Seat plank a knee-height above the footboard, like telescopic bleachers.
      const bench = new Mesh(new BoxGeometry(width, benchHeight, 0.4), benchMat);
      bench.position.set(0, y + stepRise + benchHeight / 2, z + 0.24);
      bank.add(bench);

      const perRow = 26;
      for (let i = 0; i < perRow; i++) {
        if (Math.random() < 0.08) continue;
        const x = (i - (perRow - 1) / 2) * (width / perRow) + (Math.random() - 0.5) * 0.14;
        const local = new Vector3(x, y + stepRise + benchHeight, z + 0.2);
        local.applyAxisAngle(new Vector3(0, 1, 0), yaw);
        seats.push({ position: local, yaw: yaw + Math.PI + (Math.random() - 0.5) * 0.35 });
      }
    }
    risers.add(bank);
  }
  return { risers, seats };
}

/** Part ids baked into the fan mesh; the shader colours and moves by part. */
const FAN = { SHIRT: 0, SKIN: 1, HAIR: 2, ARM_L: 3, ARM_R: 4, PANTS: 5, SHOE: 6 } as const;
/** Shoulder pivot and the resting direction of the arm, shared with the shader. */
const FAN_SHOULDER = [0.19, 0.48, 0] as const;
const FAN_ARM_TILT = -0.75;
const FAN_ARM_LENGTH = 0.43;

/**
 * One seated fan: torso, head, hair, arms resting on the knees, legs down to the
 * footboard. Merged into a single mesh with a part id per vertex so the whole
 * house is one instanced draw. The origin is the middle of the seat; fans face +Z.
 */
function fanGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const add = (g: BufferGeometry, part: number) => {
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    const n = g.getAttribute('position').count;
    g.setAttribute('aPart', new Float32BufferAttribute(new Float32Array(n).fill(part), 1));
    parts.push(g);
  };

  const torso = new CapsuleGeometry(0.15, 0.25, 2, 9);
  torso.scale(1, 1, 0.74);
  torso.translate(0, 0.27, 0.01);
  add(torso, FAN.SHIRT);
  const shoulders = new CapsuleGeometry(0.075, 0.25, 2, 7);
  shoulders.rotateZ(Math.PI / 2);
  shoulders.scale(1, 1, 0.8);
  shoulders.translate(0, 0.455, 0.0);
  add(shoulders, FAN.SHIRT);
  const neck = new CylinderGeometry(0.045, 0.05, 0.1, 7);
  neck.translate(0, 0.57, 0.02);
  add(neck, FAN.SKIN);
  const head = new SphereGeometry(0.097, 10, 8);
  head.scale(0.94, 1.1, 1);
  head.translate(0, 0.68, 0.03);
  add(head, FAN.SKIN);
  const hair = new SphereGeometry(0.103, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.52);
  hair.translate(0, 0.695, 0.015);
  add(hair, FAN.HAIR);

  for (const side of [1, -1]) {
    const arm = new CapsuleGeometry(0.045, FAN_ARM_LENGTH - 0.07, 2, 7);
    arm.translate(0, -FAN_ARM_LENGTH / 2 + 0.02, 0);
    arm.rotateX(FAN_ARM_TILT);
    arm.translate(FAN_SHOULDER[0] * side, FAN_SHOULDER[1], FAN_SHOULDER[2]);
    add(arm, side > 0 ? FAN.ARM_L : FAN.ARM_R);

    const thigh = new CapsuleGeometry(0.068, 0.3, 1, 7);
    thigh.rotateX(Math.PI / 2);
    thigh.translate(0.09 * side, 0.07, 0.19);
    add(thigh, FAN.PANTS);
    const shin = new CapsuleGeometry(0.056, 0.3, 1, 7);
    shin.translate(0.09 * side, -0.17, 0.39);
    add(shin, FAN.PANTS);
    const shoe = new BoxGeometry(0.1, 0.08, 0.24);
    shoe.translate(0.09 * side, -0.38, 0.44);
    add(shoe, FAN.SHOE);
  }
  return mergeGeometries(parts, false)!;
}

const FAN_VERTEX_PARS = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
attribute float aPart;
attribute float aPhase;
attribute float aCheer;
attribute vec3 aSkin;
attribute vec3 aHair;
attribute vec3 aPants;
varying float vPart;
varying float vArm;
varying float vSleeve;
varying vec3 vSkin;
varying vec3 vHair;
varying vec3 vPants;
`;

/** How hard this fan is reacting: shared by the normal and position passes. */
const FAN_REACTION = /* glsl */ `
  float ph = aPhase * 6.2831853;
  float energy = clamp(uEnergy, 0.0, 1.0);
  float keen = 0.55 + aCheer * 0.9;
  // On their feet with arms up when the place goes off; seated applause before that.
  float up = smoothstep(0.32, 0.85, energy * keen);
  float clap = smoothstep(0.18, 0.4, energy * keen) * (1.0 - up);
  float wave = up * (0.78 + 0.22 * sin(uTime * (5.0 + aPhase * 3.0) + ph));
  bool isArm = aPart > 2.5 && aPart < 4.5;
  float lift = isArm ? -wave * 2.45 - clap * 0.75 : 0.0;
  float lc = cos(lift);
  float ls = sin(lift);
  // Between big moments people glance at a neighbour, hold, and look back.
  bool isHead = aPart > 0.5 && aPart < 2.5;
  float glance = sin(uTime * (0.21 + aPhase * 0.17) + ph * 5.0);
  float turn = isHead ? sign(glance) * smoothstep(0.55, 0.9, abs(glance)) * 0.5 * (1.0 - up) : 0.0;
  float tc = cos(turn);
  float ts = sin(turn);
`;

const FAN_NORMAL = /* glsl */ `#include <beginnormal_vertex>
${FAN_REACTION}
  objectNormal = vec3(objectNormal.x, objectNormal.y * lc - objectNormal.z * ls, objectNormal.y * ls + objectNormal.z * lc);
  objectNormal = vec3(objectNormal.x * tc + objectNormal.z * ts, objectNormal.y, -objectNormal.x * ts + objectNormal.z * tc);
`;

const FAN_POSITION = /* glsl */ `#include <begin_vertex>
  vPart = aPart;
  vSkin = aSkin;
  vHair = aHair;
  vPants = aPants;
  vSleeve = step(0.55, fract(aPhase * 13.7));
  vArm = 0.0;
  if (isArm) {
    float side = aPart > 3.5 ? -1.0 : 1.0;
    vec3 pivot = vec3(${FAN_SHOULDER[0].toFixed(3)} * side, ${FAN_SHOULDER[1].toFixed(3)}, ${FAN_SHOULDER[2].toFixed(3)});
    vec3 q = transformed - pivot;
    vec3 along = vec3(0.0, -cos(${FAN_ARM_TILT.toFixed(3)}), -sin(${FAN_ARM_TILT.toFixed(3)}));
    vArm = clamp(dot(q, along) / ${FAN_ARM_LENGTH.toFixed(3)}, 0.0, 1.0);
    q = vec3(q.x, q.y * lc - q.z * ls, q.y * ls + q.z * lc);
    // Raised arms open into a V; clapping hands meet in front and part on the beat.
    float beat = 0.5 + 0.5 * sin(uTime * 12.5 + ph * 3.0);
    q.x += side * vArm * (wave * 0.16 - clap * (0.13 - beat * 0.08));
    transformed = pivot + q;
  }
  if (isHead) {
    vec3 h = transformed - vec3(0.0, 0.0, 0.02);
    transformed = vec3(h.x * tc + h.z * ts, h.y, -h.x * ts + h.z * tc) + vec3(0.0, 0.0, 0.02);
  }
  if (aPart < 4.5) {
    // The upper body comes up off the bench; legs stay planted.
    transformed.y += up * (0.1 + 0.035 * sin(uTime * 4.0 + ph)) + sin(uTime * (1.6 + aPhase) + ph) * (0.008 + energy * 0.02);
    transformed.z += up * 0.05 + clap * 0.02;
  }
`;

const FAN_COLOUR = /* glsl */ `#include <color_fragment>
  if (vPart > 0.5 && vPart < 1.5) diffuseColor.rgb = vSkin;
  else if (vPart > 1.5 && vPart < 2.5) diffuseColor.rgb = vHair;
  else if (vPart > 2.5 && vPart < 4.5 && (vArm > 0.86 || (vSleeve > 0.5 && vArm > 0.42))) diffuseColor.rgb = vSkin;
  else if (vPart > 4.5 && vPart < 5.5) diffuseColor.rgb = vPants;
  else if (vPart > 5.5) diffuseColor.rgb = vec3(0.05, 0.05, 0.06);
`;

function buildCrowd(seats: Seat[], schools: [School, School]): Group {
  const group = new Group();
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  const colours = (list: string[]) => list.map((c) => new Color(c));
  const home = colours([schools[0].primary, schools[0].primary, schools[0].secondary]);
  const away = colours([schools[1].primary, schools[1].secondary]);
  const street = colours(['#2d3340', '#4b5162', '#8d8375', '#d8d2c6', '#1d2027', '#5e6a7a', '#6d2f2f', '#2f4d3a']);
  const skins = colours(['#e9c3a0', '#c99572', '#9c6b4a', '#6b4630', '#4a2f20', '#f1d4b8']);
  const hairs = colours(['#17110d', '#2b1d14', '#5a3c22', '#8a6a3c', '#b8a07a', '#3a3a3a', '#d8d4cc']);
  const pants = colours(['#27344d', '#1f2430', '#3b4256', '#6b6152', '#2a2a2a', '#4a5568']);

  const mat = new MeshStandardMaterial({ roughness: 0.84 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME;
    shader.uniforms.uEnergy = CROWD_ENERGY;
    shader.vertexShader =
      FAN_VERTEX_PARS +
      shader.vertexShader
        .replace('#include <beginnormal_vertex>', FAN_NORMAL)
        .replace('#include <begin_vertex>', FAN_POSITION);
    shader.fragmentShader =
      'varying float vPart;\nvarying float vArm;\nvarying float vSleeve;\nvarying vec3 vSkin;\nvarying vec3 vHair;\nvarying vec3 vPants;\n' +
      shader.fragmentShader.replace('#include <color_fragment>', FAN_COLOUR);
  };
  mat.customProgramCacheKey = () => 'crowd-fans';

  const fans = new InstancedMesh(fanGeometry(), mat, seats.length);
  fans.castShadow = false;
  fans.receiveShadow = false;
  fans.frustumCulled = false;
  const phase = new Float32Array(seats.length);
  const cheer = new Float32Array(seats.length);
  const skin = new Float32Array(seats.length * 3);
  const hair = new Float32Array(seats.length * 3);
  const legs = new Float32Array(seats.length * 3);
  const dummy = new Object3D();

  seats.forEach((seat, i) => {
    phase[i] = Math.random();
    const r = Math.random();
    // A third in the home colours, a section for the visitors, the rest in street clothes.
    const homeFan = r < 0.36;
    fans.setColorAt(i, pick(homeFan ? home : r < 0.5 ? away : street));
    cheer[i] = homeFan ? 0.55 + Math.random() * 0.45 : Math.random() * 0.65;
    pick(skins).toArray(skin, i * 3);
    pick(hairs).toArray(hair, i * 3);
    pick(pants).toArray(legs, i * 3);
    dummy.position.copy(seat.position);
    dummy.rotation.set(0, seat.yaw, 0);
    const s = 0.95 + Math.random() * 0.1;
    dummy.scale.set(s * (0.94 + Math.random() * 0.14), s, s);
    dummy.updateMatrix();
    fans.setMatrixAt(i, dummy.matrix);
  });

  fans.geometry.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
  fans.geometry.setAttribute('aCheer', new InstancedBufferAttribute(cheer, 1));
  fans.geometry.setAttribute('aSkin', new InstancedBufferAttribute(skin, 3));
  fans.geometry.setAttribute('aHair', new InstancedBufferAttribute(hair, 3));
  fans.geometry.setAttribute('aPants', new InstancedBufferAttribute(legs, 3));
  fans.instanceMatrix.needsUpdate = true;
  group.add(fans);
  return group;
}

function buildRig(): Group {
  const rig = new Group();
  const trussMat = new MeshStandardMaterial({ color: '#3a4152', roughness: 0.6, metalness: 0.4 });
  for (const x of [-5.2, 5.2]) {
    const beam = new Mesh(new BoxGeometry(0.34, 0.34, 34), trussMat);
    beam.position.set(x, 11.4, 0);
    rig.add(beam);
  }
  for (const z of [-5.2, 5.2]) {
    const beam = new Mesh(new BoxGeometry(34, 0.3, 0.3), trussMat);
    beam.position.set(0, 11.1, z);
    rig.add(beam);
  }

  // Lamp housings with a soft cone of visible light underneath.
  const housing = new MeshStandardMaterial({ color: '#1b2029', roughness: 0.5, metalness: 0.5 });
  const glow = new MeshBasicMaterial({
    color: '#fff3d6',
    transparent: true,
    opacity: 0.022,
    depthWrite: false,
  });
  for (const x of [-4.6, 4.6]) {
    for (const z of [-4.6, 4.6]) {
      const can = new Mesh(new CylinderGeometry(0.34, 0.46, 0.5, 14), housing);
      can.position.set(x, 10.9, z);
      rig.add(can);
      const lens = new Mesh(new SphereGeometry(0.3, 12, 8), new MeshBasicMaterial({ color: '#ffeec2' }));
      lens.position.set(x, 10.66, z);
      rig.add(lens);
      const cone = new Mesh(new ConeGeometry(3.4, 10.4, 20, 1, true), glow);
      cone.position.set(x * 0.52, 5.5, z * 0.52);
      cone.rotation.z = -Math.atan2(x * 0.48, 10.4) * 0.9;
      cone.rotation.x = Math.atan2(z * 0.48, 10.4) * 0.9;
      rig.add(cone);
    }
  }
  return rig;
}

export function createGym(host: School, visitor: School): Gym {
  const group = new Group();

  // Floor.
  const floor = new Mesh(
    new PlaneGeometry(90, 90),
    new MeshStandardMaterial({ map: woodTexture(), roughness: 0.52, metalness: 0.04 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Walls and ceiling: a dark shell so the mat reads as the brightest thing.
  const shell = new Mesh(
    new BoxGeometry(62, 15, 62),
    new MeshStandardMaterial({ color: '#0d121b', roughness: 1, side: DoubleSide }),
  );
  shell.position.y = 7.4;
  group.add(shell);

  const { risers, seats } = bleacherSeats();
  group.add(risers);
  group.add(buildCrowd(seats, [host, visitor]));
  group.add(buildRig());

  // Championship banners on two walls.
  const banners = new Group();
  const years = ['1987', '1994', '2003', '2011', '2019'];
  years.forEach((year, i) => {
    const tex = bannerTexture([host.nickname.toUpperCase(), 'CONFERENCE', year], host.primary, host.secondary);
    const banner = new Mesh(
      new PlaneGeometry(1.7, 2.6),
      new MeshStandardMaterial({ map: tex, roughness: 0.9, side: DoubleSide }),
    );
    banner.position.set(-12 + i * 6, 9.2, -30.4);
    banners.add(banner);
  });
  group.add(banners);

  // Scorer's table and team benches.
  const tableMat = new MeshStandardMaterial({ color: '#262d3a', roughness: 0.7 });
  const table = new Mesh(new BoxGeometry(5.4, 0.78, 0.9), tableMat);
  table.position.set(0, 0.39, MAT.halfSize + 1.7);
  table.castShadow = true;
  group.add(table);
  const skirt = new Mesh(
    new PlaneGeometry(5.4, 0.74),
    new MeshStandardMaterial({ color: host.primary, roughness: 0.85 }),
  );
  skirt.position.set(0, 0.38, MAT.halfSize + 1.24);
  group.add(skirt);

  for (const sx of [-1, 1]) {
    const bench = new Mesh(new BoxGeometry(3.2, 0.46, 0.5), tableMat);
    bench.position.set(sx * 5.4, 0.23, MAT.halfSize + 1.5);
    bench.rotation.y = sx * 0.3;
    group.add(bench);
  }

  // Padded corner markers so the mat does not float on bare floor.
  const padMat = new MeshStandardMaterial({ color: '#1a2230', roughness: 0.9 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pad = new Mesh(new BoxGeometry(2.4, 0.12, 2.4), padMat);
      pad.position.set(sx * (MAT.halfSize + 1.1), 0.06, sz * (MAT.halfSize + 1.1));
      pad.receiveShadow = true;
      group.add(pad);
    }
  }

  let energy = 0.12;
  return {
    group,
    update(dt) {
      SHARED_TIME.value += dt;
      energy += (0.12 - energy) * Math.min(1, dt * 0.55);
      CROWD_ENERGY.value = energy;
    },
    excite(amount) {
      energy = Math.min(1, energy + amount);
    },
  };
}

/** Broadcast lighting: bright pool on the mat, dark house. */
export function createLighting(scene: Scene): void {
  const hemi = new HemisphereLight('#9fb4d4', '#2a241c', 0.26);
  scene.add(hemi);

  const keyPositions: Array<[number, number, number, boolean]> = [
    [-4.6, 10.6, -4.6, true],
    [4.6, 10.6, 4.6, true],
    [4.6, 10.6, -4.6, false],
    [-4.6, 10.6, 4.6, false],
  ];

  for (const [x, y, z, shadows] of keyPositions) {
    const spot = new SpotLight('#fff4de', 72, 26, 0.62, 0.45, 1.7);
    spot.position.set(x, y, z);
    spot.target.position.set(x * 0.15, 0, z * 0.15);
    spot.castShadow = shadows;
    if (shadows) {
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.camera.near = 2;
      spot.shadow.camera.far = 24;
      spot.shadow.bias = -0.0012;
      spot.shadow.normalBias = 0.022;
      spot.shadow.radius = 2.5;
    }
    scene.add(spot);
    scene.add(spot.target);
  }

  // Cool rim light from the stands keeps silhouettes off the dark background.
  const rim = new PointLight('#6f8dd0', 16, 30, 2);
  rim.position.set(0, 6.5, -12);
  scene.add(rim);
  const rim2 = new PointLight('#d08a5a', 10, 26, 2);
  rim2.position.set(-11, 5, 8);
  scene.add(rim2);
}
