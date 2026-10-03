import { Bone, Euler, Group, Mesh, Skeleton, SkinnedMesh } from 'three';
import { BIND_POSE, BONES } from '../../../body/skeleton';
import type { BoneName } from '../../../body/skeleton';
import type { ToonGeometry } from './generate';
import { createOutlineMaterial, createToonMaterial } from './toon';
import type { ToonLook } from './toon';

/**
 * A toon athlete on the shared 21-bone skeleton. Same bind procedure as
 * src/body/Character.ts (A-pose bind, then back to identity rest), so the game's
 * Solver drives it by bone name. Every skinned piece gets an outline twin that
 * shares its geometry and skeleton, so the ink follows the skinning exactly.
 */

const DEG = Math.PI / 180;

export class ToonCharacter {
  readonly root = new Group();
  readonly bones = {} as Record<BoneName, Bone>;
  readonly scale: number;
  /** Headgear meshes (shell and ink), so a view can show the athlete bare-headed. */
  readonly gear: Mesh[] = [];

  constructor(geo: ToonGeometry, look: ToonLook) {
    this.scale = look.scale;
    const s = this.scale;
    const list: Bone[] = [];
    for (const def of BONES) {
      const b = new Bone();
      b.name = def.name;
      b.position.set(def.offset[0] * s, def.offset[1] * s, def.offset[2] * s);
      this.bones[def.name] = b;
      list.push(b);
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
    const skeleton = new Skeleton(list);

    const mat = createToonMaterial(look);
    const ink = createOutlineMaterial();
    const rim = createOutlineMaterial(undefined, 1, true);
    for (const g of [geo.body, geo.head, ...geo.hands]) {
      const mesh = new SkinnedMesh(g, mat);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const hull = new SkinnedMesh(g, ink);
      hull.frustumCulled = false;
      const rimHull = new SkinnedMesh(g, rim);
      rimHull.frustumCulled = false;
      this.root.add(mesh, hull, rimHull);
      for (const m of [mesh, hull, rimHull]) {
        m.updateMatrixWorld(true);
        m.bind(skeleton);
      }
    }
    for (const b of list) b.quaternion.identity();
    this.root.updateMatrixWorld(true);

    const gearMat = createToonMaterial(look, true);
    const gear = new Mesh(geo.headgear, gearMat);
    gear.castShadow = true;
    const gearInk = new Mesh(geo.headgear, createOutlineMaterial('#120c16', 0.85));
    const gearRim = new Mesh(geo.headgear, createOutlineMaterial(undefined, 0.85, true));
    this.bones.head.add(gear, gearInk, gearRim);
    this.gear.push(gear, gearInk, gearRim);
  }
}
