import { Vector3, Quaternion, TransformNode, MeshBuilder, Mesh, VertexData, type Scene, type StandardMaterial, type ShadowGenerator } from './babylon';
import { material, canvasMaterial, panel } from './materials';
import { clamp, type MatchState, type Side, type Wrestler as WrestlerState } from '../game/types';

type Point = [number, number, number];
type Joint = 'hip' | 'chest' | 'head' | 'ls' | 'rs' | 'le' | 're' | 'lw' | 'rw' | 'lh' | 'rh' | 'lk' | 'rk' | 'la' | 'ra';
type Pose = Record<Joint, Point>;
interface Segment { mesh: Mesh; a: Joint; b: Joint; radius?: number; start?: number; end?: number }
const v = (p: Point) => new Vector3(...p);
const lerp = (a: Point, b: Point, n: number): Point => [a[0] + (b[0] - a[0]) * n, a[1] + (b[1] - a[1]) * n, a[2] + (b[2] - a[2]) * n];
function stance(): Pose {
  return { hip: [0, 0.86, -0.12], chest: [0, 1.28, 0.24], head: [0, 1.56, 0.41], ls: [-0.29, 1.28, 0.22], rs: [0.29, 1.28, 0.22], le: [-0.4, 0.99, 0.4], re: [0.39, 1.02, 0.36], lw: [-0.23, 1.07, 0.7], rw: [0.23, 1.13, 0.66], lh: [-0.16, 0.85, -0.12], rh: [0.16, 0.85, -0.12], lk: [-0.28, 0.46, 0.21], rk: [0.29, 0.45, -0.13], la: [-0.31, 0.11, 0.4], ra: [0.33, 0.11, -0.43] };
}
function upright(): Pose {
  const p = stance();
  p.hip = [0, 1, 0]; p.chest = [0, 1.57, 0]; p.head = [0, 1.88, 0.01];
  p.ls = [-0.29, 1.56, 0]; p.rs = [0.29, 1.56, 0];
  p.le = [-0.38, 1.2, 0.02]; p.re = [0.38, 1.2, 0.02];
  p.lw = [-0.36, 0.97, 0.1]; p.rw = [0.36, 0.97, 0.1];
  p.lh = [-0.16, 1, 0]; p.rh = [0.16, 1, 0];
  p.lk = [-0.2, 0.56, 0.03]; p.rk = [0.2, 0.56, 0.03]; p.la = [-0.22, 0.11, 0]; p.ra = [0.22, 0.11, 0];
  return p;
}
function ground(top: boolean): Pose {
  return top ? {
    hip: [0, 0.77, -0.12], chest: [0, 1.02, 0.36], head: [0, 1.16, 0.64],
    ls: [-0.3, 1.02, 0.35], rs: [0.3, 1.02, 0.35], le: [-0.38, 0.7, 0.59], re: [0.37, 0.76, 0.66], lw: [-0.14, 0.51, 0.71], rw: [0.16, 0.61, 0.87],
    lh: [-0.16, 0.76, -0.12], rh: [0.16, 0.76, -0.12], lk: [-0.38, 0.19, 0.1], rk: [0.4, 0.3, -0.2], la: [-0.4, 0.1, -0.51], ra: [0.48, 0.1, -0.65],
  } : {
    hip: [0, 0.57, -0.15], chest: [0, 0.69, 0.4], head: [0, 0.9, 0.62],
    ls: [-0.28, 0.69, 0.4], rs: [0.28, 0.69, 0.4], le: [-0.38, 0.38, 0.6], re: [0.38, 0.38, 0.6], lw: [-0.36, 0.14, 0.83], rw: [0.36, 0.14, 0.83],
    lh: [-0.16, 0.55, -0.15], rh: [0.16, 0.55, -0.15], lk: [-0.29, 0.16, -0.24], rk: [0.29, 0.16, -0.24], la: [-0.32, 0.09, -0.74], ra: [0.32, 0.09, -0.74],
  };
}
function blend(a: Pose, b: Pose, f: number): Pose {
  const out = {} as Pose;
  for (const key of Object.keys(a) as Joint[]) out[key] = lerp(a[key], b[key], f);
  return out;
}
function penetration(): Pose {
  const p = stance();
  p.hip = [0, 0.58, 0.13]; p.chest = [0, 0.91, 0.53]; p.head = [0, 1.04, 0.83];
  p.ls = [-0.28, 0.93, 0.5]; p.rs = [0.28, 0.93, 0.5]; p.le = [-0.35, 0.57, 0.74]; p.re = [0.35, 0.6, 0.76]; p.lw = [-0.23, 0.43, 1.06]; p.rw = [0.23, 0.46, 1.05];
  p.lh = [-0.16, 0.56, 0.13]; p.rh = [0.16, 0.56, 0.13]; p.lk = [-0.23, 0.18, 0.48]; p.rk = [0.23, 0.29, -0.32]; p.la = [-0.25, 0.12, 0.12]; p.ra = [0.26, 0.1, -0.7];
  return p;
}

export class WrestlerView {
  root: TransformNode;
  private scene: Scene;
  private pose = stance();
  private segments: Segment[] = [];
  private joints: { mesh: Mesh; joint: Joint; offset: Point }[] = [];
  private head: TransformNode;
  private torso: Mesh;
  private singlet: Mesh;
  private crest: Mesh;
  private shoes: Mesh[] = [];
  private shadow: Mesh;
  private shoulderSkin: StandardMaterial;
  private previousHeading = 0;
  private walk = 0;
  private isReferee = false;
  private handRoots: TransformNode[] = [];
  private lastX = 0;
  private lastZ = 0;
  private localVelocity = new Vector3();
  private backRoll = 0;
  private footPlants: (Vector3 | null)[] = [null, null];
  side: Side;

  constructor(scene: Scene, side: Side, shadowGenerator: ShadowGenerator, referee = false) {
    this.scene = scene; this.side = side; this.isReferee = referee;
    this.root = new TransformNode(`wrestler-${side}${referee ? '-ref' : ''}`, scene);
    const skin = this.shoulderSkin = material(scene, `skin-${side}-${referee}`, referee ? '#b39077' : side === 0 ? '#c8997b' : '#956a51', 0.04);
    const darkSkin = material(scene, `skin-shadow-${side}`, side === 0 ? '#9f6650' : '#603c30', 0.08);
    const uniform = material(scene, `singlet-${side}-${referee}`, referee ? '#bbbeb7' : side === 0 ? '#174638' : '#943b33', 0.045);
    skin.backFaceCulling = false; uniform.backFaceCulling = false;
    if (referee) {
      const stripes = canvasMaterial(scene, 'referee-shirt-stripes', 256, 256, c => { c.fillStyle = '#c9c8be'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#34443b'; for (let x = 0; x < 256; x += 32) c.fillRect(x, 0, 11, 256); });
      uniform.diffuseTexture = stripes.diffuseTexture;
    }
    const trim = material(scene, `trim-${side}`, side === 0 ? '#e5c777' : '#f2e6d0', 0.22);
    const black = material(scene, `boots-${side}`, '#18221f', 0.15);
    const white = material(scene, `tape-${side}`, '#e8e2cb', 0.05);
    const hair = material(scene, `hair-${side}`, side === 0 ? '#3b2d23' : '#161716', 0.03);
    const ball = (name: string, scale: Point, mat: StandardMaterial, parent = this.root) => {
      const m = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16 }, scene);
      m.scaling.copyFrom(v(scale)); m.material = mat; m.parent = parent; return m;
    };
    const joint = (name: string, key: Joint, scale: Point, mat: StandardMaterial, offset: Point = [0, 0, 0]) => {
      const m = ball(name, scale, mat); this.joints.push({ mesh: m, joint: key, offset }); return m;
    };
    const limb = (name: string, a: Joint, b: Joint, top: number, bottom: number, mat: StandardMaterial, start = 0, end = 1) => {
      const m = mat === skin
        ? MeshBuilder.CreateCapsule(name, { height: 1, radiusTop: top, radiusBottom: bottom, tessellation: 16, capSubdivisions: 4, subdivisions: 2 }, scene)
        : MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: top * 2, diameterBottom: bottom * 2, tessellation: 16 }, scene);
      m.parent = this.root; m.material = mat; m.rotationQuaternion = Quaternion.Identity();
      this.segments.push({ mesh: m, a, b, start, end }); return m;
    };
    this.torso = this.makeTorso('anatomy', referee ? uniform : skin, [0.22, 0.21, 0.26, 0.31, 0.255], [0.15, 0.13, 0.17, 0.185, 0.15]);
    this.singlet = this.makeTorso('singlet', uniform, [0.226, 0.218, 0.269, 0.296, 0.29], [0.156, 0.137, 0.177, 0.189, 0.17]);
    joint('hip', 'hip', [0.46, 0.27, 0.34], referee ? black : uniform);
    joint('left-deltoid', 'ls', [0.295, 0.31, 0.295], referee ? uniform : skin);
    joint('right-deltoid', 'rs', [0.295, 0.31, 0.295], referee ? uniform : skin);
    limb('neck', 'chest', 'head', 0.105, 0.12, skin, 0.15, 0.74);
    for (const sideName of ['l', 'r'] as const) {
      const s = sideName === 'l' ? -1 : 1;
      limb(`${sideName}-bicep`, `${sideName}s`, `${sideName}e`, 0.12, 0.143, skin);
      joint(`${sideName}-elbow`, `${sideName}e`, [0.205, 0.205, 0.205], skin);
      limb(`${sideName}-forearm`, `${sideName}e`, `${sideName}w`, 0.078, 0.115, skin);
      limb(`${sideName}-wrist-tape`, `${sideName}e`, `${sideName}w`, 0.084, 0.086, white, 0.77, 0.96);
      joint(`${sideName}-palm`, `${sideName}w`, [0.16, 0.185, 0.1], skin, [0, 0, 0.036]);
      joint(`${sideName}-thumb`, `${sideName}w`, [0.065, 0.11, 0.06], skin, [-s * 0.068, 0.009, 0.063]);
      for (let f = 0; f < 4; f++) joint(`${sideName}-finger-${f}`, `${sideName}w`, [0.032, 0.095, 0.04], skin, [(f - 1.5) * 0.032, -0.077, 0.042]);
      const hand = new TransformNode(`${sideName}-articulated-hand`, scene); hand.parent = this.root;
      for (const part of this.joints.filter(j => j.joint === `${sideName}w`)) { part.mesh.parent = hand; part.mesh.position.copyFrom(v(part.offset)); }
      this.handRoots.push(hand);
      limb(`${sideName}-thigh`, `${sideName}h`, `${sideName}k`, 0.135, 0.177, referee ? black : skin);
      limb(`${sideName}-shorts`, `${sideName}h`, `${sideName}k`, 0.172, 0.183, referee ? black : uniform, 0, 0.56);
      limb(`${sideName}-short-trim`, `${sideName}h`, `${sideName}k`, 0.172, 0.173, referee ? black : trim, 0.50, 0.56);
      joint(`${sideName}-knee`, `${sideName}k`, [0.23, 0.245, 0.23], referee ? black : skin);
      if (sideName === 'l' || referee) joint(`${sideName}-kneepad`, `${sideName}k`, [0.253, 0.275, 0.25], black, [0, 0, 0.025]);
      limb(`${sideName}-calf`, `${sideName}k`, `${sideName}a`, referee ? 0.11 : 0.076, 0.12, referee ? black : skin);
      joint(`${sideName}-boot-cuff`, `${sideName}a`, [0.16, 0.25, 0.18], black, [0, 0.055, 0]);
      const boot = joint(`${sideName}-shoe`, `${sideName}a`, [0.215, 0.16, 0.385], black, [0, -0.035, 0.092]); this.shoes.push(boot);
      joint(`${sideName}-sole`, `${sideName}a`, [0.22, 0.055, 0.395], white, [0, -0.098, 0.098]);
      for (let f = 0; f < 3; f++) joint(`${sideName}-lace-${f}`, `${sideName}a`, [0.105, 0.022, 0.025], trim, [0, 0.034 - f * 0.008, 0.10 + f * 0.038]);
      limb(`${sideName}-singlet-strap`, `${sideName}h`, `${sideName}s`, 0.062, 0.074, uniform, 0.48, 0.97);
    }
    this.head = new TransformNode('head', scene); this.head.parent = this.root;
    if (!referee) this.head.scaling.setAll(0.82);
    ball('skull', [0.345, 0.414, 0.335], skin, this.head);
    const jaw = ball('jaw', [0.295, 0.255, 0.28], skin, this.head); jaw.position.set(0, -0.105, 0.025);
    const chin = ball('chin', [0.20, 0.1, 0.11], skin, this.head); chin.position.set(0, -0.202, 0.068);
    const nose = ball('nose', [0.072, 0.117, 0.109], skin, this.head); nose.position.set(0, -0.012, 0.16);
    const hairCap = ball('cropped-hair', [0.35, 0.178, 0.338], hair, this.head); hairCap.position.set(0, 0.157, -0.008);
    for (const s of [-1, 1]) {
      const brow = ball('brow', [0.10, 0.037, 0.023], hair, this.head); brow.position.set(s * 0.077, 0.056, 0.155); brow.rotation.z = s * 0.12;
      const eye = ball('eye', [0.029, 0.022, 0.012], black, this.head); eye.position.set(s * 0.078, 0.019, 0.16);
      const ear = ball('ear', [0.074, 0.126, 0.07], skin, this.head); ear.position.set(s * 0.177, 0, 0);
      if (!referee) {
        const cup = ball('headgear-earcup', [0.095, 0.204, 0.179], side === 0 ? trim : white, this.head); cup.position.set(s * 0.182, 0.01, -0.013);
        const inset = ball('headgear-padding', [0.102, 0.142, 0.127], uniform, this.head); inset.position.set(s * 0.191, 0.014, -0.009);
        for (let j = 0; j < 3; j++) { const hole = ball('earcup-vent', [0.106, 0.018, 0.025], black, this.head); hole.position.set(s * 0.195, 0.05 - j * 0.036, -0.006); }
      }
    }
    const mouth = ball('mouth', [0.092, 0.016, 0.015], darkSkin, this.head); mouth.position.set(0, -0.113, 0.149);
    if (!referee) {
      for (const z of [-0.08, 0.08]) {
        const path = Array.from({ length: 13 }, (_, n) => { const t = n / 12 * Math.PI; return new Vector3(Math.cos(t) * 0.19, Math.sin(t) * 0.232, z); });
        const strap = MeshBuilder.CreateTube('headgear-strap', { path, radius: 0.016, tessellation: 6 }, scene); strap.material = white; strap.parent = this.head;
      }
      const chinstrap = MeshBuilder.CreateTube('chin-strap', { path: [new Vector3(-0.17, -0.035, 0), new Vector3(-0.1, -0.22, 0.105), new Vector3(0.1, -0.22, 0.105), new Vector3(0.17, -0.035, 0)], radius: 0.012, tessellation: 6 }, scene); chinstrap.parent = this.head; chinstrap.material = white;
    }
    const crestMat = canvasMaterial(scene, `crest-${side}-${referee}`, 128, 160, c => {
      c.fillStyle = referee ? '#bdbfb9' : side === 0 ? '#174638' : '#9e352e'; c.fillRect(0, 0, 128, 160);
      c.fillStyle = '#f1e3b8'; c.font = 'bold 96px Georgia'; c.textAlign = 'center'; c.fillText(referee ? '' : side === 0 ? 'N' : 'R', 64, 108);
    });
    this.crest = panel(scene, 'chest-crest', 0.16, 0.2, Vector3.Zero(), crestMat, Math.PI); this.crest.parent = this.root; this.crest.setEnabled(!referee);
    this.shadow = MeshBuilder.CreateGround(`contact-${side}`, { width: 1.35, height: 1.1 }, scene);
    const sm = canvasMaterial(scene, `shadow-${side}`, 128, 128, c => { const g = c.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
    sm.diffuseTexture!.hasAlpha = true; sm.useAlphaFromDiffuseTexture = true; sm.disableLighting = true; sm.emissiveColor.set(0.05, 0.05, 0.05); this.shadow.material = sm; this.shadow.position.y = 0.146;
    for (const m of this.root.getChildMeshes()) { m.receiveShadows = true; if (!/finger|lace|vent|strap|sole|eye|brow|mouth|crest|tape/.test(m.name)) shadowGenerator.addShadowCaster(m, false); }
    if (referee) this.root.scaling.setAll(0.96);
  }
  private makeTorso(name: string, mat: StandardMaterial, widths: number[], depths: number[]): Mesh {
    const m = new Mesh(name, this.scene), positions: number[] = [], indices: number[] = [], normals: number[] = [], uvs: number[] = [];
    const segments = 24;
    for (let ring = 0; ring < widths.length; ring++) for (let n = 0; n <= segments; n++) {
      const t = n / segments * Math.PI * 2;
      positions.push(Math.cos(t) * widths[ring], ring / (widths.length - 1) - 0.5, Math.sin(t) * depths[ring]);
      uvs.push(n / segments, ring / (widths.length - 1));
      if (ring < widths.length - 1 && n < segments) { const a = ring * (segments + 1) + n; indices.push(a, a + segments + 1, a + 1, a + 1, a + segments + 1, a + segments + 2); }
    }
    VertexData.ComputeNormals(positions, indices, normals); const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs; data.applyToMesh(m);
    m.parent = this.root; m.material = mat; m.rotationQuaternion = Quaternion.Identity(); return m;
  }
  private connect(mesh: Mesh, a: Vector3, b: Vector3) {
    const dir = b.subtract(a), length = dir.length(); dir.normalize();
    mesh.position.copyFrom(a.add(b).scale(0.5)); mesh.scaling.y = length;
    Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, dir, mesh.rotationQuaternion!);
  }
  /** Two-bone arm IK keeps reaches anatomical instead of stretching cylinders. */
  private solveArm(p: Pose, side: 'l' | 'r') {
    const shoulder = v(p[`${side}s`]), hand = v(p[`${side}w`]), preferred = v(p[`${side}e`]);
    const reach = hand.subtract(shoulder), distance = clamp(reach.length(), 0.12, 0.635);
    const direction = reach.normalize();
    const elbowPlane = preferred.subtract(shoulder);
    elbowPlane.subtractInPlace(direction.scale(Vector3.Dot(elbowPlane, direction)));
    if (elbowPlane.lengthSquared() < 0.0001) elbowPlane.set(side === 'l' ? -1 : 1, -0.5, 0);
    elbowPlane.normalize();
    const upper = 0.33, lower = 0.315;
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    const elbow = shoulder.add(direction.scale(along)).add(elbowPlane.scale(height));
    const wrist = shoulder.add(direction.scale(distance));
    p[`${side}e`] = [elbow.x, elbow.y, elbow.z]; p[`${side}w`] = [wrist.x, wrist.y, wrist.z];
  }
  private solveLeg(p: Pose, side: 'l' | 'r') {
    const hip = v(p[`${side}h`]), ankle = v(p[`${side}a`]), preferred = v(p[`${side}k`]);
    const reach = ankle.subtract(hip), distance = clamp(reach.length(), 0.17, 0.94), direction = reach.normalize();
    const plane = preferred.subtract(hip); plane.subtractInPlace(direction.scale(Vector3.Dot(plane, direction)));
    if (plane.lengthSquared() < 0.0001) plane.set(0, 0, 1);
    plane.normalize();
    const thigh = 0.49, shin = 0.47, along = (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
    const knee = hip.add(direction.scale(along)).add(plane.scale(Math.sqrt(Math.max(0, thigh * thigh - along * along))));
    const foot = hip.add(direction.scale(distance));
    p[`${side}k`] = [knee.x, Math.max(0.14, knee.y), knee.z];
    p[`${side}a`] = [foot.x, Math.max(0.11, foot.y), foot.z];
  }
  update(w: WrestlerState, state: MatchState, dt: number, time: number, referee = false) {
    let target = stance();
    const vx = (w.x - this.lastX) / Math.max(dt, 0.001), vz = (w.z - this.lastZ) / Math.max(dt, 0.001);
    this.lastX = w.x; this.lastZ = w.z;
    const localX = vx * Math.cos(w.heading) - vz * Math.sin(w.heading), localZ = vx * Math.sin(w.heading) + vz * Math.cos(w.heading);
    this.localVelocity = Vector3.Lerp(this.localVelocity, new Vector3(clamp(localX, -2, 2), 0, clamp(localZ, -2, 2)), 1 - Math.exp(-dt * 9));
    this.walk += dt * (w.speed > 0.1 ? w.speed * 6.5 : 1);
    const breath = Math.sin(time * 2.5 + this.side) * 0.012;
    let x = w.x, z = w.z, heading = w.heading;
    const top = state.top === this.side;
    if (state.top !== null) target = ground(top);
    if (state.exchange?.kind === 'takedown') target = blend(state.exchange.actor === this.side ? penetration() : stance(), ground(state.exchange.actor === this.side), clamp(state.exchange.age / 0.65, 0, 1));
    if (state.top === null && w.speed > 0.08) {
      const stride = Math.sin(this.walk), lift = Math.cos(this.walk);
      target.la[2] += stride * this.localVelocity.z * 0.16; target.ra[2] -= stride * this.localVelocity.z * 0.16;
      target.la[0] += stride * this.localVelocity.x * 0.13; target.ra[0] -= stride * this.localVelocity.x * 0.13;
      target.la[1] += Math.max(0, lift) * 0.055; target.ra[1] += Math.max(0, -lift) * 0.055;
      target.lk[2] += stride * this.localVelocity.z * 0.10; target.rk[2] -= stride * this.localVelocity.z * 0.1;
      target.hip[0] += stride * 0.025; target.chest[0] += this.localVelocity.x * 0.015;
      target.hip[1] += Math.abs(lift) * 0.018;
    }
    if (!referee && state.top === null && !state.exchange && (w.move === 'idle' || w.move === 'handfight') && w.speed > 0.08) {
      for (const i of [0, 1] as const) {
        const key = i === 0 ? 'la' : 'ra', foot = target[key], swing = Math.sin(this.walk + i * Math.PI);
        const desired = new Vector3(w.x + Math.cos(w.heading) * foot[0] + Math.sin(w.heading) * foot[2], 0, w.z - Math.sin(w.heading) * foot[0] + Math.cos(w.heading) * foot[2]);
        if (!this.footPlants[i]) this.footPlants[i] = desired;
        if (swing > 0) this.footPlants[i] = Vector3.Lerp(this.footPlants[i]!, desired, 1 - Math.exp(-dt * 22));
        const dx = this.footPlants[i]!.x - w.x, dz = this.footPlants[i]!.z - w.z;
        target[key] = [dx * Math.cos(w.heading) - dz * Math.sin(w.heading), 0.11 + Math.max(0, swing) * 0.085, dx * Math.sin(w.heading) + dz * Math.cos(w.heading)];
      }
    } else this.footPlants = [null, null];
    const impulse = Math.sin(clamp(w.moveTime / w.moveDuration, 0, 1) * Math.PI);
    if (state.top === null && (!state.exchange || state.exchange.kind !== 'takedown')) {
      if (w.move === 'shot') {
        const p = stance();
        p.hip = [0, 0.58, 0.13]; p.chest = [0, 0.91, 0.53]; p.head = [0, 1.04, 0.83];
        p.ls = [-0.28, 0.93, 0.5]; p.rs = [0.28, 0.93, 0.5]; p.le = [-0.35, 0.57, 0.74]; p.re = [0.35, 0.6, 0.76]; p.lw = [-0.23, 0.43, 1.06]; p.rw = [0.23, 0.46, 1.05];
        p.lh = [-0.16, 0.56, 0.13]; p.rh = [0.16, 0.56, 0.13]; p.lk = [-0.23, 0.18, 0.48]; p.rk = [0.23, 0.29, -0.32]; p.la = [-0.25, 0.12, 0.12]; p.ra = [0.26, 0.1, -0.7];
        target = blend(target, p, Math.min(1, impulse * 1.5));
      } else if (w.move === 'handfight' || w.move === 'snap') {
        target.lw[2] += impulse * 0.20; target.rw[2] += impulse * 0.16;
        target.lw[1] += impulse * (w.move === 'snap' ? 0.31 : 0.10); target.le[2] += impulse * 0.13;
        target.chest[2] += impulse * 0.09; target.head[2] += impulse * 0.1;
      }
      if (w.defending || w.move === 'sprawl') {
        const p = ground(false); p.hip = [0, 0.82, -0.29]; p.chest = [0, 1.06, 0.26]; p.head = [0, 1.22, 0.53];
        p.ls = [-0.3, 1.05, 0.24]; p.rs = [0.3, 1.05, 0.24]; p.lh = [-0.16, 0.8, -0.3]; p.rh = [0.16, 0.8, -0.3]; p.lk = [-0.4, 0.39, -0.48]; p.rk = [0.4, 0.39, -0.48]; p.la = [-0.48, 0.1, -0.81]; p.ra = [0.48, 0.1, -0.81];
        target = blend(target, p, w.move === 'sprawl' ? 1 : 0.6);
      }
    } else if (state.top !== null && !state.exposure) {
      if (w.move === 'standup') {
        const p = stance(); p.lw = [-0.13, 0.95, -0.18]; p.rw = [0.13, 0.94, -0.18];
        target = blend(target, p, impulse * 0.85);
      }
      if (w.move === 'switch') { target.hip[0] += impulse * 0.25; target.lw = [-0.56, 0.16, 0.1]; target.chest[0] -= impulse * 0.14; }
      if (w.move === 'heist') {
        const p = ground(false); p.hip = [0.25, 0.32, 0.18]; p.chest = [0.12, 0.78, 0.18]; p.head = [0.07, 1.01, 0.27];
        p.ls = [-0.16, 0.78, 0.18]; p.rs = [0.39, 0.78, 0.18]; p.lw = [-0.4, 0.15, -0.05]; p.rw = [0.39, 0.6, 0.52];
        p.lh = [0.08, 0.3, 0.18]; p.rh = [0.42, 0.3, 0.18]; p.lk = [-0.28, 0.23, 0.48]; p.rk = [0.58, 0.43, 0.46];
        p.la = [-0.32, 0.1, 0.86]; p.ra = [0.64, 0.1, 0.73]; target = blend(target, p, impulse);
        heading += impulse * 0.65;
      }
      if (w.move === 'turn' || w.move === 'breakdown') { target.lw[2] += impulse * 0.25; target.rw[0] -= impulse * 0.25; target.chest[1] -= impulse * 0.1; }
    }
    if (state.exposure > 0 && state.top !== null) {
      if (!top) {
        target = { hip: [0, 0.31, -0.12], chest: [0, w.defending ? 0.46 : 0.25, 0.38], head: [0, 0.29, 0.75], ls: [-0.29, w.defending ? 0.45 : 0.23, 0.37], rs: [0.29, 0.26, 0.37], le: [-0.46, 0.17, 0.62], re: [0.48, 0.3, 0.55], lw: [-0.38, 0.35, 0.88], rw: [0.34, 0.46, 0.83], lh: [-0.16, 0.31, -0.12], rh: [0.16, 0.31, -0.12], lk: [-0.34, 0.58, -0.45], rk: [0.35, 0.43, -0.43], la: [-0.4, 0.11, -0.8], ra: [0.4, 0.1, -0.81] };
        if (w.defending) target.hip[1] += Math.sin(time * 8) * 0.04;
      } else {
        target = ground(true); target.hip[1] -= 0.24; target.chest[1] -= 0.40; target.head[1] -= 0.35;
        target.ls[1] -= 0.40; target.rs[1] -= 0.40; target.rw = [0.2, 0.25, 0.92];
        x += Math.sin(heading) * 0.42; z += Math.cos(heading) * 0.42;
      }
    }
    // Shared contact targets make hand fighting and shots visibly connect to the
    // other athlete instead of playing an isolated punching animation.
    if (!referee && state.phase === 'wrestling') {
      const opponent = state.wrestlers[this.side === 0 ? 1 : 0];
      const contact = (right: number, height: number, forward: number): Point => {
        const wx = opponent.x + Math.cos(opponent.heading) * right + Math.sin(opponent.heading) * forward;
        const wz = opponent.z - Math.sin(opponent.heading) * right + Math.cos(opponent.heading) * forward;
        const dx = wx - w.x, dz = wz - w.z;
        return [dx * Math.cos(w.heading) - dz * Math.sin(w.heading), height, dx * Math.sin(w.heading) + dz * Math.cos(w.heading)];
      };
      const e = state.exchange;
      if (state.top === null && w.move === 'handfight') {
        target.lw = lerp(target.lw, contact(0.17, 1.08, 0.56), impulse);
        target.rw = lerp(target.rw, contact(-0.17, 1.14, 0.56), impulse * 0.85);
      }
      if (e && (e.kind === 'shot' || e.kind === 'snap')) {
        const phase = clamp(e.age / e.duration, 0, 1), reach = Math.sin(phase * Math.PI);
        if (e.actor === this.side) {
          if (e.kind === 'shot') {
            target.lw = lerp(target.lw, contact(0.18, 0.48, 0.08), Math.min(1, phase * 3));
            target.rw = lerp(target.rw, contact(-0.18, 0.5, 0.08), Math.min(1, phase * 3));
          } else {
            target.lw = lerp(target.lw, contact(0, 1.5 - phase * 0.35, 0.38), reach);
            target.rw = lerp(target.rw, contact(-0.24, 1.05, 0.25), reach);
          }
        } else if (e.kind === 'snap') {
          for (const joint of ['chest', 'head', 'ls', 'rs'] as Joint[]) { target[joint][1] -= reach * 0.23; target[joint][2] += reach * 0.13; }
        } else {
          target.lw = lerp(target.lw, contact(0.22, 0.97, 0.6), reach * 0.7);
          target.rw = lerp(target.rw, contact(-0.22, 1.0, 0.6), reach * 0.7);
        }
      }
      if (e?.kind === 'sprawl' && e.actor === this.side) target = blend(target, ground(false), Math.sin(clamp(e.age / e.duration, 0, 1) * Math.PI) * 0.8);
      if (state.top === this.side && !state.exposure) {
        const turning = w.move === 'turn' || w.move === 'breakdown';
        target.lw = lerp(target.lw, contact(-0.2, 0.59, -0.12), 0.8);
        target.rw = lerp(target.rw, contact(0.23, turning ? 0.71 : 0.57, turning ? 0.45 : 0.14), 0.8);
        if (turning) for (const joint of ['chest', 'head', 'ls', 'rs'] as Joint[]) target[joint][2] += impulse * 0.1;
      }
      if (state.top !== null && !top && opponent.move === 'breakdown' && !state.exposure) {
        const reaction = Math.sin(clamp(opponent.moveTime / opponent.moveDuration, 0, 1) * Math.PI);
        for (const joint of ['hip', 'chest', 'head', 'ls', 'rs', 'lh', 'rh'] as Joint[]) target[joint][1] -= reaction * 0.17;
        target.lw[2] += reaction * 0.16; target.rw[2] += reaction * 0.16;
      }
      if (state.top !== null && !top && (w.move === 'switch' || state.exchange?.kind === 'reversal')) {
        target.chest[0] -= impulse * 0.19; target.head[0] -= impulse * 0.16; target.rw[0] += impulse * 0.22;
        heading += impulse * 0.45;
      }
    }
    if (state.exchange?.kind === 'escape') {
      const progress = clamp(state.exchange.age / state.exchange.duration, 0, 1);
      target = blend(target, stance(), progress * progress * (3 - 2 * progress));
    }
    if (state.phase === 'menu') { target = stance(); x = this.side === 0 ? -0.85 : 0.85; z = 0; heading = this.side === 0 ? Math.PI / 2 : -Math.PI / 2; }
    if (state.phase === 'intro') {
      const walkIn = clamp(state.phaseAge / 3.2, 0, 1);
      x = (this.side === 0 ? -1 : 1) * (3.5 - walkIn * 2.35); z = 0;
      target = blend(upright(), stance(), clamp((state.phaseAge - 4) / 2, 0, 1));
      if (walkIn < 1) { target.la[2] += Math.sin(time * 8) * 0.17; target.ra[2] -= Math.sin(time * 8) * 0.17; }
      else if (state.phaseAge < 4.3) { target.lw = [-0.18, 1.83, 0.05]; target.rw = [0.18, 1.83, 0.05]; target.le = [-0.45, 1.54, 0.1]; target.re = [0.45, 1.54, 0.1]; }
    }
    if (state.phase === 'break') { target = upright(); target.head[1] -= 0.035; }
    if (state.result) {
      x = this.side === 0 ? -0.7 : 0.7; z = 0; heading = Math.PI;
      if (state.result.winner === this.side) {
        target = upright(); target.ls[1] += 0.07; target.rs[1] += 0.07;
        target.le = [-0.53, 1.93, 0]; target.re = [0.53, 1.93, 0]; target.lw = [-0.43, 2.27 + Math.sin(time * 3) * 0.025, 0]; target.rw = [0.43, 2.27 + Math.sin(time * 3) * 0.025, 0];
      } else {
        target = ground(false); target.chest = [0, 1.05, 0.03]; target.head = [0, 1.3, 0.12];
        target.ls = [-0.28, 1.05, 0.03]; target.rs = [0.28, 1.05, 0.03];
        target.le = [-0.37, 0.74, 0.17]; target.re = [0.37, 0.74, 0.17];
        target.lw = [-0.24, 0.56, 0.28]; target.rw = [0.24, 0.56, 0.28];
      }
    }
    if (referee) {
      target = upright(); x = (state.wrestlers[0].x + state.wrestlers[1].x) / 2 + 2.15; z = (state.wrestlers[0].z + state.wrestlers[1].z) / 2 + 1.6; heading = -2.2;
      if (state.exposure) { target = ground(true); x -= 0.4; z -= 0.9; target.rw = [0.65, 0.2 + Math.abs(Math.sin(time * 3)) * 0.4, 0.55]; }
      if (state.result) {
        x = 0; z = 0.7; heading = Math.PI;
        if (state.result.winner === 0) { target.rw = [0.6, 2.15, 0]; target.re = [0.55, 1.88, 0]; }
        else { target.lw = [-0.6, 2.15, 0]; target.le = [-0.55, 1.88, 0]; }
      }
    }
    for (const key of ['chest', 'head', 'ls', 'rs'] as Joint[]) target[key][1] += breath;
    this.solveArm(target, 'l'); this.solveArm(target, 'r');
    if (!referee) { this.solveLeg(target, 'l'); this.solveLeg(target, 'r'); }
    this.pose = blend(this.pose, target, 1 - Math.exp(-dt * 14));
    this.root.position.x += (x - this.root.position.x) * (1 - Math.exp(-dt * 10));
    this.root.position.z += (z - this.root.position.z) * (1 - Math.exp(-dt * 10));
    this.root.position.y = 0.15;
    let delta = heading - this.previousHeading;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta)); this.previousHeading += delta * (1 - Math.exp(-dt * 13)); this.root.rotation.y = this.previousHeading;
    const hip = v(this.pose.hip), chest = v(this.pose.chest), dir = chest.subtract(hip);
    this.connect(this.torso, hip, chest.add(dir.scale(0.06)));
    this.connect(this.singlet, hip, chest.subtract(dir.scale(this.isReferee ? 0 : 0.12)));
    const roll = state.exposure && !top && !referee ? Math.PI : 0;
    this.backRoll += (roll - this.backRoll) * (1 - Math.exp(-dt * 9));
    const twist = Quaternion.RotationAxis(Vector3.UpReadOnly, this.backRoll);
    this.torso.rotationQuaternion!.multiplyInPlace(twist); this.singlet.rotationQuaternion!.multiplyInPlace(twist);
    for (const seg of this.segments) this.connect(seg.mesh, v(lerp(this.pose[seg.a], this.pose[seg.b], seg.start ?? 0)), v(lerp(this.pose[seg.a], this.pose[seg.b], seg.end ?? 1)));
    for (const joint of this.joints) if (joint.mesh.parent === this.root) joint.mesh.position.copyFrom(v(this.pose[joint.joint]).add(v(joint.offset)));
    for (let i = 0; i < this.handRoots.length; i++) {
      const hand = this.handRoots[i], joint = i === 0 ? 'lw' : 'rw'; hand.position.copyFrom(v(this.pose[joint]));
      hand.rotation.x = state.top !== null && !top && !state.exposure ? -1.45 : w.move === 'shot' ? -0.15 : referee ? 0 : -0.75;
      hand.rotation.z = (i === 0 ? -1 : 1) * (w.move === 'handfight' ? 0.25 : 0.1);
    }
    this.head.position.copyFrom(v(this.pose.head));
    const headPitch = state.exposure && !top && !referee ? -1.45 : clamp(Math.atan2(dir.z, dir.y) * 0.28, -0.25, 0.45);
    this.head.rotation.x += (headPitch - this.head.rotation.x) * (1 - Math.exp(-dt * 12));
    this.crest.position.copyFrom(hip.add(dir.scale(0.66)).add(new Vector3(0, 0, 0.19)));
    this.crest.rotation.x = Math.atan2(dir.z, dir.y);
    if (this.backRoll > 0.1) {
      this.crest.position.copyFrom(hip.add(dir.scale(0.66)).add(new Vector3(0, 0.19, 0)));
      this.crest.rotation.x = -Math.PI / 2;
    }
    this.shadow.position.x = this.root.position.x; this.shadow.position.z = this.root.position.z;
    this.shadow.scaling.x = state.top === null ? 1 : 1.4; this.shadow.scaling.z = state.top === null ? 1 : 1.6;
  }
}
