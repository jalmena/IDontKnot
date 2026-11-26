import { expect, it } from 'vitest';
import { endGrain, sideGrain } from '../src/viewer/wood.ts';

const spread = (values: Uint8Array): number => {
  let [low, high] = [255, 0];
  for (let k = 0; k < values.length; k += 4) [low, high] = [Math.min(low, values[k]!), Math.max(high, values[k]!)];
  return high - low;
};

it('computes the same wood every time, and other wood for another seed', () => {
  expect(sideGrain(64, 32).colour).toEqual(sideGrain(64, 32).colour);
  expect(sideGrain(64, 32, 3).colour).not.toEqual(sideGrain(64, 32).colour);
  expect(endGrain(32).colour).toEqual(endGrain(32).colour);
});

it('gives each picture its colour, relief and roughness, with grain in them', () => {
  for (const wood of [sideGrain(128, 64), endGrain(64)]) {
    const texels = wood.width * wood.height * 4;
    for (const image of [wood.colour, wood.relief, wood.rough]) expect(image).toHaveLength(texels);
    // light earlywood and dark latewood, and relief and roughness that follow them
    expect(spread(wood.colour)).toBeGreaterThan(40);
    expect(spread(wood.relief)).toBeGreaterThan(40);
    expect(spread(wood.rough)).toBeGreaterThan(20);
  }
});

it('is wood: warm, more red than green, more green than blue', () => {
  const { colour } = sideGrain(64, 32);
  let [r, g, b] = [0, 0, 0];
  for (let k = 0; k < colour.length; k += 4) [r, g, b] = [r + colour[k]!, g + colour[k + 1]!, b + colour[k + 2]!];
  expect(r).toBeGreaterThan(g);
  expect(g).toBeGreaterThan(b);
});
