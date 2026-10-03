import { BackSide, CanvasTexture, Color, LinearMipmapLinearFilter, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { Vector3 } from 'three';
import type { Athlete } from './athletes';

/** World direction toward the key light (index.ts places the key along this). */
export const KEY_DIR = new Vector3(3.5, 8, 5).normalize();

/**
 * One material per athlete. Light is computed from the smooth (region) normal and
 * snapped to a few soft value steps, so the bands are clean poster shapes that run
 * across many facets; the true facet normal then nudges each plane by a few percent
 * (fully on hard parts: nose, brows, hair), so the cut planes still read. Skin
 * shadows go warm red-brown, cloth and gear cool mauve. Colour comes from the part
 * id plus the canonical rest position (aCanon), so the singlet panels, trim, wordmark,
 * shoe, ankle band, mouth and the stylised eyes are crisp painted shapes.
 */

const VERT_HEAD = /* glsl */ `
attribute float aPart;
attribute vec3 aCanon;
varying float vPart;
varying vec3 vRest;
`;

const FRAG_HEAD = /* glsl */ `
varying float vPart;
varying vec3 vRest;
uniform vec3 uSkin, uHair, uEye, uPrimary, uSecondary, uTrim, uPiping, uGear, uGearTrim, uStrap, uShoe, uShoeAccent, uBand, uRim;
uniform vec3 uShadeTint, uLightTint;
uniform float uSmile, uGrin, uPoster, uSteps, uRimK, uShoulderW, uFacet;
uniform vec3 uKeyDir;
uniform sampler2D uMark;
float lpRough = 0.6;
// 1 on bare skin, 0 on cloth, hair and gear: picks the shadow ramp.
float lpSkinK = 1.0;
// Lowest light step allowed here (the crotch gusset never drops to the darkest step).
float lpFloor = 0.0;
// 0 = light from the smooth region normal, 1 = from the true facet (hard planes).
float lpHard = 0.0;

vec3 singlet(float sideK) {
  vec3 c = uPrimary;
  // White side panel with a thin piping line on its edge.
  if (sideK > 0.0) c = uSecondary;
  if (sideK < 0.0 && sideK > -0.02) c = uPiping;
  return c;
}

vec3 skinTone() {
  float l = dot(uSkin, vec3(0.299, 0.587, 0.114));
  // A touch warmer and more saturated than the swatch, so skin pops off the mat.
  return mix(vec3(l), uSkin, 1.18) * vec3(1.03, 0.985, 0.95);
}

vec3 lpColor(vec3 fn, out float rough) {
  vec3 r = vRest;
  int part = int(vPart + 0.5);
  float ax = abs(r.x);
  rough = 0.62;
  vec3 skin = skinTone();
  vec3 col = skin;
  if (part == 0) {
    // Torso: the singlet with a scoop neck, straps and deep arm holes.
    float back = step(r.z, -0.015);
    // Strap and arm-hole cuts in the athlete's own shoulder width.
    float sx = ax / uShoulderW;
    float neck = mix(1.392, 1.37, back) + 7.5 * sx * sx;
    float strap = (sx > 0.078 && sx <= 0.12) ? 2.0 : 0.0;
    // A round, low arm hole from the strap's outer edge down to the armpit.
    float hq = (sx - 0.12) / 0.048;
    float hole = sx > 0.12 ? 1.265 + 0.2 * sqrt(max(0.0, 1.0 - hq * hq)) : 0.0;
    float top = max(max(neck, strap), hole);
    // The crotch gusset and pelvis underside stay at the singlet's mid value.
    if (r.y < 0.94) lpFloor = mix(0.5, 0.0, smoothstep(0.02, 0.06, ax));
    if (r.y < top) {
      float s = ax / max(length(vec2(r.x, (r.z + 0.006) * 1.25)), 1e-4);
      float panel = r.y < 1.255 ? (s - 0.955) : -1.0;
      col = singlet(panel);
      // Plain-text school wordmark across the front, only on front-facing facets.
      vec2 muv = vec2((r.x + 0.11) / 0.22, (r.y - 1.14) / 0.076);
      if (fn.z > 0.55 && muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {
        col = mix(col, uSecondary, texture2D(uMark, muv).a);
      }
      // Edge trim along the neck and arm holes and the strap sides.
      float edge = top - r.y;
      if (strap > 0.0 && r.y > max(neck, 1.465)) edge = min(sx - 0.078, 0.12 - sx) * uShoulderW;
      if (edge < 0.0075) col = uTrim;
    }
  } else if (part == 4) {
    // Thigh: singlet down to mid-thigh with the side panel, then skin.
    float lx = ax - 0.09;
    // The crotch never drops into the darkest step.
    if (r.y < 0.92) lpFloor = mix(0.5, 0.0, smoothstep(0.02, 0.06, ax));
    float legEnd = 0.725 + 0.01 * smoothstep(-0.03, 0.04, -lx);
    if (r.y > legEnd) {
      float s = lx / max(length(vec2(lx, r.z * 1.05)), 1e-4);
      col = singlet(s - 0.84);
      if (r.y - legEnd < 0.0075) col = uTrim;
    }
  } else if (part == 5) {
    rough = 0.5;
    col = uShoe;
    float lx = ax - 0.09;
    // A swept accent stripe on the outside of the shoe.
    float stripe = (r.y - 0.034) - r.z * 0.55;
    if (lx > 0.02 && abs(stripe) < 0.012 && r.z > -0.05 && r.z < 0.12) col = uShoeAccent;
    if (r.y < 0.016) col = vec3(0.82, 0.8, 0.78);
    if (r.y > 0.172) col = uBand;
  } else if (part == 1 || part == 17) {
    // Head skin, painted in the canonical head frame.
    float front = step(0.07, r.z);
    lpHard = part == 17 ? 1.0 : 0.15;
    if (uGrin > 0.5) {
      // A wide, toothy grin: a crescent of teeth under a lifted upper lip.
      float yTop = 1.5858 + 7.0 * ax * ax;
      float yBot = 1.5778 + 15.0 * ax * ax;
      float inMouth = step(ax, 0.0255) * step(yBot, r.y) * step(r.y, yTop);
      if (front > 0.5 && r.y > yTop && r.y < yTop + 0.0036 && ax < 0.026) col = skin * vec3(0.93, 0.83, 0.8);
      if (front > 0.5 && r.y < yBot && r.y > yBot - 0.0055 && ax < 0.022) col = skin * vec3(1.02, 0.93, 0.9);
      if (front > 0.5 && inMouth > 0.5) {
        col = vec3(0.92, 0.89, 0.83);
        if (r.y < yBot + 0.0015) col = vec3(0.42, 0.2, 0.19);
        if (r.y > yTop - 0.0007 || ax > 0.0235) col = vec3(0.42, 0.2, 0.19);
      }
      // Nasolabial folds: a soft plane from the nose wing to past the mouth corner.
      float t = clamp((1.606 - r.y) / 0.03, 0.0, 1.0);
      float nlx = mix(0.019, 0.031, t);
      float nl = smoothstep(0.0032, 0.0008, abs(ax - nlx)) * step(r.y, 1.607) * step(1.578, r.y);
      col = mix(col, col * vec3(0.9, 0.8, 0.78), nl * 0.75 * front);
    } else {
      // A closed, pressed mouth: soft upper-lip plane, a short line with pressed
      // corners, and a lit lower lip.
      float mouthY = 1.5835 + uSmile * 6.0 * ax * ax;
      if (front > 0.5 && ax < 0.023 && r.y > mouthY && r.y < mouthY + 0.0038) col = skin * vec3(0.93, 0.84, 0.81);
      if (front > 0.5 && ax < 0.019 && r.y < mouthY && r.y > mouthY - 0.005) col = skin * vec3(1.03, 0.95, 0.92);
      float line = 0.0007 + 0.0006 * smoothstep(0.016, 0.023, ax);
      if (front > 0.5 && ax < 0.0235 && abs(r.y - mouthY) < line) col = skin * vec3(0.55, 0.4, 0.38);
    }
    // Warm cheeks, low and soft.
    float ck = smoothstep(0.03, 0.0, length(vec2(ax - 0.05, r.y - 1.618)));
    col = mix(col, col * vec3(1.02, 0.92, 0.9), ck * 0.45);
    // The under-jaw plane: one warm step down, never a black collar.
    if (fn.y < -0.45 && r.y < 1.575) { col *= vec3(0.96, 0.92, 0.9); lpFloor = 0.5; }
    rough = r.y > 1.64 ? 0.5 : 0.62;
  } else if (part == 6) {
    col = uHair * 0.9; rough = 0.85; lpHard = 0.6;
  } else if (part == 7) {
    // Brow wedges: lit from their own planes, so the top catches light.
    col = uHair * 0.95; rough = 0.9; lpHard = 1.0;
  } else if (part == 8 || part == 9 || part == 10) {
    // Stylised eye: a big dark iris with a darker rim, a pupil and one hard
    // catchlight (same world side on both eyes), on a warm off-white ball.
    vec2 e = vec2(ax - 0.0314, r.y - 1.6492);
    float d = length(e);
    col = vec3(0.86, 0.83, 0.79);
    rough = 0.3;
    if (d < 0.0071) {
      col = mix(uEye * 0.55, uEye * 1.05, smoothstep(0.0071, 0.0045, d));
      if (d < 0.0031) col = vec3(0.04, 0.035, 0.035);
    }
    vec2 cl = vec2(r.x - sign(r.x) * 0.0314 - 0.0022, r.y - 1.6492 - 0.0025);
    if (length(cl) < 0.0015) col = vec3(1.25);
    lpFloor = 0.6;
  } else if (part == 11) {
    col = uGear; rough = 0.75;
    // A contrasting rim ring where the cup meets the skull.
    if (ax < 0.079) col = uGearTrim;
    // Vent ribs across the cup face.
    if (ax > 0.0915 && abs(r.z + 0.01) < 0.014 && mod(floor((r.y - 1.637) * 230.0 + 0.5), 2.0) < 1.0 && abs(r.y - 1.637) < 0.014) col *= 0.6;
  } else if (part == 12) {
    col = uStrap; rough = 0.6;
  } else if (part == 14) {
    col = uGear; rough = 0.45;
  } else if (part == 15) {
    col = skin * vec3(0.95, 0.88, 0.86);
  } else if (part == 16) {
    col = uHair * 0.4; rough = 0.9;
  } else if (part == 13) {
    col = skin;
  } else {
    col = skin;
  }
  lpSkinK = (part == 6 || part == 7 || (part >= 8 && part <= 12) || part == 14 || part == 16) ? 0.0 : step(length(col - skin), 0.16);
  return col;
}
`;

/** The wordmark: bold condensed caps on a transparent canvas, no logos. */
function wordmark(text: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 104;
  const font = (px: number) => `900 ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  g.font = font(size);
  while (g.measureText(text).width > 470 && size > 40) g.font = font((size -= 4));
  g.fillText(text, 256, 68);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export interface LowPolyMaterial extends MeshStandardMaterial {
  userData: { uniforms: Record<string, { value: unknown }> };
}

export function createLowPolyMaterial(a: Athlete): LowPolyMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.6, metalness: 0 }) as LowPolyMaterial;
  const p = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const uniforms: Record<string, { value: unknown }> = {
    uSkin: { value: new Color(a.skin) },
    uHair: { value: new Color(a.hair) },
    uEye: { value: new Color(a.eye) },
    uPrimary: { value: new Color(a.primary) },
    uSecondary: { value: new Color(a.secondary) },
    uTrim: { value: new Color(a.trim) },
    uPiping: { value: new Color(a.piping) },
    uGear: { value: new Color(a.gearShell) },
    uStrap: { value: new Color(a.gearStrap) },
    uGearTrim: { value: new Color(a.gearTrim) },
    uShoe: { value: new Color(a.shoe) },
    uShoeAccent: { value: new Color(a.shoeAccent) },
    uBand: { value: new Color(a.band) },
    uRim: { value: new Color('#ffd2a8') },
    uShadeTint: { value: new Color(0.84, 0.8, 1.0) },
    uLightTint: { value: new Color(1.03, 1.0, 0.96) },
    uSmile: { value: a.head.smile },
    uShoulderW: { value: a.body.shoulder },
    uGrin: { value: a.head.grin },
    uPoster: { value: Number(p.get('poster') ?? 0.85) },
    uSteps: { value: 3.0 },
    uRimK: { value: 0.3 },
    uFacet: { value: Number(p.get('facet') ?? 0.36) },
    uKeyDir: { value: KEY_DIR.clone() },
    uMark: { value: wordmark(a.wordmark) },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = aPart;\nvRest = aCanon;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Rest-space facet normal: stable as the body moves.
        vec3 lpN = normalize(cross(dFdx(vRest), dFdy(vRest)));
        diffuseColor.rgb = lpColor(lpN, lpRough);
        // Soft poster gradient: a touch darker toward the feet.
        diffuseColor.rgb *= mix(0.86, 1.03, smoothstep(0.05, 1.65, vRest.y));`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = lpRough;')
      .replace(
        '#include <opaque_fragment>',
        `{
          // Poster light. Value comes from the smooth (region) normal and is snapped
          // to a few soft steps, so bands are clean shapes that cross many facets.
          // The true facet normal then nudges each plane by a few percent: the facets
          // read as cut planes without breaking the bands into a checker.
          vec3 base = max(diffuseColor.rgb, vec3(0.03));
          vec3 shade = outgoingLight / base;
          float l = dot(shade, vec3(0.299, 0.587, 0.114));
          float steps = mix(uSteps - 1.0, uSteps, lpSkinK);
          float x = l * steps;
          float q = (floor(x) + smoothstep(0.3, 0.7, fract(x))) / steps;
          float lq = max(mix(l, q, uPoster), lpFloor);
          vec3 kd = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);
          vec3 fN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          float fm = clamp(dot(fN, kd) - dot(normal, kd), -0.6, 0.6);
          lq *= 1.0 + mix(uFacet, 0.9, lpHard) * fm;
          // Skin shadows fall to a warm red-brown; cloth and gear to a cool mauve.
          vec3 shadeT = mix(uShadeTint, vec3(1.0, 0.8, 0.74), lpSkinK);
          vec3 tint = mix(shadeT, uLightTint, smoothstep(0.25, 1.05, lq));
          outgoingLight = base * shade * (lq / max(l, 1e-3)) * tint;
          float fres = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          outgoingLight += uRim * pow(fres, 3.0) * uRimK * (0.35 + 0.65 * diffuseColor.rgb);
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'lowpoly-athlete-3';
  return mat;
}

/**
 * Inverted-hull outline: the same skinned geometry drawn back-faces only, pushed
 * out along the skinned normal by a width in device pixels that never drops below
 * about 1.4 px (so it survives small viewports and phones) and grows gently with
 * the viewport. Eyes, lids, brows and the chin strap get no outline, and the head's
 * outline fades out when the head is under about 60 px tall.
 */
export function createOutlineMaterial(color: string, px = 1.4): MeshBasicMaterial & { userData: { uViewH: { value: number } } } {
  const mat = new MeshBasicMaterial({ color, side: BackSide }) as MeshBasicMaterial & { userData: { uViewH: { value: number } } };
  const uViewH = { value: 810 };
  mat.userData.uViewH = uViewH;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPx = { value: px };
    shader.uniforms.uViewH = uViewH;
    shader.uniforms.uDepth = { value: 0.035 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart;\nuniform float uPx, uViewH, uDepth;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          int part = int(aPart + 0.5);
          float k = (part >= 7 && part <= 10) || part == 12 || part >= 15 ? 0.0 : 1.0;
          if (part == 1 || part == 6 || part == 11) {
            // Fade the head's outline on small heads so it does not muddy the face.
            float headPx = 0.23 * projectionMatrix[1][1] / max(gl_Position.w, 1e-3) * uViewH * 0.5;
            k *= mix(0.0, 0.75, smoothstep(45.0, 95.0, headPx));
          }
          float widthPx = max(uPx, uViewH * 0.0024);
          vec3 vn = normalize(normalMatrix * objectNormal);
          vec2 dir = (projectionMatrix * vec4(vn, 0.0)).xy;
          float dl = length(dir);
          if (dl > 1e-5) {
            dir /= dl;
            dir.x *= projectionMatrix[0][0] / projectionMatrix[1][1];
            gl_Position.xy += dir * (2.0 * widthPx / uViewH) * k * gl_Position.w;
          }
          // Push the hull back in depth so it only shows against things well behind
          // it: silhouettes, not the seams where two parts of one body meet.
          vec4 mv2 = mvPosition;
          mv2.z -= uDepth;
          vec4 p2 = projectionMatrix * mv2;
          gl_Position.z = p2.z / p2.w * gl_Position.w;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'lowpoly-outline-3';
  return mat;
}
