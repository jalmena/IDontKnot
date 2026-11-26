import { expect, it } from 'vitest';
import { endGrain, roundGrain, sideGrain } from '../src/viewer/wood.ts';

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
    for (const image of [wood.colour, wood.detail]) expect(image).toHaveLength(texels);
    // light earlywood and dark latewood, and relief (red) and roughness (green) that follow them
    expect(spread(wood.colour)).toBeGreaterThan(40);
    expect(spread(wood.detail)).toBeGreaterThan(40);
    expect(spread(wood.detail.subarray(1))).toBeGreaterThan(20);
  }
});

it('is wood: warm, more red than green, more green than blue', () => {
  const { colour } = sideGrain(64, 32);
  let [r, g, b] = [0, 0, 0];
  for (let k = 0; k < colour.length; k += 4) [r, g, b] = [r + colour[k]!, g + colour[k + 1]!, b + colour[k + 2]!];
  expect(r).toBeGreaterThan(g);
  expect(g).toBeGreaterThan(b);
});

it('draws the side of a round pole with its grain straight along it, and tiling both ways without a seam', () => {
  const { width, height, colour } = roundGrain(256, 128);
  const at = (x: number, y: number): number => {
    const k = 4 * (y * width + x);
    return (colour[k]! + colour[k + 1]! + colour[k + 2]!) / 3;
  };
  // across a seam the picture changes no more than from one texel to the next within it
  let [seam, within] = [0, 0];
  for (let y = 0; y < height; y++) {
    seam += Math.abs(at(width - 1, y) - at(0, y));
    within += Math.abs(at(width / 2, y) - at(width / 2 - 1, y));
  }
  expect(seam).toBeLessThan(3 * within + 1);
  [seam, within] = [0, 0];
  for (let x = 0; x < width; x++) {
    seam += Math.abs(at(x, height - 1) - at(x, 0));
    within += Math.abs(at(x, height / 2) - at(x, height / 2 - 1));
  }
  expect(seam).toBeLessThan(3 * within + 1);
  // the grain runs along the first axis: the picture changes much more round the pole than along it
  let [along, round] = [0, 0];
  for (let y = 1; y < height; y++) {
    for (let x = 1; x < width; x++) {
      along += Math.abs(at(x, y) - at(x - 1, y));
      round += Math.abs(at(x, y) - at(x, y - 1));
    }
  }
  expect(round).toBeGreaterThan(1.5 * along);
});
