/**
 * The shared skeleton.
 *
 * Conventions, fixed once so every system reads the same way:
 *   - +Y is up and a character faces +Z, which puts +X on the character's *left*.
 *   - In the rest pose every bone has an identity rotation: limbs hang straight
 *     down, the spine points up and the feet point forward. Because of that,
 *     each bone's local axes line up with world axes at rest, and body parts can
 *     be described in plain rest-space coordinates.
 *   - Knees and elbows hinge about their local X axis.
 *
 * Proportions are an athletic 1.76 m collegiate wrestler; every other athlete is
 * a uniform scale of these plus a build factor that only changes girth.
 */

export const BONE_NAMES = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulderL',
  'armL',
  'forearmL',
  'handL',
  'shoulderR',
  'armR',
  'forearmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'toeL',
  'thighR',
  'shinR',
  'footR',
  'toeR',
] as const;

export type BoneName = (typeof BONE_NAMES)[number];
export const BONE_COUNT = BONE_NAMES.length;

export const BONE_INDEX = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<BoneName, number>;

export type V3 = [number, number, number];

export interface BoneDef {
  name: BoneName;
  parent: BoneName | null;
  /** Offset from the parent joint in metres, for the canonical 1.76 m body. */
  offset: V3;
}

/** Reference height the offsets are authored for. */
export const REFERENCE_HEIGHT = 1.76;

export const BONES: readonly BoneDef[] = [
  { name: 'hips', parent: null, offset: [0, 0.965, 0] },
  { name: 'spine', parent: 'hips', offset: [0, 0.105, -0.01] },
  { name: 'chest', parent: 'spine', offset: [0, 0.165, 0] },
  { name: 'neck', parent: 'chest', offset: [0, 0.235, -0.02] },
  { name: 'head', parent: 'neck', offset: [0, 0.105, 0.025] },

  { name: 'shoulderL', parent: 'chest', offset: [0.025, 0.205, 0.03] },
  { name: 'armL', parent: 'shoulderL', offset: [0.165, -0.01, -0.045] },
  { name: 'forearmL', parent: 'armL', offset: [0, -0.295, 0] },
  { name: 'handL', parent: 'forearmL', offset: [0, -0.255, 0] },

  { name: 'shoulderR', parent: 'chest', offset: [-0.025, 0.205, 0.03] },
  { name: 'armR', parent: 'shoulderR', offset: [-0.165, -0.01, -0.045] },
  { name: 'forearmR', parent: 'armR', offset: [0, -0.295, 0] },
  { name: 'handR', parent: 'forearmR', offset: [0, -0.255, 0] },

  { name: 'thighL', parent: 'hips', offset: [0.09, -0.04, 0] },
  { name: 'shinL', parent: 'thighL', offset: [0, -0.435, 0] },
  { name: 'footL', parent: 'shinL', offset: [0, -0.415, -0.01] },
  { name: 'toeL', parent: 'footL', offset: [0, -0.05, 0.135] },

  { name: 'thighR', parent: 'hips', offset: [-0.09, -0.04, 0] },
  { name: 'shinR', parent: 'thighR', offset: [0, -0.435, 0] },
  { name: 'footR', parent: 'shinR', offset: [0, -0.415, -0.01] },
  { name: 'toeR', parent: 'footR', offset: [0, -0.05, 0.135] },
];

export const BONE_DEF = Object.fromEntries(BONES.map((b) => [b.name, b])) as Record<BoneName, BoneDef>;

export const PARENT_INDEX: Int8Array = Int8Array.from(
  BONES.map((b) => (b.parent ? BONE_INDEX[b.parent] : -1)),
);

/** Rest-pose world positions of every joint, for a body of the given scale. */
export function restPositions(scale = 1): Record<BoneName, V3> {
  const out = {} as Record<BoneName, V3>;
  for (const b of BONES) {
    const p = b.parent ? out[b.parent] : ([0, 0, 0] as V3);
    out[b.name] = [p[0] + b.offset[0] * scale, p[1] + b.offset[1] * scale, p[2] + b.offset[2] * scale];
  }
  return out;
}

/** Length of the bone that ends at `child`, for the canonical body. */
export function segmentLength(child: BoneName): number {
  const o = BONE_DEF[child].offset;
  return Math.hypot(o[0], o[1], o[2]);
}

/**
 * The bind pose the body mesh is generated in: an A-pose, arms out at about
 * fifty degrees and legs a touch apart, so no two limbs fuse together when the
 * surface is built. Rotations are XYZ euler degrees per bone.
 */
export const BIND_POSE: Partial<Record<BoneName, V3>> = {
  armL: [0, 0, 52],
  armR: [0, 0, -52],
  forearmL: [-6, 0, 0],
  forearmR: [-6, 0, 0],
  thighL: [0, 0, 4],
  thighR: [0, 0, -4],
};

export const MIRROR: Partial<Record<BoneName, BoneName>> = {
  shoulderL: 'shoulderR',
  armL: 'armR',
  forearmL: 'forearmR',
  handL: 'handR',
  thighL: 'thighR',
  shinL: 'shinR',
  footL: 'footR',
  toeL: 'toeR',
  shoulderR: 'shoulderL',
  armR: 'armL',
  forearmR: 'forearmL',
  handR: 'handL',
  thighR: 'thighL',
  shinR: 'shinL',
  footR: 'footL',
  toeR: 'toeL',
};
