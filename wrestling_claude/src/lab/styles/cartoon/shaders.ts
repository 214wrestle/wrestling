/**
 * GLSL for the toon athletes (see toon.ts for the materials that use it).
 *
 * Shading model, per the art direction:
 * - two hard tones (lit, one deep warm shadow at about 60% of the lit value),
 *   a thin saturated rim on the shadow-side silhouette, and painted highlights
 *   that only show in the light;
 * - the head is shaded from a designed proxy whose terminator runs in an S-curve
 *   (in at the temple and eye socket, out over the cheekbone, in under it), and
 *   the torso cloth from a smooth ellipsoid, so each reads as one clean shape;
 * - every face feature is painted in head space with a pixel-size level of detail,
 *   and every interior stroke is the same dark ink at no less than ~1.3 px.
 */

export const TOON_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
attribute float aPart;
attribute float aCurv;
attribute vec3 aTrueN;
uniform float uScale;
uniform float uHeadScale;
uniform float uChestW;
uniform vec3 uPivot;
uniform vec3 uHeadShift;
varying vec3 vBind;
varying vec3 vBindN;
varying vec3 vN;
varying vec3 vTN;
varying vec3 vWorld;
varying vec3 vFwd;
varying vec3 vRight;
varying float vCurv;
varying float vGeoNy;
flat varying float vPart;

void main() {
  #include <beginnormal_vertex>
  vGeoNy = objectNormal.y;
  vBindN = objectNormal;
  vec3 pc = position / uScale;
  vec3 q = uPivot + (pc - uPivot - uHeadShift) / uHeadScale;
  float part = floor(aPart + 0.5);
  if ((part > 0.5 && part < 1.5) || (part > 6.5 && part < 8.5)) {
    // Toon head: a proxy with a designed front, so the key light falls on the
    // face as one shape. The front is a height field in (x, y) only, so nose,
    // sockets and lips never wobble the terminator; its sideways slope varies
    // with height so the shadow edge runs in an S: in at the temple and eye
    // socket, out over the cheekbone, in again under it toward the jaw corner.
    vec2 f = vec2(q.x / 0.068, (q.y - 1.64) / 0.095);
    float k = 1.0
      + 0.75 * exp(-pow((q.y - 1.662) / 0.018, 2.0))
      - 0.35 * exp(-pow((q.y - 1.618) / 0.012, 2.0))
      + 0.55 * exp(-pow((q.y - 1.588) / 0.012, 2.0));
    float sx = (3.2 * f.x * f.x * f.x + 0.15 * f.x) * k;
    float sy = f.y > 0.0 ? 0.7 * f.y * f.y * f.y + 0.3 * f.y : 0.12 * f.y;
    vec3 nFront = normalize(vec3(sx, sy, 1.0));
    vec3 r = vec3(0.075, 0.105, 0.1);
    vec3 nEll = normalize((q - vec3(0.0, 1.645, -0.01)) / (r * r));
    vec3 g = normalize(mix(nEll, nFront, smoothstep(0.0, 0.07, q.z)));
    float w = smoothstep(1.535, 1.565, q.y);
    objectNormal = normalize(mix(objectNormal, g, 0.95 * w));
  } else if (part < 0.5) {
    // Torso cloth: shaded from a smooth ellipsoid, so the singlet shows one clean
    // terminator band down the far side instead of a blotch per muscle.
    vec3 r = vec3(0.19 * uChestW, 0.42, 0.13);
    vec3 nT = normalize((pc - vec3(0.0, 1.17, -0.012)) / (r * r));
    float w = smoothstep(0.86, 0.97, pc.y) * (1.0 - smoothstep(1.33, 1.43, pc.y));
    objectNormal = normalize(mix(objectNormal, nT, 0.82 * w));
  }
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  vec3 hF = vec3(0.0, 0.0, 1.0);
  vec3 hR = vec3(1.0, 0.0, 0.0);
  vec3 tn = aTrueN;
  #ifdef USE_SKINNING
    hF = (skinMatrix * vec4(hF, 0.0)).xyz;
    hR = (skinMatrix * vec4(hR, 0.0)).xyz;
    tn = (skinMatrix * vec4(tn, 0.0)).xyz;
  #endif
  vTN = normalize(mat3(modelMatrix) * tn);
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vWorld = world.xyz;
  vN = normalize(mat3(modelMatrix) * objectNormal);
  vFwd = mat3(modelMatrix) * hF;
  vRight = mat3(modelMatrix) * hR;
  vBind = position;
  vPart = aPart;
  vCurv = aCurv;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const TOON_FRAG = /* glsl */ `
varying vec3 vBind;
varying vec3 vBindN;
varying vec3 vN;
varying vec3 vTN;
varying vec3 vWorld;
varying vec3 vFwd;
varying vec3 vRight;
varying float vCurv;
varying float vGeoNy;
flat varying float vPart;

uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uBounce;
uniform float uDotPx;
uniform float uPx;

uniform float uScale;
uniform float uHeadScale;
uniform vec3 uPivot;
uniform vec3 uHeadShift;
uniform float uChestW;
uniform float uIsGear;
uniform vec3 uSkin;
uniform vec3 uHair;
uniform vec3 uBrow;
uniform vec3 uEye;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uTrim;
uniform vec3 uPiping;
uniform vec3 uBand;
uniform vec3 uShoe;
uniform vec3 uShoeAccent;
uniform vec3 uGearShell;
uniform vec3 uGearRim;
uniform vec3 uGearStrap;
uniform vec4 uEyeA;   // eyeX, eyeY, eyeW, eyeUp
uniform vec4 uEyeB;   // eyeLo, eyeTilt, iris, -
uniform vec4 uBrowA;  // browY, browRise, browArch, brow length
uniform vec3 uBrowB;  // thick inner, outer, knit crease
uniform vec4 uMouth;  // half width, curve, weight, height offset
uniform vec4 uGrin;   // grin depth, cheek hollow, chin cleft, hairline lift
uniform vec4 uHairM;  // hairline: peak, recession, jag amplitude, -
uniform vec3 uNose;   // tip drop, width, ear-cup x (canonical)
uniform vec4 uJaw;    // chin drop, jaw width, chin forward, -
uniform vec3 uHairFlow;
uniform vec3 uHairAcross;
uniform sampler2D uWordmark;

/* The key light as the face sees it (yaw clamped), set in main() before painting. */
vec3 gL = vec3(0.0, 1.0, 0.0);

const vec3 INK = vec3(0.0065, 0.0042, 0.0085);
/* Shadow multipliers (linear): deep, warm and a touch more saturated than the lit tone. */
const vec3 SKIN_SHADE = vec3(0.56, 0.33, 0.35);
const vec3 CLOTH_SHADE = vec3(0.34, 0.31, 0.52);

struct Toon {
  vec3 base;
  vec3 shade;   // shadow multiplier
  vec3 hi;      // painted highlight, added only where lit
  float spec;   // toon specular (plastic only)
  float rim;
  float ink;
  float glow;   // unshaded paint (eyes, teeth, brows)
  float dots;
};

Toon mk(vec3 base, vec3 shade) {
  return Toon(base, shade, vec3(0.0), 0.0, 1.0, 0.0, 0.0, 0.0);
}

float aa(float v) {
  float w = max(fwidth(v), 1e-6) * 0.75;
  return smoothstep(-w, w, v);
}

float aaw(float v, float k) {
  float w = max(fwidth(v), 1e-6) * k;
  return smoothstep(-w, w, v);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vn2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

/* Triangle wave in 0..1. */
float tri(float x) {
  return abs(fract(x) - 0.5) * 2.0;
}

/* Canonical head metres per pixel (set in paintFace), and an edge anti-aliased
   over about one pixel of it: crisp even where the surface turns obliquely. */
float gPx = 0.0005;
float aap(float v) {
  return smoothstep(-0.6 * gPx, 0.6 * gPx, v);
}

/* Painted shadow (same tone as a real shadow) and the jaw's cast shadow on the neck. */
float gPaint = 0.0;
float gCast = 0.0;

/* An ink stroke of half width w that never gets thinner than ~1.3 px across. */
float stroke(float d, float w, float px) {
  return aa(max(w, px * 0.65) - abs(d));
}

/* Paint the face in canonical head space q (pivot-relative, unscaled). */
void paintFace(inout Toon T, vec3 q, vec3 V, bool isEar) {
  float ax = abs(q.x);
  // Features paint only on the front of the head (never through to the back), with a hard edge.
  float front = aa(q.z - 0.035);
  // Canonical head metres per pixel, from the camera distance (not the surface
  // slope, so features near the cheek's turn do not drop detail): drives the
  // level of detail and the minimum width of every feature.
  float px = max(uPx * length(cameraPosition - vWorld) / (uScale * uHeadScale), 1e-5);
  gPx = px;
  vec3 hR = normalize(vRight);
  vec3 hF = normalize(vFwd);
  float lx = dot(gL, hR);
  float sSide = lx > 0.0 ? -1.0 : 1.0;     // head-space x sign of the shadow side
  float xs = q.x * sSide;                   // > 0 on the shadow side
  float sideK = smoothstep(0.06, 0.4, abs(lx));
  float facing = dot(hF, V);
  float mid = smoothstep(0.00045, 0.0011, px);
  float far = smoothstep(0.0011, 0.0019, px);
  float cd = uJaw.x;
  float cf = uJaw.z;

  // ---- hair: the clipped sides and the hairline are painted flat
  float hl = uGrin.w;
  // Hairline shape: a slight centre peak, receded corners (an M) and a broken, clumpy edge.
  float m = uHairM.x * (1.0 - smoothstep(0.0, 0.016, ax))
          - uHairM.y * exp(-pow((ax - 0.034) / 0.012, 2.0))
          + uHairM.z * (tri(ax / 0.0068 + 0.25 + 0.35 * sin(ax * 610.0)) - 0.5);
  float hairline = dot(q - vec3(0.0, 1.706 + hl - m, 0.06), vec3(0.0, -0.6, 0.8));
  float nape = q.y - 1.6;
  float temple = 0.072 - ax + max(0.0, q.y - 1.67) * 0.7;
  float scalp = aa(-hairline) * aa(nape) * (q.z < 0.0 ? 1.0 : aa(temple + 0.018)) * (isEar ? 0.0 : 1.0);
  float sbw = 0.011 * smoothstep(1.628, 1.668, q.y);
  float sideburn = aa(sbw - abs(q.z - 0.022)) * aa(q.y - 1.628) * aa(1.676 - q.y) * aa(ax - 0.05) * (isEar ? 0.0 : 1.0);
  // Clipped sides read a touch darker than the top, never lighter (no bald patches).
  vec3 sideHair = mix(uHair * 0.8, uHair, smoothstep(1.66, 1.7, q.y));
  float fade = mix(0.9, 1.0, smoothstep(1.62, 1.66, q.y));
  T.base = mix(T.base, sideHair, clamp(scalp * fade + sideburn * 0.85, 0.0, 1.0));
  T.rim *= 1.0 - scalp;

  // The underside of the jaw sits in its own shadow, continuous with the cast on the neck.
  float jawY = mix(1.578, 1.548 - cd, clamp((q.z + 0.01) / (0.08 + cf), 0.0, 1.0)) - 0.003;
  float underJaw = max(aa(-vGeoNy - 0.5) * aa(1.57 - q.y), aa(jawY - q.y) * aa(0.072 + cf - q.z));
  gPaint = max(gPaint, underJaw);

  // ---- eyes
  float ex = ax - uEyeA.x;
  float ey = q.y - uEyeA.y - ex * uEyeB.y;
  float u = ex / uEyeA.z;
  float uu = clamp(u, -1.0, 1.0);
  // A full almond with blunt corners: the whites never thin out into a sliver.
  float bulge = 1.0 - abs(uu * uu * uu);
  float grow = px * 0.75 * bulge;           // the opening never collapses under ~2 px
  float upper = uEyeA.w * bulge * (1.0 + 0.15 * uu) + grow;
  float lower = -uEyeB.x * bulge - grow * 0.6;
  float inEye = aap(upper - ey) * aap(ey - lower) * aa(0.96 - abs(u)) * front;
  vec2 ic = vec2(ex + 0.001, ey + 0.0006);
  float ir = length(ic);
  float irisR = max(uEyeB.z * mix(1.0, 1.25, mid), px * 1.2);
  float iris = aa(irisR - ir);
  float pupil = aa(irisR * 0.46 - ir);
  float glint = aa(irisR * 0.28 - length(ic - vec2(-0.0024, 0.0026) * irisR / 0.0068));
  vec3 irisCol = mix(uEye * 0.5, uEye * 1.15, smoothstep(irisR, 0.0, ir));
  irisCol = mix(irisCol, uEye * 0.3, aa(ir - irisR * 0.84));
  vec3 dark = mix(INK, uEye * 0.3, 0.3);
  vec3 sclera = vec3(0.95, 0.93, 0.9);
  sclera *= mix(1.0, 0.8, aap(ey - upper + 0.0018) * aa(0.85 - abs(u)));   // a hard lid shadow on the white
  sclera = mix(sclera, mix(sclera, dark, 0.55), mid);
  vec3 eye = mix(sclera, irisCol, iris);
  eye = mix(eye, vec3(0.03), pupil * (1.0 - mid * 0.5));
  eye = mix(eye, vec3(1.0), glint * iris * (1.0 - mid));
  // Far away: no whites at all, just a socket tone under the lash line and a solid iris dot.
  float farIris = aa(max(irisR * 0.9, px * 1.35) - length(vec2(ex + 0.0008, ey - (upper + lower) * 0.5 + 0.0004)));
  vec3 farEye = mix(uSkin * SKIN_SHADE, dark, farIris);
  eye = mix(eye, farEye, far);
  T.base = mix(T.base, eye, inEye);
  T.glow = max(T.glow, inEye);
  T.rim *= 1.0 - inEye;
  // Upper lid: one bold ink stroke, thickest over the outer half, no flick or wing.
  float lidW = max(mix(0.001, 0.0021, smoothstep(-0.8, 0.6, u)), px * 1.1);
  float lidY = upper;
  float lid = aap(lidW - abs(ey - lidY - lidW * 0.35)) * aa(1.0 - u) * aa(u + 1.0) * front;
  // The outer corner closes in solid ink, so the white ends on a clean edge.
  float corner = aa(u - 0.9) * aa(1.0 - u) * aap(upper + lidW * 0.6 - ey) * aap(ey - lower) * front;
  lid = max(lid, corner);
  T.base = mix(T.base, INK, lid);
  T.glow = max(T.glow, lid * 0.75);

  // ---- brows: bold tapered wedges, thick at the inner end
  float bl = uBrowA.w;
  float bu = (ax - 0.008) / bl;
  float bc = uEyeA.y + uBrowA.x + uBrowA.y * clamp(bu, 0.0, 1.0) + uBrowA.z * (1.0 - (2.0 * bu - 0.9) * (2.0 * bu - 0.9));
  float bt = mix(uBrowB.x, uBrowB.y, clamp(bu, 0.0, 1.0)) * (1.0 - smoothstep(0.7, 1.04, bu) * 0.75);
  bt = max(bt, px * 1.1);
  // A squared inner end (cut on a slant), tapering to a point at the tail.
  float browBody = aap(bt - abs(q.y - bc)) * aa(bu) * aa(1.04 - bu) * smoothstep(0.065, 0.08, q.z);
  T.base = mix(T.base, uBrow, browBody);
  T.glow = max(T.glow, browBody);
  T.rim *= 1.0 - browBody;
  // Knit: a short crease between the brows (a determined, focused look).
  float knitY0 = uEyeA.y + uBrowA.x - 0.008;
  float knit = stroke(ax - 0.0042 - (q.y - knitY0) * 0.28, 0.00045, px) * aa(q.y - knitY0) * aa(knitY0 + 0.0085 - q.y) * smoothstep(0.08, 0.09, q.z);
  T.base = mix(T.base, INK, knit * uBrowB.z * (1.0 - far));

  // ---- shadow-side eye socket: the brow shades the far eye, joining the nose wedge
  float browShadow = aa(xs - 0.005 - (q.y - uEyeA.y) * 0.45) * aa(0.052 - xs) * aa(q.y - (uEyeA.y + uEyeA.w * 0.6)) * aa(bc - q.y) * front;
  gPaint = max(gPaint, browShadow * sideK * smoothstep(0.25, 0.6, abs(lx)));

  // ---- nose: a painted wedge plane that tapers up into the brow
  float nl = uNose.x;
  float nw = uNose.y;
  float nzone = smoothstep(0.084, 0.094, q.z);
  float topY = uEyeA.y + 0.006;
  float tipY = 1.613 - nl;
  float tN = clamp((topY - q.y) / (topY - tipY), 0.0, 1.0);
  float wN = mix(0.002, 0.0148 * nw, tN) * sideK;
  float plane = aa(xs - 0.0015 + 0.002 * tN) * aa(wN - xs) * aa(topY - q.y) * aa(q.y - (tipY - 0.0045)) * smoothstep(0.075, 0.088, q.z);
  // Cast shadow under the nose onto the upper lip.
  float under = aa(1.0 - length(vec2((q.x - sSide * 0.003 * sideK) / (0.0125 * nw), (q.y - (1.6005 - nl)) / 0.004))) * smoothstep(0.08, 0.09, q.z);
  gPaint = max(gPaint, max(plane, under));
  // Nostrils: two short ink hooks.
  float nostril = stroke(q.y - (1.6022 - nl) - (ax - 0.007) * (ax - 0.007) * 60.0, 0.0005, px) * aa(0.0118 * nw - ax) * aa(ax - 0.0036) * nzone;
  T.base = mix(T.base, INK, nostril * (1.0 - far));
  // A small light on the tip.
  float tipHi = aa(1.0 - length(vec2((q.x + sSide * 0.003) / 0.0036, (q.y - tipY - 0.002) / 0.0028))) * nzone;
  T.hi += vec3(0.06, 0.05, 0.04) * tipHi * (1.0 - mid);

  // ---- mouth
  float mzone = smoothstep(0.083, 0.091, q.z);
  float my = 1.582 + uMouth.w + ax * ax * uMouth.y;
  float mw = max(uMouth.z * (1.0 - smoothstep(uMouth.x * 0.55, uMouth.x * 1.05, ax)), px * 0.6);
  float mouth = aap(mw - abs(q.y - my)) * aa(uMouth.x - ax) * mzone;
  // Firm corners: a short down-tick that keeps a level mouth from reading sad.
  float tick = stroke(length(vec2(ax - uMouth.x, (q.y - my) * 0.7)), 0.0006, px) * aa(uMouth.x + 0.0015 - ax) * mzone;
  // The grin closes to a smile when seen edge-on, so it never reads as a gasp.
  float grin = uGrin.x * smoothstep(0.45, 0.75, facing);
  if (grin > 0.0) {
    float k = clamp(ax / uMouth.x, 0.0, 1.0);
    float lowY = my - grin * (1.0 - k * k);
    float inside = aa(my - q.y) * aa(q.y - lowY) * aa(uMouth.x - ax) * mzone;
    vec3 teeth = vec3(0.97, 0.95, 0.9);
    teeth = mix(teeth, teeth * 0.8, smoothstep(my - 0.0016, my - 0.0004, q.y));
    // Upper and lower teeth meet on a line: a closed, toothy smile, not an open mouth.
    float bite = stroke(q.y - (my - grin * 0.55 * (1.0 - k * k)), 0.00035, px) * inside;
    T.base = mix(T.base, teeth, inside);
    T.base = mix(T.base, teeth * 0.62, bite * (1.0 - mid));
    T.glow = max(T.glow, inside * 0.7);
    mouth = max(mouth, stroke(q.y - lowY, 0.0007, px) * aa(uMouth.x - ax) * mzone);
    // Smile lines bracketing the grin.
    float br = stroke(length(vec2(ax - uMouth.x + 0.002, (q.y - my) * 0.8)) - 0.0065, 0.0005, px) * aa(ax - uMouth.x - 0.0005) * aa(my + 0.002 - q.y) * aa(q.y - my + 0.009) * mzone;
    mouth = max(mouth, br * (1.0 - mid));
  }
  T.base = mix(T.base, INK, clamp(mouth + tick * (1.0 - far), 0.0, 1.0));
  // Lower lip: a firm crescent shadow under it and a crescent light on it.
  float lipY = my - 0.0088 - grin * 0.6;
  float lipShadow = aa(1.0 - length(vec2(ax / (uMouth.x * 0.62), (q.y - lipY + 0.0004) / 0.0026))) * aa(lipY + 0.0004 - q.y + ax * ax * 3.0) * mzone;
  gPaint = max(gPaint, lipShadow * (1.0 - far));
  float lipA = length(vec2(ax / (uMouth.x * 0.42), (q.y - lipY - 0.0034) / 0.0021));
  float lipB = length(vec2(ax / (uMouth.x * 0.52), (q.y - lipY - 0.0048) / 0.0024));
  float lipHi = aa(1.0 - lipA) * aa(lipB - 1.0) * mzone;
  T.hi += vec3(0.09, 0.06, 0.055) * lipHi * (1.0 - mid);
  // Chin cleft.
  float cleft = stroke(q.x, 0.0005, px) * aa(q.y - 1.545 + cd) * aa(1.554 - cd - q.y) * smoothstep(0.08 + cf, 0.09 + cf, q.z);
  T.base = mix(T.base, INK, cleft * uGrin.z * (1.0 - mid));

  // ---- cheek hollow: a painted shadow plane under the cheekbone, shadow side only
  // A clean triangle: from under the cheekbone, tapering toward the mouth corner.
  float hy = 1.614 + (ax - 0.05) * 0.25;
  float ht = clamp((0.068 - ax) / 0.03, 0.0, 1.0);
  float hollow = aa(hy - q.y) * aa(q.y - (hy - 0.018 * (1.0 - ht) - 0.002)) * aa(ax - 0.038) * aa(0.068 - ax) * aa(xs);
  gPaint = max(gPaint, hollow * step(0.5, uGrin.y * sideK));
}

Toon look(vec3 V) {
  vec3 p = vBind / uScale;
  float part = floor(vPart + 0.5);
  float ax = abs(p.x);
  float side = p.x >= 0.0 ? 1.0 : -1.0;

  if (uIsGear > 0.5) {
    // Headgear: matte flat shells with a vent pattern and one painted highlight.
    vec3 q = uPivot + (p + vec3(0.0, 1.575, -0.005) - uPivot - uHeadShift) / uHeadScale;
    float gx = abs(q.x);
    Toon G = mk(uGearShell, vec3(0.4, 0.4, 0.62));
    G.rim = 0.5;
    if (part > 9.5 && part < 10.5) {
      vec2 cu = vec2(q.y - 1.641, q.z + 0.008);
      float outer = smoothstep(uNose.z + 0.004, uNose.z + 0.01, gx);
      float rr = length(cu / vec2(0.05, 0.042));
      // The rim against the head, and an inset ring on the shell face.
      G.base = mix(G.base, uGearRim, aa(gx - (uNose.z - 0.0045)) * (1.0 - outer));
      G.base = mix(G.base, uGearRim, aa(0.04 - abs(rr - 0.78)) * outer);
      // Vent holes: a hex grid of dark slots inside the ring.
      vec2 g = cu / 0.0085;
      g.x += mod(floor(g.y + 0.5), 2.0) * 0.5;
      float hole = aa(0.24 - length(fract(g) - 0.5)) * aa(0.62 - rr) * aa(rr - 0.12) * outer;
      G.base = mix(G.base, uGearShell * 0.18, hole);
      // One cel highlight: a curved crescent across the upper front of the shell.
      float hiA = length((cu - vec2(0.012, 0.012)) / vec2(0.032, 0.026));
      float hiB = length((cu - vec2(0.006, 0.006)) / vec2(0.032, 0.026));
      G.hi += vec3(0.22) * aa(1.0 - hiA) * aa(hiB - 1.0) * outer;
    } else if (part > 11.5 && part < 12.5) {
      G.base = uGearStrap;
    } else if (part > 12.5) {
      // Chin cup and its straps: the strap colour, so the cup never reads as a mouth or a beard.
      G.base = uGearStrap;
      G.rim = 0.4;
    }
    return G;
  }

  Toon T = mk(uSkin, SKIN_SHADE);
  T.rim = 1.0;
  vec3 q = uPivot + (p - uPivot - uHeadShift) / uHeadScale;

  if (part > 5.5 && part < 6.5) {
    // Hair: two flat tones, a few inked clump strokes along the cut's flow and a shine band.
    T.base = uHair;
    T.shade = vec3(0.45, 0.4, 0.58);
    T.rim = 0.0;
    float a1 = dot(q, uHairAcross) * 80.0;
    float f1 = dot(q, uHairFlow);
    float cell = floor(a1);
    float h1 = hash12(vec2(cell, 3.1));
    float keep = 1.0 - smoothstep(0.12, 0.3, fwidth(a1));
    float dash = smoothstep(0.42, 0.5, vn2(vec2(cell * 3.7, f1 * 38.0)));
    float clump = aa(0.06 - abs(fract(a1) - 0.5 - (h1 - 0.5) * 0.4)) * dash * keep;
    T.base = mix(T.base, uHair * 0.42, clump * 0.9);
    // Shine: one curved band that follows the skull, tapered with zig-zag ends.
    vec3 hc = q - vec3(0.0, 1.66, -0.012);
    float elev = atan(hc.y, length(hc.xz));
    float azi = atan(hc.x, hc.z);
    float span = 1.0 - smoothstep(0.35, 1.05, abs(azi + 0.12));
    float zig = (tri(azi * 9.0) - 0.5) * 0.06 * (1.0 - span * 0.6);
    float shine = aa(0.05 * span - abs(elev - 0.8 - zig)) * aa(span - 0.05);
    T.hi += (uHair * 1.4 + vec3(0.035, 0.022, 0.012)) * shine * (1.0 - clump * 0.7);
    return T;
  }
  if ((part > 0.5 && part < 1.5) || (part > 6.5 && part < 9.5)) {
    paintFace(T, q, V, part > 7.5 && part < 8.5);
    if (part > 7.5 && part < 8.5) {
      // Ear: a C-shaped ink stroke for the rim fold, and its hollow in shadow.
      vec2 e = vec2(q.y - 1.638, q.z + 0.008);
      float er = length(e / vec2(0.027, 0.015));
      float px = max(length(fwidth(q)) * 0.62, 1e-5);
      float fold = stroke(er - 0.66, 0.0006, px) * aa(e.y + 0.003) * aa(ax - 0.078);
      gPaint = max(gPaint, aa(0.52 - er) * aa(ax - 0.08) * aa(0.004 - e.y));
      T.base = mix(T.base, INK, fold);
    }
    return T;
  }

  // Comic cast shadow from the jaw onto the neck.
  if (part < 0.5 && p.y > 1.44) {
    float jawLine = 1.475 + ax * ax * 12.0 + max(0.0, -p.z - 0.01) * 0.9;
    gCast = aa(p.y - jawLine) * aa(p.z + 0.035) * aa(1.62 - p.y);
  }

  // ------------------------------------------------------------ singlet ---
  bool isTorso = part < 0.5;
  bool isLeg = part > 3.5 && part < 4.5;
  bool isHand = part > 2.5 && part < 3.5;
  bool isArm = part > 1.5 && part < 2.5;
  // The top of the delt is cut by the same strap and armhole as the torso.
  bool torsoKit = isTorso || (isArm && p.y > 1.3);
  float wx = ax / uChestW;
  float front = smoothstep(-0.05, 0.03, p.z);
  float scoopF = mix(1.47, 1.35, smoothstep(0.078, 0.03, wx));
  float scoopB = mix(1.47, 1.3, smoothstep(0.078, 0.022, wx));
  float scoop = mix(scoopB, scoopF, front);
  float strapOuter = 0.134;
  // The armhole sits high on the side, so the singlet (and its side panel) follows the lat flare.
  float armhole = 1.3 - max(0.0, wx - strapOuter) * 0.55;
  float inStrap = aa(wx - 0.074) * aa(strapOuter - wx);
  float topY = mix(wx < strapOuter ? scoop : armhole, 1.62, inStrap);
  float topDist = topY - p.y;
  vec3 hip = vec3(side * 0.09, 0.925, 0.0);
  vec3 thighDir = vec3(side * 0.0698, -0.9976, 0.0);
  float along = dot(p - hip, thighDir);
  float legDist = 0.2 - along;

  if (isHand) T.ink = 0.85;

  float singlet = 0.0;
  float edge = 1.0;
  if (torsoKit) {
    singlet = aa(topDist);
    edge = topDist;
  } else if (isLeg) {
    singlet = aa(legDist);
    edge = legDist;
    // The leg opening casts a hard little shadow on the thigh.
    gPaint = max(gPaint, aa(legDist + 0.011) * (1.0 - singlet));
  }
  vec3 kit = uPrimary;
  // White side panel from armpit to hip and down the outside of the leg, with piping.
  float panelHalf = torsoKit ? 0.034 : 0.026;
  float pz = torsoKit ? p.z + 0.016 : p.z - 0.004;
  float sideZone = torsoKit ? aa(wx - 0.07) : aa(p.x * side - 0.06);
  float panel = aa(panelHalf - abs(pz)) * sideZone;
  float pipe = aa(0.0032 - abs(abs(pz) - panelHalf - 0.0055)) * sideZone;
  kit = mix(kit, uSecondary, panel);
  kit = mix(kit, uPiping, pipe);
  // Wordmark across the chest.
  vec2 uv = vec2(0.5 + p.x / (0.3 * uChestW), (p.y - 1.2) / 0.075);
  float inMark = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * smoothstep(0.02, 0.05, p.z) * (isTorso ? 1.0 : 0.0);
  vec4 mark = texture2D(uWordmark, uv);
  kit = mix(kit, mark.rgb, mark.a * inMark);
  // Edge trim at the neck, armholes and leg openings.
  float trim = aa(0.0085 - abs(edge - 0.0085)) * singlet;
  kit = mix(kit, uTrim, trim);
  // Designed folds: a curved line under each pec and one fold at the waist.
  if (isTorso) {
    float fpx = max(length(fwidth(p)) * 0.62, 1e-5);
    float pecY = 1.29 + (wx - 0.06) * (wx - 0.06) * 6.0;
    float pec = stroke(p.y - pecY, 0.0011, fpx) * aa(wx - 0.022) * aa(0.105 - wx) * smoothstep(0.05, 0.08, p.z) * (1.0 - panel);
    float waist = stroke(p.y - 1.075 - (wx - 0.1) * 0.25, 0.001, fpx) * aa(wx - 0.085) * aa(0.12 - wx) * aa(p.z + 0.01) * (1.0 - panel);
    kit = mix(kit, kit * CLOTH_SHADE * 0.75, (pec + waist * 0.8) * singlet * (1.0 - inMark * mark.a));
  }
  T.base = mix(T.base, kit, singlet);
  T.shade = mix(T.shade, CLOTH_SHADE, singlet);
  T.rim = mix(T.rim, 0.8, singlet);
  T.dots = singlet;

  // Shoes and ankle bands: painted purely by height, so part seams never show.
  if (p.y < 0.215) {
    float shoe = aa(0.142 - p.y);
    float bandMask = aa(0.0155 - abs(p.y - 0.16)) * (1.0 - shoe);
    T.base = mix(T.base, uBand, bandMask);
    T.shade = mix(T.shade, vec3(0.42, 0.4, 0.62), bandMask);
    vec3 sh = uShoe;
    float fx = (p.x - side * 0.09) * side;   // + toward the outside of the foot
    // Curved sole with toe spring.
    float soleTop = 0.014 + 0.012 * smoothstep(0.12, 0.2, p.z) + 0.006 * smoothstep(-0.03, -0.07, p.z);
    float sole = aa(soleTop - p.y);
    // School-colour side panel sweeping from the heel up toward the laces.
    float sweep = p.y - (0.05 + (0.08 - p.z) * 0.32);
    float accent = aa(0.012 - abs(sweep)) * aa(abs(fx) - 0.026) * aa(p.z + 0.07) * aa(0.13 - p.z);
    // Lace cover: a lighter panel down the instep with a stitched edge.
    float lace = aa(0.013 - abs(fx)) * aa(p.z - 0.02) * aa(0.125 - p.z) * aa(p.y - 0.05);
    float laceEdge = aa(0.0012 - abs(abs(fx) - 0.013)) * aa(p.z - 0.02) * aa(0.125 - p.z) * aa(p.y - 0.05);
    float collar = aa(0.008 - abs(p.y - 0.132));
    sh = mix(sh, uShoeAccent, accent);
    sh = mix(sh, sh * 1.8 + vec3(0.04), lace);
    sh = mix(sh, INK, laceEdge * 0.8);
    sh = mix(sh, uShoeAccent, collar);
    sh = mix(sh, vec3(0.93, 0.92, 0.9), sole);
    T.base = mix(T.base, sh, shoe);
    T.shade = mix(T.shade, vec3(0.4, 0.42, 0.62), shoe);
    T.rim = mix(T.rim, 0.5, shoe);
    T.dots *= 1.0 - shoe;
    // One clean toon gloss on the toe box.
    float gloss = aa(1.0 - length(vec2((fx + 0.004) / 0.012, (p.z - 0.165) / 0.03))) * aa(p.y - 0.03) * shoe;
    T.hi += vec3(0.22) * gloss;
  }
  return T;
}

float creaseAmount() {
  return smoothstep(-25.0, -60.0, vCurv);
}

vec3 faceLight(vec3 L) {
  vec3 hR = normalize(vRight);
  vec3 hF = normalize(vFwd);
  vec3 hU = normalize(cross(hF, hR));
  float lr = dot(L, hR);
  float lf = dot(L, hF);
  float lu = dot(L, hU);
  float h = length(vec2(lr, lf));
  float yaw = clamp(atan(lr, lf), -0.85, 0.85);
  return normalize(hR * sin(yaw) * h + hF * cos(yaw) * h + hU * lu);
}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float part = floor(vPart + 0.5);
  bool isFace = uIsGear < 0.5 && ((part > 0.5 && part < 1.5) || (part > 6.5 && part < 9.5));
  gL = isFace ? faceLight(uKeyDir) : uKeyDir;
  Toon T = look(V);
  vec3 N = normalize(vN);
  float ndl = dot(N, gL);
  // Two hard tones: lit and shadow. Painted shadows use the same shadow tone.
  float lit = aaw(ndl - 0.08, 1.3) * (1.0 - gCast) * (1.0 - gPaint);
  vec3 shadowC = T.base * T.shade;
  vec3 c = mix(shadowC, T.base, lit);
  // Painted highlights only show in the light.
  c += T.hi * lit;
  // (The rim light is drawn by a second, narrower hull inside the ink line; see OUTLINE_VERT.)
  // Print halftone in cloth shadow only.
  vec2 fc = gl_FragCoord.xy / uDotPx;
  vec2 r = vec2(fc.x + fc.y, fc.x - fc.y) * 0.70710678;
  float dist = length(fract(r) - 0.5);
  float dark = (1.0 - lit) * (0.35 + 0.65 * smoothstep(0.0, -0.6, ndl));
  float rad = 0.38 * sqrt(dark);
  float dotM = 1.0 - smoothstep(rad - 0.08, rad + 0.08, dist);
  c *= 1.0 - dotM * T.dots * 0.16;
  // Crease ink between the fingers.
  c = mix(c, INK * 1.3 + T.base * 0.2, creaseAmount() * T.ink);
  c = mix(c, T.base, T.glow);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

export const OUTLINE_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
attribute float aPart;
uniform float uPx;
uniform float uLinePx;
uniform float uWidthMul;
uniform float uScaleRef;
uniform vec3 uKeyDir;
uniform vec3 uRimDir;
/* 0: the ink hull. 1: the rim hull, a narrower band drawn inside the ink line on the shadow side. */
uniform float uRim;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(normalMatrix * objectNormal);
  vec3 nw = normalize(mat3(modelMatrix) * objectNormal);
  float part = floor(aPart + 0.5);
  bool face = part == 1.0 || part == 7.0;
  bool head = face || part == 8.0 || part == 6.0;
  // Comic line weight: thin on the lit side, heavy on the shadow side and undersides.
  float kd = dot(nw, uKeyDir);
  float weight = mix(0.7, 1.4, smoothstep(0.45, -0.35, kd)) + 0.3 * smoothstep(-0.1, -0.8, nw.y);
  // Heads keep most of the body's line weight so they never look pasted on.
  float pw = head ? 0.9 : (part == 3.0 ? 0.8 : 1.0);
  // Rim band: shadow side only, about one line width, a little thinner far away.
  float rimW = uLinePx * 0.9 * smoothstep(0.05, -0.35, kd) * smoothstep(-0.05, 0.35, dot(nw, uRimDir)) * mix(1.0, 0.6, smoothstep(3.5, 7.0, -mv.z));
  float px = uPx * max(0.3, -mv.z) * uWidthMul;
  float w = uRim > 0.5 ? rimW * px : (uLinePx * pw * weight + rimW) * px;
  mv.xyz += normalize(vec3(n.xy, n.z * 0.25)) * w;
  // Sink the hull so only real silhouettes ink: the front of the face sinks
  // deepest, so no stray contour lines run down the cheeks.
  mv.z -= (face ? 0.02 : head ? 0.01 : 0.008) * uScaleRef;
  gl_Position = projectionMatrix * mv;
}
`;

export const OUTLINE_FRAG = /* glsl */ `
uniform vec3 uInk;
void main() {
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
}
`;
