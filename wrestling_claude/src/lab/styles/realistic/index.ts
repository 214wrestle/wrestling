import { ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, Vector4 } from 'three';
import { Lens } from './post';
import type { School } from '../../../sim/types';
import type { StyleBuild, ViewName } from '../shared';
import { generateBody } from './generate';
import type { BodyParams } from './anatomy';
import { RealCharacter } from './Character';
import { buildArena } from './arena';
import { ATHLETES } from './athletes';
import type { Athlete } from './athletes';

/**
 * "Broadcast realism": grounded anatomy for two real 165 lb college wrestlers,
 * skin that scatters light, lycra, real headgear and shoes, in a championship
 * final lit like television.
 */

function school(a: Athlete): School {
  return {
    id: a.id,
    name: a.school,
    mark: a.wordmark,
    nickname: a.school,
    primary: a.primary,
    secondary: a.secondary,
    accent: a.piping,
    gear: a.gearShell,
    pattern: 'panel',
    arena: 'Wells Fargo Arena',
  };
}

function build(a: Athlete, band: string): RealCharacter {
  const scale = a.height / 1.76;
  const params: BodyParams = { scale, mass: a.mass, hair: a.hair, hairFront: a.hairFront, face: a.face, frame: a.frame };
  const geo = generateBody(params, 'high', true, a.hairSides);
  console.info(`[realistic] ${a.name}: ${geo.ms.toFixed(0)} ms, ${geo.tris} tris`, JSON.stringify(Object.fromEntries(Object.entries(geo.stages).map(([k, v]) => [k, Math.round(v)]))));
  (window as unknown as Record<string, unknown>)[`realStats_${a.id}`] = { ms: geo.ms, tris: geo.tris };
  return new RealCharacter(geo, {
    look: {
      skin: a.skin,
      hair: a.hairColor,
      primary: a.primary,
      secondary: a.secondary,
      piping: a.piping,
      wordmark: a.wordmark,
      band,
      shoe: a.shoe,
      shoeAccent: a.shoeAccent,
      scale,
      faceLen: a.face.faceLen,
      stubble: a.stubble,
      sides: a.hairSides,
      brow: a.brow,
      hairFront: a.hairFront,
      smile: a.smile,
      headScale: a.frame.head,
      eyeOpen: a.face.eyeOpen ?? 1,
      nose: a.face.nose,
    },
    eye: a.eye,
    gear: { shell: a.gearShell, strap: a.gearStrap },
    hairLen: new URLSearchParams(location.search).get('hair') === '0' ? 0 : a.hairLen,
    hairFlow: a.hairFlow,
    pupilY: 1.649,
    headScale: a.frame.head,
  });
}

const PORTRAIT_VIEWS: ViewName[] = ['faceA', 'faceB', 'tapeFront', 'tapeSide'];

const styleBuild: StyleBuild = (renderer) => {
  renderer.shadowMap.enabled = new URLSearchParams(location.search).get('shadow') !== '0';
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = Number(new URLSearchParams(location.search).get('exp') ?? 0.62);

  const [da, db] = ATHLETES;
  const scene = new Scene();
  const rig = buildArena(scene, renderer, [school(da), school(db)]);
  const A = build(da, '#c8261f');
  const B = build(db, '#1f9d4a');
  scene.add(A.root, B.root);

  const _f = new Vector3();
  const _r = new Vector3();
  const _u = new Vector3();
  const params = new URLSearchParams(location.search);
  const dbg = params.get('rdbg');
  const lensOn = params.get('dof') !== '0';
  const lens = new Lens();

  /** Camera-relative portrait key, fill and rim for a head. */
  const placePortrait = (camera: PerspectiveCamera, who: RealCharacter, ks: number) => {
    const target = who.bones.head.getWorldPosition(new Vector3());
    target.y += 0.07 * who.scale;
    camera.getWorldDirection(_f);
    _r.crossVectors(_f, camera.up).normalize();
    _u.crossVectors(_r, _f).normalize();
    // Soft key from the camera side, 35 degrees up and off-axis: nose and chin
    // shadows fall short, so there is no moustache or goatee. Broad fill from
    // the other side at roughly half the key, rim from behind.
    // Key on the camera's side of the face (broad light), high and soft.
    const kf = Number(params.get('pkf') ?? -1);
    rig.key.position
      .copy(target)
      .addScaledVector(_f, -1.6)
      .addScaledVector(_r, Number(params.get('pr') ?? 0.8) * ks * kf)
      .addScaledVector(_u, Number(params.get('pu') ?? 1.2));
    rig.key.target.position.copy(target);
    rig.fill.position.copy(target).addScaledVector(_f, -2).addScaledVector(_r, -1.5 * ks).addScaledVector(_u, 0.25);
    rig.fill.target.position.copy(target);
    rig.rim.position.copy(target).addScaledVector(_f, 2).addScaledVector(_r, 1.3 * ks).addScaledVector(_u, 0.9);
    rig.rim.target.position.copy(target);
    rig.portrait.updateMatrixWorld(true);
  };

  /** Debug sculpting grid (&rdbg=grid on the faceA view): front, 3/4 and side of both heads. */
  const gridCam = new PerspectiveCamera(24, 1, 0.03, 120);
  const vp = new Vector4();
  const drawGrid = (renderer: Parameters<StyleBuildRender>[0]) => {
    renderer.getViewport(vp);
    const dirs = [new Vector3(0, 0.02, 1), new Vector3(0.62, 0.08, 0.78), new Vector3(1, 0.02, 0)];
    const rd = Number(params.get('rd') ?? 0.75);
    const cw = vp.z / 3;
    const ch = vp.w / 2;
    [A, B].forEach((who, row) => {
      dirs.forEach((d, col) => {
        const h = who.bones.head.getWorldPosition(new Vector3());
        const look = h.clone().add(new Vector3(0, 0.055 * who.scale, 0.02));
        gridCam.position.copy(look).addScaledVector(d.clone().normalize(), rd);
        gridCam.aspect = cw / ch;
        gridCam.updateProjectionMatrix();
        gridCam.lookAt(look);
        gridCam.updateMatrixWorld();
        placePortrait(gridCam, who, row === 0 ? -1 : 1);
        const x = vp.x + col * cw;
        const y = vp.y + (1 - row) * ch;
        renderer.setViewport(x, y, cw, ch);
        renderer.setScissor(x, y, cw, ch);
        renderer.render(scene, gridCam);
      });
    });
  };

  return {
    title: 'Broadcast realism',
    blurb: 'grounded anatomy, scattering skin and lycra under championship TV lights',
    scene,
    A,
    B,
    labelA: `${da.name} · ${da.school}`,
    labelB: `${db.name} · ${db.school}`,
    sheetColor: '#0b0c10',
    render: (renderer, camera, view) => {
      if (dbg === 'grid' && view === 'faceA') {
        drawGrid(renderer);
        return;
      }
      if (lensOn) lens.render(renderer, scene, camera);
      else renderer.render(scene, camera);
    },
    onView: (view, camera) => {
      // Debug close-ups for sculpting: &rdbg=front|side|q|body (on faceA/faceB views).
      if (dbg && dbg !== 'grid' && (view === 'faceA' || view === 'faceB')) {
        const who = view === 'faceA' ? A : B;
        const h = who.bones.head.getWorldPosition(new Vector3());
        const look = h.clone().add(new Vector3(0, 0.06 + Number(params.get('ly') ?? 0), 0.03));
        const cdir = params.get('cdir')?.split(',').map(Number);
        const dir = cdir
          ? new Vector3(cdir[0], cdir[1], cdir[2])
          : dbg === 'side' || dbg === 'bodyside'
            ? new Vector3(1, 0, 0)
            : dbg === 'q' || dbg === 'bodyq'
              ? new Vector3(0.7, 0.05, 0.7)
              : dbg === 'bodyback'
                ? new Vector3(0, 0.02, -1)
                : new Vector3(0, 0.02, 1);
        const body = dbg.startsWith('body');
        if (body) look.set(h.x + Number(params.get('lx') ?? 0), 1.0 + Number(params.get('ly') ?? 0), h.z + Number(params.get('lz') ?? 0));
        const rd = Number(params.get('rd') ?? 0.62);
        if (rd < 0.5) look.add(new Vector3(0, 0.0, 0.05));
        camera.position.copy(look).addScaledVector(dir.normalize(), body ? Number(params.get('bd') ?? 3.2) : rd);
        camera.fov = body ? 38 : 30;
        camera.updateProjectionMatrix();
        camera.lookAt(look);
      }
      // Eyes: at the lens for portraits and the tale of the tape, at the
      // opponent's eyes in the stance.
      const eyesOf = (r: RealCharacter) => r.bones.head.localToWorld(new Vector3(0, 0.074 * r.scale, 0.09 * r.scale));
      if (PORTRAIT_VIEWS.includes(view)) {
        A.setGaze(camera.position);
        B.setGaze(camera.position);
      } else {
        A.setGaze(eyesOf(B));
        B.setGaze(eyesOf(A));
      }
      const portrait = PORTRAIT_VIEWS.includes(view);
      A.setHeadgear(!portrait);
      B.setHeadgear(!portrait);
      const face = view === 'faceA' || view === 'faceB';
      const tape = view === 'tapeFront' || view === 'tapeSide';
      rig.portrait.visible = face || dbg === 'grid';
      rig.setHouse(face ? 0.22 : 1);
      rig.setCrowd(face ? 0.25 : tape ? 0.6 : 0.75);
      // A soft lens-height fill in the hero too, so the overhead keys do not
      // leave dark smears under the cheekbones.
      rig.setTapeFill(tape ? 1 : view === 'hero' ? 0.45 : 0, camera);
      rig.setHeroComp(view === 'hero' ? 1 : 0);
      rig.setHouseShadows(face || dbg === 'grid' ? 0 : 1);
      scene.environmentIntensity = face ? 0.18 : 0.3;
      const L = lens.settings;
      if (face) {
        const who = view === 'faceA' ? A : B;
        placePortrait(camera, who, view === 'faceA' ? -1 : 1);
        lens.focusOn(camera, who.bones.head.getWorldPosition(new Vector3()));
        Object.assign(L, { blur: 15, haze: 0.35, hazeFrom: 4, vignette: 0.3 });
      } else if (view === 'hero') {
        lens.focusOn(camera, new Vector3(0, 1.0, 0));
        Object.assign(L, { blur: 9, haze: 0.4, hazeFrom: 7, vignette: 0.3 });
      } else if (tape) {
        lens.focusOn(camera, new Vector3(0, 1.0, 0));
        Object.assign(L, { blur: 6, haze: 0.4, hazeFrom: 7, vignette: 0.25 });
      } else {
        lens.focusOn(camera, new Vector3(0, 0.9, 0));
        Object.assign(L, { blur: 3.5, haze: 0.35, hazeFrom: 9, vignette: 0.25 });
      }
    },
  };
};

type StyleBuildRender = (renderer: import('three').WebGLRenderer) => void;

export default styleBuild;
