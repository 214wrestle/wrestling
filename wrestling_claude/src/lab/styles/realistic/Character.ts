import {
  Bone,
  CanvasTexture,
  Color,
  Euler,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  SRGBColorSpace,
  Quaternion,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { BIND_POSE, BONES } from '../../../body/skeleton';
import type { BoneName } from '../../../body/skeleton';
import { createRealBodyMaterial } from './material';
import type { RealBodyMaterial, RealLook } from './material';
import { toGeometry } from './generate';
import type { RealGeometry } from './generate';
import { createHairShell } from './hair';
import { EYE_Z, HEAD_PIVOT } from './anatomy';
import { HEAD_ORIGIN } from './headgear';

/**
 * A realism-style athlete on the shared 21-bone skeleton: skinned body, head and
 * hands; eyes, hair shell and headgear riding the head bone. Same contract as
 * src/body/Character.ts, so the game's Solver drives it unchanged.
 */

export interface RealCharacterOptions {
  look: RealLook;
  eye: string;
  gear: { shell: string; strap: string };
  /** Hair length for the shell, metres (0 = painted only). */
  hairLen: number;
  /** Comb direction for the shell. */
  hairFlow: [number, number, number];
  /** Rest-space pupil height of the canonical face. */
  pupilY: number;
  /** Head size multiplier about HEAD_PIVOT. */
  headScale: number;
}

const DEG = Math.PI / 180;
const _eyeC = new Vector3();
const _eyeD = new Vector3();
const _q = new Quaternion();

/** Iris with radial fibres, a dark limbal ring, a soft pupil, and a lid shadow. */
function eyeTexture(iris: string): CanvasTexture {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // Sclera: warm off-white, pinker toward the corners.
  const scl = g.createLinearGradient(0, 0, W, 0);
  scl.addColorStop(0, '#c9b2aa');
  scl.addColorStop(0.1, '#e6ddd6');
  scl.addColorStop(0.25, '#eee8e2');
  scl.addColorStop(0.4, '#e6ddd6');
  scl.addColorStop(0.5, '#c9b2aa');
  scl.addColorStop(1, '#c9b2aa');
  g.fillStyle = scl;
  g.fillRect(0, 0, W, H);
  // Front of the sphere is u = 0.25, v = 0.5.
  const cx = W * 0.25;
  const cy = H * 0.5;
  const R = 46;
  const base = new Color(iris);
  const dark = base.clone().multiplyScalar(0.45).getStyle();
  const light = base.clone().lerp(new Color('#d8c49a'), 0.35).getStyle();
  const grad = g.createRadialGradient(cx, cy, 4, cx, cy, R);
  grad.addColorStop(0, '#050505');
  grad.addColorStop(0.3, '#060606');
  grad.addColorStop(0.36, light);
  grad.addColorStop(0.6, base.getStyle());
  grad.addColorStop(0.88, dark);
  grad.addColorStop(1, 'rgba(20,16,14,0.9)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  // Radial fibres.
  g.save();
  g.translate(cx, cy);
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + Math.random() * 0.03;
    const r0 = R * (0.36 + Math.random() * 0.05);
    const r1 = R * (0.75 + Math.random() * 0.2);
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,240,210,0.13)' : 'rgba(0,0,0,0.16)';
    g.lineWidth = 0.8 + Math.random();
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  g.restore();
  // Upper-lid shadow across the top of the eye.
  const lid = g.createLinearGradient(0, 0, 0, H);
  lid.addColorStop(0, 'rgba(40,20,15,0.6)');
  lid.addColorStop(0.3, 'rgba(40,20,15,0.25)');
  lid.addColorStop(0.4, 'rgba(40,20,15,0.0)');
  lid.addColorStop(1, 'rgba(40,20,15,0.0)');
  g.fillStyle = lid;
  g.fillRect(0, 0, W, H);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function gearMaterial(shell: string, strap: string): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.45,
    clearcoat: 0.7,
    clearcoatRoughness: 0.22,
  });
  const uShell = { value: new Color(shell) };
  const uStrap = { value: new Color(strap) };
  m.onBeforeCompile = (s) => {
    s.uniforms.uShell = uShell;
    s.uniforms.uStrap = uStrap;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart;\nflat varying float vGPart;\nvarying vec3 vGP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGPart = aPart;\nvGP = position;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uShell;\nuniform vec3 uStrap;\nflat varying float vGPart;\nvarying vec3 vGP;\nfloat gRough = 0.45;\nfloat gCoat = 0.7;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float gp = floor(vGPart + 0.5);
        if (gp < 0.5) { diffuseColor.rgb = uShell; gRough = 0.42; gCoat = 0.6; }
        else if (gp < 1.5) {
          float weave = step(0.5, fract(vGP.x * 900.0 + vGP.y * 900.0)) * 0.08;
          diffuseColor.rgb = uStrap * (0.92 + weave); gRough = 0.8; gCoat = 0.0;
        } else { diffuseColor.rgb = vec3(0.035); gRough = 0.85; gCoat = 0.0; }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRough;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat = gCoat;');
  };
  m.customProgramCacheKey = () => 'real-gear';
  return m;
}

export class RealCharacter {
  readonly root = new Group();
  readonly bones = {} as Record<BoneName, Bone>;
  readonly boneList: Bone[] = [];
  readonly material: RealBodyMaterial;
  readonly scale: number;
  readonly eyes: Mesh[] = [];
  headgear: Mesh | null = null;
  hair: Mesh | null = null;
  private materials: Material[] = [];
  private hairLen = 0;
  private geometries: BufferGeometry[] = [];

  constructor(geo: RealGeometry, opts: RealCharacterOptions) {
    this.scale = opts.look.scale;
    const s = this.scale;

    for (const def of BONES) {
      const b = new Bone();
      b.name = def.name;
      b.position.set(def.offset[0] * s, def.offset[1] * s, def.offset[2] * s);
      this.bones[def.name] = b;
      this.boneList.push(b);
    }
    for (const def of BONES) {
      if (def.parent) this.bones[def.parent].add(this.bones[def.name]);
      else this.root.add(this.bones[def.name]);
    }

    for (const def of BONES) {
      const e = BIND_POSE[def.name];
      if (e) this.bones[def.name].quaternion.setFromEuler(new Euler(e[0] * DEG, e[1] * DEG, e[2] * DEG, 'XYZ'));
    }
    this.root.updateMatrixWorld(true);
    const skeleton = new Skeleton(this.boneList);

    this.material = createRealBodyMaterial(opts.look);
    // The body mesh overlaps the finer head and hand meshes by a few
    // millimetres at the seams; pushing it back in depth lets the fine mesh win
    // there instead of z-fighting into a serrated line.
    const bodyMat = createRealBodyMaterial(opts.look, this.material);
    bodyMat.polygonOffset = true;
    bodyMat.polygonOffsetFactor = 1;
    bodyMat.polygonOffsetUnits = 2;
    this.materials.push(this.material, bodyMat);
    // The head mesh in turn sits under the finer face patch.
    const headMat = geo.face ? createRealBodyMaterial(opts.look, this.material) : this.material;
    if (geo.face) {
      headMat.polygonOffset = true;
      headMat.polygonOffsetFactor = 0.5;
      headMat.polygonOffsetUnits = 1;
      this.materials.push(headMat);
    }
    for (const m of [geo.body, geo.head, ...(geo.face ? [geo.face] : []), ...geo.hands]) {
      const g = toGeometry(m);
      this.geometries.push(g);
      const mesh = new SkinnedMesh(g, m === geo.body ? bodyMat : m === geo.head ? headMat : this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      mesh.updateMatrixWorld(true);
      mesh.bind(skeleton);
    }

    for (const b of this.boneList) b.quaternion.identity();
    this.root.updateMatrixWorld(true);

    if (geo.headgear) {
      const gm = gearMaterial(opts.gear.shell, opts.gear.strap);
      this.materials.push(gm);
      const g = toGeometry(geo.headgear);
      this.geometries.push(g);
      const gear = new Mesh(g, gm);
      gear.castShadow = true;
      gear.receiveShadow = true;
      this.bones.head.add(gear);
      this.headgear = gear;
    }

    if (opts.hairLen > 0 && geo.scalp && geo.scalpLen) {
      const hair = createHairShell(geo.scalp, geo.scalpLen, {
        color: opts.look.hair,
        length: opts.hairLen * s,
        flow: opts.hairFlow,
        scale: s,
      });
      this.materials.push(hair.material as Material);
      this.geometries.push(hair.geometry);
      this.bones.head.add(hair);
      this.hair = hair;
      this.hairLen = opts.hairLen * s;
    }

    const eyeMat = new MeshPhysicalMaterial({
      map: eyeTexture(opts.eye),
      color: '#cbc4be',
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      ior: 1.376,
    });
    this.materials.push(eyeMat);
    const hs = opts.headScale;
    const eyeGeo = new SphereGeometry(0.0119 * s * hs, 32, 20);
    this.geometries.push(eyeGeo);
    for (const side of [1, -1]) {
      const eye = new Mesh(eyeGeo, eyeMat);
      // The brow and lids shade the eyes: without this they glow under top light.
      eye.receiveShadow = true;
      const P = HEAD_PIVOT;
      const ex = P[0] + (0.032 * side - P[0]) * hs;
      const ey = P[1] + (opts.pupilY - P[1]) * hs;
      const ez = P[2] + (EYE_Z - P[2]) * hs;
      eye.position.set((ex - HEAD_ORIGIN[0]) * s, (ey - HEAD_ORIGIN[1]) * s, (ez - HEAD_ORIGIN[2]) * s);
      // Eyes converge slightly and sit a touch down-gazing for a natural look.
      eye.rotation.set(2 * DEG, -side * 2.5 * DEG, 0);
      this.bones.head.add(eye);
      this.eyes.push(eye);
    }
  }

  /**
   * Point both eyes at a world position (the camera for a portrait, the
   * opponent in the stance), each from its own centre so they converge; the
   * turn is limited to what real eyes do (about 25 degrees).
   */
  setGaze(target: Vector3): void {
    this.root.updateMatrixWorld(true);
    for (const eye of this.eyes) {
      eye.rotation.set(0, 0, 0);
      eye.updateMatrixWorld(true);
      const c = eye.getWorldPosition(_eyeC);
      const parent = eye.parent!;
      _q.copy(parent.getWorldQuaternion(_q)).invert();
      const d = _eyeD.copy(target).sub(c).applyQuaternion(_q).normalize();
      // Rest gaze is +z in head space.
      const yaw = Math.max(-0.45, Math.min(0.45, Math.atan2(d.x, d.z)));
      const pitch = Math.max(-0.35, Math.min(0.3, Math.asin(Math.max(-1, Math.min(1, d.y)))));
      eye.rotation.set(-pitch, yaw, 0, 'YXZ');
    }
  }

  setExertion(sweat: number, flush: number): void {
    const u = this.material.userData.uniforms;
    u.uSweat.value = sweat;
    u.uFlush.value = flush;
  }

  /** Show or hide the headgear (portrait shots go without). */
  setHeadgear(on: boolean): void {
    if (this.headgear) this.headgear.visible = on;
    // Hair flattens under the straps.
    if (this.hair) this.hair.scale.setScalar(on ? 0.985 : 1);
    const u = (this.hair?.material as { userData?: { uLen?: { value: number } } } | undefined)?.userData?.uLen;
    if (u) u.value = this.hairLen * (on ? 0.45 : 1);
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    for (const g of this.geometries) g.dispose();
    this.root.removeFromParent();
  }
}
