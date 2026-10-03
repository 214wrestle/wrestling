import { Euler, PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import type { Bone, Object3D, Scene } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Solver } from '../../anim/solver';
import { createPosture, P } from '../../anim/posture';
import { createLocal, localToWorld } from '../../anim/spec';
import { DEFAULT_STANCE, stancePose } from '../../anim/stance';
import type { BoneName } from '../../body/skeleton';

/**
 * Style mockup harness.
 *
 * Every art-direction mockup renders the same six shots of the same two athletes
 * so the styles can be compared side by side. A style only builds a scene and
 * two characters on the shared skeleton; posing goes through the game's own
 * animation solver, which proves the style can drop into the real game.
 *
 *   ?lab=style&v=<id>                 the 6-shot comparison sheet (1440x810 is the reference size)
 *   ?lab=style&v=<id>&view=hero       one shot, full window
 *   ?lab=style&v=<id>&orbit=1         drag to orbit, scroll to zoom (&pose=stance|stand)
 */

export type ViewName = 'hero' | 'faceA' | 'faceB' | 'tapeFront' | 'tapeSide' | 'game';
export type PoseName = 'stance' | 'standFront' | 'standSide';

/** Anything the animation solver can drive: the shared bone names, one uniform scale. */
export interface Rig {
  root: Object3D;
  bones: Record<BoneName, Bone>;
  scale: number;
}

export interface StyleMock {
  /** Short style name for the sheet header, e.g. "Broadcast realism". */
  title: string;
  /** One line on what the style is. */
  blurb: string;
  scene: Scene;
  A: Rig;
  B: Rig;
  /** Name shown under each athlete, e.g. "Kyle Dake · Cornell". */
  labelA: string;
  labelB: string;
  /** Optional custom draw for one viewport (outlines, extra passes). Viewport and scissor are already set. */
  render?: (renderer: WebGLRenderer, camera: PerspectiveCamera, view: ViewName) => void;
  /** Called after a view is posed and before it is drawn (e.g. to move a light). */
  onView?: (view: ViewName, camera: PerspectiveCamera) => void;
  /** Called every frame in orbit mode, with seconds elapsed. */
  tick?: (t: number) => void;
  /** Sheet background colour for the gaps and header. */
  sheetColor?: string;
}

export type StyleBuild = (renderer: WebGLRenderer) => StyleMock | Promise<StyleMock>;

interface ViewDef {
  name: ViewName;
  label: string;
  pose: PoseName;
  /** Grid cell on a 3x3 sheet: column, row, column span, row span. */
  cell: [number, number, number, number];
  camera: (A: Rig, B: Rig) => { eye: Vector3; look: Vector3; fov: number };
}

const _v = new Vector3();
const headOf = (r: Rig) => r.bones.head.getWorldPosition(new Vector3());

export const VIEWS: ViewDef[] = [
  {
    name: 'hero',
    label: 'Neutral — broadcast low three-quarter',
    pose: 'stance',
    cell: [0, 0, 2, 2],
    camera: () => ({ eye: new Vector3(1.15, 1.05, 3.1), look: new Vector3(0.05, 0.86, 0), fov: 34 }),
  },
  {
    name: 'faceA',
    label: 'Headshot',
    pose: 'standFront',
    cell: [2, 0, 1, 1],
    camera: (A) => {
      const h = headOf(A);
      return { eye: h.clone().add(_v.set(0.2, 0.08, 0.82)), look: h.clone().add(_v.set(0, 0.04, 0)), fov: 30 };
    },
  },
  {
    name: 'faceB',
    label: 'Headshot',
    pose: 'standFront',
    cell: [2, 1, 1, 1],
    camera: (_A, B) => {
      const h = headOf(B);
      return { eye: h.clone().add(_v.set(-0.2, 0.08, 0.82)), look: h.clone().add(_v.set(0, 0.04, 0)), fov: 30 };
    },
  },
  {
    name: 'tapeFront',
    label: 'Tale of the tape — front',
    pose: 'standFront',
    cell: [0, 2, 1, 1],
    camera: () => ({ eye: new Vector3(0, 1.0, 4.4), look: new Vector3(0, 0.92, 0), fov: 30 }),
  },
  {
    name: 'tapeSide',
    label: 'Tale of the tape — side',
    pose: 'standSide',
    cell: [1, 2, 1, 1],
    camera: () => ({ eye: new Vector3(4.4, 1.0, 0), look: new Vector3(0, 0.92, 0), fov: 30 }),
  },
  {
    name: 'game',
    label: 'Gameplay camera',
    pose: 'stance',
    cell: [2, 2, 1, 1],
    camera: () => ({ eye: new Vector3(0, 2.15, 5.6), look: new Vector3(0, 0.82, 0), fov: 36 }),
  },
];

interface Snapshot {
  pos: Vector3[];
  rot: Euler[];
}

function snapshot(r: Rig): Snapshot {
  const bones = Object.values(r.bones);
  return { pos: bones.map((b) => b.position.clone()), rot: bones.map((b) => b.rotation.clone()) };
}

function restore(r: Rig, s: Snapshot): void {
  Object.values(r.bones).forEach((b, i) => {
    b.position.copy(s.pos[i]);
    b.rotation.copy(s.rot[i]);
  });
}

/** Poses both athletes through the game's solver (stance) or a relaxed stand. */
function makePoser(A: Rig, B: Rig) {
  const restA = snapshot(A);
  const restB = snapshot(B);
  const solverA = new Solver(A);
  const solverB = new Solver(B);
  const local = createLocal();
  const world = createPosture();
  const DEG = Math.PI / 180;

  const stand = (r: Rig, rest: Snapshot, x: number, z: number) => {
    restore(r, rest);
    r.root.position.set(x, 0, z);
    r.root.rotation.set(0, 0, 0);
    // Arms a hand's width off the hips, elbows soft: a relaxed weigh-in stance.
    r.bones.armL.rotation.set(0, 0, 9 * DEG);
    r.bones.armR.rotation.set(0, 0, -9 * DEG);
    r.bones.forearmL.rotation.set(-10 * DEG, 0, 0);
    r.bones.forearmR.rotation.set(-10 * DEG, 0, 0);
    r.root.updateMatrixWorld(true);
  };

  const stance = (r: Rig, rest: Snapshot, solver: Solver, x: number, yaw: number, oppX: number) => {
    restore(r, rest);
    r.root.position.set(0, 0, 0);
    r.root.rotation.set(0, 0, 0);
    stancePose({ ...DEFAULT_STANCE, level: 0.45, lean: 0, lead: 1 }, local);
    localToWorld(local, { x, z: 0, yaw }, world);
    world[P.LOOK] = oppX;
    world[P.LOOK + 1] = 1.25;
    world[P.LOOK + 2] = 0;
    solver.apply(world);
    r.root.updateMatrixWorld(true);
  };

  return (pose: PoseName) => {
    if (pose === 'stance') {
      stance(A, restA, solverA, -0.5, Math.PI / 2, 0.5);
      stance(B, restB, solverB, 0.5, -Math.PI / 2, -0.5);
    } else if (pose === 'standFront') {
      stand(A, restA, -0.5, 0);
      stand(B, restB, 0.5, 0);
    } else {
      stand(A, restA, 0, 0.5);
      stand(B, restB, 0, -0.5);
    }
  };
}

function label(host: HTMLElement, text: string, css: string): HTMLDivElement {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText =
    'position:absolute;font:600 12px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;pointer-events:none;' +
    css;
  host.appendChild(d);
  return d;
}

export async function runStyle(host: HTMLElement, build: StyleBuild): Promise<void> {
  const params = new URLSearchParams(location.search);
  const only = params.get('view') as ViewName | null;
  const orbit = params.get('orbit') === '1';

  host.innerHTML = '';
  host.style.cssText = 'position:fixed;inset:0;background:#111;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  host.appendChild(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, Number(params.get('dpr') ?? 1)));
  const mock = await build(renderer);
  const pose = makePoser(mock.A, mock.B);
  const camera = new PerspectiveCamera(34, 1, 0.03, 120);

  const draw = (view: ViewName) => {
    if (mock.render) mock.render(renderer, camera, view);
    else renderer.render(mock.scene, camera);
  };

  if (orbit) {
    pose((params.get('pose') as PoseName) ?? 'stance');
    const def = VIEWS[0].camera(mock.A, mock.B);
    camera.position.copy(def.eye);
    camera.fov = def.fov;
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(def.look);
    controls.enableDamping = true;
    label(host, `${mock.title} — drag to orbit, scroll to zoom`, 'left:12px;top:10px;font-size:14px');
    const t0 = performance.now();
    const loop = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.setViewport(0, 0, w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      controls.update();
      mock.tick?.((performance.now() - t0) / 1000);
      mock.onView?.('hero', camera);
      draw('hero');
      requestAnimationFrame(loop);
    };
    loop();
    (window as unknown as { mockReady: boolean }).mockReady = true;
    return;
  }

  const views = only ? VIEWS.filter((v) => v.name === only) : VIEWS;
  const header = 26;
  const overlays: HTMLDivElement[] = [];

  const render = () => {
    for (const o of overlays) o.remove();
    overlays.length = 0;
    const W = host.clientWidth;
    const H = host.clientHeight;
    renderer.setSize(W, H, false);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    renderer.setClearColor(mock.sheetColor ?? '#0d0f13', 1);
    renderer.clear();
    const top = only ? 0 : header;
    const gap = only ? 0 : 2;
    const cw = W / 3;
    const ch = (H - top) / 3;
    for (const v of views) {
      const [c, r, cs, rs] = only ? [0, 0, 3, 3] : v.cell;
      const x = Math.round(c * cw + gap / 2);
      const yTop = Math.round(top + r * ch + gap / 2);
      const w = Math.round(cs * cw - gap);
      const h = Math.round(rs * ch - gap);
      pose(v.pose);
      const cam = v.camera(mock.A, mock.B);
      camera.position.copy(cam.eye);
      camera.fov = cam.fov;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.lookAt(cam.look);
      const yGl = H - yTop - h;
      renderer.setViewport(x, yGl, w, h);
      renderer.setScissor(x, yGl, w, h);
      mock.onView?.(v.name, camera);
      draw(v.name);
      const who = v.name === 'faceA' ? ` — ${mock.labelA}` : v.name === 'faceB' ? ` — ${mock.labelB}` : '';
      overlays.push(label(host, v.label + who, `left:${x + 8}px;top:${yTop + 6}px`));
    }
    renderer.setScissorTest(false);
    if (!only) {
      overlays.push(
        label(host, `${mock.title}  ·  ${mock.blurb}`, 'left:10px;top:5px;font-size:14px;font-weight:700'),
        label(host, `${mock.labelA}   vs   ${mock.labelB}`, 'right:10px;top:6px;font-size:13px'),
      );
    }
  };

  render();
  window.addEventListener('resize', render);
  (window as unknown as { mockReady: boolean }).mockReady = true;
}
