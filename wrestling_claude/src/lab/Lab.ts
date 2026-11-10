import { ROSTER } from '../sim/roster';
import { animationMotion } from '../sim/athleteProfiles';
import {registerSupportedArmBarChain} from '../anim/supportedArmBar';
import { isArmBar } from '../sim/armBars';
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
  SkeletonHelper,
  Vector3,
  WebGLRenderer,
  Euler,
} from 'three';
import { buildBodyNow } from '../body/factory';
import { Character } from '../body/Character';
import { buildRealCharacterNow, portraitFor } from '../body/realistic/factory';
import type { BodyParams } from '../body/anatomy';
import type { BodyLook } from '../body/material';
import type { BoneName } from '../body/skeleton';
import { BIND_POSE } from '../body/skeleton';
import { Solver } from '../anim/solver';
import { createPosture, P } from '../anim/posture';
import { createLocal, localToWorld } from '../anim/spec';
import { DEFAULT_STANCE, downBlock, stancePose } from '../anim/stance';
import { Animator } from '../anim/Animator';
import { resolveHeadClearance } from '../anim/headClearance';
import { hasHold, hasMove } from '../anim/clips';
import '../anim/library';
import {headSurfaceMinimum,registerHeadPostDraft,registerSeatedBarDrafts} from './doubleBarFinishDraft';

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
  if (mode === 'facefit') {
    // Fit a wrestler's face to a portrait (MediaPipe landmarks); see faceFitLab.ts.
    void import('./faceFitLab').then((m) => m.startFaceFit(host, params));
    return;
  }
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
  let advanceLab: ((dt: number) => void) | undefined;
  let reviewPhotos: ({ url: string; oval: number[] } | undefined)[] | undefined;

  if (mode === 'lineup') {
    // Development only: a whole team, lightest to heaviest, built with the realistic bodies.
    const team = params.get('team') ?? 'penn-state';
    const role = params.get('role') ?? 'starter';
    const squad = ROSTER.filter(w => w.school.id === team && w.legends?.role === role).sort((a, b) => a.weightClass - b.weightClass).slice(Number(params.get('from')) || 0, (Number(params.get('from')) || 0) + (Number(params.get('n')) || 99));
    const gap = 0.62;
    // &faces=1: a contact sheet of every face (headgear off), to review photo fits.
    const faces = params.get('faces') === '1';
    const heights: number[] = [];
    squad.forEach((w, i) => {
      const real = buildRealCharacterNow(w, '#c8261f', faces ? 'high' : 'low');
      real.character.root.position.x = (i - (squad.length - 1) / 2) * gap;
      if (faces) real.character.setHeadgear(false);
      // Eye height of the head as built (likeness height, not the roster placeholder).
      const hp = real.geo.head.positions;
      let top = 0; for (let k = 1; k < hp.length; k += 3) top = Math.max(top, hp[k]);
      heights.push(top - 0.12 * (top / 1.8));
      scene.add(real.character.root);
    });
    floor.scale.set(1.6, 1, 1);
    key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.updateProjectionMatrix();
    info.textContent = `${team} ${role}s: ${squad.map(w => `${w.weightClass} ${w.lastName}`).join(' · ')}`;
    const half = (squad.length - 1) / 2 * gap;
    // &photos=1 with faces=1: each portrait under its render in __labShot captures.
    if (faces && params.get('photos') === '1') reviewPhotos = squad.map(w => portraitFor(`${w.firstName} ${w.lastName}`));
    if (faces) views = squad.map((w, i) => {
      const x = (i - (squad.length - 1) / 2) * gap;
      const hy = heights[i];
      return { eye: [x, hy + 0.01, 0.5] as [number, number, number], look: [x, hy - 0.005, 0] as [number, number, number], fov: 26, label: w.lastName };
    });
    else views = [
      { eye: [0, 1.0, 5.6], look: [0, 0.95, 0], fov: 40, label: 'lineup' },
      { eye: [-half, 1.6, 1.1], look: [-half + 0.9, 1.55, 0], fov: 34, label: 'light end' },
      { eye: [half, 1.75, 1.1], look: [half - 0.9, 1.65, 0], fov: 34, label: 'heavy end' },
    ];
  }

  if (mode === 'body') {
    const byName = params.get('name')?.toLowerCase();
    const athlete = ROSTER.find(w => w.id === params.get('athlete') || (!!byName && `${w.firstName} ${w.lastName}`.toLowerCase() === byName));
    const who = params.get('who') ?? 'a';
    const clothing = params.get('clothing') === 'referee' ? 'referee' : 'singlet';
    const hair = (params.get('hair') ?? athlete?.hairStyle ?? 'crop') as BodyParams['hair'];
    const quality = params.get('quality') === 'low' ? 'low' : 'high';
    const mass = Number(params.get('mass') ?? athlete?.build ?? 0.5);
    let scale = Number(params.get('height') ?? athlete?.height ?? 1.76) / 1.76;
    const bp: BodyParams = { scale, mass, hair, clothing, shape: athlete?.appearance };
    const t0 = performance.now();
    const realPilot = !!athlete && params.get('realism') !== '0' && clothing !== 'referee';
    const real = realPilot ? buildRealCharacterNow(athlete!, '#c8261f', quality) : null;
    const buffers = real ? null : buildBodyNow(bp, quality, clothing !== 'referee');
    const t1 = performance.now();
    const look: BodyLook = {
      skin: params.get('skin') ?? athlete?.skinTone ?? (who === 'b' ? '#e0b48f' : '#9c6b4a'),
      hair: athlete?.hairColor ?? '#17110d',
      hairStyle: hair,
      primary: params.get('primary') ?? athlete?.school.primary ?? '#9d1b2c',
      secondary: params.get('secondary') ?? athlete?.school.secondary ?? '#f2e6c9',
      accent: '#ffcd4a',
      pattern: (params.get('pattern') ?? athlete?.school.pattern ?? 'panel') as BodyLook['pattern'],
      wordmark: params.get('mark') ?? athlete?.school.mark ?? 'Carver',
      blockC: athlete?.school.id === 'cornell',
      band: '#c8261f',
      shoe: '#17181d',
      shoeAccent: params.get('primary') ?? '#9d1b2c',
      clothing,
      eye: '#4a2c1a',
      scale,
    };
    const ch = real?.character ?? new Character(buffers!, {
      look,
      shape: athlete?.appearance, motion: athlete ? animationMotion(athlete) : undefined,
      gear: clothing === 'referee' ? null : { shell: athlete?.headgearColor ?? '#1d1f26', strap: athlete?.headgearColor ?? '#1d1f26' },
    });
    scene.add(ch.root);
    if(real)for(const hand of ['L','R'] as const)real.character.setGrip(hand,Number(params.get('grip') ?? 0));
    // &gear=0: no headgear, to compare the face, ears and hair with portraits.
    if(real&&params.get('gear')==='0')real.character.setHeadgear(false);

    const pose = params.get('pose') ?? 'rest';
    const set = (name: BoneName, x: number, y: number, z: number) =>
      ch.bones[name].quaternion.setFromEuler(new Euler(x * DEG, y * DEG, z * DEG, 'XYZ'));
    // &solo=refWork&u=0.3 (&mirror=1): a solo clip (referee signals, celebrations) on this body, for review.
    if (params.get('solo')) {
      const anim = new Animator(ch);
      anim.instant = true;
      const view = { mode: 'solo', clip: params.get('solo')!, x: 0, z: 0, yaw: 0, u: Number(params.get('u') ?? 0), stamina: 1, exertion: 0, mirror: params.get('mirror') === '1' };
      for (let i = 0; i < 30; i++) { anim.update(1 / 60, view as never, null); anim.applyContacts(1 / 60, null); }
    } else if (pose === 'walk' || pose === 'shuffle' || pose === 'pivot') {
      // The lab recenters world-space motion for the fixed cameras. Static mesh
      // bounds do not follow the displaced skeleton during extended playback.
      ch.root.traverse(object => { object.frustumCulled = false; });
      const anim = new Animator(ch);
      const speed = Number(params.get('speed') ?? (pose==='walk'?.85:.65));
      const t = Number(params.get('t') ?? 1.5);
      const hz = Math.max(15, Math.min(120, Number(params.get('hz') ?? 60)));
      const frames = Math.round(t * hz);
      const step = (dt:number, elapsed:number) => {
        ch.root.position.set(0,0,0);
        ch.root.updateMatrixWorld(true);
        const lateral=pose==='shuffle';
        const stanceAt=Number(params.get('stanceAt') ?? Infinity);
        const inStance=lateral||elapsed>=stanceAt;
        const reverseAt=Number(params.get('reverseAt') ?? Infinity);
        const stopAt=Number(params.get('stopAt') ?? Infinity);
        const movingTime=Math.min(elapsed,stopAt);
        const distance=speed*(movingTime<=reverseAt?movingTime:2*reverseAt-movingTime);
        const velocity=elapsed>=stopAt?0:elapsed<=reverseAt?speed:-speed;
        const pivot=pose==='pivot';
        const x=lateral?distance:0, z=lateral||pivot?0:distance;
        const yaw=pivot?Math.min(1,Math.max(0,(elapsed-.4)/.8))*Math.PI/2:0;
        const motion={x,z,yaw,vx:lateral?velocity:0,vz:lateral||pivot?0:velocity,stamina:Number(params.get('stamina') ?? 1),exertion:0};
        anim.update(dt, inStance ? {
          ...motion, mode:'stance', level:.45,lean:0,lead:athlete?.lead ?? 1,act:'stance',actT:0,actDur:0,hand:0,oppHand:0,
        } : {...motion,mode:'walk'},null);
        ch.root.position.set(-x,0,-z);
      };
      for (let i=0; i<=frames; i++) step(1/hz,i/hz);
      if (params.get('play') === '1') {
        let elapsed = frames / hz;
        advanceLab = dt => { elapsed += dt; step(dt,elapsed); };
      }
    } else if (pose === 'bind') {
      for (const [name, e] of Object.entries(BIND_POSE)) set(name as BoneName, e[0], e[1], e[2]);
    } else if (pose === 'shoulders') {
      // Stress shoulder skinning through forward reach, underhook and overhead.
      const lift = Math.max(0, Math.min(150, Number(params.get('lift') ?? 90)));
      set('shoulderL', 0, 8, lift * .16);
      set('shoulderR', 0, -8, -lift * .16);
      set('armL', -lift * .45, 0, lift * .55);
      set('armR', -lift * .45, 0, -lift * .55);
      set('forearmL', -70, 0, 0);
      set('forearmR', -70, 0, 0);
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

    const vb = real ? real.geo.body.positions.length / 3 : buffers!.body.getAttribute('position').count;
    const vh = real ? real.geo.head.positions.length / 3 + (real.geo.face?.positions.length ?? 0) / 3 : buffers!.head.getAttribute('position').count;
    const vg = real ? (real.geo.headgear?.positions.length ?? 0) / 3 : buffers!.headgear?.getAttribute('position').count ?? 0;
    info.textContent = `body ${vb} verts · head ${vh} · gear ${vg} · built in ${(t1 - t0).toFixed(0)} ms (worker est ${(real?.geo.ms ?? buffers!.ms).toFixed(0)})`;

    // Views follow the body as built (a likeness sets its own height), not the roster's placeholder.
    if (real) {
      const hp = real.geo.head.positions;
      let top = 0; for (let k = 1; k < hp.length; k += 3) top = Math.max(top, hp[k]);
      scale = top / 1.795;
    }
    const cy = 0.95 * scale;
    if (params.get('focus') === 'upper') {
      views = [
        {eye:[0,1.43*scale,1.5*scale],look:[0,1.39*scale,0],fov:32,label:'upper front'},
        {eye:[1.5*scale,1.43*scale,0],look:[0,1.39*scale,0],fov:32,label:'upper side'},
        {eye:[0,1.43*scale,-1.5*scale],look:[0,1.39*scale,0],fov:32,label:'upper back'},
        {eye:[1.1*scale,1.55*scale,1.1*scale],look:[0,1.39*scale,0],fov:32,label:'front quarter'},
        {eye:[1.1*scale,1.55*scale,-1.1*scale],look:[0,1.39*scale,0],fov:32,label:'back quarter'},
        {eye:[-1.5*scale,1.43*scale,0],look:[0,1.39*scale,0],fov:32,label:'opposite side'},
      ];
    } else if (params.get('focus') === 'arms') {
      const ay = 1.2 * scale, ax = 0.19 * scale;
      views = [
        {eye:[ax+0.1,ay,1.25],look:[ax,ay,0],fov:24,label:'arm front'},
        {eye:[ax+1.25,ay,0],look:[ax,ay,0],fov:24,label:'arm outside'},
        {eye:[ax+0.1,ay,-1.25],look:[ax,ay,0],fov:24,label:'arm back'},
      ];
    } else if (params.get('focus') === 'abs') {
      const ay = 1.17 * scale;
      views = [
        {eye:[0,ay+0.02,1.05],look:[0,ay,0],fov:22,label:'abs front'},
        {eye:[0.74,ay+0.04,0.74],look:[0,ay,0],fov:22,label:'abs 3/4'},
        {eye:[1.05,ay,0.04],look:[0,ay,0],fov:22,label:'abs side'},
      ];
    } else if (params.get('focus') === 'torso') {
      const ty = 1.2 * scale;
      views = [
        {eye:[0,ty,2.0],look:[0,ty,0],fov:26,label:'torso front'},
        {eye:[0,ty,-2.0],look:[0,ty,0],fov:26,label:'torso back'},
        {eye:[2.0,ty,0],look:[0,ty,0],fov:26,label:'torso side'},
      ];
    } else if (params.get('focus') === 'legs') {
      const ly = 0.5 * scale;
      views = [
        {eye:[0,ly,1.9],look:[0,ly,0],fov:30,label:'legs front'},
        {eye:[1.9,ly,0],look:[0,ly,0],fov:30,label:'legs side'},
        {eye:[0.6,ly,-1.8],look:[0,ly,0],fov:30,label:'legs back'},
      ];
    } else if (params.get('focus') === 'full') {
      const my = 0.9 * scale;
      views = [
        {eye:[0,my,3.5],look:[0,my,0],fov:30,label:'full front'},
        {eye:[3.5,my,0],look:[0,my,0],fov:30,label:'full side'},
        {eye:[0,my,-3.5],look:[0,my,0],fov:30,label:'full back'},
      ];
    } else if (params.get('focus') === 'chest') {
      const cy = 1.36 * scale;
      views = [
        {eye:[0,cy+0.04,1.05],look:[0,cy,0],fov:24,label:'chest front'},
        {eye:[0.74,cy+0.06,0.74],look:[0,cy,0],fov:24,label:'chest 3/4'},
        {eye:[1.05,cy+0.02,0.06],look:[0,cy,0],fov:24,label:'chest profile'},
      ];
    } else if (params.get('focus') === 'face') {
      const fy = 1.645 * scale;
      views = [
        {eye:[0,fy+0.01,0.62],look:[0,fy,0],fov:22,label:'face front'},
        {eye:[0.62,fy+0.01,0],look:[0,fy,0],fov:22,label:'face profile'},
        {eye:[0.44,fy+0.06,0.44],look:[0,fy,0],fov:22,label:'face 3/4'},
        {eye:[0,fy+0.4,2.6],look:[0,1.2*scale,0],fov:30,label:'match distance'},
      ];
    } else if (params.get('focus') === 'hands') {
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
    // &block=0..1: wrestler A in the down block (his answer to a fake), for review.
    const block = Number(params.get('block') ?? 0);
    const pose = (solver: Solver, x: number, yaw: number, lead: 1 | -1, oppX: number) => {
      stancePose({ ...DEFAULT_STANCE, level, lean, lead }, local);
      if (solver === solverA) downBlock(local, block);
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
    if(params.get('sequence')==='supported-chain')registerSupportedArmBarChain();
    // The registry is authoritative. A stale hold=1 on a move used to show
    // an unrelated fallback pose, making visual review falsely reassuring.
    if(!hasHold(clip)&&!hasMove(clip))throw new Error(`Unknown review clip: ${clip}`);
    const hold = hasHold(clip) && (!hasMove(clip) || params.get('hold') === '1');
    const mirror = params.get('mirror') === '1';
    const strip = params.get('strip') === '1';
    const t = Number(params.get('t') ?? 0);
    const dist = params.get('dist') ? Number(params.get('dist')) : undefined;
    const mk = (skin: string, primary: string, mark: string, hair: BodyParams['hair'], pattern: BodyLook['pattern'], athleteId?:string|null) => {
      const athlete=ROSTER.find(w=>w.id===athleteId);
      if(athlete && params.get('realism')!=='0'){
        const real=buildRealCharacterNow(athlete,'#c8261f','high');
        scene.add(real.character.root);
        return new Animator(real.character);
      }
      const labScale=Math.max(.8,Math.min(1.2,Number(params.get(mark==='Carver'?'scaleA':'scaleB')??1)));
      const bp: BodyParams = { scale: labScale, mass: 0.5, hair, clothing: 'singlet' };
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
        scale: labScale,
      };
      const ch = new Character(buildBodyNow(bp, 'high'), { look, gear: { shell: '#1d1f26', strap: '#1d1f26' } });
      scene.add(ch.root);
      return new Animator(ch);
    };
    const A = mk('#9c6b4a', '#9d1b2c', 'Carver', 'crop', 'panel',params.get('athlete'));
    const B = mk('#e0b48f', '#15386b', 'Lakeridge', 'buzz', 'sash',params.get('athleteB'));
    if(params.get('sequence')==='supported-chain')registerSupportedArmBarChain(A.scale,B.scale);
    if(params.get('skeleton')==='1')for(const anim of [A,B]){
      const helper=new SkeletonHelper(anim.character.root);
      for(const material of Array.isArray(helper.material)?helper.material:[helper.material])material.depthTest=false;
      helper.renderOrder=10;
      scene.add(helper);
    }
    const frame = { x: 0, z: 0, yaw: 0 };
    const pose = (time: number, dynamicDt?: number, activeClip = clip, activeHold = hold, applyEffort = true) => {
      const effort = applyEffort ? params.get('effort') : null;
      if (effort) {
        const bottomInitiates = params.get('effortRole') === 'B';
        const result = params.get('outcome') === 'lost' ? 'lost' : 'ok';
        // Static samples seek to the pulse; playback must let it complete.
        A.effort(effort, bottomInitiates, result, dynamicDt === undefined);
        B.effort(effort, !bottomInitiates, result, dynamicDt === undefined);
      }
      for (let pass = 0; pass < (dynamicDt !== undefined ? 1 : effort ? 12 : 2); pass++) {
        for (const [anim, role, opp] of [
          [A, 'A', B],
          [B, 'B', A],
        ] as const) {
          anim.instant = dynamicDt === undefined;
          anim.update(
            dynamicDt ?? 1 / 60,
            {
              mode: 'paired',
              clip: activeClip,
              hold: activeHold,
              role,
              frame,
              mirror,
              u: time,
              progress: time,
              intensity: Math.max(0, Math.min(1, Number(params.get('intensity') ?? 0))),
              pockets: Math.max(0,Math.min(1,Number(params.get('pockets')??0))),
              resistance: Math.max(0,Math.min(1,Number(params.get('resistance')??0))),
              dist,
              stamina: 1,
              exertion: 0,
            },
            opp,
          );
        }
        // Same head clearance as the game (&noclear=1 shows the raw clip).
        if (params.get('noclear') !== '1') resolveHeadClearance(A, B, dynamicDt ?? 1 / 60);
        A.applyContacts(dynamicDt ?? 1, B);
        B.applyContacts(dynamicDt ?? 1, A);
      }
      if(params.get('skeleton')==='1') info.textContent = `${clip} ${time.toFixed(2)} `+(['neck',mirror?'shinR':'shinL',mirror?'footR':'footL'] as BoneName[]).map(n=>`${n}: ${B.bonePos(n,new Vector3()).toArray().map(x=>x.toFixed(3)).join(',')}`).join(' | ');
    };
    // A recovery used as the source of a release needs the same size-aware
    // head support as a recovery viewed on its own.
    if(['flatGroundedDraft','flatPressureDraft'].includes(clip)||/Seated(Finish|Turn|Exit|Fall)Draft$/.test(clip))registerSeatedBarDrafts(A.scale,B.scale);
    const headPostClips = new Set(['doubleBarSupportedRecoverDraft','doubleBarSupportedEntryDraft','doubleBarSupportedHeadPostDraft','doubleBarHeadPostDraft','doubleBarHeadPostEntryDraft','doubleBarHeadPostBridgeDraft','doubleBarHeadPostRecoverDraft']);
    if([clip,params.get('sourceMove'),params.get('sourceHold')].some(id=>id!==null&&headPostClips.has(id))){
      const supportedHeadPost=[clip,params.get('sourceMove'),params.get('sourceHold')].some(id=>id==='doubleBarSupportedHeadPostDraft'||id==='doubleBarSupportedEntryDraft'||id==='doubleBarSupportedRecoverDraft');
      registerHeadPostDraft(.6,A.scale,B.scale);pose(0,undefined,supportedHeadPost?'doubleBarSupportedHeadPostDraft':'doubleBarHeadPostDraft',true);
      // Translate only the torso root; authored planted feet remain fixed.
      registerHeadPostDraft(.6+.003-headSurfaceMinimum(A.character.root),A.scale,B.scale);pose(0);
    }
    const custom = params.get('times')?.split(',').map(Number);
    const times = custom ?? (strip ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [t, t, t, t, t, t]);
    poseAt = (i: number) => pose(times[i]);
    if (params.get('dynamic') === '1' && !strip && !custom) {
      const duration = Math.max(.1, Number(params.get('duration') ?? .4));
      const hz = Math.max(20, Number(params.get('hz') ?? 60));
      const source=params.get('sourceHold');
      if(source){
        const progress=Math.max(0,Math.min(1,Number(params.get('sourceProgress')??0)));
        pose(progress,undefined,source,true,false);
        for(let i=0;i<hz;i++)pose(progress,1/hz,source,true,false);
      }
      const sourceMove=params.get('sourceMove');
      if(sourceMove){
        const end=Math.max(0,Math.min(1,Number(params.get('sourceU')??.5)));
        const sourceDuration=Math.max(.1,Number(params.get('sourceDuration')??2.6));
        for(let i=0;i<=Math.ceil(end*sourceDuration*hz);i++)pose(Math.min(end,i/(sourceDuration*hz)),1/hz,sourceMove,false,false);
      }
      const frames = Math.ceil(t * duration * hz);
      const targetProgress=Math.max(0,Math.min(1,Number(params.get('targetProgress')??0)));
      for (let i = 0; i <= frames; i++) pose(hold?targetProgress:Math.min(t, i / (duration * hz)), 1 / hz,clip,hold,params.get('effortOnce')!=='1'||i===0);
      const sourcePath=[source,sourceMove].filter(Boolean).join(' → ')||'start';
      info.textContent=`${sourcePath} → ${clip} · ${(frames/hz).toFixed(3)}s · ${hz}Hz${hold?' · target progress='+targetProgress:''}`;
      // Retain the actual spring/contact result across camera views.
      poseAt = null;
    }
    const cam = params.get('cam') ?? 'side';
    const camViews: Record<string, View> = {
      grip: { eye: [1.4, .7, 1.5], look: [-.2,.25,.6], fov: 24, label: 'grip close-up' },
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
    if(params.get('dynamic')!=='1'||strip||custom) info.textContent = `${clip} ${hold ? 'hold progress' : 'move u'}=${strip ? 'strip' : t}${mirror ? ' mirrored' : ''}`;
    // Advance once per frame, then render the same coupled pose from every
    // camera. Static strips cannot expose spring/contact lag during a release.
    const sequence=params.get('sequence');
    if((sequence==='seated-defense'||sequence==='arm-bar'||sequence==='seated-bar-draft'||sequence==='supported-chain') && !strip && !custom){
      // Review the same complete path as the transition regression, including
      // the landing hold and controlled return, without resetting either rig.
      const requestedBar=params.get('bar');
      const bar=isArmBar(requestedBar)?requestedBar:'barHalf';
      const resistedBar=sequence==='arm-bar'&&params.get('outcome')==='resisted';
      const draftBar=requestedBar==='wristBar'?'wristBar':'armBar';
      const phases=sequence==='supported-chain'?[
        {clip:'flatPressureDraft',hold:true,duration:1,progress:0},
        {clip:'armBarSupportedSeatedTurnDraft',hold:false,duration:2.2,progress:0},
        {clip:'armBarSupportedSeatedFinishDraft',hold:true,duration:1.5,progress:0},
        {clip:'armBarSupportedSeatedExitDraft',hold:false,duration:.85,progress:0},
        {clip:'flatPressureDraft',hold:true,duration:1,progress:0},
      ]:sequence==='seated-bar-draft'?[
        {clip:'armBarFlatDraft',hold:true,duration:1,progress:0},
        {clip:`${draftBar}SeatedTurnDraft`,hold:false,duration:2.2,progress:0},
        {clip:`${draftBar}SeatedFinishDraft`,hold:true,duration:2,progress:0},
      ]:resistedBar?[
        {clip:'flat',hold:true,duration:1,progress:0},
        {clip:`${bar}Resisted`,hold:false,duration:1.5,progress:0},
        {clip:'flat',hold:true,duration:1,progress:0},
      ]:sequence==='arm-bar'?[
        {clip:'flat',hold:true,duration:1,progress:0},
        {clip:`${bar}Turn`,hold:false,duration:2.2,progress:0},
        {clip:`${bar}Pin`,hold:true,duration:2,progress:1},
        {clip:`${bar}Exit`,hold:false,duration:.85,progress:0},
        {clip:'flat',hold:true,duration:1,progress:0},
      ]:[
        {clip:'legRide',hold:true,duration:1,progress:1},
        {clip:'sitAndCircleLegDefense',hold:false,duration:2.6,progress:0},
        {clip:'seatedLegDefenseExit',hold:true,duration:.5,progress:0},
        {clip:'recoverSeatedLegDefense',hold:false,duration:1.8,progress:0},
        {clip:'seatedDefenseRecovered',hold:true,duration:.9,progress:0},
        {clip:'ride',hold:true,duration:1.2,progress:0},
      ];
      const total=phases.reduce((sum,p)=>sum+p.duration,0);
      let elapsed=0,paused=params.get('play')!=='1';
      let recorder:MediaRecorder|null=null;
      const controls=document.createElement('div');
      controls.style.cssText='position:fixed;bottom:10px;left:10px;display:flex;gap:8px;align-items:center;background:#222d;padding:8px;color:white;font:13px sans-serif';
      const button=(label:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;controls.appendChild(b);return b;};
      const pause=button(paused?'Play':'Pause',()=>{paused=!paused;pause.textContent=paused?'Play':'Pause';});
      const step=(dt:number)=>{
        elapsed=Math.min(total,elapsed+dt);
        let local=elapsed,phase=phases[phases.length-1];
        for(const candidate of phases){phase=candidate;if(local<candidate.duration)break;local-=candidate.duration;}
        const u=phase.hold?phase.progress:Math.min(1,local/phase.duration);
        frame.yaw=sequence==='seated-defense'&&elapsed>=6.8?(mirror?-1:1)*55*Math.PI/180:0;
        pose(u,dt,phase.clip,phase.hold,false);
        info.textContent=`${phase.clip} · ${elapsed.toFixed(2)} / ${total.toFixed(2)} s · u=${u.toFixed(3)}${mirror?' mirrored':''}`;
        if(elapsed>=total){paused=true;pause.textContent='Play';if(recorder?.state==='recording')recorder.stop();}
      };
      const reset=()=>{elapsed=0;frame.yaw=0;pose(phases[0].progress,undefined,phases[0].clip,true,false);step(0);};
      button('Restart',()=>{reset();paused=false;pause.textContent='Pause';});
      button('Step 1 frame',()=>{paused=true;pause.textContent='Play';step(1/60);});
      const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max=String(total);seek.step=String(1/60);seek.value='0';seek.setAttribute('aria-label','Sequence time');
      seek.oninput=()=>{const target=Number(seek.value);paused=true;pause.textContent='Play';reset();while(elapsed+1/60<target)step(1/60);if(target>elapsed)step(target-elapsed);};
      controls.appendChild(seek);
      const record=button('Record review',()=>{
        if(recorder)return;
        if(typeof MediaRecorder==='undefined'||!canvas.captureStream){info.textContent='Video recording is unavailable in this browser';return;}
        const stream=canvas.captureStream(30),chunks:BlobPart[]=[];
        const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(value=>MediaRecorder.isTypeSupported(value));
        if(!mime){stream.getTracks().forEach(track=>track.stop());info.textContent='WebM recording is unavailable in this browser';return;}
        recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
        recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
        const unlock=()=>{stream.getTracks().forEach(track=>track.stop());recorder=null;for(const control of controls.querySelectorAll('button,input'))(control as HTMLButtonElement).disabled=false;};
        recorder.onerror=()=>{unlock();info.textContent='Recording failed; the animation is still available for review';};
        recorder.onstop=()=>{
          const url=URL.createObjectURL(new Blob(chunks,{type:mime}));
          const link=document.createElement('a');link.href=url;link.download=sequence==='arm-bar'?`${bar}${mirror?'-right':'-left'}${resistedBar?'-resisted':''}-review.webm`:'seated-leg-defense-review.webm';link.click();
          setTimeout(()=>URL.revokeObjectURL(url),60000);unlock();
        };
        reset();paused=false;pause.textContent='Pause';
        for(const control of controls.querySelectorAll('button,input'))(control as HTMLButtonElement).disabled=true;
        recorder.start();
      });
      record.title='Save this complete animation sequence locally for coaching review';
      host.appendChild(controls);
      poseAt=null;reset();
      advanceLab=dt=>{if(!paused){let remaining=Math.min(dt,.1);while(remaining>0){const delta=Math.min(remaining,1/60);step(delta);remaining-=delta;}}seek.value=String(elapsed);};
    } else if(params.get('play')==='1' && !strip && !custom){
      const duration=Math.max(.1,Number(params.get('duration')??(clip==='cradleFightOff'?.85:clip==='cradleFall'?2.2:1)));
      const speed=Math.max(.1,Math.min(2,Number(params.get('speed')??1)));
      const source=params.get('sourceHold');
      const sourceProgress=Math.max(0,Math.min(1,Number(params.get('sourceProgress')??(clip==='cradleFall'?1:0))));
      const lead=source?1:0;
      let elapsed=0;
      poseAt=null;
      pose(source?sourceProgress:0,undefined,source??clip,!!source||hold);
      advanceLab=(dt)=>{
        elapsed=Math.min(lead+duration,elapsed+dt*speed);
        const warming=elapsed<lead;
        const u=warming?0:Math.min(1,(elapsed-lead)/duration);
        // A held position keeps its chosen progress while effort plays, then
        // settles after the input window. Do not turn a sprawl preview into
        // an automatic successful finish by advancing hold progress to one.
        pose(warming?sourceProgress:hold?(clip==='doubleBarHeadPostBridgeDraft'?Math.sin(Math.PI*u)**2:t):u,dt*speed,warming?source!:clip,warming||hold,elapsed<lead+duration);
        info.textContent=`${warming?source:clip} · ${elapsed>=lead+duration?'finished':'playing'} · u=${u.toFixed(3)} · ${speed}×${mirror?' mirrored':''}`;
      };
    }
  }

  (window as unknown as { __labScene: Scene }).__labScene = scene;
  // &only=0: just that one view, filling the canvas (likeness checks against photos).
  const only = params.get('only');
  if (only !== null && views[Number(only)]) views = [views[Number(only)]];
  const camera = new PerspectiveCamera(36, 1, 0.05, 50);
  const render = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    const cols = Number(params.get('cols')) || Math.min(3,views.length,Math.max(1,Math.floor(w/480)));
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
      const focus=new Vector3(...v.look);
      // Pair cameras were authored for landscape cells. Preserve horizontal
      // coverage in a narrow panel instead of cropping the feet and head.
      const fit=Math.max(1,(16/9)/camera.aspect);
      camera.position.sub(focus).multiplyScalar(fit).add(focus);
      camera.lookAt(focus);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    renderer.setScissorTest(false);
  };
  render();
  // Dev: __labShot('name') renders and saves the canvas to outputs/nov08-likeness/shots/ (see vite.config.ts).
  (window as unknown as { __labShot: (name: string) => Promise<string> }).__labShot = async (name: string) => {
    render();
    let url = canvas.toDataURL('image/jpeg', 0.9);
    if (reviewPhotos) url = await withPhotos(url, reviewPhotos, Number(params.get('cols')) || 1);
    const r = await fetch(`/__shot/save?name=${name}`, { method: 'POST', body: url });
    return `${r.status} ${canvas.width}x${canvas.height}`;
  };
  // Textures such as a photo-fitted face load in the background: draw again once they arrive.
  setTimeout(render, 700); setTimeout(render, 2000);
  if (advanceLab) {
    let last: number | undefined;
    const animate=(now:number) => {
      if (!host.isConnected) return;
      if (last !== undefined) advanceLab?.(Math.max(0, Math.min(.05, (now-last)/1000)));
      last=now;
      render(); requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  window.addEventListener('resize', render);
  (window as unknown as { labReady: boolean }).labReady = true;
}

/** Dev review: a contact sheet with each portrait's face (cropped around its outline) under its render cell. */
async function withPhotos(shot: string, photos: ({ url: string; oval: number[] } | undefined)[], cols: number): Promise<string> {
  const load = (src: string) => new Promise<HTMLImageElement>((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = src; });
  const base = await load(shot);
  const rows = Math.ceil(photos.length / cols);
  const cw = Math.floor(base.width / cols), ch = Math.floor(base.height / rows);
  const out = document.createElement('canvas');
  out.width = cw * cols; out.height = ch * rows * 2;
  const g = out.getContext('2d')!;
  g.fillStyle = '#20242c'; g.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < photos.length; i++) {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch * 2;
    g.drawImage(base, cx, Math.floor(i / cols) * ch, cw, ch, cx, cy, cw, ch);
    const p = photos[i];
    if (!p) continue;
    const im = await load(p.url);
    let u0 = 1, u1 = 0, v0 = 1, v1 = 0;
    for (let k = 0; k < p.oval.length; k += 2) { u0 = Math.min(u0, p.oval[k]); u1 = Math.max(u1, p.oval[k]); v0 = Math.min(v0, p.oval[k + 1]); v1 = Math.max(v1, p.oval[k + 1]); }
    // Texture v runs up; the face in the render fills about the middle 40% of the cell's height.
    const fh = (v1 - v0) * im.height / 0.42, fw = fh * cw / ch;
    const mx = (u0 + u1) / 2 * im.width, my = (1 - (v0 + v1) / 2) * im.height;
    g.drawImage(im, mx - fw / 2, my - fh * 0.5, fw, fh, cx, cy + ch, cw, ch);
  }
  return out.toDataURL('image/jpeg', 0.88);
}
