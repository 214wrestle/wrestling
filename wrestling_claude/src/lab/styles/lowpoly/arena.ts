import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  DodecahedronGeometry,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash } from './mesh';

/**
 * A faceted arena to match the athletes: a gradient dome, a polygonal mat lit like
 * a spotlight pool with a coral 10 m circle, a darker protection band, a hexagon
 * centre mark and plain-text wordmarks; stepped stands with an instanced crowd of
 * faceted busts; a warm LED ribbon board along the front of the stands and team
 * banners above them.
 */

export interface ArenaPalette {
  sky: string;
  horizon: string;
  floor: string;
  matIn: string;
  matOut: string;
  line: string;
  accent: string;
  crowd: string[];
}

export const PALETTE: ArenaPalette = {
  sky: '#141a33',
  horizon: '#4a3352',
  floor: '#171b2b',
  matIn: '#7480a3',
  matOut: '#323c5c',
  line: '#e0573a',
  accent: '#f2b14c',
  crowd: ['#b3312c', '#9a948c', '#21407f', '#3b64a8', '#3a4152', '#4a3a48', '#5e5266', '#56627a'],
};

/** Non-indexed triangle soup with a per-face colour jitter. */
function facetColours(g: BufferGeometry, colourAt: (x: number, y: number, z: number, f: number) => Color, jitter: number): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let f = 0; f < pos.count / 3; f++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 3; k++) {
      x += pos.getX(f * 3 + k) / 3;
      y += pos.getY(f * 3 + k) / 3;
      z += pos.getZ(f * 3 + k) / 3;
    }
    c.copy(colourAt(x, y, z, f));
    const j = 1 + (hash(f, 7.3) - 0.5) * jitter;
    for (let k = 0; k < 3; k++) {
      col[(f * 3 + k) * 3] = c.r * j;
      col[(f * 3 + k) * 3 + 1] = c.g * j;
      col[(f * 3 + k) * 3 + 2] = c.b * j;
    }
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** A flat disc of concentric polygon rings, triangulated as a fan of quads. */
function ringDisc(radii: number[], seg: number): BufferGeometry {
  const pos: number[] = [];
  const pt = (r: number, i: number): [number, number, number] => {
    const a = (i / seg) * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r];
  };
  for (let k = 0; k < radii.length; k++) {
    const r0 = k === 0 ? 0 : radii[k - 1];
    const r1 = radii[k];
    for (let i = 0; i < seg; i++) {
      const a0 = pt(r0, i);
      const a1 = pt(r0, i + 1);
      const b0 = pt(r1, i);
      const b1 = pt(r1, i + 1);
      if (r0 === 0) pos.push(...a0, ...b1, ...b0);
      else pos.push(...a0, ...b1, ...b0, ...a0, ...a1, ...b1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return g;
}

function textTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const FONT = (px: number) => `900 ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;

/** A crowd bust: a six-sided shoulder block and an eight-plane head (optionally a raised arm). */
function bust(cheer: boolean): BufferGeometry {
  const torsoG = new CylinderGeometry(0.13, 0.2, 0.42, 6, 1);
  torsoG.scale(1, 1, 0.62);
  torsoG.translate(0, 0.21, 0);
  const headB = new DodecahedronGeometry(0.1, 0);
  headB.scale(0.95, 1.15, 1.0);
  headB.translate(0, 0.56, 0);
  const parts = [torsoG.toNonIndexed(), headB.toNonIndexed()];
  if (cheer) {
    const armG = new CylinderGeometry(0.045, 0.06, 0.3, 5, 1);
    armG.rotateZ(-0.25);
    armG.translate(0.19, 0.55, 0);
    parts.push(armG.toNonIndexed());
  }
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

export function createArena(p: ArenaPalette = PALETTE): Group {
  const group = new Group();
  const cSky = new Color(p.sky);
  const cHor = new Color(p.horizon);

  // Gradient dome, faceted.
  const dome = facetColours(
    new IcosahedronGeometry(70, 3),
    (_x, y) => new Color().lerpColors(cHor, cSky, Math.min(1, Math.max(0, (y + 4) / 40)) ** 0.7),
    0.06,
  );
  group.add(new Mesh(dome, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false })));

  // Arena floor.
  const floor = facetColours(ringDisc([12, 20, 34, 60], 28), () => new Color(p.floor), 0.12);
  floor.translate(0, -0.012, 0);
  const floorMesh = new Mesh(floor, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // The mat: a slate wrestling area lit like a spotlight pool (lighter in the
  // centre), the coral 10 m circle, a darker protection band and a dark edge.
  const cIn = new Color(p.matIn);
  const cOut = new Color(p.matOut);
  const cLine = new Color(p.line);
  const cAcc = new Color(p.accent);
  const cEdge = new Color('#1f2640');
  const mat = facetColours(
    ringDisc([0.8, 1.6, 2.4, 3.2, 4.0, 4.6, 4.88, 5.02, 5.6, 6.3, 7.0, 7.4, 7.7], 48),
    (x, _y, z) => {
      const r = Math.hypot(x, z);
      const pool = 1.12 - 0.3 * Math.min(1, Math.max(0, r / 5)) ** 1.4;
      if (r < 4.88) return cIn.clone().multiplyScalar(pool);
      if (r < 5.03) return cLine.clone();
      if (r < 7.4) return cOut.clone().multiplyScalar(1.05 - 0.1 * ((r - 5) / 2.4));
      return cEdge.clone();
    },
    0.025,
  );
  const matMesh = new Mesh(mat, new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, flatShading: true }));
  matMesh.receiveShadow = true;
  group.add(matMesh);

  // Centre mark: a faceted hexagon ring around the start box.
  const star: number[] = [];
  const R0 = 1.5;
  const R1 = 1.56;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const a1 = ((i + 1) / 6) * Math.PI * 2 + Math.PI / 6;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    star.push(c0 * R0, 0, s0 * R0, c1 * R1, 0, s1 * R1, c0 * R1, 0, s0 * R1);
    star.push(c0 * R0, 0, s0 * R0, c1 * R0, 0, s1 * R0, c1 * R1, 0, s1 * R1);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new BufferAttribute(new Float32Array(star), 3));
  starGeo.computeVertexNormals();
  const starMesh = new Mesh(starGeo, new MeshStandardMaterial({ color: cAcc.clone().lerp(cIn, 0.35).multiplyScalar(0.8), roughness: 0.7, side: DoubleSide }));
  starMesh.position.y = 0.0015;
  starMesh.receiveShadow = true;
  group.add(starMesh);

  // Wordmarks on the protection band, front and back: plain text, no logos.
  const markTex = textTexture(1024, 160, (g) => {
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = FONT(120);
    g.fillText('MAT RIVALS', 512, 84);
  });
  for (const [z, rot] of [
    [-6.15, 0],
    [6.15, Math.PI],
  ]) {
    const m = new Mesh(
      new PlaneGeometry(3.6, 0.56),
      new MeshStandardMaterial({ map: markTex, transparent: true, color: '#e9e2d6', roughness: 0.8, depthWrite: false }),
    );
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(0, 0.002, z);
    m.receiveShadow = true;
    group.add(m);
  }

  // Starting lines: the 1 m box of the neutral start, red and green.
  const lineMat = (c: string) => new MeshStandardMaterial({ color: c, roughness: 0.7 });
  const box = (w: number, d: number, x: number, z: number, c: string) => {
    const m = new Mesh(new BoxGeometry(w, 0.004, d), lineMat(c));
    m.position.set(x, 0.002, z);
    m.receiveShadow = true;
    group.add(m);
  };
  box(0.05, 0.9, -0.5, 0, '#c8261f');
  box(0.05, 0.9, 0.5, 0, '#1f9d4a');

  // Stands: stepped, sectioned, in a ring behind the mat.
  const standGeos: BufferGeometry[] = [];
  const seats: Array<{ x: number; y: number; z: number; a: number; row: number }> = [];
  const sections = 14;
  for (let s = 0; s < sections; s++) {
    const a0 = (s / sections) * Math.PI * 2 + 0.03;
    const a1 = ((s + 1) / sections) * Math.PI * 2 - 0.03;
    for (let row = 0; row < 9; row++) {
      const r = 10.5 + row * 0.85;
      const h = 0.45 + row * 0.42;
      const segs = 3;
      for (let k = 0; k < segs; k++) {
        const b0 = a0 + ((a1 - a0) * k) / segs;
        const b1 = a0 + ((a1 - a0) * (k + 1)) / segs;
        const mid = (b0 + b1) / 2;
        const chord = 2 * r * Math.sin((b1 - b0) / 2);
        const g = new BoxGeometry(chord, h, 0.85);
        g.rotateY(-mid + Math.PI / 2);
        g.translate(Math.cos(mid) * r, h / 2, Math.sin(mid) * r);
        standGeos.push(g);
        const nSeat = 4;
        for (let q = 0; q < nSeat; q++) {
          const aa = b0 + ((b1 - b0) * (q + 0.5)) / nSeat;
          seats.push({ x: Math.cos(aa) * (r + 0.1), y: h, z: Math.sin(aa) * (r + 0.1), a: aa, row });
        }
      }
    }
  }
  const stands = facetColours(
    mergeGeometries(standGeos)!,
    (_x, y) => new Color('#232a40').lerp(new Color('#2e2440'), Math.min(1, y / 4)),
    0.18,
  );
  const standMesh = new Mesh(stands, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
  standMesh.receiveShadow = true;
  group.add(standMesh);

  // Crowd: faceted busts in two poses, lit and fogged like the arena, in three values.
  const crowdMat = new MeshLambertMaterial({ flatShading: true });
  const fanSets = [new InstancedMesh(bust(false), crowdMat, seats.length), new InstancedMesh(bust(true), crowdMat, seats.length)];
  const counts = [0, 0];
  const mtx = new Matrix4();
  const dummy = new Object3D();
  const colours = p.crowd.map((c) => new Color(c));
  seats.forEach((s, i) => {
    if (hash(i, 3.1) < 0.1) return;
    const set = hash(i, 4.4) < 0.16 ? 1 : 0;
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, -s.a - Math.PI / 2 + (hash(i, 9) - 0.5) * 0.4, 0);
    const sc = 0.85 + hash(i, 5) * 0.2;
    dummy.scale.set(sc * (hash(i, 11) < 0.5 ? 1 : -1), sc * (0.92 + hash(i, 6) * 0.2), sc);
    dummy.updateMatrix();
    mtx.copy(dummy.matrix);
    fanSets[set].setMatrixAt(counts[set], mtx);
    // Fans cluster by section: red end and blue end, neutrals between.
    const side = Math.cos(s.a);
    const pick = hash(i, 1.7);
    const c =
      pick < 0.5
        ? side < -0.2
          ? colours[pick < 0.34 ? 0 : 1]
          : side > 0.2
            ? colours[pick < 0.34 ? 2 : 3]
            : colours[4 + Math.floor(hash(i, 2) * 4)]
        : colours[4 + Math.floor(hash(i, 2.2) * 4)];
    // Three values, with a gentle falloff toward the back rows.
    const v = [0.5, 0.38, 0.28][Math.floor(hash(i, 8) * 3)] * (1 - s.row * 0.035);
    fanSets[set].setColorAt(counts[set], c.clone().multiplyScalar(v));
    counts[set]++;
  });
  fanSets.forEach((f, k) => {
    f.count = counts[k];
    group.add(f);
  });

  // A warm LED ribbon board along the front of the stands, in team colours and
  // amber: the arena's one bright, warm accent.
  const segs: Array<[string, string, string]> = [
    ['#f2b14c', '#2a1a10', 'MAT RIVALS'],
    ['#b31b1b', '#ffffff', 'CORNELL'],
    ['#f2b14c', '#2a1a10', 'NCAA  165'],
    ['#1e407c', '#ffffff', 'PENN STATE'],
  ];
  const ribbonTex = textTexture(2048, 64, (g) => {
    const w = 2048 / segs.length;
    segs.forEach(([bg, fg, text], k) => {
      g.fillStyle = bg;
      g.fillRect(k * w, 0, w, 64);
      g.fillStyle = fg;
      g.font = FONT(38);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, k * w + w / 2, 34);
    });
  });
  ribbonTex.wrapS = RepeatWrapping;
  // Seen from inside the cylinder: flip U so the text reads left to right.
  ribbonTex.repeat.set(-7, 1);
  const ribbonMesh = new Mesh(
    new CylinderGeometry(10.06, 10.06, 0.34, 56, 1, true),
    new MeshBasicMaterial({ map: ribbonTex, side: BackSide, color: '#9c9488' }),
  );
  ribbonMesh.position.y = 0.5;
  group.add(ribbonMesh);

  // Team pennants hung above the stands at each end (one merged draw).
  const pennants: BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const end = i < 5 ? -1 : 1;
    const k = i % 5;
    const a = (end < 0 ? Math.PI : 0) + (k - 2) * 0.2;
    const r = 15.5;
    const g = new PlaneGeometry(1.0, 2.3, 2, 1);
    const pos = g.getAttribute('position');
    for (let v = 0; v < pos.count; v++) if (pos.getY(v) < 0 && Math.abs(pos.getX(v)) < 0.01) pos.setY(v, -1.6);
    const holder = new Object3D();
    holder.position.set(Math.cos(a) * r, 6.2, Math.sin(a) * r);
    holder.lookAt(0, 6.2, 0);
    holder.updateMatrix();
    g.applyMatrix4(holder.matrix);
    const colour = new Color(k % 2 ? '#e8e2d8' : end < 0 ? '#a8211d' : '#1c3a72');
    const cols = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v++) colour.toArray(cols, v * 3);
    g.setAttribute('color', new BufferAttribute(cols, 3));
    pennants.push(g);
  }
  const pennantGeo = mergeGeometries(pennants)!;
  pennantGeo.computeVertexNormals();
  group.add(new Mesh(pennantGeo, new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide })));

  // Centre-hung octagonal scoreboard with glowing faces.
  const board = new Group();
  const shell = new Mesh(new CylinderGeometry(1.5, 1.2, 1.3, 8, 1), new MeshStandardMaterial({ color: '#1b2034', roughness: 0.6, flatShading: true }));
  board.add(shell);
  const screen = new Mesh(new CylinderGeometry(1.52, 1.52, 0.7, 8, 1, true), new MeshBasicMaterial({ color: '#3c5a9a', fog: false }));
  screen.position.y = 0.15;
  board.add(screen);
  const ring = new Mesh(new CylinderGeometry(1.62, 1.62, 0.08, 8, 1, true), new MeshBasicMaterial({ color: cAcc, side: DoubleSide, fog: false }));
  ring.position.y = -0.55;
  board.add(ring);
  board.position.set(0, 10.5, 0);
  board.rotation.y = Math.PI / 8;
  group.add(board);

  return group;
}
