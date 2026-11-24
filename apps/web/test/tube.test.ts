import { torusKnot, type Point3 } from '@idontknot/core';
import { describe, expect, it } from 'vitest';
import { buildTube, rotationMinimisingFrames } from '../src/viewer/tube.ts';

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const length = (a: readonly number[]) => Math.sqrt(dot(a, a));

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

describe('the tube', () => {
  const knot = torusKnot(2, 3, { samples: 90 });
  const tube = buildTube(knot.points, true, 0.2, { sides: 10 });

  it('has one ring of vertices per point', () => {
    expect(tube.rings).toBe(90);
    expect(tube.positions).toHaveLength(90 * 10 * 3);
    expect(tube.normals).toHaveLength(tube.positions.length);
    expect(tube.colors).toHaveLength(tube.positions.length);
  });

  it('keeps every vertex at the rope radius from its centre point', () => {
    for (let i = 0; i < tube.rings; i++) {
      for (let j = 0; j < tube.sides; j++) {
        const k = (i * tube.sides + j) * 3;
        const offset = [0, 1, 2].map((axis) => tube.positions[k + axis]! - knot.points[i]![axis]!);
        expect(length(offset)).toBeCloseTo(0.2, 5);
      }
    }
  });

  it('closes on itself, and an open curve has one band fewer', () => {
    expect(tube.indices).toHaveLength(90 * 10 * 6);
    expect(Math.max(...tube.indices)).toBe(90 * 10 - 1);
    const open = buildTube(knot.points.slice(0, 20), false, 0.2, { sides: 10 });
    expect(open.indices).toHaveLength(19 * 10 * 6);
  });
});
