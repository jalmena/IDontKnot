import { framePolylines, type Frame, type Point3 } from '@idontknot/core';
import { expect, it } from 'vitest';
import { KNOTS } from '../src/knot/library.ts';
import { plateFor, postFor } from '../src/knot/objects.ts';
import { fitOf } from '../src/knot/shape.ts';
import { PLATE_HOLE, POST_RADIUS } from '../src/viewer/things.ts';

const shapeOf = (id: string) => {
  const { document } = KNOTS[id]!;
  const [curve] = framePolylines(document, document.geometry?.frames[0] as Frame);
  if (!curve) throw new Error(`${id} has a rope`);
  return { document, rope: { points: curve.points, s: curve.s, radius: document.components[0]?.radius ?? 0.5 } };
};
const between = (a: Point3, b: Point3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

it('sets a plate across the standing part of a stopper, short of the knot, with the rope through its hole', () => {
  for (const id of ['figure-eight', 'overhand']) {
    const { rope } = shapeOf(id);
    const plate = plateFor(rope);
    expect(plate.kind).toBe('plate');
    // on the standing part: the rope passes through the middle of it, along its axis
    const nearest = Math.min(...rope.points.map((point) => between(point, plate.at)));
    expect(nearest).toBeLessThan(0.2);
    const [start, next] = [rope.points[0]!, rope.points[3]!];
    const along = [next[0] - start[0], next[1] - start[1], next[2] - start[2]];
    const dot =
      (along[0]! * plate.axis[0] + along[1]! * plate.axis[1] + along[2]! * plate.axis[2]) / Math.hypot(...along);
    expect(Math.abs(dot)).toBeGreaterThan(0.9);
    // its hole is wider than the rope
    expect(PLATE_HOLE * plate.scale).toBeGreaterThan(rope.radius);
  }
});

it('stands a post inside the eye of a bowline, at its far end, clear of the rope', () => {
  const { document, rope } = shapeOf('bowline');
  const eye = document.parts?.find((part) => part.type === 'eye');
  if (!eye) throw new Error('the bowline has an eye');
  const post = postFor(rope, [eye.from, eye.to]);
  expect(post.kind).toBe('post');
  expect(post.axis).toEqual([0, 0, 1]);
  // no rope comes nearer to its axis than its radius and the rope's own
  const nearest = Math.min(...rope.points.map((point) => Math.hypot(point[0] - post.at[0], point[1] - post.at[1])));
  expect(nearest).toBeGreaterThan(POST_RADIUS * post.scale + rope.radius);
  // and it is at the end of the eye furthest from the knot
  expect(post.at[0]).toBeGreaterThan(Math.max(...rope.points.map((point) => point[0])) - 3);
});

it('takes in what the rope is tied to when it frames the knot', () => {
  const { document, rope } = shapeOf('figure-eight');
  const curves = framePolylines(document, document.geometry?.frames[0] as Frame);
  const bare = fitOf(curves);
  const tied = fitOf(curves, undefined, [plateFor(rope)]);
  expect(tied.width).toBeGreaterThan(bare.width);
  expect(tied.centre[0] - tied.width / 2).toBeLessThan(bare.centre[0] - bare.width / 2);
  expect(fitOf(curves, undefined, [])).toEqual(bare);
});
