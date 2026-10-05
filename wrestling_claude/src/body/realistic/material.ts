import { CanvasTexture, Color, LinearFilter, MeshPhysicalMaterial, ShaderChunk, SRGBColorSpace } from 'three';
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

export interface RealLook {
  skin: string;
  hair: string;
  primary: string;
  secondary: string;
  /** Piping/trim colour between body and panel. */
  piping: string;
  wordmark: string;
  wordmarkColor?: string;
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
  /** Eyebrow lift, slope (outer end up), arch, thickness. */
  brow: [number, number, number, number];
  hairFront: number;
  /** Mouth-corner lift (paint curvature): 0 = flat and serious, 4 = a smile. */
  smile: number;
  /** Head size multiplier about the head pivot (paint works in the unscaled frame). */
  headScale: number;
  /** Eye aperture height multiplier, as the anatomy. */
  eyeOpen: number;
  /** Nose length offset, as the anatomy (to place the nostril paint). */
  nose: number;
}

function wordmarkTexture(text: string): CanvasTexture {
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
  g.fillText(text, c.width / 2, c.height / 2 + 8);
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
varying vec3 vSmoothN;
varying vec3 vBind;
varying vec3 vBindN;
varying float vAO;
flat varying float vPart;
`;

const FRAGMENT_HEAD = /* glsl */ `
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
uniform sampler2D uWordmark;
uniform float uBumpAmt;
uniform float uAOAmt;
uniform float uBrowLift;
uniform float uClay;
uniform float uHairFront;
uniform float uSmile;
uniform float uSSSAmt;
uniform float uBrowSlope;
uniform float uBrowArch;
uniform float uBrowThick;
uniform float uHeadScale;
uniform float uEyeOpen;
uniform float uNose;

// Set by the look, read by the lighting functions below.
float gSSS = 0.0;
float gH = 0.0;
float gCloth = 0.0;
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
    float mouthY = 1.5813 - lenOff * 0.35;
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
    float nos = 1.0 - smoothstep(0.55, 1.0, length(nq));
    skin = mix(skin, skin * vec3(0.45, 0.3, 0.28), nos * 0.6);
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
      float u = dq.x * 0.99619 + dq.y * 0.08716;
      float v = -dq.x * 0.08716 + dq.y * 0.99619;
      float hApt = 0.0049 * uEyeOpen * sqrt(max(0.0, 1.0 - (u / 0.0152) * (u / 0.0152)));
      float isUp = step(0.0, v);
      float dM = abs(v) - hApt;
      // Upper lash line: dense, thicker toward the outer corner; lower: a hint.
      float wLash = isUp > 0.5 ? mix(0.0007, 0.0014, smoothstep(-0.012, 0.012, u)) : 0.0005;
      float lash = 1.0 - smoothstep(wLash * 0.4, wLash, dM);
      lash *= isUp > 0.5 ? 0.9 : 0.3;
      lash *= smoothstep(-0.0152, -0.011, u) * (1.0 - smoothstep(0.0135, 0.0158, u));
      // The margin's inner wall: a slightly darker, wet skin, never a pink rim.
      float wall = (1.0 - smoothstep(-0.0002, 0.0005, dM)) * (1.0 - smoothstep(0.013, 0.0152, abs(u)));
      skin = mix(skin, skin * vec3(0.86, 0.8, 0.78), wall * 0.6);
      rough = mix(0.5, 0.25, wall);
      skin = mix(skin, uHair * 0.18, lash);
      // Upper-lid crease: a soft shadow line following the margin, 7 mm up.
      float crease = (1.0 - smoothstep(0.0, 0.0022, abs(dM - 0.0068))) * isUp * smoothstep(-0.014, -0.006, u);
      skin *= 1.0 - crease * 0.14;
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

    // Hair: mirrors hairAt() in anatomy.ts, with the same soft falloff.
    float hf = uHairFront + 0.007 * smoothstep(0.016, 0.044, ax);
    float front = -0.5 * (p.y - hf) + 0.866 * (p.z - 0.07) + hairlineNoise(p.x, p.y, p.z);
    float frontHair = smoothstep(0.006, -0.009, front);
    float y1 = mix(1.635, 1.69, smoothstep(0.016, 0.03, p.z));
    y1 = mix(y1, 1.672, smoothstep(0.006, -0.002, p.z));
    y1 = mix(y1, 1.594, smoothstep(-0.021, -0.065, p.z));
    float hw = 0.006 + 0.008 * smoothstep(-0.03, -0.07, p.z);
    float sideHair = smoothstep(-hw * 0.5, hw, p.y - y1 + hairlineNoise(p.z, p.y, p.x) * 0.8);
    float sideGate = smoothstep(0.044, 0.064, ax);
    hairMask = min(frontHair, sideHair) * step(1.575, p.y);
    // Fine irregularity at the edge only.
    hairMask = clamp(hairMask + (vnoise(p * 300.0) - 0.5) * 0.35 * hairMask * (1.0 - hairMask) * 4.0, 0.0, 1.0);
    float top = smoothstep(1.7, 1.73, p.y) * (1.0 - sideGate * 0.5);
    float density = mix(uSides, 1.0, max(top, isHairVol ? 1.0 : 0.0));
    if (isHairVol) hairMask = max(hairMask, 0.98);
    // Strands flow front to back on top, down on the sides.
    vec3 flow = p * vec3(1500.0, 1500.0, 220.0);
    flow = mix(flow, p * vec3(1500.0, 260.0, 1500.0), sideGate * (1.0 - top));
    float strands = vnoise(flow);
    float clump = vnoise(p * 140.0);
    vec3 hairCol = uHair * (0.7 + strands * 0.45 + clump * 0.2);
    vec3 scalp = skin * 0.86;
    vec3 hairArea = mix(scalp, hairCol, density * (0.75 + 0.25 * strands));
    skin = mix(skin, hairArea, hairMask);
    rough = mix(rough, 0.52, hairMask);
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
  float scoopF = mix(1.462, 1.36, smoothstep(0.082, 0.03, ax));
  float scoopB = mix(1.462, 1.31, smoothstep(0.08, 0.024, ax));
  float scoop = mix(scoopB, scoopF, frontF);
  float strapOuter = 0.13;
  float armhole = 1.24 - max(0.0, ax - strapOuter) * 1.6;
  float inStrap = aa(ax - 0.078) * aa(strapOuter - ax);
  float topY = mix(ax < strapOuter ? scoop : armhole, 1.62, inStrap);
  float topDist = topY - p.y;

  vec3 hip = vec3(side * 0.09, 0.925, 0.0);
  vec3 thighDir = vec3(side * 0.0698, -0.9976, 0.0);
  float alongT = dot(p - hip, thighDir);
  float legDist = 0.2 - alongT;

  float singlet = 0.0;
  float edge = 1.0;
  if (isTorso) {
    singlet = aa(topDist);
    edge = topDist;
  } else if (isLeg) {
    singlet = aa(legDist);
    edge = legDist;
  }

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
    float panel = aa(halfW - dz) * lateralOk;
    kit = mix(kit, uSecondary, panel);
    // Piping along both panel edges.
    float pipe = (1.0 - smoothstep(0.0016, 0.003, abs(dz - halfW))) * lateralOk;
    kit = mix(kit, uPiping, pipe);
    float lateral = dz - halfW;
    float panelEdge = 0.0;
    // Binding at the openings.
    float bind = (1.0 - smoothstep(0.004, 0.0065, edge)) * singlet;
    kit = mix(kit, uPiping, bind);

    // Wordmark across the chest.
    vec2 uv = vec2(0.5 + p.x / 0.2, (p.y - 1.236) / 0.05);
    float inMark = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * smoothstep(0.02, 0.05, p.z) * (isTorso ? 1.0 : 0.0);
    float ink = texture2D(uWordmark, uv).a * inMark;
    kit = mix(kit, uWordmarkColor, ink * 0.95);

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

  const uniforms: Record<string, IUniform> = share ? share.userData.uniforms : {
    uSkin: { value: new Color(look.skin) },
    uHair: { value: new Color(look.hair) },
    uPrimary: { value: new Color(look.primary) },
    uSecondary: { value: new Color(look.secondary) },
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
    uWordmark: { value: wordmarkTexture(look.wordmark.toUpperCase()) },
    uBumpAmt: { value: dbgParam('bump', 1) },
    uBrowLift: { value: look.brow[0] },
    uClay: { value: dbgParam('clay', 0) },
    uHairFront: { value: look.hairFront },
    uSmile: { value: look.smile },
    uSSSAmt: { value: dbgParam('sss', 1) },
    uBrowSlope: { value: look.brow[1] },
    uBrowArch: { value: look.brow[2] },
    uBrowThick: { value: look.brow[3] },
    uAOAmt: { value: dbgParam('ao', 1) },
    uHeadScale: { value: look.headScale },
    uEyeOpen: { value: look.eyeOpen },
    uNose: { value: look.nose },
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
        '#include <begin_vertex>\nvBind = position;\nvBindN = normal;\nvPart = aPart;\nvAO = aAO;',
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
          normal = normalize( mix( normal, normalize( vSmoothN ) * faceDirection, gCloth * 0.85 ) );
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
          float ao = mix( 1.0, clamp( vAO, 0.0, 1.0 ), uAOAmt * ( 1.0 - gCloth * 0.85 ) * gFaceAO );
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
