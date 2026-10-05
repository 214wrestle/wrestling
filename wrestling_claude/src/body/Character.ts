import type { AppearanceShape, WrestlingStyle } from '../sim/athleteProfiles';
import { DEFAULT_MOTION } from '../sim/athleteProfiles';
import {
  Bone,
  CanvasTexture,
  Euler,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { BIND_POSE, BONES } from './skeleton';
import type { BoneName } from './skeleton';
import { createBodyMaterial } from './material';
import type { BodyLook, BodyMaterial } from './material';
import type { BodyBuffers } from './factory';

/**
 * A finished athlete: skinned body and head meshes on one skeleton, headgear and
 * eyes riding on the head bone. The bones start in the rest pose; the animation
 * solver writes their rotations (and the hips' position) every frame.
 */

export interface CharacterOptions {
  look: BodyLook;
  shape?: AppearanceShape;
  motion?: WrestlingStyle;
  /** Headgear colours, or null for the official. */
  gear: { shell: string; strap: string } | null;
}

const DEG = Math.PI / 180;

function eyeTexture(iris: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9e4dc';
  g.fillRect(0, 0, 256, 128);
  // Front of the sphere is u = 0.25, v = 0.5.
  const cx = 64;
  const cy = 64;
  const grad = g.createRadialGradient(cx, cy, 2, cx, cy, 19);
  grad.addColorStop(0, '#0a0a0a');
  grad.addColorStop(0.32, '#0a0a0a');
  grad.addColorStop(0.36, iris);
  grad.addColorStop(0.9, iris);
  grad.addColorStop(1, '#1a1410');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy, 19, 19, 0, 0, Math.PI * 2);
  g.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export class Character {
  readonly root = new Group();
  readonly motion: WrestlingStyle;
  readonly bones = {} as Record<BoneName, Bone>;
  readonly boneList: Bone[] = [];
  readonly material: BodyMaterial;
  readonly scale: number;
  private meshes: Array<Mesh | SkinnedMesh> = [];
  private extraMaterials: Array<MeshStandardMaterial | MeshPhysicalMaterial> = [];
  readonly eyes: Mesh[] = [];

  constructor(buffers: BodyBuffers, opts: CharacterOptions) {
    this.motion = opts.motion ?? DEFAULT_MOTION;
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

    // Bind in the A-pose the mesh was generated in.
    for (const def of BONES) {
      const e = BIND_POSE[def.name];
      if (e) this.bones[def.name].quaternion.setFromEuler(new Euler(e[0] * DEG, e[1] * DEG, e[2] * DEG, 'XYZ'));
    }
    this.root.updateMatrixWorld(true);
    const skeleton = new Skeleton(this.boneList);

    this.material = createBodyMaterial(opts.look);
    for (const geo of [buffers.body, buffers.head, ...buffers.hands]) {
      const mesh = new SkinnedMesh(geo, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      mesh.updateMatrixWorld(true);
      mesh.bind(skeleton);
      this.meshes.push(mesh);
    }

    // Back to rest: identity rotations everywhere.
    for (const b of this.boneList) b.quaternion.identity();
    this.root.updateMatrixWorld(true);

    if (buffers.headgear && opts.gear) {
      const gearMat = new MeshPhysicalMaterial({
        color: opts.gear.shell,
        roughness: 0.38,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
      });
      this.extraMaterials.push(gearMat);
      const gear = new Mesh(buffers.headgear, gearMat);
      gear.castShadow = true;
      gear.receiveShadow = true;
      gear.scale.set(opts.shape?.faceWidth ?? 1, opts.shape?.faceLength ?? 1, 1);
      this.bones.head.add(gear);
      this.meshes.push(gear);
    }

    const eyeMat = new MeshPhysicalMaterial({
      map: eyeTexture(opts.look.eye),
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    this.extraMaterials.push(eyeMat);
    const eyeGeo = new SphereGeometry(0.0118 * s, 20, 14);
    for (const side of [1, -1]) {
      const eye = new Mesh(eyeGeo, eyeMat);
      eye.position.set(0.032 * side * s * (opts.shape?.faceWidth ?? 1), (1.664 - 1.575) * s, (0.0875 + 0.005) * s);
      this.bones.head.add(eye);
      this.eyes.push(eye);
    }
  }

  /** Exertion drives sweat sheen and facial flush. */
  setExertion(sweat: number, flush: number): void {
    const u = this.material.userData.uniforms;
    u.uSweat.value = sweat;
    u.uFlush.value = flush;
  }

  setBandColor(hex: string): void {
    (this.material.userData.uniforms.uBand.value as { set: (c: string) => void }).set(hex);
  }

  dispose(): void {
    // Geometry is cached and shared between characters, so only materials go.
    this.material.dispose();
    for (const m of this.extraMaterials) m.dispose();
    this.root.removeFromParent();
  }
}
