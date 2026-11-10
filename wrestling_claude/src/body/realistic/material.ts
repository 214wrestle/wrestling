import { CanvasTexture, Color, DataTexture, LinearFilter, MeshPhysicalMaterial, ShaderChunk, SRGBColorSpace, TextureLoader, Vector4 } from 'three';
import type { Texture } from 'three';
import type { IUniform } from 'three';

/**
 * Broadcast-realism body material.
 *
 * One MeshPhysicalMaterial paints the athlete per pixel from bind-pose position,
 * as in the game, with the parts that make skin read as skin:
 *  - wrap diffuse with a red-shifted terminator (cheap subsurface scattering),
 *  - the SDF-baked ambient occlusion on indirect light and softly on direct,
 *  - roughness that varies by region (T-zone, cheeks, scalp) plus sweat,
 *  - procedural bump (pores and skin undulation, lycra weave, hair strands)
 *    faded by pixel footprint so it never sparkles,
 *  - blood tones where they really sit: ears, nose, lips, knuckles, elbows, knees.
 * The singlet is lycra: tight sheen, panel seams and piping; shoes have suede and
 * mesh panels, laces and a gum sole.
 */

/** How a singlet of the wrestler's era is cut and decorated. */
export interface KitLook {
  /** 0 modern high cut .. 1 deep low cut (front and back scoop, armholes down the ribs). */
  cut?: number;
  /** Leg length along the thigh, metres: 0.2 today, shorter in older singlets. */
  leg?: number;
  /** Side panels and their piping (default on). */
  panel?: boolean;
  /** Upper body in a second colour (two-tone). */
  top?: string;
  /** Wide cuff at the leg hem. */
  cuff?: string;
  /** Horizontal band around the body (chest by default; Penn State's sits at the waist). */
  chestBand?: string;
  /** Height of that band's centre, metres on a 1.76 m body: 1.29 chest, about 1.03 waist. */
  bandY?: number;
  /** Two thin stripes just above the leg hem. */
  hemStripes?: string;
  /** Full-length tights under the singlet. */
  tights?: string;
}

const colourOn = (hex?: string) => {
  const c = new Color(hex ?? '#000000');
  return new Vector4(c.r, c.g, c.b, hex ? 1 : 0);
};

const blank = (() => { const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();
/** The portrait for a photo-fitted face (loads in the background; blank until then). */
function facePhotoTexture(url: string | undefined, ready: IUniform): Texture {
  if (!url) return blank;
  const tex = new TextureLoader().load(url, () => { ready.value = 1; });
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export interface RealLook {
  /** Portrait URL for a photo-fitted face, and how much to brighten it (its own lighting is baked in). */
  facePhoto?: string;
  photoGain?: number;
  /** How much of the portrait's colour (vs its brightness) shows; low for colour-cast photos. */
  photoChroma?: number;
  /** The portrait's mean cheek colour (sRGB hex), to match it to the body's skin. */
  photoMean?: string;
  /** Era singlet; omitted is today's high-cut panelled singlet. */
  kit?: KitLook;
  skin: string;
  hair: string;
  primary: string;
  secondary: string;
  /** Piping/trim colour between body and panel. */
  piping: string;
  wordmark: string;
  wordmarkColor?: string;
  chestEmblem?: boolean;
  /** The official: striped shirt, black slacks and shoes instead of a singlet. */
  referee?: boolean;
  /** Face is the CC0 base head: skip paint tied to the generated face's features. */
  baseHead?: boolean;
  /** Strength of abdominal definition under the singlet, 0..1. */
  abs?: number;
  band: string;
  shoe: string;
  shoeAccent: string;
  scale: number;
  /** Lower-face length offset from the anatomy, to move the mouth paint. */
  faceLen: number;
  /** Beard shadow strength, 0..1. */
  stubble: number;
  /** Hair density on the clipped sides, 0..1. */
  sides: number;
  /** Hair texture: 0 tightly coiled .. 1 straight. */
  hairStraight?: number;
  /** Eyebrow lift, slope (outer end up), arch, thickness. */
  brow: [number, number, number, number];
  hairFront: number;
  /** Side and back hairline lowered over the ears (0..1). */
  hairLow?: number;
  /** Mouth-corner lift (paint curvature): 0 = flat and serious, 4 = a smile. */
  smile: number;
  /** Head size multiplier about the head pivot (paint works in the unscaled frame). */
  headScale: number;
  /** Eye aperture height multiplier, as the anatomy. */
  eyeOpen: number;
  eyeWidth?: number;
  naturalNasalBase?: boolean;
  /** Match thin natural lid margins to the reconstructed fold. */
  naturalLidFold?: boolean;
  /** Nose length offset, as the anatomy (to place the nostril paint). */
  nose: number;
}

function wordmarkTexture(text: string, emblem = false): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 190;
  const font = (s: number) => `800 ${s}px "Bahnschrift", "Arial Narrow", "Arial", sans-serif`;
  g.font = font(size);
  while (g.measureText(text).width > 940 && size > 40) {
    size -= 4;
    g.font = font(size);
  }
  if (emblem) {
    // Reference-inspired block I and crossing STATE; not a photographed texture.
    g.translate(512, 0); g.scale(2.5, 1); g.translate(-512, 0);
    g.font = '900 238px "Arial Black", "Arial", sans-serif';
    g.lineJoin = 'miter';
    g.strokeStyle = '#f5c635'; g.lineWidth = 18;
    g.strokeText('I', 512, 133);
    g.fillStyle = '#9e1736'; g.fillText('I', 512, 133);
    g.font = '900 82px "Arial Black", "Arial", sans-serif';
    g.strokeStyle = '#9e1736'; g.lineWidth = 12;
    g.strokeText('STATE', 512, 135);
    g.fillStyle = '#f5c635'; g.fillText('STATE', 512, 135);
  } else g.fillText(text, c.width / 2, c.height / 2 + 8);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const VERTEX_HEAD = /* glsl */ `
attribute float aPart;
attribute float aAO;
attribute vec3 aSmoothN;
attribute vec4 aPhoto;
varying vec3 vSmoothN;
varying vec3 vBind;
varying vec3 vBindN;
varying float vAO;
varying vec4 vPhoto;
flat varying float vPart;
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec4 vPhoto;
uniform sampler2D uFacePhoto;
uniform float uPhotoGain;
uniform float uPhotoReady;
uniform float uPhotoBroad;
uniform float uPhotoChroma;
uniform vec3 uPhotoMean;
varying vec3 vSmoothN;
varying vec3 vBind;
varying vec3 vBindN;
varying float vAO;
flat varying float vPart;
uniform vec3 uSkin;
uniform vec3 uHair;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uWordmarkColor;
uniform float uChestEmblem;
// Era singlet: cut depth (0 modern high cut .. 1 deep low cut), leg length along the thigh,
// side panels on/off, and optional two-tone top, wide leg cuffs, chest band and tights (rgb + on).
uniform float uCut;
uniform float uLegLen;
uniform float uPanel;
uniform vec4 uTop;
uniform vec4 uCuff;
uniform vec4 uChestBand;
uniform float uBandY;
uniform vec4 uHemStripes;
uniform vec4 uTights;
uniform float uReferee;
uniform float uBaseHead;
uniform float uAbs;
uniform vec3 uPiping;
uniform vec3 uBand;
uniform vec3 uShoe;
uniform vec3 uShoeAccent;
uniform float uScale;
uniform float uSweat;
uniform float uFlush;
uniform float uFaceLen;
uniform float uStubble;
uniform float uSides;
uniform float uHairStraight;
uniform sampler2D uWordmark;
uniform float uBumpAmt;
uniform float uAOAmt;
uniform float uBrowLift;
uniform float uClay;
uniform float uHairFront;
uniform float uHairLow;
uniform float uSmile;
uniform float uSSSAmt;
uniform float uBrowSlope;
uniform float uBrowArch;
uniform float uBrowThick;
uniform float uHeadScale;
uniform float uEyeOpen;
uniform float uNaturalLid;
uniform float uNose;
uniform float uEyeWidth;
uniform float uNaturalNose;

// Set by the look, read by the lighting functions below.
float gSSS = 0.0;
float gH = 0.0;
float gCloth = 0.0;
float gAbs = 0.0;
float gFaceAO = 1.0;
float gThin = 0.0;

struct Look {
  vec3 color;
  float rough;
  float coat;
  float coatRough;
  vec3 sheen;
  float sheenRough;
  float sss;
  float height;
  float spec;
  float cloth;
  float thin;
};

float aa(float v) {
  float w = max(fwidth(v), 1e-5) * 0.75;
  return smoothstep(-w, w, v);
}
float soft(float v, float w) {
  float f = max(fwidth(v), 1e-5) * 0.75;
  float e = max(w, f);
  return smoothstep(-e, e, v);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.3) * 0.15;
}

float hairlineNoise(float x, float y, float z) {
  return 0.0022 * sin(x * 260.0 + 1.3) + 0.0014 * sin(x * 610.0 + y * 90.0 + 0.4) + 0.0009 * sin(z * 420.0 + x * 150.0);
}

// Cellular-ish pores: dimples from a jittered grid.
float pores(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d = 1.0;
  for (int z = 0; z <= 1; z++)
  for (int y = 0; y <= 1; y++)
  for (int x = 0; x <= 1; x++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = o + vec3(hash13(i + o), hash13(i + o + 11.7), hash13(i + o + 23.1)) - f;
    d = min(d, dot(r, r));
  }
  return smoothstep(0.0, 0.25, d);
}

Look bodyLook() {
  vec3 p = vBind / uScale;
  vec3 n = normalize(vBindN);
  float part = floor(vPart + 0.5);
  float side = p.x >= 0.0 ? 1.0 : -1.0;
  // Lighter baked occlusion on the face, eased by height (not by part id, which
  // would leave a jagged seam where the neck meets the jaw).
  gFaceAO = mix(1.0, 0.42, smoothstep(1.5, 1.575, p.y));
  float ax = abs(p.x);
  float foot = length(fwidth(vBind));
  // The portrait's footprint per pixel, taken here in uniform control flow: derivatives inside the
  // face branch below are undefined, and the GPU then picked a far-blurred mip (the photo vanished
  // from every face smaller than a close-up).
  vec2 phDx = dFdx(vPhoto.xy), phDy = dFdy(vPhoto.xy);
  // Detail fades as a pixel covers more surface.
  float fineFade = 1.0 - smoothstep(0.0004, 0.0016, foot);
  float midFade = 1.0 - smoothstep(0.0015, 0.006, foot);

  bool isTorso = part < 0.5;
  bool isArm = part > 1.5 && part < 2.5;
  bool isHand = part > 2.5 && part < 3.5;
  bool isLeg = part > 3.5 && part < 4.5;
  bool isFoot = part > 4.5 && part < 5.5;
  bool isHairVol = part > 5.5 && part < 6.5;
  bool isHead = (part > 0.5 && part < 1.5) || part > 5.5;

  // ---- skin -------------------------------------------------------------
  float tone = fbm(p * 38.0) - 0.5;
  // Slightly desaturated base: real skin under white light is less orange than its swatch.
  vec3 skin0 = mix(vec3(dot(uSkin, vec3(0.299, 0.587, 0.114))), uSkin, 0.66) * vec3(1.0, 0.99, 0.99);
  vec3 skin = skin0 * (1.0 + tone * 0.1);
  // Blotchy capillary tone at a few centimetres, as real skin has.
  skin *= mix(vec3(1.0), vec3(1.02, 0.95, 0.94), smoothstep(0.45, 0.75, fbm(p * 22.0 + 11.0)) * 0.7);
  // Faint olive/cool drift so the tone is not one flat colour.
  skin *= mix(vec3(1.0), vec3(0.97, 1.0, 1.02), smoothstep(0.35, 0.65, fbm(p * 9.0 + 3.0)) * 0.6);
  // Freckle-scale mottling, very faint.
  skin *= 1.0 + (vnoise(p * 420.0) - 0.5) * 0.08 * midFade;
  vec3 blood = vec3(1.0, 0.74, 0.7);

  vec3 shoulder = vec3(side * 0.19, 1.43, -0.025);
  vec3 armDir = normalize(vec3(side * 0.788, -0.616, 0.0));
  float along = dot(p - shoulder, armDir);

  float red = 0.0;
  // Knees and elbows, knuckles and fingers: thinner skin, more blood.
  if (isLeg) red += (1.0 - smoothstep(0.0, 0.05, length(vec2(p.y - 0.5, max(0.0, 0.03 - p.z) * 2.0)))) * 0.6;
  if (isArm) red += (1.0 - smoothstep(0.0, 0.05, abs(along - 0.3))) * smoothstep(-0.01, -0.04, p.z) * 0.6;
  if (isHand) red += 0.35 + (1.0 - smoothstep(0.0, 0.03, abs(along - 0.65))) * 0.35 + smoothstep(0.66, 0.74, along) * 0.25;
  if (isFoot || isLeg) red += 0.0;

  float sweatMask = 0.6;
  float rough = 0.62;
  float height = 0.0;
  float poreAmt = 0.25;

  Look L;
  L.sss = 1.0;
  L.spec = 1.0;
  L.cloth = 0.0;
  L.thin = isHand ? 0.3 : 0.0;
  L.coatRough = 0.28;
  L.sheenRough = 0.6;

  // ---- arm definition: creases between muscles, on bare skin ------------------
  if (isArm) {
    float outer = ax - 0.19;
    float aZ = p.z + 0.026;
    // Deltoid's tip: a soft V down the outside of the upper arm.
    float deltV = (1.0 - smoothstep(0.003, 0.014, abs(p.y - 1.296 - abs(aZ) * 1.25))) * smoothstep(-0.03, 0.012, outer) * (1.0 - smoothstep(0.05, 0.075, abs(aZ)));
    // Biceps from triceps, on both sides of the arm.
    float split = (1.0 - smoothstep(0.002, 0.011, abs(aZ + 0.002 + (1.23 - p.y) * 0.06))) * smoothstep(1.155, 1.2, p.y) * (1.0 - smoothstep(1.285, 1.32, p.y)) * smoothstep(0.012, 0.03, abs(outer));
    // Biceps' lower end, above the elbow crease.
    float bicepEnd = (1.0 - smoothstep(0.003, 0.012, abs(p.y - 1.168 - aZ * 0.25))) * smoothstep(0.0, 0.02, aZ) * 0.8;
    // Triceps' horseshoe on the back of the arm.
    float triceps = (1.0 - smoothstep(0.003, 0.012, abs(p.y - 1.215 - abs(outer) * 0.8))) * smoothstep(-0.018, -0.042, aZ) * 0.65;
    // Forearm: brachioradialis and extensors separate, then run into the wrist.
    float fore = (1.0 - smoothstep(0.002, 0.009, abs(aZ - 0.012 + (1.1 - p.y) * 0.07))) * smoothstep(0.96, 1.02, p.y) * (1.0 - smoothstep(1.09, 1.125, p.y)) * smoothstep(-0.008, 0.012, outer) * 0.7;
    float cut = clamp(max(max(deltV, split), max(max(bicepEnd, triceps), fore)), 0.0, 1.0) * uAbs;
    skin *= 1.0 - cut * vec3(0.17, 0.21, 0.2);
    height -= cut * 0.7;
  }

  // ---- head -------------------------------------------------------------
  float hairMask = 0.0;
  if (isHead || part > 6.5) {
    p = vec3(0.0, 1.6, -0.01) + (p - vec3(0.0, 1.6, -0.01)) / uHeadScale;
    ax = abs(p.x);
    float pupil = 1.649;
    float lenOff = uFaceLen;
    // T-zone shine and pores; matte cheeks.
    float tzone = (1.0 - smoothstep(0.012, 0.03, ax)) * smoothstep(1.59, 1.62, p.y) * step(0.06, p.z);
    tzone = max(tzone, smoothstep(1.675, 1.69, p.y) * step(0.05, p.z) * (1.0 - smoothstep(1.72, 1.74, p.y)));
    rough = mix(0.62, 0.5, tzone);
    poreAmt = 0.55 + tzone * 0.4;
    sweatMask = 0.7 + tzone * 0.5;

    // Warmth: cheeks, nose tip, ears.
    float cheek = 1.0 - smoothstep(0.006, 0.04, length(vec2(ax - 0.054, p.y - 1.612)));
    cheek *= step(0.03, p.z);
    red += cheek * (0.3 + uFlush * 0.6);
    red += (1.0 - smoothstep(0.004, 0.02, length(vec2(ax, p.y - 1.612)))) * step(0.1, p.z) * 0.3;
    // Slightly yellower, more even forehead.
    skin *= mix(vec3(1.0), vec3(1.02, 1.0, 0.95), smoothstep(1.68, 1.71, p.y) * step(0.03, p.z));
    float ear = smoothstep(0.066, 0.078, ax) * (1.0 - smoothstep(0.03, 0.04, abs(p.y - 1.638))) * (1.0 - smoothstep(0.02, 0.035, abs(p.z + 0.007)));
    red += ear * 0.12 + (part > 6.5 && part < 7.5 ? 0.04 : 0.0);
    L.thin = max(ear, part > 6.5 && part < 7.5 ? 1.0 : 0.0) * 0.5 + (1.0 - smoothstep(0.004, 0.016, length(vec2(ax, p.y - 1.612)))) * step(0.1, p.z) * 0.3;

    // Beard shadow on a clean-shaven face: jaw, chin, upper lip.
    float mouthY = uBaseHead > 0.5 ? 1.5745 - (lenOff + 0.005) * 0.7 : 1.5813 - lenOff * 0.35;
    float beard = smoothstep(1.585, 1.562, p.y + ax * 0.5) * smoothstep(1.52, 1.545, p.y) * step(0.0, p.z + 0.01);
    beard *= 1.0 - smoothstep(0.06, 0.074, ax);
    beard *= 1.0 - (1.0 - smoothstep(0.006, 0.012, abs(p.y - mouthY + 0.001))) * (1.0 - smoothstep(0.022, 0.03, ax));
    float stub = beard * uStubble * (0.75 + 0.5 * vnoise(p * 900.0) * fineFade);
    skin = mix(skin, skin * vec3(0.72, 0.74, 0.8), stub * 0.5);

    skin = mix(skin, skin * blood, clamp(red, 0.0, 1.0) * 0.6);
    red = 0.0;
    // Periorbital: slightly darker, cooler skin round the eyes.
    float orbit = 1.0 - smoothstep(0.006, 0.022, length(vec2((ax - 0.032) * 0.8, p.y - pupil)));
    skin = mix(skin, skin * vec3(0.9, 0.87, 0.89), orbit * step(0.06, p.z) * 0.35);

    // Lips: vermilion by position with a cupid's bow, soft borders.
    float my = mouthY + ax * ax * uSmile;
    float upH = 0.0074 * (1.0 - smoothstep(0.004, 0.027, ax)) + 0.0012 * smoothstep(0.003, 0.008, ax) * (1.0 - smoothstep(0.008, 0.016, ax));
    float loH = 0.0092 * (1.0 - smoothstep(0.004, 0.025, ax * 1.05));
    float upper = soft(my + upH - p.y, 0.0016) * soft(p.y - my, 0.0003);
    float lower = soft(p.y - (my - loH), 0.0018) * soft(my - p.y, 0.0003);
    float lips = clamp(upper + lower, 0.0, 1.0) * step(0.081, p.z) * (1.0 - smoothstep(0.022, 0.028, ax));
    vec3 lipCol = skin * vec3(0.86, 0.6, 0.58);
    skin = mix(skin, lipCol, (upper * 0.75 + lower * 0.7) * lips);
    // Nostrils: dark inside the openings carved under the tip.
    vec3 nq = vec3((ax - 0.0078) / 0.0055, (p.y - 1.6052 + uNose * 0.8) / 0.0034, (p.z - 0.1045 - uNose * 0.3) / 0.0068);
    if (uNaturalNose > 0.5) nq = vec3((ax - 0.0102) / 0.0037, (p.y - 1.6082 + uNose * 0.8) / 0.0027, (p.z - 0.1093 - uNose * 0.3) / 0.005);
    float nos = 1.0 - smoothstep(0.55, 1.0, length(nq));
    skin = mix(skin, skin * vec3(0.45, 0.3, 0.28), nos * mix(0.6,0.3,uNaturalNose) * (1.0 - uBaseHead));
    rough = mix(rough, 0.56, lips);
    float mouth = soft(0.0006 - abs(p.y - my), 0.0005) * (1.0 - smoothstep(0.021, 0.028, ax)) * step(0.08, p.z);
    // Shadowed mouth corners.
    float corner = (1.0 - smoothstep(0.0, 0.0045, length(vec2(ax - 0.0255, p.y - my)))) * step(0.075, p.z);
    skin = mix(skin, skin * vec3(0.55, 0.4, 0.38), clamp(mouth * 0.55 + corner * 0.3, 0.0, 1.0));

    // Lash lines along the almond aperture carved through the lid shell (see
    // anatomy: centre (0.0327, pupil - 0.0004), half axes 15.2 x 5.3 mm, tilted 5
    // degrees so the outer corner sits higher).
    if (part > 8.5) {
      vec2 dq = vec2(ax - 0.0327, p.y - (pupil - 0.0004));
      float u = (dq.x * 0.99619 + dq.y * 0.08716) / uEyeWidth;
      float v = -dq.x * 0.08716 + dq.y * 0.99619;
      float hApt = 0.0049 * uEyeOpen * sqrt(max(0.0, 1.0 - (u / 0.0152) * (u / 0.0152)));
      float isUp = step(0.0, v);
      float dM = abs(v) - hApt;
      // Upper lash line: dense, thicker toward the outer corner; lower: a hint.
      float wLash = isUp > 0.5 ? mix(0.0007, 0.0014, smoothstep(-0.012, 0.012, u)) : 0.0005;
      wLash *= mix(1.0, 0.48, uNaturalLid);
      float lash = 1.0 - smoothstep(wLash * 0.4, wLash, abs(dM));
      lash *= isUp > 0.5 ? 0.9 : 0.3;
      lash *= smoothstep(-0.0152, -0.011, u) * (1.0 - smoothstep(0.0135, 0.0158, u));
      // The margin's inner wall: a slightly darker, wet skin, never a pink rim.
      float wall = (1.0 - smoothstep(-0.0002, 0.0005, dM)) * (1.0 - smoothstep(0.013, 0.0152, abs(u)));
      skin = mix(skin, skin * vec3(0.86, 0.8, 0.78), wall * 0.6);
      rough = mix(0.5, 0.25, wall);
      skin = mix(skin, mix(uHair * 0.18, skin * vec3(0.48, 0.35, 0.31), uNaturalLid), lash * mix(1.0, 0.65, uNaturalLid));
      // Upper-lid crease: a soft shadow line following the margin, 7 mm up.
      float crease = (1.0 - smoothstep(0.0, 0.0022, abs(dM - 0.0068))) * isUp * smoothstep(-0.014, -0.006, u);
      skin *= 1.0 - crease * mix(0.14, 0.06, uNaturalLid);
    }

    // Eyebrows: strands along a gentle arch, denser at the head of the brow.
    float browY = pupil + 0.0205 + uBrowLift + (ax - 0.012) * uBrowSlope - (ax - 0.036) * (ax - 0.036) * uBrowArch;
    float bh = mix(0.0042, 0.0014, smoothstep(0.014, 0.056, ax)) * uBrowThick;
    // Denser and darker at the lower edge, wispy along the top.
    float bv = (p.y - browY) / bh;
    float browBand = soft(bh - abs(p.y - browY), 0.0016) * mix(1.0, 0.55, smoothstep(-0.2, 1.0, bv)) * smoothstep(0.009, 0.014, ax) * (1.0 - smoothstep(0.05, 0.056, ax)) * step(0.07, p.z);
    // Brow hairs point up at the head of the brow, then sweep outward.
    float ang = mix(1.15, 0.22, smoothstep(0.012, 0.03, ax));
    vec2 bd = vec2(cos(ang), sin(ang));
    vec2 bq = vec2(ax, p.y - browY);
    float strand = vnoise(vec3(dot(bq, bd) * 380.0, dot(bq, vec2(-bd.y, bd.x)) * 2600.0, side * 7.0));
    strand = smoothstep(0.25, 0.75, strand);
    float brow = browBand * mix(0.55, 1.0, strand * fineFade + (1.0 - fineFade) * 0.6);
    skin = mix(skin, uHair * 0.62, brow * 0.8);
    height += brow * strand * 0.5;

    // Photo-fitted face: the portrait itself, over the painted features it replaces.
    float pm = vPhoto.z * uPhotoReady;
    if (pm > 0.002) {
      // The portrait with its own shading and colour (beard shadow, brows, eye sockets, flush), white-balanced
      // so its skin averages the body's skin. Toward the edge the balance turns local (photo over a blurred copy
      // of itself), so the fade meets the head with the same tone on both sides and no ring shows.
      vec3 ph = textureGrad(uFacePhoto, vPhoto.xy, phDx, phDy).rgb;
      // A blurred copy at a fixed size on the face (mip 4, about 16 texels of the portrait), or coarser
      // where a pixel already covers more than that.
      vec2 tsz = vec2(textureSize(uFacePhoto, 0));
      float lodPh = log2(max(1.0, max(length(phDx * tsz), length(phDy * tsz))));
      vec3 lo = textureLod(uFacePhoto, vPhoto.xy, max(4.0, lodPh + 1.0)).rgb;
      vec3 local = ph / max(lo, vec3(0.004));
      // The photo's broad shading (its light falling on cheekbones and sockets) is partly redundant with
      // the renderer's own light on the fitted shape; keep uPhotoBroad of it (as a power) in the middle.
      vec3 broad = pow(max(lo / max(uPhotoMean, vec3(0.01)), vec3(0.02)), vec3(uPhotoBroad * smoothstep(0.35, 0.95, pm)));
      // Colour within the face (lips, flush, beard) relative to its brightness; a colour-cast photo keeps less of it.
      vec3 ratio = local * broad;
      ratio = mix(vec3(dot(ratio, vec3(0.2126, 0.7152, 0.0722))), ratio, uPhotoChroma);
      vec3 photo = skin0 * clamp(ratio, 0.05, 2.2) * uPhotoGain;
      skin = mix(skin, photo, pm);
      height *= 1.0 - pm * 0.7;
      poreAmt *= 1.0 - pm * 0.5;
    }

    // Hair: mirrors hairAt() in anatomy.ts, with the same soft falloff.
    float hf = uHairFront + 0.007 * smoothstep(0.016, 0.044, ax);
    // Straight hair grows to a smoother hairline than coiled hair's broken edge.
    float front = -0.5 * (p.y - hf) + 0.866 * (p.z - 0.07) + hairlineNoise(p.x, p.y, p.z) * mix(1.0, 0.55, uHairStraight);
    float frontHair = smoothstep(0.006, -0.009, front);
    float y1 = mix(1.635, 1.69, smoothstep(0.016, 0.03, p.z));
    y1 = mix(y1, 1.672, smoothstep(0.006, -0.002, p.z));
    y1 = mix(y1, 1.594, smoothstep(-0.021, -0.065, p.z));
    y1 -= uHairLow * 0.05 * smoothstep(0.03, 0.0, p.z);
    float hw = 0.006 + 0.008 * smoothstep(-0.03, -0.07, p.z);
    float sideHair = smoothstep(-hw * 0.5, hw, p.y - y1 + hairlineNoise(p.z, p.y, p.x) * 0.8);
    float sideGate = smoothstep(0.044, 0.064, ax);
    hairMask = min(frontHair, sideHair) * step(1.575 - uHairLow * 0.05, p.y);
    // Fine irregularity at the edge only.
    hairMask = clamp(hairMask + (vnoise(p * 300.0) - 0.5) * 0.35 * mix(1.0, 0.25, uHairStraight) * hairMask * (1.0 - hairMask) * 4.0, 0.0, 1.0);
    float top = smoothstep(1.7, 1.73, p.y) * (1.0 - sideGate * 0.5);
    float density = mix(uSides, 1.0, max(top, isHairVol ? 1.0 : 0.0));
    if (isHairVol) hairMask = max(hairMask, 0.98);
    // Strands flow front to back on top, down on the sides.
    // Tightly coiled hair reads as fine speckle; straight hair as long strands along its direction.
    vec3 flowTop = mix(vec3(1500.0, 1500.0, 220.0), vec3(2600.0, 2600.0, 80.0), uHairStraight);
    vec3 flowSide = mix(vec3(1500.0, 260.0, 1500.0), vec3(2600.0, 90.0, 2600.0), uHairStraight);
    vec3 flow = mix(p * flowTop, p * flowSide, sideGate * (1.0 - top));
    float strands = vnoise(flow);
    float clump = vnoise(p * 140.0);
    vec3 hairCol = uHair * mix(0.7 + strands * 0.45 + clump * 0.2, 0.82 + strands * 0.28 + clump * 0.12, uHairStraight);
    vec3 scalp = skin * 0.86;
    vec3 hairArea = mix(scalp, hairCol, density * (0.75 + 0.25 * strands));
    skin = mix(skin, hairArea, hairMask);
    // Matte enough that the cap never reads as a helmet; the shell above carries the strand sheen.
    rough = mix(rough, mix(0.7, 0.6, uHairStraight), hairMask);
    height = mix(height, strands * 0.8 + clump * 0.4, hairMask);
    sweatMask *= 1.0 - hairMask * 0.6;
    L.sss = 1.0 - hairMask * 0.7;
  }

  // Knees, elbows, knuckles: thinner skin, more blood.
  skin = mix(skin, skin * blood, clamp(red, 0.0, 1.0) * 0.6);
  L.color = skin;
  // Pores and fine skin texture: pores at 0.9 mm, a crepey undulation at
  // 4-6 mm that breaks the specular up even where the pores are sub-pixel.
  float pr = pores(p * 1100.0);
  float und = fbm(p * 160.0);
  float crepe = fbm(p * 520.0);
  height += ((pr - 1.0) * poreAmt * fineFade + (crepe - 0.5) * 0.45 * fineFade + (und - 0.5) * 0.5 * midFade) * (1.0 - hairMask);
  L.rough = clamp(rough + (pr - 0.85) * 0.12 * fineFade + (und - 0.5) * 0.1, 0.3, 0.9);
  L.sheen = uSkin * 0.05;

  // Sweat: a thin glossy film with droplet breakup.
  float drops = smoothstep(0.55, 0.8, vnoise(p * 300.0));
  float sweat = uSweat * sweatMask * (0.6 + 0.4 * drops);
  L.coat = sweat * 0.55;
  L.coatRough = mix(0.4, 0.2, sweat);

  // ---- singlet ----------------------------------------------------------
  float frontF = smoothstep(-0.05, 0.03, p.z);
  float scoopF = mix(1.462, mix(1.36, 1.285, uCut), smoothstep(0.082, 0.03, ax));
  float scoopB = mix(1.462, mix(1.31, 1.215, uCut), smoothstep(0.08, 0.024, ax));
  float scoop = mix(scoopB, scoopF, frontF);
  // A low-cut singlet has narrower straps and armholes cut down the ribs.
  float strapOuter = mix(0.13, 0.118, uCut);
  float armhole = mix(1.24, 1.15, uCut) - max(0.0, ax - strapOuter) * 1.6;
  float inStrap = aa(ax - mix(0.078, 0.088, uCut)) * aa(strapOuter - ax);
  float topY = mix(ax < strapOuter ? scoop : armhole, 1.62, inStrap);
  float topDist = topY - p.y;

  vec3 hip = vec3(side * 0.09, 0.925, 0.0);
  vec3 thighDir = vec3(side * 0.0698, -0.9976, 0.0);
  float alongT = dot(p - hip, thighDir);
  float legDist = uLegLen - alongT;

  float singlet = 0.0;
  float edge = 1.0;
  if (isTorso) {
    singlet = aa(topDist);
    edge = topDist;
  } else if (isLeg) {
    singlet = aa(legDist);
    edge = legDist;
  }

  if (uReferee > 0.5) singlet = 0.0;
  if (singlet > 0.0) {
    // Very dark team colours (navy) are lifted so their hue survives the
    // lights and the tone curve instead of collapsing to charcoal.
    vec3 kit = uPrimary;
    float kitLum = dot(kit, vec3(0.2126, 0.7152, 0.0722));
    kit *= mix(1.0, 1.75, 1.0 - smoothstep(0.004, 0.05, kitLum));
    // White side panel: a vertical stripe down the ribs and the outside of the leg.
    float zc = -0.008;
    float halfW = 0.036;
    float lateralOk = isTorso ? aa(ax - 0.07) * soft(1.3 - p.y, 0.01) : aa(p.x * side - 0.1);
    float dz = abs(p.z - zc);
    // Two-tone: the upper body (chest, shoulders, straps) in its own colour.
    if (isTorso && uTop.w > 0.5) kit = mix(kit, uTop.rgb, aa(p.y - (1.272 + ax * 0.25)));
    // Horizontal band across the chest and back, an older design.
    if (isTorso && uChestBand.w > 0.5) kit = mix(kit, uChestBand.rgb, aa(0.022 - abs(p.y - uBandY)));
    float panel = aa(halfW - dz) * lateralOk * uPanel;
    kit = mix(kit, uSecondary, panel);
    // Piping along both panel edges.
    float pipe = (1.0 - smoothstep(0.0016, 0.003, abs(dz - halfW))) * lateralOk * uPanel;
    kit = mix(kit, uPiping, pipe);
    float lateral = dz - halfW;
    float panelEdge = 0.0;
    // Binding at the openings.
    float bind = (1.0 - smoothstep(0.004, 0.0065, edge)) * singlet;
    kit = mix(kit, uPiping, bind);
    // Wide contrasting cuff at the leg hem.
    if (isLeg && uCuff.w > 0.5) kit = mix(kit, uCuff.rgb, (1.0 - smoothstep(0.034, 0.037, edge)) * singlet);
    // Two thin stripes just above the leg hem.
    if (isLeg && uHemStripes.w > 0.5) {
      float hs = (1.0 - smoothstep(0.0028, 0.0045, abs(edge - 0.016))) + (1.0 - smoothstep(0.0028, 0.0045, abs(edge - 0.029)));
      kit = mix(kit, uHemStripes.rgb, clamp(hs, 0.0, 1.0) * singlet);
    }

    // Wordmark across the chest.
    vec2 uv = vec2(0.5 + p.x / mix(0.2, 0.32, uChestEmblem), (p.y - mix(1.236, 1.17, uChestEmblem)) / mix(0.05, 0.15, uChestEmblem));
    float inMark = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * smoothstep(0.02, 0.05, p.z) * (isTorso ? 1.0 : 0.0);
    vec4 emblem = texture2D(uWordmark, uv);
    float ink = emblem.a * inMark;
    kit = mix(kit, mix(uWordmarkColor, emblem.rgb, uChestEmblem), ink * 0.95);

    float legStripe = (1.0 - smoothstep(0.003, 0.006, abs(p.y - 0.735))) + (1.0 - smoothstep(0.003, 0.006, abs(p.y - 0.753)));
    kit = mix(kit, uPiping, clamp(legStripe, 0.0, 1.0) * uChestEmblem * (1.0 - uCuff.w) * singlet);

    // Lycra: fine knit, seams, tight sheen.
    float knit = vnoise(vec3(p.x * 2600.0, p.y * 900.0, p.z * 2600.0));
    float seam = (1.0 - smoothstep(0.0, 0.0018, abs(lateral - panelEdge))) * lateralOk + (1.0 - smoothstep(0.0, 0.0015, ax)) * (1.0 - frontF) * (isTorso ? 1.0 : 0.0);
    kit *= 0.97 + knit * 0.05 * fineFade;
    kit *= 1.0 - seam * 0.12;
    // Cover-stitch: a dashed double row just inside each panel edge and above
    // each hem, the way a competition singlet is finished.
    float dash = step(0.45, fract(p.y * 380.0 + p.z * 120.0));
    float rowA = (1.0 - smoothstep(0.0003, 0.0007, abs(abs(dz - halfW) - 0.0045))) * lateralOk;
    float rowH = (1.0 - smoothstep(0.0003, 0.0007, abs(edge - 0.0105))) * step(0.0, edge);
    float stitch = max(rowA, rowH) * dash * fineFade;
    kit = mix(kit, mix(kit, vec3(1.0), 0.25), stitch * 0.6);
    // Lycra clings: abs, obliques and the lower pec read through it as shading,
    // crisp at any mesh resolution and any camera distance.
    if (isTorso && p.z > 0.0) {
      // Real abs aren't a grid: rows slope up and out, sit unevenly left to right,
      // narrow toward the navel, and the grooves are soft valleys.
      float wob = (vnoise(vec3(p.y * 26.0, side * 3.0, 1.7)) - 0.5) * 0.006;
      float zone = (1.0 - smoothstep(0.044 + (p.y - 1.08) * 0.09, 0.07, ax + wob)) * smoothstep(1.045, 1.09, p.y) * (1.0 - smoothstep(1.235, 1.275, p.y));
      float tilt = ax * 0.16 + ax * ax * 1.6;
      float rows = (1.0 - smoothstep(0.0018, 0.0085, abs(p.y - 1.236 - tilt - side * 0.0016))) * 0.8;
      rows = max(rows, 1.0 - smoothstep(0.0018, 0.0085, abs(p.y - 1.179 - tilt + side * 0.0022)));
      rows = max(rows, (1.0 - smoothstep(0.0018, 0.0085, abs(p.y - 1.122 - tilt * 0.7 - side * 0.0012))) * 0.85);
      float linea = (1.0 - smoothstep(0.0012, 0.0075, abs(p.x + (p.y - 1.15) * 0.012 + wob * 0.3))) * mix(0.75, 1.0, smoothstep(1.2, 1.1, p.y));
      float groove = max(rows, linea) * zone;
      groove = max(groove, (1.0 - smoothstep(0.003, 0.013, abs(ax - 0.062 - (1.15 - p.y) * 0.03 + wob))) * smoothstep(1.06, 1.11, p.y) * (1.0 - smoothstep(1.225, 1.265, p.y)) * 0.7);
      float inguinal = (1.0 - smoothstep(0.002, 0.008, abs((p.y - 0.985) - (ax - 0.02) * 0.82))) * smoothstep(0.015, 0.03, ax) * (1.0 - smoothstep(0.09, 0.115, ax)) * 0.7;
      float serratus = (1.0 - smoothstep(0.003, 0.012, abs(ax - 0.112 + (p.y - 1.2) * 0.2))) * smoothstep(1.13, 1.17, p.y) * (1.0 - smoothstep(1.22, 1.26, p.y)) * 0.45;
      float pecLine = (1.0 - smoothstep(0.0024, 0.01, abs(p.y - 1.283 - (ax - 0.075) * (ax - 0.075) * 3.0))) * smoothstep(0.004, 0.02, ax) * (1.0 - smoothstep(0.12, 0.15, ax)) * 0.8;
      float cut = clamp(max(max(groove, inguinal), max(serratus, pecLine)), 0.0, 1.0) * uAbs;
      kit *= 1.0 - cut * 0.27;
      float block = zone * (1.0 - groove) * uAbs;
      // Black kit can't get darker, so light the blocks for the grooves to read against.
      kit += vec3(0.022) * block;
      height -= cut * 0.8 * singlet;
      gAbs = zone * uAbs * singlet;
    }
    // The back reads through the cloth too: spine channel, shoulder blades, lats.
    if (isTorso && p.z <= 0.0) {
      float wobB = (vnoise(vec3(p.y * 22.0, side * 3.0, 4.1)) - 0.5) * 0.005;
      float spine = (1.0 - smoothstep(0.002, 0.012, ax + wobB)) * smoothstep(1.0, 1.06, p.y) * (1.0 - smoothstep(1.36, 1.44, p.y));
      vec2 sq = vec2((ax - 0.09) / 0.052, (p.y - 1.355) / 0.078);
      float scap = (1.0 - smoothstep(0.0, 0.2, abs(length(sq) - 1.0))) * smoothstep(1.26, 1.3, p.y) * (1.0 - smoothstep(0.1, 0.16, ax - 0.09)) * 0.75;
      float lat = (1.0 - smoothstep(0.003, 0.014, abs(ax - 0.05 - (p.y - 1.06) * 0.42 + wobB))) * smoothstep(1.06, 1.1, p.y) * (1.0 - smoothstep(1.24, 1.3, p.y)) * 0.6;
      float back = clamp(max(spine, max(scap, lat)), 0.0, 1.0) * uAbs;
      kit *= 1.0 - back * 0.27;
      kit += vec3(0.012) * uAbs * (1.0 - back) * smoothstep(1.05, 1.15, p.y) * (1.0 - smoothstep(0.1, 0.13, ax));
      height -= back * 0.8 * singlet;
    }
    L.color = mix(L.color, kit, singlet);
    L.rough = mix(L.rough, 0.6 - ink * 0.1, singlet);
    L.coat = mix(L.coat, 0.0, singlet);
    L.sheen = mix(L.sheen, mix(kit, normalize(kit + 1e-4) * 0.6, 0.5) * 0.8, singlet);
    L.sheenRough = mix(L.sheenRough, 0.42, singlet);
    L.sss = mix(L.sss, 0.0, singlet);
    L.thin = 0.0;
    L.cloth = singlet;
    height = mix(height, knit * 0.25 * fineFade - seam * 0.6 + bind * 0.5, singlet);
    red = 0.0;
  }
  // Tights under the singlet, hip to ankle: matte knit, no skin showing.
  if (uTights.w > 0.5 && isLeg && uReferee < 0.5) {
    float tights = (1.0 - singlet) * aa(p.y - 0.13);
    float tknit = vnoise(vec3(p.x * 2200.0, p.y * 800.0, p.z * 2200.0));
    vec3 tcol = uTights.rgb * mix(1.0, 1.6, 1.0 - smoothstep(0.004, 0.05, dot(uTights.rgb, vec3(0.2126, 0.7152, 0.0722))));
    L.color = mix(L.color, tcol * (0.96 + tknit * 0.06 * fineFade), tights);
    L.rough = mix(L.rough, 0.66, tights);
    L.coat = mix(L.coat, 0.0, tights);
    L.sheen = mix(L.sheen, tcol * 0.5, tights);
    L.sheenRough = mix(L.sheenRough, 0.5, tights);
    L.sss = mix(L.sss, 0.0, tights);
    L.cloth = max(L.cloth, tights);
    height = mix(height, tknit * 0.2 * fineFade, tights);
    red = mix(red, 0.0, tights);
  }

  // ---- official's uniform ------------------------------------------------
  if (uReferee > 0.5) {
    vec3 black = vec3(0.022, 0.024, 0.03);
    vec3 shoulder = vec3(side * 0.19, 1.43, -0.025);
    vec3 armDir = normalize(vec3(side * 0.788, -0.616, 0.0));
    float armAlong = dot(p - shoulder, armDir);
    float sleeve = isArm ? aa(0.15 - armAlong) : 0.0;
    float shirt = isTorso ? aa(p.y - 1.0) : sleeve;
    float slacks = clamp((isTorso ? aa(1.0 - p.y) : 0.0) + (isLeg ? 1.0 : 0.0), 0.0, 1.0);
    float collar = isTorso ? aa(p.y - 1.44) * aa(0.075 - ax) : 0.0;
    float stripe = step(0.5, fract((p.x + 0.0125) / 0.05));
    vec3 shirtCol = mix(mix(vec3(0.9, 0.9, 0.88), black, stripe), black, collar);
    float clothed = clamp(shirt + slacks, 0.0, 1.0);
    L.color = mix(L.color, shirtCol, shirt);
    L.color = mix(L.color, black, slacks);
    L.rough = mix(L.rough, 0.86, clothed);
    L.coat = mix(L.coat, 0.0, clothed);
    L.sheen = mix(L.sheen, vec3(0.08), clothed);
    L.sss = mix(L.sss, 0.0, clothed);
    height = mix(height, 0.0, clothed);
    red = mix(red, 0.0, clothed);
    float wristBand = isArm ? aa(armAlong - 0.485) * aa(0.53 - armAlong) : 0.0;
    vec3 wristCol = side > 0.0 ? vec3(0.75, 0.08, 0.07) : vec3(0.08, 0.55, 0.2);
    L.color = mix(L.color, wristCol, wristBand);
    L.sss = mix(L.sss, 0.0, wristBand);
  }

  // ---- ankle band -------------------------------------------------------
  if (isLeg || isFoot) {
    float bandMask = soft(0.0115 - abs(p.y - 0.18), 0.0012);
    L.color = mix(L.color, uBand * (0.92 + vnoise(p * 1800.0) * 0.12 * fineFade), bandMask);
    L.rough = mix(L.rough, 0.75, bandMask);
    L.coat = mix(L.coat, 0.0, bandMask);
    L.sheen = mix(L.sheen, vec3(0.06), bandMask);
    L.sss = mix(L.sss, 0.0, bandMask);
    height = mix(height, -0.3 + vnoise(p * 1800.0) * 0.4, bandMask);
  }

  // ---- shoes ------------------------------------------------------------
  // A logo-free wrestling boot: synthetic upper with a mesh vamp, one swept
  // side panel and heel counter in the accent colour, a lace cover piped in the
  // accent, a padded collar, and a light rubber sole that wraps up the toe.
  float shoe = (isFoot || isLeg) ? soft(0.17 - p.y, 0.0015) : 0.0;
  if (shoe > 0.0) {
    // The bind pose turns each leg out 4 degrees at the hip.
    float fx = p.x - side * (0.09 + (0.925 - p.y) * 0.0699);
    float topFace = smoothstep(0.45, 0.75, dot(n, normalize(vec3(0.0, 0.62, 0.78))));
    float sideFace = 1.0 - topFace;
    vec3 base = uShoe * 1.25 + vec3(0.012);
    // Mesh vamp over the forefoot, smooth synthetic elsewhere.
    float meshZone = smoothstep(0.06, 0.09, p.z) * (1.0 - smoothstep(0.15, 0.17, p.z)) * soft(p.y - 0.022, 0.002);
    float meshPat = step(0.5, fract(p.y * 700.0 + p.z * 300.0)) * step(0.5, fract(p.y * 700.0 - p.z * 300.0));
    vec3 sh = mix(base, base * (0.85 + meshPat * 0.3 * fineFade) + vec3(0.02), meshZone);
    // Swept side panel from the heel up toward the laces.
    float sweep = p.y - (0.028 + (p.z + 0.06) * 0.42);
    float panel = soft(0.016 - abs(sweep), 0.0012) * soft(p.z + 0.058, 0.003) * soft(0.11 - p.z, 0.004) * step(0.02, abs(fx)) * sideFace;
    float panelEdge = panel * (1.0 - soft(0.0125 - abs(sweep), 0.0008));
    // Heel counter.
    float heel = soft(-0.034 - p.z, 0.003) * soft(0.085 - p.y + p.z * 0.4, 0.003);
    sh = mix(sh, uShoeAccent, max(panel, heel * 0.9));
    sh = mix(sh, mix(uShoeAccent, vec3(1.0), 0.5), panelEdge * 0.6);
    // Lace cover flap with accent piping, and the lace bars under its edge.
    float flap = soft(0.02 - abs(fx), 0.0015) * topFace * soft(p.z - 0.035, 0.003) * soft(0.125 - p.z, 0.003) * soft(p.y - 0.05, 0.003);
    float flapPipe = flap * (1.0 - soft(0.0165 - abs(fx), 0.001));
    float laceBar = soft(0.0035 - abs(fract(p.z * 55.0) - 0.5) * 0.018, 0.0006) * flap * (1.0 - flapPipe);
    sh = mix(sh, base * 0.8, flap);
    sh = mix(sh, uShoeAccent, flapPipe * 0.9);
    sh = mix(sh, base * 0.6 + vec3(0.03), laceBar * 0.5);
    // Padded collar.
    float collar = soft(p.y - 0.152, 0.0015) * soft(0.17 - p.y, 0.0015);
    sh = mix(sh, uShoeAccent * 0.9, collar);
    // Rubber sole, wrapping up over the toe and round the heel.
    float wrap = 0.0115 + 0.014 * smoothstep(0.165, 0.215, p.z) + 0.006 * smoothstep(-0.045, -0.065, p.z);
    float sole = soft(wrap - p.y, 0.0012);
    vec3 rubber = vec3(0.62, 0.61, 0.58);
    float tread = soft(0.0015 - p.y, 0.0005);
    sh = mix(sh, rubber * (0.92 + vnoise(p * 900.0) * 0.1 * fineFade), sole);
    sh = mix(sh, rubber * 0.4, tread);
    float overlay = max(panel, max(heel, collar));
    float sRough = mix(mix(0.55, 0.75, meshZone), 0.5, overlay);
    sRough = mix(sRough, 0.7, sole);
    L.color = mix(L.color, sh, shoe);
    L.rough = mix(L.rough, sRough, shoe);
    L.coat = mix(L.coat, 0.05 * (1.0 - sole), shoe);
    L.sheen = mix(L.sheen, vec3(0.05), shoe);
    L.sss = mix(L.sss, 0.0, shoe);
    height = mix(height, meshPat * 0.3 * fineFade * meshZone + laceBar * 0.6 + flapPipe * 0.4 - collar * 0.2 + panelEdge * 0.3, shoe);
  }

  L.height = height;
  if (uClay > 1.5) { L.color = uSkin * 0.7; L.rough = 0.6; L.coat = 0.0; L.sheen = vec3(0.0); }
  else if (uClay > 0.5) { L.color = vec3(0.55); L.rough = 0.65; L.coat = 0.0; L.sheen = vec3(0.0); L.sss = 0.0; }
  return L;
}

// Bump from a screen-space height derivative (Mikkelsen), as three's bump map.
vec3 realPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

/** The physical lighting chunk with wrap diffuse and a red-shifted terminator on skin. */
function skinLightingChunk(): string {
  const src = ShaderChunk.lights_physical_pars_fragment;
  const from = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
  if (!src.includes(from)) return src;
  return src.replace(
    from,
    `{
      float ndlRaw = dot( geometryNormal, directLight.direction );
      vec3 wrapW = gSSS * vec3( 0.12, 0.05, 0.03 );
      vec3 wrapped = clamp( ( vec3( ndlRaw ) + wrapW ) / ( 1.0 + wrapW ), 0.0, 1.0 );
      // A touch of saturated scatter right at the terminator.
      float term = gSSS * clamp( 1.0 - abs( ndlRaw * 2.2 - 0.15 ), 0.0, 1.0 ) * 0.035;
      vec3 diffIrr = ( wrapped + vec3( term, term * 0.25, term * 0.12 ) ) * directLight.color;
      reflectedLight.directDiffuse += diffIrr * BRDF_Lambert( material.diffuseColor );
      // Thin parts (ears, nose tip, fingers) glow red when the light is behind them.
      float through = pow( clamp( dot( geometryViewDir, -directLight.direction ), 0.0, 1.0 ), 4.0 ) * 0.2 + clamp( -ndlRaw, 0.0, 1.0 ) * 0.05;
      reflectedLight.directDiffuse += directLight.color * gThin * through * vec3( 0.9, 0.22, 0.1 ) * material.diffuseColor;
    }`,
  );
}

/** Debug overrides from the URL, e.g. &bump=0&ao=0. */
function dbgParam(name: string, def: number): number {
  const v = new URLSearchParams(location.search).get(name);
  return v === null ? def : Number(v);
}

export interface RealBodyMaterial extends MeshPhysicalMaterial {
  userData: { uniforms: Record<string, IUniform> };
}

export function createRealBodyMaterial(look: RealLook, share?: RealBodyMaterial): RealBodyMaterial {
  const mat = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.55,
    metalness: 0,
    ior: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.3,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: new Color('#ffffff'),
  }) as RealBodyMaterial;

  const photoReady: IUniform = { value: 0 };
  const uniforms: Record<string, IUniform> = share ? share.userData.uniforms : {
    uSkin: { value: new Color(look.skin) },
    uHair: { value: new Color(look.hair) },
    uPrimary: { value: new Color(look.primary) },
    uSecondary: { value: new Color(look.secondary) },
    uChestEmblem: { value: look.chestEmblem ? 1 : 0 },
    // Until the portrait has loaded the face keeps its painted features.
    uPhotoReady: photoReady,
    uFacePhoto: { value: facePhotoTexture(look.facePhoto, photoReady) },
    uPhotoGain: { value: look.photoGain ?? 1 },
    uPhotoBroad: { value: 0.7 },
    uPhotoChroma: { value: look.photoChroma ?? 0.8 },
    uPhotoMean: { value: new Color(look.photoMean ?? '#808080') },
    uCut: { value: look.kit?.cut ?? 0 },
    uLegLen: { value: look.kit?.leg ?? 0.2 },
    uPanel: { value: look.kit?.panel === false ? 0 : 1 },
    uTop: { value: colourOn(look.kit?.top) },
    uCuff: { value: colourOn(look.kit?.cuff) },
    uChestBand: { value: colourOn(look.kit?.chestBand) },
    uBandY: { value: look.kit?.bandY ?? 1.29 },
    uHemStripes: { value: colourOn(look.kit?.hemStripes) },
    uTights: { value: colourOn(look.kit?.tights) },
    uReferee: { value: look.referee ? 1 : 0 },
    uBaseHead: { value: look.baseHead ? 1 : 0 },
    uAbs: { value: look.abs ?? 0 },
    uWordmarkColor: { value: new Color(look.wordmarkColor ?? look.secondary) },
    uPiping: { value: new Color(look.piping) },
    uBand: { value: new Color(look.band) },
    uShoe: { value: new Color(look.shoe) },
    uShoeAccent: { value: new Color(look.shoeAccent) },
    uScale: { value: look.scale },
    uSweat: { value: 0.15 },
    uFlush: { value: 0.1 },
    uFaceLen: { value: look.faceLen },
    uStubble: { value: look.stubble },
    uSides: { value: look.sides },
    uHairStraight: { value: look.hairStraight ?? 0 },
    uWordmark: { value: wordmarkTexture(look.wordmark.toUpperCase(), look.chestEmblem) },
    uBumpAmt: { value: dbgParam('bump', 1) },
    uBrowLift: { value: look.brow[0] },
    uClay: { value: dbgParam('clay', 0) },
    uHairFront: { value: look.hairFront },
    uHairLow: { value: look.hairLow ?? 0 },
    uSmile: { value: look.smile },
    uSSSAmt: { value: dbgParam('sss', 1) },
    uBrowSlope: { value: look.brow[1] },
    uBrowArch: { value: look.brow[2] },
    uBrowThick: { value: look.brow[3] },
    uAOAmt: { value: dbgParam('ao', 1) },
    uHeadScale: { value: look.headScale },
    uEyeOpen: { value: look.eyeOpen },
    uNaturalLid: { value: look.naturalLidFold ? 1 : 0 },
    uNose: { value: look.nose },
    uEyeWidth: { value: look.eyeWidth ?? 1 },
    uNaturalNose: { value: look.naturalNasalBase ? 1 : 0 },
  };
  mat.userData.uniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>
        {
          vec3 sn = aSmoothN;
          #ifdef USE_SKINNING
          sn = ( skinMatrix * vec4( sn, 0.0 ) ).xyz;
          #endif
          vSmoothN = normalMatrix * sn;
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBind = position;\nvBindN = normal;\nvPart = aPart;\nvAO = aAO;\nvPhoto = aPhoto;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <lights_physical_pars_fragment>', skinLightingChunk())
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nLook look = bodyLook();\ndiffuseColor.rgb = look.color;\ngSSS = look.sss * uSSSAmt;\ngThin = look.thin;\ngCloth = look.cloth;\ngH = look.height;',
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = look.rough;')
      .replace(
        '#include <normal_fragment_maps>',
        `{
          normal = normalize( mix( normal, normalize( vSmoothN ) * faceDirection, gCloth * 0.85 * ( 1.0 - gAbs * 0.5 ) ) );
          vec2 dH = vec2( dFdx( gH ), dFdy( gH ) ) * 0.0016 * uBumpAmt;
          normal = realPerturb( - vViewPosition, normal, dH, faceDirection );
        }`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        material.clearcoat = look.coat;
        material.clearcoatRoughness = look.coatRough;
        #ifdef USE_SHEEN
        material.sheenColor = look.sheen;
        material.sheenRoughness = look.sheenRough;
        #endif`,
      )
      .replace(
        '#include <aomap_fragment>',
        `{
          // A photo face carries its own occlusion; the baked value under it was measured on the unwarped head.
          float ao = mix( 1.0, clamp( vAO, 0.0, 1.0 ), uAOAmt * ( 1.0 - gCloth * 0.85 ) * gFaceAO * ( 1.0 - max( smoothstep( 0.55, 1.0, vPhoto.z * uPhotoReady ), vPhoto.w ) * 0.85 ) );
          float aoSoft = mix( 1.0, ao * ao, 0.9 );
          // Occlusion on skin keeps its red (light bleeds through the crease), so
          // creases read as warm form shadow rather than grey grime.
          vec3 aoTint = mix( vec3( aoSoft ), pow( vec3( aoSoft ), vec3( 0.86, 1.0, 1.08 ) ), gSSS );
          reflectedLight.indirectDiffuse *= aoTint;
          reflectedLight.directDiffuse *= mix( vec3( 1.0 ), mix( vec3( ao ), pow( vec3( ao ), vec3( 0.86, 1.0, 1.08 ) ), gSSS ), 0.6 );
          reflectedLight.indirectSpecular *= mix( 1.0, ao * ao, 0.8 );
          reflectedLight.directSpecular *= mix( 1.0, ao, 0.4 );
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'real-body-v1';
  return mat;
}
