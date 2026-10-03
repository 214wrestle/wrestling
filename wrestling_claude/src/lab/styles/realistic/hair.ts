import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { MeshData } from '../../../body/mesher';

/**
 * Short hair as a shell texture: the scalp patch is drawn N times, each layer
 * pushed out along the normal and leaned with the comb direction; the fragment
 * shader keeps only the strands that reach that layer. One instanced draw, alpha
 * to coverage for soft edges. Reads as clipped, textured hair at every distance
 * where the painted scalp alone reads as a helmet.
 */

export const HAIR_LAYERS = 12;

export interface HairOptions {
  color: string;
  /** Top length, metres. */
  length: number;
  /** Comb direction in head space (forward, to the side...). */
  flow: [number, number, number];
  scale: number;
}

export function createHairShell(scalp: MeshData, lengths: Float32Array, opts: HairOptions): InstancedMesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(scalp.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(scalp.normals, 3));
  g.setAttribute('aLen', new Float32BufferAttribute(lengths, 1));
  g.setIndex(new BufferAttribute(scalp.indices, 1));
  g.computeBoundingSphere();

  const mat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0 });
  mat.alphaToCoverage = true;
  const uniforms = {
    uHairCol: { value: new Color(opts.color) },
    uLen: { value: opts.length },
    uFlow: { value: new Vector3(...opts.flow).normalize() },
    uLayers: { value: HAIR_LAYERS },
    uS: { value: opts.scale },
  };
  mat.userData.uLen = uniforms.uLen;
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aLen;
        uniform float uLen;
        uniform vec3 uFlow;
        uniform float uLayers;
        varying vec3 vRoot;
        varying float vT;
        varying float vLen;
        varying vec3 vFlowV;
        varying vec3 vUpV;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float t = (float(gl_InstanceID) + 1.0) / uLayers;
        float h = t * uLen * aLen;
        // Hair leaves the scalp along the normal and bends over in the comb direction.
        vec3 lean = uFlow - normal * dot(uFlow, normal);
        transformed += normal * h * 0.6 + lean * h * 1.1 * t + normal * 0.0003;
        vRoot = position;
        vT = t;
        vLen = aLen;
        // Strand direction and the world up, in view space, for the sheen band.
        vFlowV = (modelViewMatrix * vec4(normalize(normal * 0.6 + lean * 1.1 * t + 1e-4), 0.0)).xyz;
        vUpV = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uHairCol;
        uniform float uS;
        varying vec3 vRoot;
        varying float vT;
        varying float vLen;
        varying vec3 vFlowV;
        varying vec3 vUpV;
        float hh13(vec3 p3) {
          p3 = fract(p3 * 0.1031);
          p3 += dot(p3, p3.zyx + 31.32);
          return fract((p3.x + p3.y) * p3.z);
        }
        float gCov = 1.0;
        float gShade = 1.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // Strands live on a jittered grid in scalp space; each has its own
          // length, thickness and shade. Cells are 1.1 mm: at broadcast
          // distances that is about a pixel, so a strand reads as texture
          // rather than per-pixel noise.
          vec3 q = vRoot / uS / 0.0011;
          vec3 i = floor(q);
          vec3 f = fract(q);
          float best = 9.0;
          float bestH = 0.0;
          for (int z = 0; z <= 1; z++)
          for (int y = 0; y <= 1; y++)
          for (int x = 0; x <= 1; x++) {
            vec3 o = vec3(float(x), float(y), float(z));
            vec3 c = i + o;
            vec3 r = o + vec3(hh13(c), hh13(c + 11.7), hh13(c + 23.1)) - f;
            float d = dot(r, r);
            if (d < best) { best = d; bestH = hh13(c + 5.3); }
          }
          // Clumps: neighbouring strands share a length, so the top reads as
          // tufts with a broken silhouette instead of an even cap.
          float clump = hh13(floor(vRoot / uS / 0.004) + 3.7);
          float dens = smoothstep(0.0, 0.28, vLen);
          if (hh13(i + 9.1) > dens * 1.15) discard;
          float reach = 0.35 + 0.45 * bestH + 0.35 * clump;
          float alive = step(vT, reach);
          float rad = mix(0.75, 0.35, vT / reach);
          gCov = alive * smoothstep(rad, rad * 0.5, sqrt(best));
          // Outer layers fade where the scalp turns away: no fuzzy halo.
          float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          gCov *= 1.0 - vT * (1.0 - smoothstep(0.1, 0.45, ndv));
          if (gCov < 0.12) discard;
          // Root-to-tip value: dark at the scalp, lighter and warmer at the tips,
          // with per-strand and per-clump variation.
          float tip = vT / reach;
          gShade = mix(0.32, 1.0, tip) * (0.8 + 0.3 * bestH) * (0.85 + 0.3 * clump);
          vec3 col = uHairCol * gShade;
          col = mix(col, col * vec3(1.12, 1.04, 0.9), tip * 0.5);
          // Anisotropic sheen band (Kajiya-Kay) from the overhead lights.
          vec3 T = normalize(vFlowV);
          vec3 V = normalize(vViewPosition);
          vec3 Lup = normalize(vUpV + V * 0.3);
          vec3 Hh = normalize(Lup + V);
          float th = dot(T, Hh);
          float aniso = pow(sqrt(max(0.0, 1.0 - th * th)), 60.0);
          col += uHairCol * 1.6 * aniso * 0.35 * tip + vec3(0.04) * aniso * tip;
          diffuseColor.rgb = col;
          diffuseColor.a = gCov;
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.75, 0.55, vT);');
  };
  mat.customProgramCacheKey = () => 'real-hair-shell';

  const mesh = new InstancedMesh(g, mat, HAIR_LAYERS);
  const id = new Matrix4();
  for (let i = 0; i < HAIR_LAYERS; i++) mesh.setMatrixAt(i, id);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
