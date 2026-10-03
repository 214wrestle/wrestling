import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Camera, WebGLRenderer } from 'three';
import { createGym } from '../../../arena/gym';
import { MAT } from '../../../sim/rules';
import type { School } from '../../../sim/types';

/**
 * A championship-final set for the realism style: the mat on a raised stage in a
 * dark arena, the game's instanced crowd in the stands, and a broadcast lighting
 * rig — hard overhead keys with soft shadows, cool and warm rim lights from the
 * stands, and a dim studio environment so skin, lycra and plastic get proper
 * reflections. Mat surface at y = 0, where the harness stands the athletes.
 */

const TEX = 2048;
const PPM = TEX / (MAT.halfSize * 2);
const px = (m: number) => m * PPM;

function arcText(g: CanvasRenderingContext2D, text: string, radius: number, start: number, sweep: number, size: number, color: string, flip = false) {
  g.save();
  g.translate(TEX / 2, TEX / 2);
  g.fillStyle = color;
  g.font = `800 ${size}px "Bahnschrift", "Arial Narrow", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = [...text];
  const step = sweep / Math.max(1, chars.length - 1);
  chars.forEach((ch, i) => {
    g.save();
    g.rotate(start + step * i);
    g.translate(0, flip ? radius : -radius);
    if (flip) g.rotate(Math.PI);
    g.fillText(ch, 0, 0);
    g.restore();
  });
  g.restore();
}

function paintMat(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = TEX;
  c.height = TEX;
  const g = c.getContext('2d')!;
  const mid = TEX / 2;
  g.fillStyle = '#16171b';
  g.fillRect(0, 0, TEX, TEX);
  const rC = px(MAT.circleRadius);
  // Out-of-bounds band and competition area.
  g.beginPath();
  g.arc(mid, mid, rC, 0, Math.PI * 2);
  g.fillStyle = '#262329';
  g.fill();
  g.beginPath();
  g.arc(mid, mid, rC - px(1.0), 0, Math.PI * 2);
  g.fillStyle = '#b7a17a';
  g.fill();
  // Boundary line.
  g.beginPath();
  g.arc(mid, mid, rC - px(1.0), 0, Math.PI * 2);
  g.strokeStyle = '#efe9dc';
  g.lineWidth = px(0.05);
  g.stroke();
  g.beginPath();
  g.arc(mid, mid, rC, 0, Math.PI * 2);
  g.strokeStyle = '#efe9dc';
  g.lineWidth = px(0.04);
  g.stroke();
  // Centre circle.
  g.beginPath();
  g.arc(mid, mid, px(MAT.centerRadius), 0, Math.PI * 2);
  g.strokeStyle = '#2a2622';
  g.lineWidth = px(0.05);
  g.stroke();
  // Event text in the band.
  arcText(g, 'DES MOINES  ·  NCAA FINALS  ·  2013', rC - px(0.5), -0.9, 1.8, 72, '#8f8678');
  arcText(g, '165 LB  ·  CHAMPIONSHIP', rC - px(0.5), -0.62, 1.24, 72, '#8f8678', true);
  // Starting box with red and green ends.
  const ll = px(MAT.startingLine);
  const gap = px(0.3);
  g.lineWidth = px(0.05);
  g.strokeStyle = '#efe9dc';
  g.strokeRect(mid - ll / 2, mid - gap, ll, gap * 2);
  g.lineWidth = px(0.07);
  g.strokeStyle = '#c23b3b';
  g.beginPath();
  g.moveTo(mid - ll / 2, mid - gap);
  g.lineTo(mid - ll / 2 + px(0.22), mid - gap);
  g.stroke();
  g.strokeStyle = '#2f9e5c';
  g.beginPath();
  g.moveTo(mid + ll / 2 - px(0.22), mid + gap);
  g.lineTo(mid + ll / 2, mid + gap);
  g.stroke();
  // Vinyl wear and scuffs.
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * TEX;
    const y = Math.random() * TEX;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.025})`;
    g.fillRect(x, y, 2 + Math.random() * 6, 2 + Math.random() * 3);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Fine vinyl grain as a roughness variation. */
function grainTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(40, 40);
  return tex;
}

/**
 * Reflection environment: a dark house with four overhead lamp banks, a warm
 * glow from the lit mat below and a faint band of stands. Specular highlights
 * then read as stage lights rather than a white studio.
 */
function arenaEnvironment(): Scene {
  const env = new Scene();
  const shell = new Mesh(new BoxGeometry(40, 20, 40), new MeshBasicMaterial({ color: '#07080b', side: BackSide }));
  shell.position.y = 6;
  env.add(shell);
  const lamp = new MeshBasicMaterial({ color: new Color('#fff2dc').multiplyScalar(14) });
  for (const [x, z] of [[-4, 4], [4, 4], [4, -4], [-4, -4]] as const) {
    const m = new Mesh(new BoxGeometry(1.6, 0.2, 1.6), lamp);
    m.position.set(x, 10, z);
    env.add(m);
  }
  const floor = new Mesh(new PlaneGeometry(12, 12), new MeshBasicMaterial({ color: new Color('#b7a17a').multiplyScalar(0.5) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  env.add(floor);
  const stands = new Mesh(
    new CylinderGeometry(18, 18, 6, 32, 1, true),
    new MeshBasicMaterial({ color: new Color('#3a3f4c').multiplyScalar(0.6), side: BackSide }),
  );
  stands.position.y = 3;
  env.add(stands);
  return env;
}

export interface ArenaRig {
  /** Camera-relative portrait key and fill, on for headshots only. */
  portrait: Group;
  key: DirectionalLight;
  fill: DirectionalLight;
  rim: DirectionalLight;
  /** Overhead and stand lights with their base intensities, for per-shot balance. */
  house: Array<{ light: SpotLight | HemisphereLight; base: number }>;
  /** Scale the house lights (portraits dim them under the portrait key). */
  setHouse: (k: number) => void;
  /** Crowd brightness multiplier (portrait lights would otherwise light the stands). */
  setCrowd: (k: number) => void;
  /** Low camera-side fill for the tale-of-the-tape shots, 0..1. */
  setTapeFill: (k: number, camera: Camera) => void;
  /** Exposure compensation on the overhead keys for the low hero angle, 0..1. */
  setHeroComp: (k: number) => void;
  /** Strength of the overhead keys' shadows (their 2048 maps are too coarse for close-ups). */
  setHouseShadows: (k: number) => void;
}

export function buildArena(scene: Scene, renderer: WebGLRenderer, schools: [School, School]): ArenaRig {
  scene.background = new Color('#040508');

  // Stage height: the gym floor sits below the raised mat.
  const stageH = 0.62;
  const gym = createGym(schools[0], schools[1]);
  const crowdMats: MeshStandardMaterial[] = [];
  // Drop the generic championship banners: this is a neutral NCAA final.
  for (const child of [...gym.group.children]) {
    if (child instanceof Group && child.children.length === 5 && child.children.every((m) => m instanceof Mesh && m.position.z < -30)) {
      gym.group.remove(child);
    }
  }
  gym.group.position.y = -stageH;
  // A broadcast final keeps the house dark: dim the crowd and stands.
  gym.group.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as MeshStandardMaterial;
    if (!m || !('color' in m)) return;
    if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) {
      m.color.setScalar(0.42);
      crowdMats.push(m);
    }
    else if (!(m as unknown as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) m.color.multiplyScalar(0.6);
    m.envMapIntensity = 0.4;
  });
  scene.add(gym.group);

  const stage = new Group();
  const deck = new Mesh(
    new BoxGeometry(MAT.halfSize * 2 + 1.4, stageH, MAT.halfSize * 2 + 1.4),
    new MeshStandardMaterial({ color: '#0b0c10', roughness: 0.7 }),
  );
  deck.position.y = -stageH / 2 - 0.002;
  deck.receiveShadow = true;
  stage.add(deck);
  // Skirt trim: a thin lit edge so the stage reads in the gameplay shot.
  const trim = new Mesh(
    new BoxGeometry(MAT.halfSize * 2 + 1.42, 0.04, MAT.halfSize * 2 + 1.42),
    new MeshStandardMaterial({ color: '#5d5a55', roughness: 0.4, metalness: 0.5 }),
  );
  trim.position.y = -0.03;
  stage.add(trim);
  const mat = new Mesh(
    new PlaneGeometry(MAT.halfSize * 2, MAT.halfSize * 2),
    new MeshStandardMaterial({ map: paintMat(), roughnessMap: grainTexture(), roughness: 0.8, metalness: 0 }),
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.0;
  mat.receiveShadow = true;
  stage.add(mat);
  scene.add(stage);

  // Studio environment for reflections, kept dim so the spots stay in charge.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(arenaEnvironment(), 0.02).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();

  const house: ArenaRig['house'] = [];
  const hemi = new HemisphereLight('#8ea3c4', '#3a2e22', 0.35);
  scene.add(hemi);
  house.push({ light: hemi, base: hemi.intensity });

  // Overhead broadcast keys.
  const keys: Array<[number, number, number, boolean, number]> = [
    [-3.6, 9.5, 4.2, true, 105],
    [3.8, 9.5, 3.2, true, 85],
    [3.2, 9.5, -4.4, false, 60],
    [-3.8, 9.5, -3.6, false, 60],
  ];
  for (const [x, y, z, shadows, power] of keys) {
    const spot = new SpotLight('#fff3e2', power, 30, 0.45, 0.7, 1.6);
    spot.position.set(x, y, z);
    // Each key aims a little toward its own side, so their pools overlap into
    // an even field instead of stacking into one hot spot in the centre circle.
    spot.target.position.set(x * 0.22, 0.6, z * 0.22);
    spot.castShadow = shadows;
    if (shadows) {
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.camera.near = 4;
      spot.shadow.camera.far = 16;
      spot.shadow.bias = -0.0004;
      spot.shadow.normalBias = 0.012;
      spot.shadow.radius = 3;
    }
    scene.add(spot, spot.target);
    house.push({ light: spot, base: spot.intensity });
  }
  // Rim lights from the stands, low and opposite each other.
  const rimCool = new SpotLight('#9fc0ff', 120, 26, 0.28, 0.6, 1.5);
  rimCool.position.set(-2.5, 3.2, -8.5);
  rimCool.target.position.set(0, 1.35, 0);
  const rimWarm = new SpotLight('#ffc89a', 80, 26, 0.3, 0.6, 1.5);
  rimWarm.position.set(8.0, 2.6, -2.0);
  rimWarm.target.position.set(0, 1.2, 0);
  scene.add(rimCool, rimCool.target, rimWarm, rimWarm.target);
  house.push({ light: rimCool, base: rimCool.intensity }, { light: rimWarm, base: rimWarm.intensity });

  // Portrait rig (camera-relative), switched on for headshots.
  const portrait = new Group();
  const key = new DirectionalLight('#fff1e4', 2.5);
  // The portrait key casts a tight, soft shadow: jaw onto neck, nose onto lip.
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -0.3;
  key.shadow.camera.right = 0.3;
  key.shadow.camera.top = 0.3;
  key.shadow.camera.bottom = -0.3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 4;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = 6;
  const fill = new DirectionalLight('#dfe6ff', 0.8);
  const rim = new DirectionalLight('#dfe8ff', 1.6);
  portrait.add(key, key.target, fill, fill.target, rim, rim.target);
  portrait.visible = false;
  scene.add(portrait);

  let houseK = 1;
  let heroK = 0;
  const applyHouse = () => {
    for (const h of house) {
      const overhead = h.light instanceof SpotLight && h.light.position.y > 9;
      h.light.intensity = h.base * houseK * (overhead ? 1 - heroK * 0.25 : 1);
    }
  };
  const setHouse = (k: number) => {
    houseK = k;
    applyHouse();
  };
  const setHeroComp = (k: number) => {
    heroK = k;
    applyHouse();
  };
  const setHouseShadows = (k: number) => {
    for (const h of house) if (h.light.castShadow && h.light.shadow) h.light.shadow.intensity = k;
  };
  const tapeFill = new DirectionalLight('#e6ecff', 0);
  scene.add(tapeFill, tapeFill.target);
  const setTapeFill = (k: number, camera: Camera) => {
    tapeFill.intensity = 0.9 * k;
    // Near lens height, so the planes under the brows, nose and lips are lifted
    // rather than reading as a painted-on goatee.
    tapeFill.position.copy(camera.position).add(new Vector3(0.8, 0.15, 0));
    tapeFill.target.position.set(0, 1.1, 0);
    tapeFill.updateMatrixWorld();
    tapeFill.target.updateMatrixWorld();
  };
  const setCrowd = (k: number) => {
    for (const m of crowdMats) m.color.setScalar(0.42 * k);
  };
  return { portrait, key, fill, rim, house, setHouse, setCrowd, setTapeFill, setHeroComp, setHouseShadows };
}
