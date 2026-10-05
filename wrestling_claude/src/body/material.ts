import { CanvasTexture, Color, LinearFilter, MeshPhysicalMaterial, SRGBColorSpace } from 'three';
import type { IUniform } from 'three';

/**
 * The body material.
 *
 * One physically based material paints the whole athlete. The singlet, its trim
 * and side panels, the chest wordmark, shoes, ankle bands, hair and the face are
 * all decided per pixel from where that pixel sat in the bind pose, so edges stay
 * crisp at any distance and no textures are needed beyond the wordmark.
 */

export type SingletPattern = 'panel' | 'sash' | 'stripes' | 'band';

export interface BodyLook {
  skin: string;
  hair: string;
  hairStyle: 'buzz' | 'crop' | 'curls' | 'bald';
  primary: string;
  secondary: string;
  accent: string;
  pattern: SingletPattern;
  wordmark: string;
  /** Ankle band colour: red or green, as in a real bout. */
  band: string;
  shoe: string;
  shoeAccent: string;
  clothing: 'singlet' | 'referee';
  eye: string;
  scale: number;
}

const PATTERN_ID: Record<SingletPattern, number> = { panel: 0, sash: 1, stripes: 2, band: 3 };
const HAIR_ID = { buzz: 0, crop: 1, curls: 2, bald: 3 } as const;

function wordmarkTexture(text: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 118;
  const font = (s: number) => `900 ${s}px "Bahnschrift", "Arial Narrow", "Arial Black", Impact, sans-serif`;
  g.font = font(size);
  while (g.measureText(text).width > 470 && size > 40) {
    size -= 4;
    g.font = font(size);
  }
  g.fillText(text, c.width / 2, c.height / 2 + 6);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const VERTEX_HEAD = /* glsl */ `
attribute float aPart;
varying vec3 vBind;
varying vec3 vBindN;
flat varying float vPart;
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vBind;
varying vec3 vBindN;
flat varying float vPart;
uniform vec3 uSkin;
uniform vec3 uHair;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform vec3 uBand;
uniform vec3 uShoe;
uniform vec3 uShoeAccent;
uniform float uScale;
uniform float uPattern;
uniform float uClothing;
uniform float uHairStyle;
uniform float uSweat;
uniform float uFlush;
uniform sampler2D uWordmark;

struct Look {
  vec3 color;
  float rough;
  float coat;
  vec3 sheen;
};

float aa(float v) {
  float w = max(fwidth(v), 1e-5) * 0.75;
  return smoothstep(-w, w, v);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i.xy + i.z * 17.0);
  float b = hash12(i.xy + vec2(1.0, 0.0) + i.z * 17.0);
  float c = hash12(i.xy + vec2(0.0, 1.0) + i.z * 17.0);
  float d = hash12(i.xy + vec2(1.0, 1.0) + i.z * 17.0);
  float e = hash12(i.xy + (i.z + 1.0) * 17.0);
  float f2 = hash12(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 17.0);
  float g = hash12(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 17.0);
  float h = hash12(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 17.0);
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, f2, f.x), mix(g, h, f.x), f.y), f.z);
}

Look bodyLook() {
  vec3 p = vBind / uScale;
  vec3 n = normalize(vBindN);
  float part = floor(vPart + 0.5);
  float side = p.x >= 0.0 ? 1.0 : -1.0;
  float ax = abs(p.x);

  // Skin, with a little warmth where blood sits close to the surface.
  float mottle = vnoise(p * 140.0) * 0.05 - 0.025;
  vec3 skin = uSkin * (1.0 + mottle);
  float knee = (1.0 - smoothstep(0.0, 0.06, abs(p.y - 0.5))) * step(3.5, part) * step(part, 4.5);
  float cheek = (1.0 - smoothstep(0.0, 0.035, length(vec2(ax - 0.045, p.y - 1.632)))) * step(0.06, p.z) * step(0.5, part) * step(part, 1.5);
  vec3 flushTint = vec3(0.86, 0.38, 0.32);
  skin = mix(skin, skin * flushTint * 1.35, clamp(knee * 0.2 + cheek * (0.12 + uFlush * 0.3), 0.0, 0.5));
  Look L = Look(skin, 0.66 - uSweat * 0.12, 0.02 + uSweat * 0.2, skin * 0.09);

  bool isHead = part > 0.5 && part < 1.5;
  bool isHairVolume = part > 5.5;

  // Face details.
  if (isHead || isHairVolume) {
    // Eyebrows: two soft arcs above the sockets.
    float browY = 1.6935 - (ax - 0.032) * (ax - 0.032) * 6.0;
    float brow = aa(0.0032 - abs(p.y - browY)) * aa(ax - 0.012) * aa(0.056 - ax) * step(0.07, p.z);
    L.color = mix(L.color, uHair * 0.8, brow * 0.9);
    // Lips and the line of the mouth, curving a touch at the corners.
    float lipY = 1.592 + ax * ax * 3.0;
    float lip = aa(0.0058 - abs(p.y - lipY)) * aa(0.02 - ax) * step(0.086, p.z);
    L.color = mix(L.color, L.color * vec3(0.8, 0.6, 0.58), lip * 0.55);
    float mouth = aa(0.0011 - abs(p.y - lipY + 0.0005)) * aa(0.018 - ax) * step(0.088, p.z);
    L.color = mix(L.color, L.color * 0.4, mouth * 0.85);

    // Hair: above a hairline that dips to the nape.
    float hairline = dot(p - vec3(0.0, 1.7, 0.06), vec3(0.0, -0.62, 0.78));
    float nape = p.y - 1.598;
    float temple = 0.074 - ax + max(0.0, p.y - 1.66) * 0.6;
    float hairMask = aa(-hairline) * aa(nape) * (p.z < 0.0 ? 1.0 : aa(temple + 0.02));
    if (uHairStyle > 2.5) hairMask = 0.0;
    if (isHairVolume) hairMask = 1.0;
    float strands = vnoise(p * vec3(420.0, 260.0, 420.0));
    vec3 hairCol = uHair * (0.82 + strands * 0.36);
    float density = uHairStyle < 0.5 ? 0.78 : 1.0;
    L.color = mix(L.color, mix(L.color, hairCol, density), hairMask);
    L.rough = mix(L.rough, 0.62, hairMask);
    L.coat = mix(L.coat, 0.04, hairMask);
    L.sheen = mix(L.sheen, uHair * 0.6, hairMask);
    return L;
  }

  if (uClothing > 0.5) {
    // The official: striped shirt, black slacks, black shoes, wristbands.
    vec3 black = vec3(0.022, 0.024, 0.03);
    bool isTorso = part < 0.5;
    bool isArm = part > 1.5 && part < 2.5;
    bool isLeg = part > 3.5 && part < 4.5;
    bool isFoot = part > 4.5 && part < 5.5;
    vec3 shoulder = vec3(side * 0.19, 1.43, -0.025);
    vec3 armDir = normalize(vec3(side * 0.788, -0.616, 0.0));
    float along = dot(p - shoulder, armDir);
    float sleeve = isArm ? aa(0.15 - along) : 0.0;
    float shirt = isTorso ? aa(p.y - 1.0) : sleeve;
    float pants = (isTorso ? aa(1.0 - p.y) : 0.0) + (isLeg ? 1.0 : 0.0);
    float collar = isTorso ? aa(p.y - 1.44) * aa(0.075 - ax) : 0.0;
    float stripe = step(0.5, fract((p.x + 0.0125) / 0.05));
    vec3 shirtCol = mix(vec3(0.9, 0.9, 0.88), black, stripe);
    shirtCol = mix(shirtCol, black, collar);
    L.color = mix(L.color, shirtCol, shirt);
    L.color = mix(L.color, black, clamp(pants, 0.0, 1.0));
    float clothed = clamp(shirt + pants, 0.0, 1.0);
    L.rough = mix(L.rough, 0.86, clothed);
    L.coat = mix(L.coat, 0.0, clothed);
    L.sheen = mix(L.sheen, vec3(0.08), clothed);
    float bandMask = isArm ? aa(along - 0.485) * aa(0.53 - along) : 0.0;
    vec3 wristCol = side > 0.0 ? vec3(0.75, 0.08, 0.07) : vec3(0.08, 0.55, 0.2);
    L.color = mix(L.color, wristCol, bandMask);
    if (isFoot || p.y < 0.18) {
      L.color = black * 1.4;
      L.rough = 0.5;
      L.coat = 0.3;
      L.sheen = vec3(0.0);
    }
    return L;
  }

  // ------------------------------------------------------------ singlet ---
  bool isTorso = part < 0.5;
  bool isLeg = part > 3.5 && part < 4.5;
  bool isFoot = part > 4.5 && part < 5.5;

  float front = smoothstep(-0.05, 0.03, p.z);
  // Top edge: scoop neck in front, lower scoop behind, straps over the shoulders,
  // deep armholes at the sides.
  float scoopF = mix(1.47, 1.352, smoothstep(0.078, 0.028, ax));
  float scoopB = mix(1.47, 1.3, smoothstep(0.078, 0.022, ax));
  float scoop = mix(scoopB, scoopF, front);
  float strapOuter = 0.136;
  float armhole = 1.236 - max(0.0, ax - strapOuter) * 1.6;
  // Soft vertical strap edges so the switch between zones is anti-aliased.
  float inStrap = aa(ax - 0.074) * aa(strapOuter - ax);
  float topY = mix(ax < strapOuter ? scoop : armhole, 1.62, inStrap);
  float topDist = topY - p.y;

  vec3 hip = vec3(side * 0.09, 0.925, 0.0);
  vec3 thighDir = vec3(side * 0.0698, -0.9976, 0.0);
  float along = dot(p - hip, thighDir);
  float legDist = 0.205 - along;

  float singlet = 0.0;
  float edge = 1.0;
  if (isTorso) {
    singlet = aa(topDist);
    edge = topDist;
  } else if (isLeg) {
    singlet = aa(legDist);
    edge = legDist;
  }

  vec3 base = uPrimary;
  float trimW = 0.012;
  float trim = aa(trimW - abs(edge)) * singlet;

  vec3 kit = base;
  if (uPattern < 0.5) {
    // Side panels down the ribs and the outside of each leg.
    float panel = isTorso ? aa(ax - 0.118) : aa(p.x * side - 0.128);
    kit = mix(kit, uSecondary, panel);
  } else if (uPattern < 1.5) {
    // A diagonal sash across the front.
    float sash = aa(0.032 - abs(p.y - 1.16 - p.x * 0.75)) * front;
    kit = mix(kit, uSecondary, sash);
  } else if (uPattern < 2.5) {
    float s1 = aa(0.008 - abs(ax - 0.128));
    float s2 = aa(0.006 - abs(ax - 0.146));
    float legStripe = isLeg ? aa(0.009 - abs(p.x * side - 0.138)) : 0.0;
    kit = mix(kit, uAccent, clamp(s1 + s2 + legStripe, 0.0, 1.0));
  } else {
    float band = aa(0.055 - abs(p.y - 1.225)) * (isTorso ? 1.0 : 0.0);
    kit = mix(kit, uSecondary, band);
  }

  // Chest wordmark.
  vec2 uv = vec2(0.5 + p.x / 0.25, (p.y - 1.178) / 0.078);
  float inMark = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * smoothstep(0.0, 0.04, p.z) * (isTorso ? 1.0 : 0.0);
  float ink = texture2D(uWordmark, uv).a * inMark;
  vec3 inkCol = uPattern > 2.5 ? uPrimary : uSecondary;
  kit = mix(kit, inkCol, ink);
  kit = mix(kit, uSecondary, trim);

  // Fabric weave catches the light differently from skin.
  float weave = vnoise(p * vec3(900.0, 900.0, 900.0)) * 0.04;
  kit *= 0.98 + weave;
  L.color = mix(L.color, kit, singlet);
  L.rough = mix(L.rough, 0.5, singlet);
  L.coat = mix(L.coat, 0.05, singlet);
  L.sheen = mix(L.sheen, mix(uPrimary, vec3(1.0), 0.45) * 0.9, singlet);

  // Ankle band, above the shoe.
  if (isLeg || isFoot) {
    float bandMask = aa(0.017 - abs(p.y - 0.2));
    L.color = mix(L.color, uBand, bandMask);
    L.rough = mix(L.rough, 0.7, bandMask);
    L.coat = mix(L.coat, 0.0, bandMask);
  }

  // Shoes.
  float shoe = aa(0.182 - p.y);
  if (isFoot || shoe > 0.0) {
    float s = isFoot ? 1.0 : shoe;
    vec3 sh = uShoe;
    float fx = p.x - side * 0.09;
    // Accent swoosh along the side panel.
    float swoosh = aa(0.011 - abs(p.y - 0.06 - (p.z + 0.04) * 0.35)) * aa(abs(fx) - 0.026) * step(-0.06, p.z) * step(p.z, 0.15);
    sh = mix(sh, uShoeAccent, swoosh);
    // Laces up the front.
    float laces = aa(0.016 - abs(fx)) * aa(p.z - 0.02) * aa(0.12 - p.z) * aa(p.y - 0.05);
    float laceLines = step(0.5, fract(p.z * 90.0));
    sh = mix(sh, mix(uShoe * 1.6, vec3(0.85), 0.5), laces * laceLines * 0.8);
    float sole = aa(0.024 - p.y);
    sh = mix(sh, vec3(0.86, 0.84, 0.8), sole);
    L.color = mix(L.color, sh, s);
    L.rough = mix(L.rough, mix(0.42, 0.8, sole), s);
    L.coat = mix(L.coat, 0.25 * (1.0 - sole), s);
    L.sheen = mix(L.sheen, vec3(0.05), s);
  }
  return L;
}
`;

export interface BodyMaterial extends MeshPhysicalMaterial {
  userData: {
    uniforms: Record<string, IUniform>;
  };
}

export function createBodyMaterial(look: BodyLook): BodyMaterial {
  const mat = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.38,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: new Color('#ffffff'),
  }) as BodyMaterial;

  const uniforms: Record<string, IUniform> = {
    uSkin: { value: new Color(look.skin) },
    uHair: { value: new Color(look.hair) },
    uPrimary: { value: new Color(look.primary) },
    uSecondary: { value: new Color(look.secondary) },
    uAccent: { value: new Color(look.accent) },
    uBand: { value: new Color(look.band) },
    uShoe: { value: new Color(look.shoe) },
    uShoeAccent: { value: new Color(look.shoeAccent) },
    uScale: { value: look.scale },
    uPattern: { value: PATTERN_ID[look.pattern] },
    uClothing: { value: look.clothing === 'referee' ? 1 : 0 },
    uHairStyle: { value: HAIR_ID[look.hairStyle] },
    uSweat: { value: 0.15 },
    uFlush: { value: 0 },
    uWordmark: { value: wordmarkTexture(look.wordmark.toUpperCase()) },
  };
  mat.userData.uniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBind = position;\nvBindN = normal;\nvPart = aPart;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nLook look = bodyLook();\ndiffuseColor.rgb = look.color;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = look.rough;')
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        material.clearcoat = look.coat;
        material.clearcoatRoughness = 0.3;
        #ifdef USE_SHEEN
        material.sheenColor = look.sheen;
        material.sheenRoughness = 0.45;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'mat-rivals-body';
  return mat;
}
