import { torusKnot, type Point3 } from '@idontknot/core';
import { describe, expect, it } from 'vitest';
import { buildTube, curveLength, resample, rotationMinimisingFrames, strandProfile } from '../src/viewer/tube.ts';

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const length = (a: readonly number[]) => Math.sqrt(dot(a, a));
const at = (array: Float32Array, index: number, size: number) =>
  Array.from(array.slice(index * size, index * size + size));

describe('rotation-minimising frames', () => {
  const knot = torusKnot(3, 4);
  const frames = rotationMinimisingFrames(knot.points, true);

  it('are orthonormal at every point', () => {
    frames.normals.forEach((normal, i) => {
      expect(length(normal)).toBeCloseTo(1, 9);
      expect(length(frames.tangents[i]!)).toBeCloseTo(1, 9);
      expect(dot(normal, frames.tangents[i]!)).toBeCloseTo(0, 6);
      expect(dot(normal, frames.binormals[i]!)).toBeCloseTo(0, 9);
    });
  });

  it('turn smoothly from one point to the next, including where a closed curve meets itself', () => {
    const n = frames.normals.length;
    const turns = frames.normals.map((normal, i) => dot(normal, frames.normals[(i + 1) % n]!));
    expect(Math.min(...turns)).toBeGreaterThan(0.95);
  });

  it('do not twist along a straight line', () => {
    const line: Point3[] = Array.from({ length: 12 }, (_, i) => [i, 0, 0]);
    const straight = rotationMinimisingFrames(line, false);
    straight.normals.forEach((normal) => expect(dot(normal, straight.normals[0]!)).toBeCloseTo(1, 12));
  });
});

describe('resampling', () => {
  const knot = torusKnot(2, 3, { samples: 60 });

  it('keeps the original points and adds points between them', () => {
    const finer = resample(knot.points, true, 0.05);
    expect(finer.length).toBeGreaterThan(knot.points.length * 4);
    expect(finer[0]).toEqual(knot.points[0]);
    const gaps = finer.map((point, i) => length(point.map((x, axis) => x - finer[(i + 1) % finer.length]![axis]!)));
    expect(Math.max(...gaps)).toBeLessThan(0.06);
  });

  it('barely changes the length of a smooth curve', () => {
    const finer = resample(knot.points, true, 0.05);
    expect(curveLength(finer, true) / curveLength(knot.points, true)).toBeCloseTo(1, 2);
  });

  it('keeps both ends of an open curve', () => {
    const open = knot.points.slice(0, 10);
    const finer = resample(open, false, 0.05);
    expect(finer[0]).toEqual(open[0]);
    expect(finer[finer.length - 1]).toEqual(open[9]);
  });
});

describe('the outline of three strands', () => {
  it('reaches the full radius at the centre of each strand and dips between them', () => {
    for (const k of [0, 1, 2]) expect(strandProfile((k * 2 * Math.PI) / 3, 3)).toBeCloseTo(1, 12);
    const groove = strandProfile(Math.PI / 3, 3);
    expect(groove).toBeGreaterThan(0.55);
    expect(groove).toBeLessThan(0.8);
  });

  it('is a circle when there are no strands', () => {
    expect(strandProfile(1.234, 0)).toBe(1);
  });
});

describe('the surface of a closed rope', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  const round = buildTube(knot.points, true, 0.2, { sides: 10, strands: 0 });
  const laid = buildTube(resample(knot.points, true, 0.05), true, 0.2, { sides: 24, strands: 3 });

  it('repeats its first row and column, so that a texture can wrap', () => {
    expect(round.rows).toBe(91);
    expect(round.columns).toBe(11);
    expect(round.positions).toHaveLength(91 * 11 * 3);
    expect(at(round.positions, 90 * 11, 3)).toEqual(at(round.positions, 0, 3));
    expect(at(round.positions, 10, 3)).toEqual(at(round.positions, 0, 3));
  });

  it('keeps a round tube at its radius from the centerline', () => {
    for (let row = 0; row < 90; row++) {
      for (let column = 0; column < 10; column++) {
        const offset = at(round.positions, row * 11 + column, 3).map((x, axis) => x - knot.points[row]![axis]!);
        expect(length(offset)).toBeCloseTo(0.2, 5);
      }
    }
  });

  it('keeps laid rope within its radius, with grooves', () => {
    const points = resample(knot.points, true, 0.05);
    const reaches: number[] = [];
    for (let row = 0; row < points.length; row += 7) {
      for (let column = 0; column < 24; column++) {
        const offset = at(laid.positions, row * laid.columns + column, 3).map((x, axis) => x - points[row]![axis]!);
        reaches.push(length(offset));
      }
    }
    expect(Math.max(...reaches)).toBeLessThanOrEqual(0.2 + 1e-6);
    expect(Math.min(...reaches)).toBeLessThan(0.16);
  });

  it('has unit normals that point away from the centerline, with no seam', () => {
    const points = resample(knot.points, true, 0.05);
    for (let row = 0; row < laid.rows; row += 5) {
      for (let column = 0; column < laid.columns; column++) {
        const index = row * laid.columns + column;
        const normal = at(laid.normals, index, 3);
        const outward = at(laid.positions, index, 3).map((x, axis) => x - points[row % points.length]![axis]!);
        expect(length(normal)).toBeCloseTo(1, 5);
        expect(dot(normal, outward)).toBeGreaterThan(0);
      }
    }
    // the repeated row and column carry the same normals as the ones they repeat
    expect(at(laid.normals, (laid.rows - 1) * laid.columns, 3)).toEqual(at(laid.normals, 0, 3));
    expect(at(laid.normals, laid.columns - 1, 3)).toEqual(at(laid.normals, 0, 3));
  });

  it('wraps its texture a whole number of times, along the rope and round it', () => {
    const last = (laid.rows - 1) * laid.columns;
    const [u0, v0] = at(laid.uvs, 0, 2) as [number, number];
    const [uEnd, vEnd] = at(laid.uvs, last, 2) as [number, number];
    const [, vRound] = at(laid.uvs, laid.columns - 1, 2) as [number, number];
    expect(uEnd - u0).toBeCloseTo(Math.round(uEnd - u0), 4);
    expect(uEnd - u0).toBeGreaterThanOrEqual(1);
    expect(vEnd - v0).toBeCloseTo(Math.round(vEnd - v0), 4);
    expect(vRound - v0).toBeCloseTo(3, 4);
  });

  it('joins every row to the next', () => {
    expect(round.indices).toHaveLength(90 * 10 * 6);
    expect(Math.max(...round.indices)).toBe(91 * 11 - 1);
  });
});

it('gives an open rope one band fewer than it has points', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  const open = buildTube(knot.points.slice(0, 20), false, 0.2, { sides: 10, strands: 0 });
  expect(open.rows).toBe(20);
  expect(open.indices).toHaveLength(19 * 10 * 6);
});

it('faces outward: every triangle is anticlockwise when seen from outside the rope', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  for (const strands of [0, 3]) {
    const tube = buildTube(knot.points, true, 0.2, { sides: 12, strands });
    for (let k = 0; k < tube.indices.length; k += 3 * 37) {
      const [i0, i1, i2] = [tube.indices[k]!, tube.indices[k + 1]!, tube.indices[k + 2]!];
      const [p0, p1, p2] = [at(tube.positions, i0, 3), at(tube.positions, i1, 3), at(tube.positions, i2, 3)];
      const e1 = p1.map((x, axis) => x - p0[axis]!);
      const e2 = p2.map((x, axis) => x - p0[axis]!);
      const face = [
        e1[1]! * e2[2]! - e1[2]! * e2[1]!,
        e1[2]! * e2[0]! - e1[0]! * e2[2]!,
        e1[0]! * e2[1]! - e1[1]! * e2[0]!,
      ];
      expect(dot(face, at(tube.normals, i0, 3))).toBeGreaterThan(0);
    }
  }
});
