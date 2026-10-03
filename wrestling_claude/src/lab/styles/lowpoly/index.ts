import {
  ACESFilmicToneMapping,
  Bone,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PCFSoftShadowMap,
  Scene,
  Skeleton,
  SkinnedMesh,
  Vector4,
} from 'three';
import { BONES } from '../../../body/skeleton';
import type { BoneName } from '../../../body/skeleton';
import type { Rig, StyleBuild } from '../shared';
import { DAKE, TAYLOR } from './athletes';
import type { Athlete } from './athletes';
import { buildBody } from './body';
import { createLowPolyMaterial, createOutlineMaterial } from './material';
import { createArena, PALETTE } from './arena';

/**
 * Low-poly sculpt: hand-designed faceted athletes (about 3.8k triangles, one body
 * draw plus one outline draw each) on the game's own skeleton, in a matching
 * faceted arena.
 */

function athlete(a: Athlete): Rig & { triangles: number; ms: number } {
  const scale = a.height / 1.76;
  const root = new Group();
  const bones = {} as Record<BoneName, Bone>;
  const list: Bone[] = [];
  for (const def of BONES) {
    const b = new Bone();
    b.name = def.name;
    b.position.set(def.offset[0] * scale, def.offset[1] * scale, def.offset[2] * scale);
    bones[def.name] = b;
    list.push(b);
  }
  for (const def of BONES) {
    if (def.parent) bones[def.parent].add(bones[def.name]);
    else root.add(bones[def.name]);
  }
  root.updateMatrixWorld(true);
  const built = buildBody(a);
  const mesh = new SkinnedMesh(built.geometry, createLowPolyMaterial(a));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
  mesh.updateMatrixWorld(true);
  // Bound in the rest pose: the mesh is authored with limbs hanging.
  const skeleton = new Skeleton(list);
  mesh.bind(skeleton);
  // Ink outline: the same geometry and skeleton, back faces pushed out in screen space.
  const ol = Number(new URLSearchParams(location.search).get('outline') ?? 1.4);
  if (ol > 0) {
    const olMat = createOutlineMaterial('#1a1222', ol);
    const outline = new SkinnedMesh(built.geometry, olMat);
    const vp = new Vector4();
    // The outline width is in device pixels, so it needs this draw's viewport height.
    outline.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(vp);
      olMat.userData.uViewH.value = vp.w;
    };
    outline.frustumCulled = false;
    root.add(outline);
    outline.updateMatrixWorld(true);
    outline.bind(skeleton, mesh.bindMatrix);
  }
  return { root, bones, scale, triangles: built.triangles, ms: built.ms };
}

const build: StyleBuild = (renderer) => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new Scene();
  scene.background = new Color(PALETTE.sky);
  scene.fog = new Fog('#2c2542', 8, 26);
  scene.add(createArena());

  // Soft gradient light: warm sky, cool bounce, a warm key, a cool rim.
  scene.add(new HemisphereLight('#ffe8d2', '#6b5a62', 1.15));
  const key = new DirectionalLight('#fff0dc', 2.2);
  key.position.set(3.5, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  // Cast shadows are one poster step, not a black hole.
  key.shadow.intensity = 0.55;
  scene.add(key);
  const fill = new DirectionalLight('#9db4ff', 0.7);
  fill.position.set(-5, 3, 3);
  scene.add(fill);
  // Warm bounce off the mat, so undersides (nose, jaw, arms) stay readable.
  const bounce = new DirectionalLight('#ffd9b8', 0.45);
  bounce.position.set(0.5, -2, 4);
  scene.add(bounce);
  const rim = new DirectionalLight('#ffc89a', 1.6);
  rim.position.set(-1, 4.5, -6);
  scene.add(rim);

  const A = athlete(DAKE);
  const B = athlete(TAYLOR);
  scene.add(A.root, B.root);
  let meshes = 0;
  scene.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes++;
  });
  console.info(
    `[lowpoly] ${DAKE.name}: ${A.triangles} tris in ${A.ms.toFixed(1)} ms; ${TAYLOR.name}: ${B.triangles} tris in ${B.ms.toFixed(1)} ms; ${meshes} meshes in scene`,
  );

  return {
    title: 'Low-poly sculpt',
    blurb: 'hand-cut faceted athletes, poster-banded light with facet accents and ink outlines, ~3.5k triangles each',
    scene,
    A,
    B,
    labelA: DAKE.label,
    labelB: TAYLOR.label,
    sheetColor: '#0e1020',
    // Dev aid: &lpcam=ex,ey,ez,tx,ty,tz overrides the camera for close inspection.
    onView: (_view, camera) => {
      const v = new URLSearchParams(location.search).get('lpcam');
      if (!v) return;
      const n = v.split(',').map(Number);
      camera.position.set(n[0], n[1], n[2]);
      camera.lookAt(n[3], n[4], n[5]);
      if (n[6]) {
        camera.fov = n[6];
        camera.updateProjectionMatrix();
      }
    },
  };
};

export default build;
