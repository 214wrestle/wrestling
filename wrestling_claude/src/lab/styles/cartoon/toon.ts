import { BackSide, CanvasTexture, Color, LinearFilter, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { IUniform } from 'three';
import { HEAD_PIVOT } from './anatomy';
import { OUTLINE_FRAG, OUTLINE_VERT, TOON_FRAG, TOON_VERT } from './shaders';

/**
 * Cel shading for the toon athletes.
 *
 * One ShaderMaterial (with the engine's skinning chunks) lights every pixel in
 * two hard tones from a broadcast key light, adds a rim in the local colour,
 * painted highlights, a print-style halftone in cloth shadow and ink between
 * the fingers (GLSL in shaders.ts). All the
 * graphic detail (eyes, brows, mouth, singlet panels and wordmark, shoes, ankle
 * bands) is painted per pixel from the bind-pose position, so it stays crisp at
 * any distance. A second, back-face-only material pushes the skinned surface out
 * along its normal by a constant pixel width: the comic-book outline.
 */

/** Lighting shared by every toon material in the scene; updated per view. */
export const LIGHT = {
  uKeyDir: { value: new Vector3(0.4, 0.8, 0.45).normalize() },
  uKeyCol: { value: new Color('#fff6e6') },
  uRimDir: { value: new Vector3(-0.3, 0.4, -0.9).normalize() },
  uRimCol: { value: new Color('#8fe6ff') },
  uBounce: { value: new Color('#ffcf8a') },
  /** World metres per pixel at 1 m from the camera (2 tan(fov/2) / viewport height). */
  uPx: { value: 0.002 },
  /** Outline width and halftone cell, in pixels. */
  uLinePx: { value: 2.4 },
  uDotPx: { value: 4.5 },
};

export interface FacePaint {
  /** Eye centre (canonical head space). */
  eyeX: number;
  eyeY: number;
  /** Half width, upper-lid height, lower-lid depth (m). */
  eyeW: number;
  eyeUp: number;
  eyeLo: number;
  /** Outer-corner lift, m per m. */
  eyeTilt: number;
  /** Iris radius (m). */
  iris: number;
  /** Brow: height of the inner end above the eye centre, rise toward the outer end, arch, thickness inner/outer, length. */
  browY: number;
  browRise: number;
  browArch: number;
  browIn: number;
  browOut: number;
  browLen: number;
  /** Strength of the short crease between the brows (0..1). */
  knit: number;
  /** Mouth: half width, corner curve (+ smile), line weight, height offset (m). */
  mouthW: number;
  mouthCurve: number;
  mouthWeight: number;
  mouthY: number;
  /** Open-grin depth in metres (0 = closed mouth line). */
  grin: number;
  /** Painted cheek hollow under the cheekbone, shadow side (0..1). */
  hollow: number;
  /** Chin cleft stroke opacity. */
  cleft: number;
  /** Hairline shape (m): centre peak, recession at the corners, jagged edge amplitude. */
  hairPeak: number;
  hairRecede: number;
  hairJag: number;
}

export interface ToonLook {
  skin: string;
  hair: string;
  brow: string;
  eye: string;
  primary: string;
  secondary: string;
  /** Thin edge trim colour. */
  trim: string;
  /** Piping line inside the side panel. */
  piping: string;
  band: string;
  shoe: string;
  shoeAccent: string;
  gearShell: string;
  gearRim: string;
  gearStrap: string;
  wordmark: string;
  scale: number;
  headScale: number;
  chestW: number;
  /** From the face shape: nose tip drop and width, ear-cup centre x. */
  noseLen: number;
  noseW: number;
  cupX: number;
  /** Hairline lift (m), chin drop (m) and jaw width, from the face shape. */
  hairUp: number;
  chinDrop: number;
  chinFwd: number;
  jawW: number;
  /** Head offset on the head bone (canonical m), per athlete: a longer neck lifts it. */
  headShift: [number, number, number];
  /** Strand direction and its perpendicular on the scalp (canonical head space). */
  hairFlow: [number, number, number];
  hairAcross: [number, number, number];
  face: FacePaint;
}

function wordmarkTexture(text: string, ink: string, outline: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 210;
  const font = (s: number) => `italic 900 ${s}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
  g.font = font(size);
  while (g.measureText(text).width > 900 && size > 60) {
    size -= 6;
    g.font = font(size);
  }
  g.lineJoin = 'round';
  g.strokeStyle = outline;
  g.lineWidth = size * 0.2;
  g.strokeText(text, c.width / 2, c.height / 2 + 8);
  g.fillStyle = ink;
  g.fillText(text, c.width / 2, c.height / 2 + 8);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/* ---------------------------------------------------------- materials ---- */

export function createToonMaterial(look: ToonLook, isGear = false): ShaderMaterial {
  const c = (h: string) => new Color(h);
  const f = look.face;
  const uniforms: Record<string, IUniform> = {
    ...LIGHT,
    uScale: { value: look.scale },
    uHeadScale: { value: look.headScale },
    uPivot: { value: new Vector3(...HEAD_PIVOT) },
    uHeadShift: { value: new Vector3(...look.headShift) },
    uChestW: { value: look.chestW },
    uIsGear: { value: isGear ? 1 : 0 },
    uSkin: { value: c(look.skin) },
    uHair: { value: c(look.hair) },
    uBrow: { value: c(look.brow) },
    uEye: { value: c(look.eye) },
    uPrimary: { value: c(look.primary) },
    uSecondary: { value: c(look.secondary) },
    uTrim: { value: c(look.trim) },
    uPiping: { value: c(look.piping) },
    uBand: { value: c(look.band) },
    uShoe: { value: c(look.shoe) },
    uShoeAccent: { value: c(look.shoeAccent) },
    uGearShell: { value: c(look.gearShell) },
    uGearRim: { value: c(look.gearRim) },
    uGearStrap: { value: c(look.gearStrap) },
    uEyeA: { value: [f.eyeX, f.eyeY, f.eyeW, f.eyeUp] },
    uEyeB: { value: [f.eyeLo, f.eyeTilt, f.iris, 0] },
    uBrowA: { value: [f.browY, f.browRise, f.browArch, f.browLen] },
    uBrowB: { value: [f.browIn, f.browOut, f.knit] },
    uMouth: { value: [f.mouthW, f.mouthCurve, f.mouthWeight, f.mouthY] },
    uGrin: { value: [f.grin, f.hollow, f.cleft, look.hairUp] },
    uHairM: { value: [f.hairPeak, f.hairRecede, f.hairJag, 0] },
    uNose: { value: [look.noseLen, look.noseW, look.cupX] },
    uJaw: { value: [look.chinDrop, look.jawW, look.chinFwd, 0] },
    uHairFlow: { value: new Vector3(...look.hairFlow).normalize() },
    uHairAcross: { value: new Vector3(...look.hairAcross).normalize() },
    uWordmark: { value: wordmarkTexture(look.wordmark.toUpperCase(), look.secondary, '#14101a') },
  };
  return new ShaderMaterial({
    uniforms,
    vertexShader: TOON_VERT,
    fragmentShader: TOON_FRAG,
  });
}

/** The ink hull, or (rim = true) the narrower rim-light hull drawn just inside it. */
export function createOutlineMaterial(ink = '#120c16', widthMul = 1, rim = false): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uPx: LIGHT.uPx,
      uLinePx: LIGHT.uLinePx,
      uWidthMul: { value: widthMul },
      uScaleRef: { value: 1 },
      uKeyDir: LIGHT.uKeyDir,
      uRimDir: LIGHT.uRimDir,
      uRim: { value: rim ? 1 : 0 },
      uInk: { value: rim ? LIGHT.uRimCol.value : new Color(ink) },
    },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: BackSide,
  });
}
