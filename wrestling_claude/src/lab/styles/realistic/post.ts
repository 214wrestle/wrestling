import {
  DepthTexture,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three';
import type { Camera, PerspectiveCamera, WebGLRenderer } from 'three';

/**
 * Broadcast lens: the scene is rendered into a multisampled HDR target, then a
 * single gather pass adds depth of field (a background-aware bokeh so the
 * in-focus athlete never bleeds), a touch of atmospheric haze in the far house
 * and a soft vignette, before ACES tone mapping and sRGB output. The crowd goes
 * soft and dark behind the athletes the way a long broadcast lens renders it.
 *
 * One extra full-screen pass, 40 taps: cheap on desktop; a phone would drop the
 * taps to 16 at half resolution or skip it.
 */

export interface LensSettings {
  /** Focus distance, metres. */
  focus: number;
  /** Blur radius in pixels (at a 810 px tall view) for something at infinity. */
  blur: number;
  /** Depth (m) beyond which the haze starts. */
  hazeFrom: number;
  haze: number;
  vignette: number;
}

/** Pass 1: nearest and farthest view depth of each 3x3 neighbourhood. */
const DILATE = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;
void main() {
  float zn = 1e6;
  float zf = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      float d = texture2D(tDepth, vUv + vec2(float(i), float(j)) / uRes).x;
      float z = -perspectiveDepthToViewZ(d, uNear, uFar);
      zn = min(zn, z);
      zf = max(zf, z);
    }
  gl_FragColor = vec4(zn, zf, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNear;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uBlur;
uniform float uHazeFrom;
uniform float uHaze;
uniform float uVignette;
varying vec2 vUv;

float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, uNear, uFar);
}
float coc(float z) {
  return min(uBlur, uBlur * abs(1.0 - uFocus / max(z, 0.01)));
}

void main() {
  vec3 base = texture2D(tColor, vUv).rgb;
  float zc = viewZ(vUv);
  vec2 nf = texture2D(tNear, vUv).xy;
  // A pixel touching the in-focus subject (its nearest neighbour is near the
  // focus plane) keeps its own anti-aliased edge; the blur is decided by its
  // own depth only, so the subject never picks up a dark fringe.
  float touchesFocus = 1.0 - smoothstep(0.25, 0.6, abs(1.0 - uFocus / max(nf.x, 0.01)));
  float cc = coc(zc);
  vec3 acc = base * mix(1.0, 8.0, touchesFocus);
  float wsum = mix(1.0, 8.0, touchesFocus);
  if (uBlur > 0.25 && cc > 0.6) {
    const int N = 40;
    float R = uBlur;
    for (int i = 0; i < N; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(N)) * R;
      float a = fi * 2.39996;
      vec2 off = vec2(cos(a), sin(a)) * r;
      vec2 uv = vUv + off / uRes;
      float zs = viewZ(uv);
      float zsNear = texture2D(tNear, uv).x;
      float cs = coc(zs);
      // A sample reaches this pixel if its own blur disc covers the distance.
      float reach = smoothstep(r - 1.0, r + 0.5, cs);
      // Never gather anything that is (or borders) nearer than this pixel by
      // a margin: the athletes' colour must not bleed into the blurred house.
      float fg = step(zsNear, zc * 0.8);
      float w = reach * (1.0 - fg) * smoothstep(r - 1.0, r + 0.5, cc);
      acc += texture2D(tColor, uv).rgb * w;
      wsum += w;
    }
  }
  vec3 col = acc / wsum;
  // Haze in the far house: lifts nothing, just pulls the stands toward smoke.
  float hz = uHaze * smoothstep(uHazeFrom, uHazeFrom * 3.0, zc);
  col = mix(col, vec3(0.012, 0.014, 0.02), hz);
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Lens {
  private rt: WebGLRenderTarget;
  private nearRT: WebGLRenderTarget;
  private dilate: ShaderMaterial;
  private quad: Mesh;
  private qScene = new Scene();
  private qCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: ShaderMaterial;
  private vp = new Vector4();
  readonly settings: LensSettings = { focus: 3, blur: 0, hazeFrom: 12, haze: 0, vignette: 0.25 };

  constructor() {
    this.rt = new WebGLRenderTarget(16, 16, {
      type: HalfFloatType,
      samples: 4,
      depthTexture: new DepthTexture(16, 16, UnsignedIntType),
    });
    this.nearRT = new WebGLRenderTarget(16, 16, { type: HalfFloatType, depthBuffer: false });
    this.dilate = new ShaderMaterial({
      uniforms: {
        tDepth: { value: this.rt.depthTexture },
        uRes: { value: new Vector2(16, 16) },
        uNear: { value: 0.03 },
        uFar: { value: 120 },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: DILATE,
      depthTest: false,
      depthWrite: false,
    });
    this.mat = new ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        tNear: { value: this.nearRT.texture },
        uRes: { value: new Vector2(16, 16) },
        uNear: { value: 0.03 },
        uFar: { value: 120 },
        uFocus: { value: 3 },
        uBlur: { value: 0 },
        uHazeFrom: { value: 12 },
        uHaze: { value: 0 },
        uVignette: { value: 0.25 },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
  }

  /** Focus on a world point. */
  focusOn(camera: Camera, p: Vector3): void {
    this.settings.focus = camera.position.distanceTo(p);
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    renderer.getViewport(this.vp);
    const pr = renderer.getPixelRatio();
    const w = Math.max(1, Math.round(this.vp.z * pr));
    const h = Math.max(1, Math.round(this.vp.w * pr));
    if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.setSize(w, h);
      this.nearRT.setSize(w, h);
    }
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, camera);
    const du = this.dilate.uniforms;
    du.uRes.value.set(w, h);
    du.uNear.value = camera.near;
    du.uFar.value = camera.far;
    renderer.setRenderTarget(this.nearRT);
    this.quad.material = this.dilate;
    renderer.render(this.qScene, this.qCam);
    this.quad.material = this.mat;
    renderer.setRenderTarget(prev);

    const u = this.mat.uniforms;
    const s = this.settings;
    u.uRes.value.set(w, h);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = s.focus;
    u.uBlur.value = s.blur * (h / 810);
    u.uHazeFrom.value = s.hazeFrom;
    u.uHaze.value = s.haze;
    u.uVignette.value = s.vignette;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.qScene, this.qCam);
    renderer.autoClear = ac;
  }
}
