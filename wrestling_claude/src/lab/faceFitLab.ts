/**
 * Development only: fit a wrestler's face to a portrait.
 *
 *   ?lab=facefit&base=1                         measure the base head (writes window.__faceFit.base)
 *   ?lab=facefit&name=michael%20moreno&photo=michael-moreno.jpg
 *                                               fit that portrait (writes window.__faceFit.fit) and preview it
 *
 * MediaPipe's face landmarker is loaded from its CDN here and only here; the game uses the stored
 * numbers (`src/body/realistic/faces/`). Results are copied into those files by hand.
 */
import {
  AmbientLight, Color, DirectionalLight, OrthographicCamera, Raycaster, Scene, Vector3, WebGLRenderer,
} from 'three';
import type { Object3D } from 'three';
import { ROSTER } from '../sim/roster';
import type { Athlete } from '../body/realistic/athletes';
import { buildRealCharacterNow } from '../body/realistic/factory';
import { FACE_OVAL, FIT_FACE, mouthLift, type FaceFitData } from '../body/realistic/faceFit';
import { BASE_LANDMARKS } from '../body/realistic/faces/baseLandmarks';

const PORTRAITS = import.meta.glob('../body/realistic/faces/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Where each portrait came from (written by the portrait search), for the fit's source link. */
const PORTRAIT_LOGS = import.meta.glob('../../outputs/nov08-likeness/portraits-*.json', { eager: true, import: 'default' }) as Record<string, { name: string; file: string | null; page?: string }[]>;
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Landmark = { x: number; y: number; z: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Detector = { detect: (img: any) => { faceLandmarks: Landmark[][] } };

async function detector(): Promise<Detector> {
  const vision = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
  return vision.FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1, outputFaceBlendshapes: false,
  });
}

/** Front orthographic render of a character's face, and canonical points under image pixels. */
const VIEW = { left: -0.1, right: 0.1, top: 1.78, bottom: 1.5 };
const W = 1000, H = Math.round((W * (VIEW.top - VIEW.bottom)) / (VIEW.right - VIEW.left));

let sharedRenderer: WebGLRenderer | null = null;
function renderFace(root: Object3D, canvas: HTMLCanvasElement) {
  // One context for every render: a batch would run out of WebGL contexts otherwise.
  const renderer = sharedRenderer ??= new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  const scene = new Scene();
  scene.background = new Color('#8a8f98');
  scene.add(new AmbientLight('#ffffff', 1.1));
  const key = new DirectionalLight('#ffffff', 2.2);
  key.position.set(0.3, 1.9, 2);
  scene.add(key);
  scene.add(root);
  root.updateMatrixWorld(true);
  const cam = new OrthographicCamera(VIEW.left, VIEW.right, VIEW.top, VIEW.bottom, 0.1, 5);
  cam.position.set(0, 0, 2);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const ray = new Raycaster();
  const meshes: Object3D[] = [];
  root.traverse((o) => { if ((o as { isMesh?: boolean }).isMesh && o.visible) meshes.push(o); });
  /** Canonical point on the front-most surface under a normalized image position. */
  const surfaceAt = (nx: number, ny: number): Vector3 | null => {
    const x = VIEW.left + nx * (VIEW.right - VIEW.left);
    const y = VIEW.top - ny * (VIEW.top - VIEW.bottom);
    ray.set(new Vector3(x, y, 1), new Vector3(0, 0, -1));
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? hit.point.clone() : null;
  };
  return { surfaceAt };
}

// ---- Similarity alignment (Horn's quaternion method) ------------------------------------------

function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const v: number[][] = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-20) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-30) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: a.map((r, i) => r[i]), vectors: v };
}

/** s, R (row-major 3x3), t with B ≈ s R P + t, over the given landmark indices. */
function similarity(P: number[][], B: number[][], use: number[]) {
  const mean = (X: number[][]) => [0, 1, 2].map((k) => use.reduce((s, i) => s + X[i][k], 0) / use.length);
  const mp = mean(P), mb = mean(B);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let pp = 0;
  for (const i of use) {
    const p = [P[i][0] - mp[0], P[i][1] - mp[1], P[i][2] - mp[2]];
    const b = [B[i][0] - mb[0], B[i][1] - mb[1], B[i][2] - mb[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += p[r] * b[c];
    pp += p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
  }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const { values, vectors } = jacobiEigen(N);
  const k = values.indexOf(Math.max(...values));
  const [w, x, y, z] = [0, 1, 2, 3].map((r) => vectors[r][k]);
  const R = [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ];
  let num = 0;
  for (const i of use) {
    const p = [P[i][0] - mp[0], P[i][1] - mp[1], P[i][2] - mp[2]];
    const b = [B[i][0] - mb[0], B[i][1] - mb[1], B[i][2] - mb[2]];
    const rp = R.map((row) => row[0] * p[0] + row[1] * p[1] + row[2] * p[2]);
    num += rp[0] * b[0] + rp[1] * b[1] + rp[2] * b[2];
  }
  const s = num / pp;
  const rm = R.map((row) => row[0] * mp[0] + row[1] * mp[1] + row[2] * mp[2]);
  const t = [mb[0] - s * rm[0], mb[1] - s * rm[1], mb[2] - s * rm[2]];
  return { s, R, t };
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export async function startFaceFit(host: HTMLElement, params: URLSearchParams): Promise<void> {
  host.innerHTML = '';
  host.style.cssText = 'position:fixed;inset:0;background:#2b2f36;color:#fff;font:12px/1.4 monospace;overflow:auto';
  const log = document.createElement('pre');
  log.style.cssText = 'margin:6px;white-space:pre-wrap';
  host.appendChild(log);
  const say = (t: string) => { log.textContent += t + '\n'; };
  const out: Record<string, unknown> = {};
  (window as unknown as { __faceFit: unknown }).__faceFit = out;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:420px;display:inline-block;margin:6px';
  const shot = document.createElement('img');
  shot.style.cssText = 'width:420px;display:inline-block;margin:6px;vertical-align:top';
  host.append(canvas, shot);

  say('loading MediaPipe face landmarker…');
  const det = await detector();
  const someone = ROSTER.find((w) => w.weightClass === 165)!;
  const neutral = (a: Athlete): Athlete => ({
    ...a, height: 1.76, face: { ...FIT_FACE }, hair: 'buzz' as const, hairLen: 0.002, hairSides: 0.3, hairFront: 1.722, stubble: 0, skin: '#c99a78',
  });

  if (params.get('base') === '1') {
    const { character } = buildRealCharacterNow(someone, '#c8261f', 'high', { athlete: neutral, fit: undefined });
    character.setHeadgear(false);
    const view = renderFace(character.root, canvas);
    const found = det.detect(canvas).faceLandmarks[0];
    if (!found) { say('no face found on the base head render'); return; }
    const pts: number[] = [];
    let missed = 0;
    for (const l of found) {
      const p = view.surfaceAt(l.x, l.y);
      if (!p) { missed++; pts.push(NaN, NaN, NaN); continue; }
      pts.push(+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5));
    }
    out.base = pts;
    say(`base head: ${found.length} landmarks, ${missed} without a surface under them`);
    return;
  }

  const slugOf = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!BASE_LANDMARKS.length) { say('measure the base head first (&base=1)'); return; }

  // Batch: every portrait in faces/ (or &only=slug,slug), fitted, checked and saved in one request.
  if (params.get('batch') === '1') {
    const pick = params.get('pick')?.split(',');
    const pages = Object.values(PORTRAIT_LOGS).flat();
    const fits: (FaceFitData & { name: string })[] = [];
    const report: string[] = [];
    for (const key of Object.keys(PORTRAITS).sort()) {
      const file = key.split('/').pop()!;
      const slug = file.replace(/\.jpg$/, '');
      if (pick && !pick.includes(slug)) continue;
      const w = ROSTER.find((x) => slugOf(`${x.firstName} ${x.lastName}`) === slug);
      if (!w) { report.push(`${slug}: no roster match`); continue; }
      const page = pages.find((e) => e.file === file || e.name === `${w.firstName} ${w.lastName}`)?.page ?? '';
      try {
        const r = await fitPortrait(w, file, PORTRAITS[key], page);
        if (!r) { report.push(`${slug}: no face found`); continue; }
        fits.push({ name: `${w.firstName} ${w.lastName}`, ...r.fit });
        report.push(`${slug}: error ${r.error ?? '?'} mm, lip gap ${(r.fit.mouthGap * 1000).toFixed(1)} mm, move ${r.maxMove} mm`);
      } catch (e) { report.push(`${slug}: failed ${(e as Error).message}`); }
      say(report[report.length - 1]);
    }
    out.batch = report;
    if (params.get('save') === '1' && fits.length) {
      const u = new URL(location.href); u.searchParams.delete('save'); history.replaceState(null, '', u);
      const r = await fetch('/__facefit/saveMany', { method: 'POST', body: JSON.stringify(fits.map((f) => ({ slug: slugOf(f.name), fit: f }))) });
      say(`saved ${fits.length} fits: ${r.status}`);
    }
    return;
  }

  const name = (params.get('name') ?? '').toLowerCase();
  const w = ROSTER.find((x) => `${x.firstName} ${x.lastName}`.toLowerCase() === name);
  const file = params.get('photo') ?? '';
  const url = PORTRAITS[`../body/realistic/faces/${file}`];
  if (!w || !url) { say(`need &name= (roster name) and &photo= (a file in faces/); got ${name} / ${file}`); return; }
  const r = await fitPortrait(w, file, url, params.get('source') ?? '');
  if (!r) { say('no face found in the portrait'); return; }
  out.fit = r.fit; out.error = r.error;
  say(`fit: largest landmark move ${r.maxMove} mm, lip gap ${(r.fit.mouthGap * 1000).toFixed(1)} mm, skin ${r.fit.skin}; fitted head error ${r.error ?? '?'} mm`);
  if (params.get('save') === '1') {
    const u = new URL(location.href); u.searchParams.delete('save'); history.replaceState(null, '', u);
    const res = await fetch(`/__facefit/save?slug=${slugOf(`${w.firstName} ${w.lastName}`)}`, { method: 'POST', body: JSON.stringify({ name: `${w.firstName} ${w.lastName}`, ...r.fit }) });
    say(`saved: ${res.status}`);
  }

  /** Fits one portrait: landmarks, alignment, offsets, projection, skin; then renders the fitted head and measures it. */
  async function fitPortrait(w: (typeof ROSTER)[number], file: string, url: string, source: string) {
    const img = new Image();
    img.src = url;
    await img.decode();
    shot.src = url;
    const found = det.detect(img).faceLandmarks[0];
    if (!found) return null;
    const IW = img.naturalWidth, IH = img.naturalHeight;
    // Portrait points in pixels, y and z flipped to the canonical frame (y up, z toward the camera).
    const P = found.map((l) => [l.x * IW, -l.y * IH, -l.z * IW]);
    const B: number[][] = [];
    for (let i = 0; i < BASE_LANDMARKS.length; i += 3) B.push([BASE_LANDMARKS[i], BASE_LANDMARKS[i + 1], BASE_LANDMARKS[i + 2]]);
    const usable = B.map((b, i) => (Number.isFinite(b[0]) ? i : -1)).filter((i) => i >= 0);
    const { s, R, t } = similarity(P, B, usable);
    const A = P.map((p) => [0, 1, 2].map((r) => s * (R[r][0] * p[0] + R[r][1] * p[1] + R[r][2] * p[2]) + t[r]));
    // Close the mouth: the lower face (below the inner-lip line) rises by the portrait's lip gap.
    const gap = Math.max(0, A[13][1] - A[14][1]);
    const mouthB = (B[13][1] + B[14][1]) / 2;
    const offsets: number[] = [];
    let maxD = 0;
    for (let i = 0; i < B.length; i++) {
      if (!Number.isFinite(B[i][0])) { offsets.push(0, 0, 0); continue; }
      const d = [A[i][0] - B[i][0], A[i][1] - B[i][1], (A[i][2] - B[i][2]) * 0.5];
      maxD = Math.max(maxD, Math.hypot(d[0], d[1], d[2]));
      offsets.push(+d[0].toFixed(5), +d[1].toFixed(5), +d[2].toFixed(5));
    }
    // Canonical -> photo: invert the similarity, then pixels -> texture coordinates (v up).
    const Rt = [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
    const Rtt = Rt.map((row) => row[0] * t[0] + row[1] * t[1] + row[2] * t[2]);
    const toPhoto = [
      Rt[0][0] / (s * IW), Rt[0][1] / (s * IW), Rt[0][2] / (s * IW), -Rtt[0] / (s * IW),
      Rt[1][0] / (s * IH), Rt[1][1] / (s * IH), Rt[1][2] / (s * IH), 1 - Rtt[1] / (s * IH),
    ].map((v) => +v.toPrecision(7));
    const cx = FACE_OVAL.reduce((a, i) => a + found[i].x, 0) / FACE_OVAL.length;
    const cy = FACE_OVAL.reduce((a, i) => a + found[i].y, 0) / FACE_OVAL.length;
    const oval = FACE_OVAL.flatMap((i) => [+(cx + (found[i].x - cx) * 0.95).toFixed(4), +(1 - (cy + (found[i].y - cy) * 0.95)).toFixed(4)]);
    // Skin: mean of small patches on both cheeks and the forehead.
    const sc = document.createElement('canvas');
    sc.width = IW; sc.height = IH;
    const ctx = sc.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    let rs = 0, gs = 0, bs = 0, ns = 0;
    for (const i of [50, 280, 205, 425, 151]) {
      const px = Math.round(found[i].x * IW), py = Math.round(found[i].y * IH), r = Math.max(3, Math.round(IW * 0.01));
      const d = ctx.getImageData(px - r, py - r, r * 2, r * 2).data;
      for (let k = 0; k < d.length; k += 4) { rs += d[k]; gs += d[k + 1]; bs += d[k + 2]; ns++; }
    }
    const patch = (px: number, py: number, r: number) => {
      const d = ctx.getImageData(Math.round(px - r), Math.round(py - r), Math.max(1, r * 2), Math.max(1, r * 2)).data;
      let a = 0, b = 0, c = 0, n = 0;
      for (let k = 0; k < d.length; k += 4) { a += d[k]; b += d[k + 1]; c += d[k + 2]; n++; }
      return [a / n, b / n, c / n];
    };
    // Hair: the darkest third of the eyebrow pixels (above the hairline the photo is often background
    // or bare scalp); eyes: the two iris centres.
    const browPx: number[][] = [];
    const br = Math.max(1, Math.round(IW * 0.006));
    for (const i of [70, 63, 105, 66, 107, 336, 296, 334, 293, 300]) {
      const d = ctx.getImageData(Math.round(found[i].x * IW - br), Math.round(found[i].y * IH - br), br * 2, br * 2).data;
      for (let k = 0; k < d.length; k += 4) browPx.push([d[k], d[k + 1], d[k + 2]]);
    }
    browPx.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const dark = browPx.slice(0, Math.max(1, Math.round(browPx.length / 3)));
    const hairRGB = [0, 1, 2].map((k) => dark.reduce((s, p) => s + p[k], 0) / dark.length);
    // Black and white: the cheeks carry no colour.
    const cheek = [rs / ns, gs / ns, bs / ns];
    const mono = (Math.max(...cheek) - Math.min(...cheek)) / Math.max(1, Math.max(...cheek)) < 0.06;
    const irisR = Math.max(1, Math.round(Math.hypot((found[469].x - found[471].x) * IW, (found[469].y - found[471].y) * IH) * 0.25));
    const eyePts = found.length > 473 ? [468, 473].map((i) => patch(found[i].x * IW, found[i].y * IH, irisR)) : [];
    const eyeRGB = eyePts.length ? [0, 1, 2].map((k) => eyePts.reduce((s, p) => s + p[k], 0) / eyePts.length) : null;
    const fit: FaceFitData = {
      photo: file, offsets, toPhoto, oval, mouthY: +mouthB.toFixed(5), mouthGap: +gap.toFixed(5),
      skin: hex(rs / ns, gs / ns, bs / ns), source,
      hair: hex(hairRGB[0], hairRGB[1], hairRGB[2]), eye: eyeRGB ? hex(eyeRGB[0] * 0.9, eyeRGB[1] * 0.9, eyeRGB[2] * 0.9) : undefined, mono,
    };
    // Preview the fitted head and measure how close its landmarks land.
    const { character } = buildRealCharacterNow(w, '#c8261f', 'high', { fit, photo: url, athlete: (a) => ({ ...a, height: 1.76, frame: { ...a.frame, head: 1 } }) });
    character.setHeadgear(false);
    const view = renderFace(character.root, canvas);
    // Give the portrait texture a moment to load, then render again.
    await new Promise((r) => setTimeout(r, 800));
    renderFace(character.root, canvas);
    const again = det.detect(canvas).faceLandmarks[0];
    let error: number | undefined;
    if (again) {
      let err = 0, n = 0;
      for (const i of usable) {
        const p = view.surfaceAt(again[i].x, again[i].y);
        if (!p) continue;
        const target = [A[i][0], A[i][1] + mouthLift(B[i][0], B[i][1], fit)];
        err += Math.hypot(p.x - target[0], p.y - target[1]); n++;
      }
      error = +(err / n * 1000).toFixed(2);
    }
    return { fit, error, maxMove: +(maxD * 1000).toFixed(1) };
  }
}
