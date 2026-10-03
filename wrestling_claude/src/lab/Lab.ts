import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  Euler,
} from 'three';
import { buildBodyNow } from '../body/factory';
import { Character } from '../body/Character';
import type { BodyParams } from '../body/anatomy';
import type { BodyLook } from '../body/material';
import type { BoneName } from '../body/skeleton';
import { BIND_POSE } from '../body/skeleton';
import { Solver } from '../anim/solver';
import { createPosture, P } from '../anim/posture';
import { createLocal, localToWorld } from '../anim/spec';
import { DEFAULT_STANCE, stancePose } from '../anim/stance';
import { Animator } from '../anim/Animator';
import '../anim/library';

/**
 * Development lab: renders bodies, poses and moves from fixed cameras in a grid
 * of viewports so they can be reviewed from screenshots. Driven by URL params,
 * e.g. ?lab=body&pose=bind.
 */

interface View {
  eye: [number, number, number];
  look: [number, number, number];
  fov: number;
  label: string;
}

const DEG = Math.PI / 180;

export function startLab(host: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const mode = params.get('lab') ?? 'body';
  if (mode === 'style') {
    // Art-direction mockups have their own harness.
    void import('./styles').then((m) => m.startStyle(host));
    return;
  }
  host.innerHTML = '';
  host.style.cssText = 'position:fixed;inset:0;background:#3a3f48';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  host.appendChild(canvas);
  const info = document.createElement('div');
  info.style.cssText =
    'position:fixed;left:8px;top:6px;font:12px/1.4 monospace;color:#fff;text-shadow:0 1px 2px #000;white-space:pre';
  host.appendChild(info);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new Scene();
  scene.background = new Color('#3a3f48');
  scene.add(new HemisphereLight('#dfe8ff', '#4a4038', 0.9));
  const key = new DirectionalLight('#fff2e0', 2.6);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2;
  key.shadow.camera.right = 2;
  key.shadow.camera.top = 2.5;
  key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new DirectionalLight('#9fc0ff', 1.4);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);
  const floor = new Mesh(new PlaneGeometry(10, 10), new MeshStandardMaterial({ color: '#b9a884', roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let views: View[] = [];

  if (mode === 'body') {
    const who = params.get('who') ?? 'a';
    const clothing = params.get('clothing') === 'referee' ? 'referee' : 'singlet';
    const hair = (params.get('hair') ?? 'crop') as BodyParams['hair'];
    const quality = params.get('quality') === 'low' ? 'low' : 'high';
    const mass = Number(params.get('mass') ?? 0.5);
    const scale = Number(params.get('height') ?? 1.76) / 1.76;
    const bp: BodyParams = { scale, mass, hair, clothing };
    const t0 = performance.now();
    const buffers = buildBodyNow(bp, quality, clothing !== 'referee');
    const t1 = performance.now();
    const look: BodyLook = {
      skin: params.get('skin') ?? (who === 'b' ? '#e0b48f' : '#9c6b4a'),
      hair: '#17110d',
      hairStyle: hair,
      primary: params.get('primary') ?? '#9d1b2c',
      secondary: params.get('secondary') ?? '#f2e6c9',
      accent: '#ffcd4a',
      pattern: (params.get('pattern') ?? 'panel') as BodyLook['pattern'],
      wordmark: params.get('mark') ?? 'Carver',
      band: '#c8261f',
      shoe: '#17181d',
      shoeAccent: params.get('primary') ?? '#9d1b2c',
      clothing,
      eye: '#4a2c1a',
      scale,
    };
    const ch = new Character(buffers, {
      look,
      gear: clothing === 'referee' ? null : { shell: '#1d1f26', strap: '#1d1f26' },
    });
    scene.add(ch.root);

    const pose = params.get('pose') ?? 'rest';
    const set = (name: BoneName, x: number, y: number, z: number) =>
      ch.bones[name].quaternion.setFromEuler(new Euler(x * DEG, y * DEG, z * DEG, 'XYZ'));
    if (pose === 'bind') {
      for (const [name, e] of Object.entries(BIND_POSE)) set(name as BoneName, e[0], e[1], e[2]);
    } else if (pose === 'bend') {
      // Deformation check: deep knee and hip flexion, bent elbows, a forward lean.
      ch.bones.hips.position.y = 0.66 * scale;
      set('hips', 20, 0, 0);
      set('spine', 15, 0, 0);
      set('chest', 12, 0, 0);
      set('neck', -20, 0, 0);
      set('head', -15, 0, 0);
      set('thighL', -95, 0, 8);
      set('thighR', -40, 0, -8);
      set('shinL', 110, 0, 0);
      set('shinR', 80, 0, 0);
      set('footL', -15, 0, 0);
      set('footR', -40, 0, 0);
      set('armL', -70, 0, 25);
      set('armR', -40, 0, -35);
      set('forearmL', -95, 0, 0);
      set('forearmR', -60, 0, 0);
      set('shoulderL', 0, 15, 8);
    }
    ch.root.updateMatrixWorld(true);

    const vb = buffers.body.getAttribute('position').count;
    const vh = buffers.head.getAttribute('position').count;
    const vg = buffers.headgear?.getAttribute('position').count ?? 0;
    info.textContent = `body ${vb} verts · head ${vh} · gear ${vg} · built in ${(t1 - t0).toFixed(0)} ms (worker est ${buffers.ms.toFixed(0)})`;

    const cy = 0.95 * scale;
    if (params.get('focus') === 'hands') {
      const hx = 0.19 * scale;
      const hy = 0.82 * scale;
      views = [
        { eye: [hx + 0.45, hy, 0.05], look: [hx, hy, -0.01], fov: 30, label: 'hand outside' },
        { eye: [hx, hy, 0.45], look: [hx, hy, -0.01], fov: 30, label: 'hand front' },
        { eye: [hx, hy, -0.45], look: [hx, hy, -0.01], fov: 30, label: 'hand back' },
        { eye: [hx + 0.3, hy + 0.2, 0.3], look: [hx, hy, -0.01], fov: 30, label: 'hand 3/4' },
        { eye: [0, 1.2, 1.6], look: [0, 1.0, 0], fov: 34, label: 'upper body' },
        { eye: [-hx - 0.45, hy, 0.05], look: [-hx, hy, -0.01], fov: 30, label: 'right hand' },
      ];
    } else views = [
      { eye: [0, cy, 3.4], look: [0, cy, 0], fov: 36, label: 'front' },
      { eye: [3.4, cy, 0], look: [0, cy, 0], fov: 36, label: 'side' },
      { eye: [0, cy, -3.4], look: [0, cy, 0], fov: 36, label: 'back' },
      { eye: [2.2, 1.6, 2.5], look: [0, cy, 0], fov: 36, label: '3/4' },
      { eye: [0, 1.66 * scale, 0.75], look: [0, 1.64 * scale, 0], fov: 30, label: 'face' },
      { eye: [0.55, 1.7 * scale, 0.5], look: [0, 1.64 * scale, 0], fov: 32, label: 'face 3/4' },
    ];
  }

  if (mode === 'stance') {
    // Two wrestlers squared up in their stances.
    const d = Number(params.get('d') ?? 1.0);
    const level = Number(params.get('level') ?? 0.45);
    const lean = Number(params.get('lean') ?? 0);
    const mk = (skin: string, primary: string, mark: string, hair: BodyParams['hair']) => {
      const bp: BodyParams = { scale: 1, mass: 0.5, hair, clothing: 'singlet' };
      const look: BodyLook = {
        skin,
        hair: '#17110d',
        hairStyle: hair,
        primary,
        secondary: '#f2e6c9',
        accent: '#ffcd4a',
        pattern: 'panel',
        wordmark: mark,
        band: '#c8261f',
        shoe: '#17181d',
        shoeAccent: primary,
        clothing: 'singlet',
        eye: '#4a2c1a',
        scale: 1,
      };
      const ch = new Character(buildBodyNow(bp, 'high'), { look, gear: { shell: '#1d1f26', strap: '#1d1f26' } });
      scene.add(ch.root);
      return ch;
    };
    const a = mk('#9c6b4a', '#9d1b2c', 'Carver', 'crop');
    const b = mk('#e0b48f', '#15386b', 'Lakeridge', 'buzz');
    const solverA = new Solver(a);
    const solverB = new Solver(b);
    const local = createLocal();
    const world = createPosture();
    const pose = (solver: Solver, x: number, yaw: number, lead: 1 | -1, oppX: number) => {
      stancePose({ ...DEFAULT_STANCE, level, lean, lead }, local);
      localToWorld(local, { x, z: 0, yaw }, world);
      world[P.LOOK] = oppX;
      world[P.LOOK + 1] = 1.25;
      world[P.LOOK + 2] = 0;
      solver.apply(world);
    };
    pose(solverA, -d / 2, Math.PI / 2, 1, d / 2);
    pose(solverB, d / 2, -Math.PI / 2, 1, -d / 2);
    info.textContent = `stance d=${d} level=${level} lean=${lean}`;
    views = [
      { eye: [0, 1.0, 3.6], look: [0, 0.75, 0], fov: 36, label: 'side' },
      { eye: [0, 1.0, -3.6], look: [0, 0.75, 0], fov: 36, label: 'other side' },
      { eye: [-3.2, 1.3, 1.6], look: [0, 0.75, 0], fov: 36, label: 'behind A' },
      { eye: [2.4, 2.2, 2.4], look: [0, 0.7, 0], fov: 36, label: 'high 3/4' },
      { eye: [0, 1.2, 1.6], look: [0, 1.0, 0], fov: 34, label: 'close' },
      { eye: [0, 3.6, 0.01], look: [0, 0, 0], fov: 40, label: 'top' },
    ];
  }

  // Paired clips: ?lab=pair&clip=ride&hold=1&t=0.3  or  &strip=1&cam=side
  let poseAt: ((i: number) => void) | null = null;
  if (mode === 'pair') {
    const clip = params.get('clip') ?? 'ride';
    const hold = params.get('hold') === '1';
    const mirror = params.get('mirror') === '1';
    const strip = params.get('strip') === '1';
    const t = Number(params.get('t') ?? 0);
    const dist = params.get('dist') ? Number(params.get('dist')) : undefined;
    const mk = (skin: string, primary: string, mark: string, hair: BodyParams['hair'], pattern: BodyLook['pattern']) => {
      const bp: BodyParams = { scale: 1, mass: 0.5, hair, clothing: 'singlet' };
      const look: BodyLook = {
        skin,
        hair: '#17110d',
        hairStyle: hair,
        primary,
        secondary: '#f2e6c9',
        accent: '#ffcd4a',
        pattern,
        wordmark: mark,
        band: '#c8261f',
        shoe: '#17181d',
        shoeAccent: primary,
        clothing: 'singlet',
        eye: '#4a2c1a',
        scale: 1,
      };
      const ch = new Character(buildBodyNow(bp, 'high'), { look, gear: { shell: '#1d1f26', strap: '#1d1f26' } });
      scene.add(ch.root);
      return new Animator(ch);
    };
    const A = mk('#9c6b4a', '#9d1b2c', 'Carver', 'crop', 'panel');
    const B = mk('#e0b48f', '#15386b', 'Lakeridge', 'buzz', 'sash');
    const frame = { x: 0, z: 0, yaw: 0 };
    const pose = (time: number) => {
      for (let pass = 0; pass < 2; pass++) {
        for (const [anim, role, opp] of [
          [A, 'A', B],
          [B, 'B', A],
        ] as const) {
          anim.instant = true;
          anim.update(
            1 / 60,
            {
              mode: 'paired',
              clip,
              hold,
              role,
              frame,
              mirror,
              u: time,
              progress: time,
              intensity: 0,
              dist,
              stamina: 1,
              exertion: 0,
            },
            opp,
          );
        }
        A.applyContacts(1, B);
        B.applyContacts(1, A);
      }
    };
    const custom = params.get('times')?.split(',').map(Number);
    const times = custom ?? (strip ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [t, t, t, t, t, t]);
    poseAt = (i: number) => pose(times[i]);
    const cam = params.get('cam') ?? 'side';
    const camViews: Record<string, View> = {
      side: { eye: [3.4, 1.1, 0.1], look: [0, 0.45, 0.1], fov: 34, label: 'side' },
      tall: { eye: [3.9, 1.3, 0.6], look: [0, 0.75, 0.6], fov: 34, label: 'tall' },
      tallOther: { eye: [-3.9, 1.3, 0.6], look: [0, 0.75, 0.6], fov: 34, label: 'tall other' },
      tallFront: { eye: [0, 1.4, 4.4], look: [0, 0.8, 0.6], fov: 34, label: 'tall front' },
      tallBack: { eye: [0, 1.4, -3.4], look: [0, 0.8, 0.6], fov: 34, label: 'tall back' },
      tallHigh: { eye: [2.6, 3.0, 2.8], look: [0, 0.7, 0.6], fov: 34, label: 'tall high' },
      other: { eye: [-3.4, 1.1, 0.1], look: [0, 0.45, 0.1], fov: 34, label: 'other side' },
      front: { eye: [0, 1.2, 3.4], look: [0, 0.45, 0], fov: 34, label: 'front' },
      back: { eye: [0, 1.2, -3.4], look: [0, 0.45, 0], fov: 34, label: 'back' },
      high: { eye: [2.2, 2.8, 2.2], look: [0, 0.3, 0], fov: 34, label: 'high' },
      top: { eye: [0, 3.6, 0.01], look: [0, 0, 0], fov: 40, label: 'top' },
    };
    views = strip || custom
      ? times.map((tt) => ({ ...camViews[cam], label: `t=${tt}` }))
      : (params.get('views')?.split(',') ?? ['side', 'other', 'front', 'back', 'high', 'top']).map((k) => camViews[k]);
    info.textContent = `${clip} ${hold ? 'hold progress' : 'move u'}=${strip ? 'strip' : t}${mirror ? ' mirrored' : ''}`;
  }

  const camera = new PerspectiveCamera(36, 1, 0.05, 50);
  const render = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    const cols = 3;
    const rows = Math.ceil(views.length / cols);
    const vw = Math.floor(w / cols);
    const vh = Math.floor(h / rows);
    renderer.setScissorTest(true);
    views.forEach((v, i) => {
      poseAt?.(i);
      const x = (i % cols) * vw;
      const y = h - (Math.floor(i / cols) + 1) * vh;
      renderer.setViewport(x, y, vw, vh);
      renderer.setScissor(x, y, vw, vh);
      camera.aspect = vw / vh;
      camera.fov = v.fov;
      camera.position.set(...v.eye);
      camera.lookAt(new Vector3(...v.look));
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    renderer.setScissorTest(false);
  };
  render();
  window.addEventListener('resize', render);
  (window as unknown as { labReady: boolean }).labReady = true;
}
