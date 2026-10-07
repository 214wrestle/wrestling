import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MAT } from '../sim/rules';
import type { School } from '../sim/types';

/**
 * The mat.
 *
 * All of the painted detail — competition circle, red zone, starting lines, the
 * host school's name arced around the edge — is drawn into a canvas at real-world
 * scale and used as a texture. Two-dimensional drawing buys an enormous amount of
 * apparent detail for one quad.
 */

const TEX = 2048;
/** Canvas pixels per metre. */
const PPM = TEX / (MAT.halfSize * 2);

function toPx(metres: number): number {
  return metres * PPM;
}

function arcText(
  g: CanvasRenderingContext2D,
  text: string,
  radius: number,
  startAngle: number,
  sweep: number,
  size: number,
  color: string,
  flip = false,
): void {
  g.save();
  g.translate(TEX / 2, TEX / 2);
  g.fillStyle = color;
  g.font = `bold ${size}px "Arial Black", Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = [...text];
  const step = sweep / Math.max(1, chars.length - 1);
  chars.forEach((ch, i) => {
    const a = startAngle + step * i;
    g.save();
    g.rotate(a);
    g.translate(0, flip ? radius : -radius);
    if (flip) g.rotate(Math.PI);
    g.fillText(ch, 0, 0);
    g.restore();
  });
  g.restore();
}

function paintMat(host: School): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = TEX;
  c.height = TEX;
  const g = c.getContext('2d')!;
  const mid = TEX / 2;

  // Protection area.
  g.fillStyle = '#16202e';
  g.fillRect(0, 0, TEX, TEX);

  // Subtle vinyl mottling so the surface is not a flat colour.
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * TEX;
    const y = Math.random() * TEX;
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.016})`;
    g.fillRect(x, y, 3, 3);
  }

  // Competition circle.
  const rCircle = toPx(MAT.circleRadius);
  g.beginPath();
  g.arc(mid, mid, rCircle, 0, Math.PI * 2);
  g.fillStyle = '#b9a884';
  g.fill();

  // One-metre red zone inside the boundary.
  g.beginPath();
  g.arc(mid, mid, rCircle - toPx(0.5), 0, Math.PI * 2);
  g.strokeStyle = '#9d2b2b';
  g.lineWidth = toPx(1);
  g.stroke();

  // Boundary line.
  g.beginPath();
  g.arc(mid, mid, rCircle - toPx(0.02), 0, Math.PI * 2);
  g.strokeStyle = '#f2ead8';
  g.lineWidth = toPx(0.05);
  g.stroke();

  // Host identity arced inside the boundary.
  arcText(g, host.name.toUpperCase(), rCircle - toPx(1.45), -0.62, 1.24, 108, '#2b2419');
  arcText(g, host.nickname.toUpperCase(), rCircle - toPx(1.45), Math.PI - 0.52, 1.04, 92, '#2b2419', true);

  // Centre circle.
  const rCenter = toPx(MAT.centerRadius);
  g.beginPath();
  g.arc(mid, mid, rCenter, 0, Math.PI * 2);
  g.fillStyle = host.primary;
  g.fill();
  g.beginPath();
  g.arc(mid, mid, rCenter, 0, Math.PI * 2);
  g.strokeStyle = '#f2ead8';
  g.lineWidth = toPx(0.05);
  g.stroke();

  // Starting lines: a one-metre box with a red and a green line.
  const lineLen = toPx(MAT.startingLine);
  const gap = toPx(0.3);
  g.lineWidth = toPx(0.05);
  g.strokeStyle = '#f2ead8';
  g.beginPath();
  g.moveTo(mid - lineLen / 2, mid - gap);
  g.lineTo(mid + lineLen / 2, mid - gap);
  g.moveTo(mid - lineLen / 2, mid + gap);
  g.lineTo(mid + lineLen / 2, mid + gap);
  g.moveTo(mid - lineLen / 2, mid - gap);
  g.lineTo(mid - lineLen / 2, mid + gap);
  g.moveTo(mid + lineLen / 2, mid - gap);
  g.lineTo(mid + lineLen / 2, mid + gap);
  g.stroke();

  // Each opposing short end is a full red or green starting line.
  g.lineWidth = toPx(0.07);
  g.strokeStyle = '#c23b3b';
  g.beginPath();
  g.moveTo(mid - lineLen / 2, mid - gap);
  g.lineTo(mid - lineLen / 2, mid + gap);
  g.stroke();
  g.strokeStyle = '#2f9e5c';
  g.beginPath();
  g.moveTo(mid + lineLen / 2, mid - gap);
  g.lineTo(mid + lineLen / 2, mid + gap);
  g.stroke();

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

export function createMat(host: School): Group {
  const group = new Group();

  const body = new Mesh(
    new RoundedBoxGeometry(MAT.halfSize * 2, MAT.thickness, MAT.halfSize * 2, 3, 0.02),
    new MeshStandardMaterial({ color: '#0f1724', roughness: 0.85 }),
  );
  body.position.y = MAT.thickness / 2;
  body.receiveShadow = true;
  group.add(body);

  const surface = new Mesh(
    new PlaneGeometry(MAT.halfSize * 2, MAT.halfSize * 2),
    new MeshStandardMaterial({
      map: paintMat(host),
      roughness: 0.78,
      metalness: 0,
    }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = MAT.thickness + 0.001;
  surface.receiveShadow = true;
  group.add(surface);

  return group;
}
