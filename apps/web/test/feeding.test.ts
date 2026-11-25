import { framePolylines, type Frame, type Point3 } from '@idontknot/core';
import { expect, it } from 'vitest';
import { fed } from '../src/knot/feeding.ts';
import { KNOTS } from '../src/knot/library.ts';
import { pointAt } from '../src/knot/parts.ts';

const { document } = KNOTS['figure-eight']!;
const [way] = framePolylines(document, document.geometry?.frames[0] as Frame);
if (!way) throw new Error('the figure-eight knot has a rope');
const length = document.components[0]?.length ?? 0;
const run = (points: readonly Point3[]): number =>
  points.slice(1).reduce((sum, point, i) => sum + Math.hypot(...point.map((x, c) => x - points[i]![c]!)), 0);

it('has the whole rope there while the knot is tied: what is not in the knot yet lies straight behind it', () => {
  for (const position of [12, 30, 47.786, 60]) {
    const rope = fed(way, position, length);
    // nothing of the rope is missing, and nothing is stretched
    expect(run(rope.points)).toBeCloseTo(length, 1);
    expect(rope.s[0]).toBe(0);
    expect(rope.s.at(-1)).toBeCloseTo(length, 9);
    // its end is where the end has been led to
    expect(rope.points.at(-1)).toEqual(pointAt(way, position));
    // and the rest lies straight back from where the way begins, as far as there is rope left
    const [far, start] = [rope.points[0]!, rope.points[1]!];
    expect(start).toEqual(way.points[0]);
    expect(Math.hypot(...far.map((x, c) => x - start[c]!))).toBeCloseTo(length - position, 6);
    expect(far[0]).toBeLessThan(start[0]);
    expect(far[1]).toBeCloseTo(start[1], 6);
  }
});

it('slides the rope along the way: the same point of the way holds rope from further along it as the end goes on', () => {
  const [early, late] = [fed(way, 20, length), fed(way, 40, length)];
  // the start of the way is the second point of both; the rope there is what is still behind
  expect(early.s[1]).toBeCloseTo(length - 20, 9);
  expect(late.s[1]).toBeCloseTo(length - 40, 9);
});

it('is the rope as it lies when the knot is tied, once the end has come all the way', () => {
  expect(fed(way, length, length).points).toEqual(way.points);
  expect(fed(way, length + 5, length).points).toEqual(way.points);
});
