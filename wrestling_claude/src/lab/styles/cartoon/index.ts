import { NoToneMapping, PCFShadowMap, Scene, Vector3, Vector4 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { StyleBuild, ViewName } from '../shared';
import { createToonArena } from './arena';
import { DAKE, TAYLOR } from './athletes';
import type { Athlete } from './athletes';
import { generateToon } from './generate';
import { makeTie } from './tie';
import { LIGHT } from './toon';
import { ToonCharacter } from './ToonCharacter';

/**
 * "Stylized toon": cel-shaded comic-book athletes on the game's skeleton.
 * See athletes.ts for the two likenesses, anatomy.ts for the stylised body,
 * toon.ts for the shading and outlines, arena.ts for the set, tie.ts for the
 * collar-and-elbow tie the match views are solved into.
 *
 * Debug URL params: &tie=0 (plain harness stance), &gear=0|1 (force headgear),
 * &arms=<deg> (weigh-in arm spread), &ink=0 (hide outline and rim hulls),
 * &toonYaw=<deg> (orbit any view's camera), &q=low (coarser meshes).
 */

function build(a: Athlete, band: string): { ch: ToonCharacter; ms: number; tris: number; parts: number[] } {
  const q = new URLSearchParams(location.search).get('q') === 'low' ? 'low' : 'high';
  const geo = generateToon(a.shape, q);
  const ch = new ToonCharacter(geo, {
    ...a.look,
    band,
    scale: a.shape.scale,
    headScale: a.shape.head,
    chestW: a.shape.chestW,
    noseLen: a.shape.face.noseLen,
    noseW: a.shape.face.noseW,
    cupX: 0.097 * a.shape.face.skullW,
    hairUp: a.shape.face.hairline,
    chinDrop: a.shape.face.chinDrop,
    chinFwd: a.shape.face.chinFwd,
    jawW: a.shape.face.jawW,
    headShift: a.shape.headShift,
  });
  return { ch, ms: geo.ms, tris: geo.tris, parts: geo.parts };
}

const _right = new Vector3();
const _up = new Vector3();
const _back = new Vector3();
const _vp = new Vector4();

/** Broadcast key from camera-left and above, cool rim from behind the athletes. */
function lightFor(camera: PerspectiveCamera, view: ViewName): void {
  camera.updateMatrixWorld();
  const e = camera.matrixWorld.elements;
  _right.set(e[0], e[1], e[2]);
  _up.set(0, 1, 0);
  _back.set(e[8], e[9], e[10]); // toward the camera
  const face = view === 'faceA' || view === 'faceB';
  LIGHT.uKeyDir.value
    .copy(_right)
    .multiplyScalar(face ? -0.8 : -0.85)
    .addScaledVector(_up, face ? 0.55 : 0.62)
    .addScaledVector(_back, face ? 0.42 : 0.38)
    .normalize();
  LIGHT.uRimDir.value.copy(_right).multiplyScalar(0.55).addScaledVector(_up, 0.35).addScaledVector(_back, -0.75).normalize();
}

const styleBuild: StyleBuild = (renderer) => {
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  createToonArena(scene, { name: DAKE.school, color: DAKE.look.primary }, { name: TAYLOR.school, color: '#1E407C' });

  const A = build(DAKE, '#d8262a');
  const B = build(TAYLOR, '#1f9d4a');
  scene.add(A.ch.root, B.ch.root);
  console.info(`[cartoon] Dake ${A.ms.toFixed(0)} ms, ${A.tris} tris; Taylor ${B.ms.toFixed(0)} ms, ${B.tris} tris`);
  (window as unknown as { toonStats: unknown }).toonStats = { dake: { ms: A.ms, tris: A.tris, parts: A.parts }, taylor: { ms: B.ms, tris: B.tris, parts: B.parts } };

  // Match views show a collar-and-elbow tie, solved by the game's Solver (&tie=0 for the plain stance).
  const params = new URLSearchParams(location.search);
  const tie = makeTie({ root: A.ch.root, bones: A.ch.bones, scale: A.ch.scale }, { root: B.ch.root, bones: B.ch.bones, scale: B.ch.scale });
  const useTie = params.get('tie') !== '0' && (params.get('pose') ?? 'stance') === 'stance';

  return {
    title: 'Stylized toon',
    blurb: 'cel-shaded comic-book athletes: two-tone light, painted faces, ink outlines, graphic arena',
    scene,
    A: { root: A.ch.root, bones: A.ch.bones, scale: A.ch.scale },
    B: { root: B.ch.root, bones: B.ch.bones, scale: B.ch.scale },
    labelA: DAKE.label,
    labelB: TAYLOR.label,
    sheetColor: '#0c0916',
    onView: (view, camera) => {
      // Debug: &toonYaw=<deg> orbits any view's camera about the mat centre (checks backs and sides).
      const yaw = Number(new URLSearchParams(location.search).get('toonYaw') ?? 0);
      if (yaw) {
        const look = new Vector3(0, 0.9, 0);
        camera.position.sub(look).applyAxisAngle(new Vector3(0, 1, 0), (yaw * Math.PI) / 180).add(look);
        camera.lookAt(look);
      }
      if (useTie && (view === 'hero' || view === 'game')) tie();
      if (view === 'faceA' || view === 'faceB' || view === 'tapeFront' || view === 'tapeSide') {
        // Weigh-in stand: the arms hang off the lats a little wider than the
        // harness's relaxed 9 degrees, the way a heavily muscled athlete stands.
        const deg = Number(params.get('arms') ?? 15);
        for (const r of [A.ch, B.ch]) {
          r.bones.armL.rotation.z = (deg * Math.PI) / 180;
          r.bones.armR.rotation.z = (-deg * Math.PI) / 180;
          r.root.updateMatrixWorld(true);
        }
      }
      lightFor(camera, view);
      // Portraits and the tale of the tape are bare-headed (headgear in hand at
      // the weigh-in), so hair and hairline carry the likeness; match views wear it.
      const bare = view === 'faceA' || view === 'faceB' || view === 'tapeFront' || view === 'tapeSide';
      const gearParam = new URLSearchParams(location.search).get('gear');
      const show = gearParam === '1' ? true : gearParam === '0' ? false : !bare;
      for (const m of [...A.ch.gear, ...B.ch.gear]) m.visible = show;
      // Debug: &ink=0 hides the outline and rim hulls.
      if (params.get('ink') === '0') {
        scene.traverse((o) => {
          const mat = (o as { material?: { uniforms?: Record<string, unknown> } }).material;
          if (mat?.uniforms && 'uRim' in mat.uniforms) o.visible = false;
        });
      }
    },
    render: (r, camera) => {
      r.getCurrentViewport(_vp);
      const h = Math.max(1, _vp.w);
      LIGHT.uPx.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / h;
      LIGHT.uLinePx.value = Math.min(3.6, Math.max(1.25, h * 0.0034));
      LIGHT.uDotPx.value = Math.min(6.5, Math.max(2.6, h * 0.006));
      r.render(scene, camera);
    },
  };
};

export default styleBuild;
