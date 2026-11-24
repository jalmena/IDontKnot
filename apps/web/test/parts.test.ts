import { framePolylines, type Frame, type Part } from '@idontknot/core';
import { expect, it } from 'vitest';
import { KNOTS } from '../src/knot/library.ts';
import { boundsOf, partShape, pointAt } from '../src/knot/parts.ts';

const { document } = KNOTS['figure-eight']!;
const frame = document.geometry?.frames[0] as Frame;
const curve = framePolylines(document, frame)[0]!;
const control = frame.curves['rope']!.points;
const length = document.components[0]!.length as number;
const part = (id: string) => (document.parts ?? []).find((candidate) => candidate.id === id) as Part;

it('finds the point of a rope at a material coordinate', () => {
  for (const [x, y, z, s] of control) {
    const point = pointAt(curve, s);
    expect(point[0]).toBeCloseTo(x, 6);
    expect(point[1]).toBeCloseTo(y, 6);
    expect(point[2]).toBeCloseTo(z, 6);
  }
  // beyond either end it stays at the end
  expect(pointAt(curve, -5)).toEqual(curve.points[0]);
  expect(pointAt(curve, length + 5)).toEqual(curve.points.at(-1));
});

it('gives a part its stretch of the rope, from where it starts to where it ends', () => {
  const tail = partShape(part('tail'), curve, length);
  expect(tail.to).toBe(1);
  expect(tail.from).toBeCloseTo(part('tail').from / length, 12);
  expect(tail.points[0]).toEqual(pointAt(curve, part('tail').from));
  expect(tail.points.at(-1)).toEqual(curve.points.at(-1));
  const stretch = tail.points
    .slice(1)
    .reduce((sum, point, i) => sum + Math.hypot(...point.map((x, a) => x - tail.points[i]![a]!)), 0);
  expect(stretch).toBeCloseTo(part('tail').to - part('tail').from, 1);
});

it('hangs the name of a straight part on its middle, and the name of a loop on its top', () => {
  const standing = partShape(part('standing-part'), curve, length);
  expect(standing.anchor).toEqual(pointAt(curve, part('standing-part').to / 2));
  for (const id of ['first-loop', 'second-loop']) {
    const loop = partShape(part(id), curve, length);
    expect(loop.anchor[1]).toBe(Math.max(...loop.points.map((point) => point[1])));
    expect(loop.anchor[1]).toBeGreaterThan(2.5);
  }
  // the first loop along the rope is the one nearer the tail, on the right
  expect(partShape(part('first-loop'), curve, length).anchor[0]).toBeGreaterThan(0);
  expect(partShape(part('second-loop'), curve, length).anchor[0]).toBeLessThan(0);
});

it('knows which parts reach an end of the rope, and where they leave the rest of it', () => {
  const standing = partShape(part('standing-part'), curve, length);
  expect(standing.outer).toEqual(curve.points[0]);
  expect(standing.inner).toEqual(pointAt(curve, part('standing-part').to));
  const tail = partShape(part('tail'), curve, length);
  expect(tail.outer).toEqual(curve.points.at(-1));
  expect(tail.inner).toEqual(pointAt(curve, part('tail').from));
  expect(partShape(part('first-loop'), curve, length).inner).toBeNull();
});

it('boxes the curves with a margin', () => {
  expect(
    boundsOf(
      [
        {
          points: [
            [0, 1, 5],
            [4, -2, 0],
          ],
        },
      ],
      0.5,
    ),
  ).toEqual([-0.5, -2.5, 4.5, 1.5]);
  const [minX, minY, maxX, maxY] = boundsOf([curve], 0);
  expect([minX, maxX]).toEqual([-9.6, 9.6]); // and its two ends are as long as each other
  expect(minY).toBeCloseTo(-maxY, 6); // the knot is as tall above its rope as below it
});
