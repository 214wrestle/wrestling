import {
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  ShadowMaterial,
  SRGBColorSpace,
} from 'three';
import type { Scene } from 'three';
import { MAT } from '../../../sim/rules';

/**
 * A comic-book arena: flat-colour mat with a painted spotlight pool, a crowd of
 * halftone silhouettes in both schools' colours, a padded barrier with plain
 * text banners. Everything is unlit paint except the
 * floor shadow, so it costs a handful of draw calls.
 */

const PALETTE = {
  night: '#16112a',
  floor: '#1f1838',
  protection: '#2b2350',
  // A cool, slightly deeper mat field, so lit skin never sits on the same value.
  circle: '#cbd0dc',
  zone: '#f2a12e',
  line: '#ffffff',
  ink: '#140e1c',
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, aniso = 8): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Halftone dot field over a region, dot size following a 0..1 density function. */
function halftone(g: CanvasRenderingContext2D, w: number, h: number, step: number, color: string, density: (x: number, y: number) => number): void {
  g.fillStyle = color;
  for (let y = 0; y < h + step; y += step) {
    const odd = Math.round(y / step) % 2;
    for (let x = odd ? step / 2 : 0; x < w + step; x += step) {
      const d = density(x, y);
      if (d <= 0.02) continue;
      g.beginPath();
      g.arc(x, y, (step / 2) * Math.sqrt(Math.min(1, d)) * 0.95, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function paintMat(nameA: string, nameB: string, colA: string, colB: string): CanvasTexture {
  const S = 2048;
  const ppm = S / (MAT.halfSize * 2);
  const [c, g] = canvas(S, S);
  const mid = S / 2;
  const px = (m: number) => m * ppm;
  g.fillStyle = PALETTE.protection;
  g.fillRect(0, 0, S, S);
  // Dots fading toward the corners.
  halftone(g, S, S, 22, '#221b42', (x, y) => (Math.hypot(x - mid, y - mid) / mid - 0.8) * 1.6);

  const rC = px(MAT.circleRadius);
  // Out-of-bounds zone ring, then the field.
  g.beginPath();
  g.arc(mid, mid, rC, 0, Math.PI * 2);
  g.fillStyle = PALETTE.zone;
  g.fill();
  g.beginPath();
  g.arc(mid, mid, rC - px(0.62), 0, Math.PI * 2);
  g.fillStyle = PALETTE.circle;
  g.fill();
  // Spotlight pool: a soft warm centre, then a printed falloff ring of dots.
  const pool = g.createRadialGradient(mid, mid, px(0.4), mid, mid, rC - px(0.62));
  pool.addColorStop(0, 'rgba(255,248,232,0.6)');
  pool.addColorStop(0.55, 'rgba(255,250,235,0.0)');
  pool.addColorStop(1, 'rgba(120,90,60,0.0)');
  g.fillStyle = pool;
  g.beginPath();
  g.arc(mid, mid, rC - px(0.62), 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(mid, mid, rC - px(0.62), 0, Math.PI * 2);
  g.clip();
  halftone(g, S, S, 14, 'rgba(120,128,165,0.45)', (x, y) => {
    const r = Math.hypot(x - mid, y - mid) / (rC - px(0.62));
    return (r - 0.62) * 2.2;
  });
  g.restore();
  // Ink rings.
  g.lineWidth = px(0.06);
  g.strokeStyle = PALETTE.ink;
  for (const r of [rC, rC - px(0.62)]) {
    g.beginPath();
    g.arc(mid, mid, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.lineWidth = px(0.05);
  g.strokeStyle = PALETTE.line;
  g.beginPath();
  g.arc(mid, mid, rC - px(0.62) - px(0.06), 0, Math.PI * 2);
  g.stroke();

  // Centre circle: an ink ring with a thin inner line.
  const rc = px(MAT.centerRadius);
  g.lineWidth = px(0.07);
  g.strokeStyle = PALETTE.ink;
  g.beginPath();
  g.arc(mid, mid, rc, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = px(0.025);
  g.beginPath();
  g.arc(mid, mid, rc - px(0.1), 0, Math.PI * 2);
  g.stroke();

  // School names arced inside the boundary, plain text.
  const arc = (text: string, color: string, start: number, flip: boolean) => {
    g.save();
    g.translate(mid, mid);
    g.font = `italic 900 ${px(0.5)}px "Arial Black", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const chars = [...text];
    const step = 0.085;
    chars.forEach((ch, i) => {
      g.save();
      g.rotate(start + step * (i - (chars.length - 1) / 2) * (flip ? -1 : 1));
      g.translate(0, flip ? rC - px(1.25) : -(rC - px(1.25)));
      if (flip) g.rotate(Math.PI);
      g.lineWidth = px(0.08);
      g.strokeStyle = PALETTE.ink;
      g.lineJoin = 'round';
      g.strokeText(ch, 0, 0);
      g.fillStyle = color;
      g.fillText(ch, 0, 0);
      g.restore();
    });
    g.restore();
  };
  arc(nameA.toUpperCase(), colA, 0, false);
  arc(nameB.toUpperCase(), colB, 0, true);

  // Starting box with red and green ankle marks.
  const L = px(MAT.startingLine);
  const gap = px(0.3);
  const box = (stroke: string, w: number) => {
    g.lineWidth = w;
    g.strokeStyle = stroke;
    g.strokeRect(mid - L / 2, mid - gap, L, gap * 2);
  };
  box(PALETTE.ink, px(0.09));
  box(PALETTE.line, px(0.045));
  g.lineWidth = px(0.07);
  g.strokeStyle = '#e0302b';
  g.beginPath();
  g.moveTo(mid - L / 2, mid - gap);
  g.lineTo(mid - L / 2 + px(0.24), mid - gap);
  g.stroke();
  g.strokeStyle = '#22a653';
  g.beginPath();
  g.moveTo(mid + L / 2 - px(0.24), mid + gap);
  g.lineTo(mid + L / 2, mid + gap);
  g.stroke();
  const t = tex(c, 16);
  t.minFilter = LinearFilter;
  return t;
}

/**
 * One 90-degree panel of crowd and barrier, repeated four times round the ring.
 * The crowd sits two values down from the athletes: dark, desaturated flat
 * silhouettes, halftone only on the bleachers behind them, so the lit athletes
 * are always the brightest, highest-contrast shapes in frame.
 */
function paintCrowd(colA: string, colB: string, nameA: string, nameB: string): CanvasTexture {
  const W = 2048;
  const H = 1024;
  const [c, g] = canvas(W, H);
  // Night sky / rafters.
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b0816');
  sky.addColorStop(0.55, '#141029');
  sky.addColorStop(1, '#1c1636');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // The ring is 9 m tall over 1024 px; the barrier is the bottom 1.1 m.
  const mpx = H / 9;
  const barrierTop = H - 1.1 * mpx;
  const rows = 8;
  const rowH = 0.86 * mpx;
  // Bleacher halftone behind the fans (big, sparse dots; never on faces).
  halftone(g, W, barrierTop, 32, 'rgba(70,58,120,0.35)', (_x, y) => 0.15 + (y / barrierTop) * 0.5);
  const shirts = [colA, colA, colB, colB, '#d9d2c4', '#e07a3a', '#3b3360', '#4d4578'];
  const skins = ['#e0b08d', '#c58c64', '#8d5b3d', '#f0c8a8'];
  const night = new Color('#1d1736');
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const hex = (col: Color) => `#${col.getHexString()}`;
  // The lower bowl is three rows; a dark ribbon board with lamps separates it from the upper bowl.
  const lower = 3;
  const ribbonH = 0.62 * mpx;
  for (let r = rows - 1; r >= 0; r--) {
    const base = barrierTop - r * rowH - (r >= lower ? ribbonH : 0);
    const fade = Math.min(1, r / (rows - 1) + (r >= lower ? 0.18 : 0));
    // Bleacher step.
    g.fillStyle = `rgba(28,22,52,${0.95 - fade * 0.3})`;
    g.fillRect(0, base - rowH * 0.16, W, rowH * 0.16);
    const fanW = 0.6 * mpx;
    for (let x = -fanW * rnd(); x < W - fanW * 0.6; x += fanW * (0.9 + rnd() * 0.35)) {
      const shirt = new Color(shirts[Math.floor(rnd() * shirts.length)]);
      // Desaturate and darken toward the night colour; the back rows fade further.
      const hsl = { h: 0, s: 0, l: 0 };
      shirt.getHSL(hsl);
      shirt.setHSL(hsl.h, hsl.s * 0.55, hsl.l);
      const col = shirt.lerp(night, 0.62 + fade * 0.25);
      const skin = new Color(skins[Math.floor(rnd() * skins.length)]).lerp(night, 0.66 + fade * 0.22);
      const bob = rnd() * rowH * 0.1;
      const sy = base - rowH * 0.18 - bob;
      const cheer = rnd() < 0.1;
      for (const wrap of [-W, 0, W]) {
        const hx = x + fanW * 0.5 + wrap;
        if (hx < -fanW || hx > W + fanW) continue;
        if (cheer) {
          // Raised arms: short sleeves in the shirt colour, round mitten hands.
          g.strokeStyle = hex(col);
          g.lineWidth = fanW * 0.16;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(hx - fanW * 0.28, sy - rowH * 0.18);
          g.lineTo(hx - fanW * 0.36, sy - rowH * 0.72);
          g.moveTo(hx + fanW * 0.28, sy - rowH * 0.18);
          g.lineTo(hx + fanW * 0.38, sy - rowH * 0.72);
          g.stroke();
          g.fillStyle = hex(skin);
          for (const [dx, dy] of [
            [-0.37, -0.8],
            [0.39, -0.8],
          ]) {
            g.beginPath();
            g.arc(hx + fanW * dx, sy + rowH * dy, fanW * 0.1, 0, Math.PI * 2);
            g.fill();
          }
        }
        // Shoulders and head as one flat silhouette.
        g.fillStyle = hex(col);
        g.beginPath();
        g.ellipse(hx, sy, fanW * 0.44, rowH * 0.3, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = hex(skin);
        g.beginPath();
        g.arc(hx, sy - rowH * 0.36, fanW * 0.16, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // Darken toward the rafters (flat gradient, no dots on the fans).
  const dim = g.createLinearGradient(0, 0, 0, barrierTop);
  dim.addColorStop(0, 'rgba(8,6,16,0.75)');
  dim.addColorStop(0.6, 'rgba(8,6,16,0.25)');
  dim.addColorStop(1, 'rgba(8,6,16,0.0)');
  g.fillStyle = dim;
  g.fillRect(0, 0, W, barrierTop);

  // Ribbon board between the bowls: a dark band with muted LED text and a row of lamps.
  const ribTop = barrierTop - lower * rowH - ribbonH + rowH * 0.12;
  const ribH = ribbonH * 0.62;
  g.fillStyle = '#0a0714';
  g.fillRect(0, ribTop, W, ribH);
  g.fillStyle = PALETTE.ink;
  g.fillRect(0, ribTop - 4, W, 4);
  g.fillRect(0, ribTop + ribH, W, 6);
  g.font = `italic 900 ${ribH * 0.62}px "Arial Black", Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const ribbon = ['2013 CHAMPIONSHIPS', '165 LB', 'DES MOINES', 'FINAL'];
  const seg = W / ribbon.length;
  ribbon.forEach((t, i) => {
    g.fillStyle = i % 2 ? '#b8732e' : '#3f8f99';
    g.fillText(t, seg * (i + 0.5), ribTop + ribH / 2 + 2, seg * 0.86);
  });
  // Lamps: flat starbursts on the ribbon's top edge, the frame's focal lights.
  const star = (cx: number, cy: number, r: number, points: number, core: string, ray: string) => {
    g.fillStyle = ray;
    g.beginPath();
    for (let k = 0; k < points * 2; k++) {
      const a = (k / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 ? r * 0.28 : r;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.fillStyle = core;
    g.beginPath();
    g.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    g.fill();
  };
  for (let i = 0; i < 6; i++) {
    const cx = (i + 0.5) * (W / 6);
    star(cx, ribTop - 2, rowH * 0.42, 8, '#fff6dc', 'rgba(255,226,150,0.55)');
  }
  // Camera flashes popping in the crowd.
  for (let i = 0; i < 9; i++) {
    const cx = rnd() * W;
    const cy = barrierTop - rowH * (0.4 + rnd() * (rows - 1));
    star(cx, cy, rowH * (0.14 + rnd() * 0.1), 4, '#ffffff', 'rgba(255,255,255,0.8)');
  }

  // Barrier pads with plain-text banners.
  g.fillStyle = '#0f0a1d';
  g.fillRect(0, barrierTop, W, H - barrierTop);
  const muted = (hexStr: string, k: number) => `#${new Color(hexStr).lerp(night, k).getHexString()}`;
  const panels = [
    { bg: muted(colA, 0.18), fg: '#f4efe6', text: nameA.toUpperCase() },
    { bg: muted('#f2a12e', 0.2), fg: '#140e1c', text: '165 LB · FINAL' },
    { bg: muted(colB, 0.18), fg: '#f4efe6', text: nameB.toUpperCase() },
    { bg: muted('#f3e6c4', 0.22), fg: '#140e1c', text: 'DES MOINES · 2013' },
  ];
  const pw = W / panels.length;
  panels.forEach((p, i) => {
    const x = i * pw + 8;
    const y = barrierTop + 10;
    const w = pw - 16;
    const h = H - barrierTop - 22;
    g.fillStyle = p.bg;
    g.fillRect(x, y, w, h);
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = 8;
    g.strokeRect(x, y, w, h);
    g.font = `italic 900 ${h * 0.46}px "Arial Black", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = p.fg;
    g.fillText(p.text, x + w / 2, y + h / 2 + 4, w * 0.9);
  });
  const t = tex(c);
  t.wrapS = RepeatWrapping;
  t.repeat.set(-4, 1);
  return t;
}

export function createToonArena(scene: Scene, a: { name: string; color: string }, b: { name: string; color: string }): DirectionalLight {
  const group = new Group();
  scene.background = new Color(PALETTE.night);

  const floor = new Mesh(new CircleGeometry(30, 64), new MeshBasicMaterial({ color: PALETTE.floor }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  group.add(floor);

  // Mat slab edge and painted surface (top at y = 0, where the feet are).
  const slab = new Mesh(
    new CylinderGeometry(MAT.halfSize * Math.SQRT2, MAT.halfSize * Math.SQRT2, MAT.thickness, 4, 1),
    new MeshBasicMaterial({ color: '#1b1535' }),
  );
  slab.rotation.y = Math.PI / 4;
  slab.position.y = -MAT.thickness / 2 - 0.002;
  group.add(slab);
  const surface = new Mesh(
    new PlaneGeometry(MAT.halfSize * 2, MAT.halfSize * 2),
    new MeshBasicMaterial({ map: paintMat(a.name, b.name, a.color, b.color) }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0;
  group.add(surface);

  // Hard floor shadow in a cool ink tint.
  const shadow = new Mesh(new PlaneGeometry(MAT.halfSize * 2, MAT.halfSize * 2), new ShadowMaterial({ color: '#2a1a4a', opacity: 0.42 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  shadow.receiveShadow = true;
  group.add(shadow);

  // Crowd ring.
  const crowd = new Mesh(
    new CylinderGeometry(11, 11, 9, 96, 1, true),
    new MeshBasicMaterial({
      map: paintCrowd(a.color, b.color, a.name, b.name),
      side: DoubleSide,
    }),
  );
  crowd.position.y = 4.5 - 0.06;
  group.add(crowd);

  scene.add(group);

  // Shadow-only key, overhead and a little toward the broadcast side.
  const sun = new DirectionalLight('#ffffff', 1);
  sun.position.set(1.2, 8, 2.4);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -2.6;
  sc.right = 2.6;
  sc.top = 2.6;
  sc.bottom = -2.6;
  sc.near = 2;
  sc.far = 14;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  return sun;
}
