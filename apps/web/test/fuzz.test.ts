import { torusKnot } from '@idontknot/core';
import { expect, it } from 'vitest';
import { buildFuzz, FUZZ_PIECES } from '../src/viewer/fuzz.ts';
import { curveLength, resample } from '../src/viewer/tube.ts';

const points = resample(torusKnot(2, 3, { samples: 90 }).points, true, 0.05);
const radius = 0.2;
const options = { density: 6, reach: 0.8, stiffness: 0.5 };
const fuzz = buildFuzz(points, true, radius, options);
const fibres = fuzz.positions.length / (FUZZ_PIECES * 6);
const point = (fibre: number, end: number) =>
  Array.from(fuzz.positions.slice((fibre * FUZZ_PIECES * 2 + end) * 3).slice(0, 3));
const apart = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

it('has as many loose fibres as the length of the rope asks for', () => {
  expect(fibres).toBe(Math.round((options.density * curveLength(points, true)) / radius));
  expect(fuzz.strengths).toHaveLength(fibres * FUZZ_PIECES * 2);
  expect(fuzz.facings).toHaveLength(fuzz.positions.length);
});

it('starts every fibre just under the surface of the rope', () => {
  for (let fibre = 0; fibre < fibres; fibre += 7) {
    const root = point(fibre, 0);
    const nearest = Math.min(...points.map((p) => apart(p, root)));
    expect(nearest).toBeGreaterThan(radius * 0.75);
    expect(nearest).toBeLessThan(radius * 1.01);
  }
});

it('makes each fibre one unbroken line, no longer than its reach, that fades towards its tip', () => {
  for (let fibre = 0; fibre < fibres; fibre += 7) {
    let total = 0;
    for (let piece = 0; piece < FUZZ_PIECES; piece++) {
      const [from, to] = [point(fibre, 2 * piece), point(fibre, 2 * piece + 1)];
      total += apart(from, to);
      if (piece > 0) expect(apart(point(fibre, 2 * piece - 1), from)).toBe(0);
    }
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(options.reach * radius + 1e-6);
    expect(fuzz.strengths[fibre * FUZZ_PIECES * 2]).toBe(1);
    expect(fuzz.strengths[(fibre + 1) * FUZZ_PIECES * 2 - 1]).toBe(0);
  }
});

it('is the same every time, and different for another seed', () => {
  expect(buildFuzz(points, true, radius, options).positions).toEqual(fuzz.positions);
  expect(buildFuzz(points, true, radius, { ...options, seed: 20 }).positions).not.toEqual(fuzz.positions);
});

it('says how far along the rope each fibre is', () => {
  expect(fuzz.alongs).toHaveLength(fuzz.strengths.length);
  for (let fibre = 0; fibre < fibres; fibre += 5) {
    const ends = Array.from(fuzz.alongs.slice(fibre * FUZZ_PIECES * 2, (fibre + 1) * FUZZ_PIECES * 2));
    expect(new Set(ends).size).toBe(1);
    expect(ends[0]).toBeGreaterThanOrEqual(0);
    expect(ends[0]).toBeLessThanOrEqual(1);
  }
});
