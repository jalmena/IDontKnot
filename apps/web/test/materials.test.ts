import { expect, it } from 'vitest';
import { ROPE_MATERIALS, ROPE_MATERIAL_IDS, ROPE_OF_DISCIPLINE, ropeColour } from '../src/viewer/materials.ts';

it('gives every material enough colours to tell five loops apart', () => {
  for (const id of ROPE_MATERIAL_IDS) {
    const { colours } = ROPE_MATERIALS[id];
    expect(new Set(colours).size).toBeGreaterThanOrEqual(5);
    for (const colour of colours) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  }
});

it('gives each of the six disciplines a rope that exists', () => {
  expect(Object.keys(ROPE_OF_DISCIPLINE).sort()).toEqual(
    ['climbing', 'decorative', 'nautical', 'pioneering', 'shibari', 'theory'].sort(),
  );
  for (const id of Object.values(ROPE_OF_DISCIPLINE)) expect(ROPE_MATERIALS[id]).toBeDefined();
  expect(ROPE_OF_DISCIPLINE['shibari']).toBe('jute');
});

it('cycles through the colours when there are more loops than colours', () => {
  expect(ropeColour('jute', 0)).toBe(ROPE_MATERIALS.jute.colours[0]);
  expect(ropeColour('jute', 5)).toBe(ROPE_MATERIALS.jute.colours[0]);
  expect(ropeColour('line', 7)).toBe(ROPE_MATERIALS.line.colours[2]);
});

it('gives only textured constructions a number of yarns', () => {
  for (const id of ROPE_MATERIAL_IDS) {
    const material = ROPE_MATERIALS[id];
    if (material.construction === 'smooth') expect(material.yarns).toBe(0);
    else expect(material.yarns).toBeGreaterThan(0);
  }
});
