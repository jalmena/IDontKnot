import { torusKnot, type Point3 } from '@idontknot/core';
import { describe, expect, it } from 'vitest';
import {
  buildLaid,
  buildTube,
  curveLength,
  LAID_ARC,
  resample,
  rotationMinimisingFrames,
  strandPlace,
} from '../src/viewer/tube.ts';

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

describe('a round tube along a closed rope', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  const round = buildTube(knot.points, true, 0.2, { sides: 10 });

  it('repeats its first row and column, so that a texture can wrap', () => {
    expect(round.rows).toBe(91);
    expect(round.columns).toBe(11);
    expect(round.positions).toHaveLength(91 * 11 * 3);
    expect(at(round.positions, 90 * 11, 3)).toEqual(at(round.positions, 0, 3));
    expect(at(round.positions, 10, 3)).toEqual(at(round.positions, 0, 3));
  });

  it('stays at its radius from the centerline', () => {
    for (let row = 0; row < 90; row++) {
      for (let column = 0; column < 10; column++) {
        const offset = at(round.positions, row * 11 + column, 3).map((x, axis) => x - knot.points[row]![axis]!);
        expect(length(offset)).toBeCloseTo(0.2, 5);
      }
    }
  });

  it('has unit normals that point away from the centerline, with no seam', () => {
    for (let row = 0; row < round.rows; row += 5) {
      for (let column = 0; column < round.columns; column++) {
        const index = row * round.columns + column;
        const normal = at(round.normals, index, 3);
        const outward = at(round.positions, index, 3).map((x, axis) => x - knot.points[row % 90]![axis]!);
        expect(length(normal)).toBeCloseTo(1, 5);
        expect(dot(normal, outward)).toBeGreaterThan(0);
      }
    }
    // the repeated row and column carry the same normals as the ones they repeat
    expect(at(round.normals, (round.rows - 1) * round.columns, 3)).toEqual(at(round.normals, 0, 3));
    expect(at(round.normals, round.columns - 1, 3)).toEqual(at(round.normals, 0, 3));
  });

  it('wraps its texture a whole number of times along the rope, and once round it', () => {
    const last = (round.rows - 1) * round.columns;
    const [u0, v0] = at(round.uvs, 0, 2) as [number, number];
    const [uEnd] = at(round.uvs, last, 2) as [number, number];
    const [, vRound] = at(round.uvs, round.columns - 1, 2) as [number, number];
    expect(uEnd - u0).toBeCloseTo(Math.round(uEnd - u0), 4);
    expect(uEnd - u0).toBeGreaterThanOrEqual(1);
    expect(vRound - v0).toBeCloseTo(1, 6);
  });

  it('joins every row to the next', () => {
    expect(round.indices).toHaveLength(90 * 10 * 6);
    expect(Math.max(...round.indices)).toBe(91 * 11 - 1);
  });
});

it('gives an open rope one band fewer than it has points', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  const open = buildTube(knot.points.slice(0, 20), false, 0.2, { sides: 10 });
  expect(open.rows).toBe(20);
  expect(open.indices).toHaveLength(19 * 10 * 6);
});

describe('laid rope as its strands', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  const points = resample(knot.points, true, 0.05);
  const radius = 0.2;
  const sides = 8;
  const laid = buildLaid(points, true, radius, { sides, layLength: 6 * radius, textureLength: 4 * radius });
  const perStrand = laid.rows * laid.columns;
  const vertex = (strand: number, row: number, column: number) => strand * perStrand + row * laid.columns + column;
  const fromCentreline = (strand: number, row: number, column: number) =>
    length(
      at(laid.positions, vertex(strand, row, column), 3).map((x, axis) => x - points[row % points.length]![axis]!),
    );

  it('is three strands, each a band of vertices along the whole rope', () => {
    expect(laid.rows).toBe(points.length + 1);
    expect(laid.columns).toBe(sides + 1);
    expect(laid.positions).toHaveLength(3 * perStrand * 3);
    expect(laid.indices).toHaveLength(3 * (laid.rows - 1) * sides * 6);
    expect(Math.max(...laid.indices)).toBe(3 * perStrand - 1);
  });

  it('fills the rope: the outer side of each strand is at its radius, and its edges are down in the grooves', () => {
    for (const strand of [0, 1, 2]) {
      for (let row = 0; row < laid.rows; row += 11) {
        const outer = fromCentreline(strand, row, sides / 2);
        expect(outer).toBeGreaterThan(radius * 0.99);
        expect(outer).toBeLessThan(radius * 1.03);
        expect(fromCentreline(strand, row, 0)).toBeLessThan(radius * 0.6);
        expect(fromCentreline(strand, row, sides)).toBeLessThan(radius * 0.6);
      }
    }
  });

  it('places three round strands that touch', () => {
    const { offset, size } = strandPlace(3);
    expect(offset + size).toBeCloseTo(1, 12);
    expect(2 * offset * Math.sin(Math.PI / 3)).toBeCloseTo(2 * size, 12); // centres two strand radii apart
    expect(LAID_ARC).toBeGreaterThan(Math.PI); // more than the half that could ever be seen
  });

  it('has unit normals', () => {
    for (let index = 0; index < 3 * perStrand; index += 13)
      expect(length(at(laid.normals, index, 3))).toBeCloseTo(1, 5);
  });

  it('ends every strand where a strand begins, so that the rope closes without a seam', () => {
    const last = laid.rows - 1;
    for (const strand of [0, 1, 2]) {
      const meets = [0, 1, 2].filter((other) =>
        Array.from({ length: laid.columns }, (_, column) => column).every((column) => {
          const end = at(laid.positions, vertex(strand, last, column), 3);
          const start = at(laid.positions, vertex(other, 0, column), 3);
          return length(end.map((x, axis) => x - start[axis]!)) < 1e-5;
        }),
      );
      expect(meets).toHaveLength(1);
    }
  });

  it('wraps its texture a whole number of times along the rope, and runs it once across each strand', () => {
    const [u0, v0] = at(laid.uvs, vertex(1, 0, 0), 2) as [number, number];
    const [uEnd] = at(laid.uvs, vertex(1, laid.rows - 1, 0), 2) as [number, number];
    const [, vAcross] = at(laid.uvs, vertex(1, 0, sides), 2) as [number, number];
    expect(uEnd - u0).toBeCloseTo(Math.round(uEnd - u0), 4);
    expect(uEnd - u0).toBeGreaterThanOrEqual(1);
    expect([v0, vAcross]).toEqual([0, 1]);
  });

  it('goes round like a right-handed screw', () => {
    // seen along the rope, a strand turns anticlockwise as it advances
    const frames = rotationMinimisingFrames(points, true);
    const angleAt = (row: number) => {
      const away = at(laid.positions, vertex(0, row, sides / 2), 3).map((x, axis) => x - points[row]![axis]!);
      return Math.atan2(dot(away, frames.binormals[row]!), dot(away, frames.normals[row]!));
    };
    const step = angleAt(1) - angleAt(0);
    expect(Math.atan2(Math.sin(step), Math.cos(step))).toBeGreaterThan(0);
  });
});

it('faces outward: every triangle is anticlockwise when seen from outside the rope', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  // the strands of laid rope turn quickly, so they need the centerline in small steps, as the viewport gives it
  const fine = resample(knot.points, true, 0.04);
  for (const tube of [buildTube(knot.points, true, 0.2, { sides: 12 }), buildLaid(fine, true, 0.2, { sides: 6 })]) {
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
