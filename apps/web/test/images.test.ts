import { expect, it } from 'vitest';
import { ROPE_MATERIALS, ROPE_MATERIAL_IDS } from '../src/viewer/materials.ts';
import { rgbOf, toned, yarnTwist } from '../src/viewer/images.ts';

it('reads a colour as its red, green and blue', () => {
  expect(rgbOf('#a8835a')).toEqual([168, 131, 90]);
});

it('moves a colour towards black or towards white', () => {
  expect(toned([200, 100, 0], -0.5)).toEqual([100, 50, 0]);
  expect(toned([200, 100, 0], 0.5)).toEqual([227.5, 177.5, 127.5]);
  expect(toned([200, 100, 0], 0)).toEqual([200, 100, 0]);
});

it('twists the yarns of every laid rope a whole number of times in each repeat', () => {
  for (const id of ROPE_MATERIAL_IDS) {
    const material = ROPE_MATERIALS[id];
    if (material.construction !== 'laid') continue;
    const twist = yarnTwist(material);
    expect(Number.isInteger(twist)).toBe(true);
    expect(twist).toBeGreaterThanOrEqual(1);
  }
});

it('twists the yarns more, the more of them there are and the shorter the lay', () => {
  const jute = ROPE_MATERIALS.jute;
  if (jute.construction !== 'laid') throw new Error('jute is laid rope');
  const more = { ...jute, surface: { ...jute.surface, yarns: jute.surface.yarns * 2 } };
  const tighter = { ...jute, lay: jute.lay / 2 };
  expect(yarnTwist(more)).toBeGreaterThan(yarnTwist(jute));
  expect(yarnTwist(tighter)).toBeGreaterThan(yarnTwist(jute));
});
