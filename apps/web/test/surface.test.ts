import { describe, expect, it } from 'vitest';
import { ROPE_MATERIALS, type BraidedMaterial, type LaidMaterial } from '../src/viewer/materials.ts';
import { braidedSurface, colourOf, laidSurface, SHADE_UNIT, type Surface } from '../src/viewer/surface.ts';

const jute = ROPE_MATERIALS.jute as LaidMaterial;
const kernmantle = ROPE_MATERIALS.kernmantle as BraidedMaterial;
const strand = laidSurface({ ...jute.surface, twist: 5, arc: 4.4 }, [4, 2], 256, 128);
const sheath = braidedSurface(kernmantle.surface, [5, 2 * Math.PI], 320, 320);

/** How much the shade changes from one texel to the next, on average, between two columns or two rows. */
function step(surface: Surface, axis: 'along' | 'across', from: number, to: number): number {
  const { width, height, shade } = surface;
  const count = axis === 'along' ? height : width;
  let total = 0;
  for (let k = 0; k < count; k++) {
    const [a, b] = axis === 'along' ? [k * width + from, k * width + to] : [from * width + k, to * width + k];
    total += Math.abs(shade[a]! - shade[b]!);
  }
  return total / count;
}

describe('the face of a strand of laid rope', () => {
  it('repeats along the rope: its last column runs into its first as any column does into the next', () => {
    const usual =
      (step(strand, 'along', 60, 61) + step(strand, 'along', 140, 141) + step(strand, 'along', 200, 201)) / 3;
    expect(step(strand, 'along', strand.width - 1, 0)).toBeLessThan(2 * usual);
    expect(step(strand, 'along', 0, strand.width / 2)).toBeGreaterThan(2 * usual); // and it is not simply flat
  });

  it('is darker in the grooves at its edges than on its outer side', () => {
    const row = (y: number) => {
      let total = 0;
      for (let x = 0; x < strand.width; x++) total += strand.shade[y * strand.width + x]!;
      return total / strand.width;
    };
    const middle = (row(60) + row(64) + row(68)) / 3;
    expect(row(2)).toBeLessThan(0.6 * middle);
    expect(row(strand.height - 3)).toBeLessThan(0.6 * middle);
  });

  it('has fibres of different colours', () => {
    const tints = new Set(strand.tint);
    expect(tints.size).toBeGreaterThan(40);
    expect(Math.min(...tints)).toBeLessThan(90);
    expect(Math.max(...tints)).toBeGreaterThan(165);
  });
});

describe('the sheath of a braided rope', () => {
  it('repeats along the rope and round it', () => {
    const along =
      (step(sheath, 'along', 50, 51) + step(sheath, 'along', 170, 171) + step(sheath, 'along', 250, 251)) / 3;
    const across =
      (step(sheath, 'across', 50, 51) + step(sheath, 'across', 170, 171) + step(sheath, 'across', 250, 251)) / 3;
    expect(step(sheath, 'along', sheath.width - 1, 0)).toBeLessThan(2 * along);
    expect(step(sheath, 'across', sheath.height - 1, 0)).toBeLessThan(2 * across);
  });

  it('gives each carrier the colour its pattern names, and no other', () => {
    expect([...new Set(sheath.tint)].sort((a, b) => a - b)).toEqual([0, 128, 255]);
  });

  it('shows as much of the carriers going one way as of those going the other', () => {
    // the two tracer colours are on carriers going opposite ways, two of every ten each
    const count = (tint: number) => sheath.tint.reduce((n, value) => n + (value === tint ? 1 : 0), 0);
    expect(count(128) / count(255)).toBeGreaterThan(0.9);
    expect(count(128) / count(255)).toBeLessThan(1.1);
    expect(count(128) / sheath.tint.length).toBeCloseTo(0.1, 1);
  });
});

it('gives every texel a unit normal that faces out of the surface', () => {
  for (const surface of [strand, sheath]) {
    for (let k = 0; k < surface.width * surface.height; k += 97) {
      const [x, y, z] = [0, 1, 2].map((c) => surface.normal[4 * k + c]! / 127.5 - 1) as [number, number, number];
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
      expect(z).toBeGreaterThan(0);
    }
  }
});

it('paints a surface with a ramp of colours, lighter or darker by its shade', () => {
  const surface: Surface = {
    width: 3,
    height: 1,
    shade: Uint8Array.from([SHADE_UNIT, SHADE_UNIT / 2, SHADE_UNIT]),
    tint: Uint8Array.from([0, 0, 255]),
    normal: new Uint8Array(12),
    detail: new Uint8Array(12),
  };
  const pixels = colourOf(surface, [
    [200, 100, 40],
    [10, 20, 30],
  ]);
  expect(Array.from(pixels)).toEqual([200, 100, 40, 255, 100, 50, 20, 255, 10, 20, 30, 255]);
  expect(Array.from(colourOf(surface, [[200, 100, 40]]).slice(8))).toEqual([200, 100, 40, 255]);
});
