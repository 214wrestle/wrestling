import { ACESFilmicToneMapping, Color, Fog, PCFSoftShadowMap, Scene } from 'three';
import { buildBodyNow } from '../../../body/factory';
import { Character } from '../../../body/Character';
import { createGym, createLighting } from '../../../arena/gym';
import { createMat } from '../../../arena/mat';
import { ROSTER } from '../../../sim/roster';
import type { Wrestler } from '../../../sim/types';
import type { StyleBuild } from '../shared';

/** Baseline: today's characters exactly as the game builds them, in the game's arena. */

function character(w: Wrestler, band: string): Character {
  const scale = w.height / 1.76;
  const buffers = buildBodyNow({ scale, mass: w.build, hair: w.hairStyle, clothing: 'singlet' }, 'high');
  return new Character(buffers, {
    look: {
      skin: w.skinTone,
      hair: w.hairColor,
      hairStyle: w.hairStyle,
      primary: w.school.primary,
      secondary: w.school.secondary,
      accent: w.school.accent,
      pattern: w.school.pattern,
      wordmark: w.school.mark,
      band,
      shoe: '#15161b',
      shoeAccent: w.school.primary,
      clothing: 'singlet',
      eye: w.eyeColor,
      scale,
    },
    gear: { shell: w.school.gear, strap: w.school.gear },
  });
}

const build: StyleBuild = (renderer) => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const scene = new Scene();
  scene.background = new Color('#05070c');
  scene.fog = new Fog('#070a12', 26, 64);
  const [a, b] = [ROSTER[0], ROSTER[1]];
  scene.add(createGym(a.school, b.school).group);
  createLighting(scene);
  scene.add(createMat(a.school));
  const A = character(a, '#c8261f');
  const B = character(b, '#1f9d4a');
  scene.add(A.root, B.root);
  return {
    title: 'Current look',
    blurb: 'today’s procedural athletes, unchanged',
    scene,
    A,
    B,
    labelA: `${a.firstName} ${a.lastName} · ${a.school.name}`,
    labelB: `${b.firstName} ${b.lastName} · ${b.school.name}`,
  };
};

export default build;
