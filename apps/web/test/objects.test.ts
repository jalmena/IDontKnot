import { framePolylines, type Frame, type Point3 } from '@idontknot/core';
import { expect, it } from 'vitest';
import { KNOTS } from '../src/knot/library.ts';
import { aroundPost, lengthened, plateFor, postFor, towardsPlate } from '../src/knot/objects.ts';
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
    // it stands across the drawing, upright to it
    expect(plate.axis[2]).toBe(0);
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

it('stands a post nearly upright through the eye of a bowline: over its upper side, under its lower', () => {
  const { document, rope } = shapeOf('bowline');
  const eye = document.parts?.find((part) => part.type === 'eye');
  if (!eye) throw new Error('the bowline has an eye');
  const post = postFor(rope, [eye.from, eye.to]);
  expect(post.kind).toBe('post');
  // nearly upright in the drawing, leaning out of it
  expect(Math.abs(post.axis[1])).toBeGreaterThan(0.85);
  expect(post.axis[2]).toBeGreaterThan(0.1);
  // where it crosses the eye, it is in front of the upper side and behind the lower, clear of both
  const inEye = rope.points.filter((_, i) => rope.s[i]! > eye.from && rope.s[i]! < eye.to);
  const crossing = inEye.filter((point) => Math.abs(point[0] - post.at[0]) < 0.5);
  const [upper, lower] = [crossing.filter((p) => p[1] > post.at[1]), crossing.filter((p) => p[1] < post.at[1])];
  expect(upper.length).toBeGreaterThan(0);
  expect(lower.length).toBeGreaterThan(0);
  const heightAt = (y: number): number => post.at[2] + ((y - post.at[1]) / post.axis[1]) * post.axis[2];
  const clear = (POST_RADIUS * post.scale + rope.radius) / Math.abs(post.axis[1]);
  for (const point of upper) expect(heightAt(point[1]) - point[2]).toBeGreaterThan(clear * 0.9);
  for (const point of lower) expect(point[2] - heightAt(point[1])).toBeGreaterThan(clear * 0.9);
  // and it is long enough to stand out of the eye at both sides
  expect((post.length ?? 0) * post.scale).toBeGreaterThan(
    Math.max(...inEye.map((p) => p[1])) - Math.min(...inEye.map((p) => p[1])),
  );
});

it('moves a tightened knot so that it rests against its plate, and an eye so that it stays round its post', () => {
  const { rope } = shapeOf('figure-eight');
  const plate = plateFor(rope);
  // the knot drawn three diameters further from the plate is moved back by as much, along the plate's axis
  const far = {
    ...rope,
    points: rope.points.map((p): Point3 => [
      p[0] + plate.axis[0] * 3,
      p[1] + plate.axis[1] * 3,
      p[2] + plate.axis[2] * 3,
    ]),
  };
  const back = towardsPlate(plate, rope, 0, far, 0);
  back.forEach((value, c) => expect(value).toBeCloseTo(-3 * plate.axis[c]!, 6));
  // the same shape is not moved
  towardsPlate(plate, rope, 0, rope, 0).forEach((value) => expect(value).toBeCloseTo(0, 6));
  // a knot drawn aside is brought back across, so that its standing part goes through the middle of the hole
  const aside = { ...rope, points: rope.points.map((p): Point3 => [p[0], p[1] + 0.8, p[2] - 0.5]) };
  const across = towardsPlate(plate, rope, 0, aside, 0);
  const moved = aside.points.map((p): Point3 => [p[0] + across[0], p[1] + across[1], p[2] + across[2]]);
  const nearest = Math.min(...moved.map((point) => between(point, plate.at)));
  expect(nearest).toBeLessThan(0.1);

  const { document, rope: eyed } = shapeOf('bowline');
  const eye = document.parts?.find((part) => part.type === 'eye');
  if (!eye) throw new Error('the bowline has an eye');
  const shifted = { ...eyed, points: eyed.points.map((p): Point3 => [p[0] - 2, p[1] + 1, p[2]]) };
  const kept = aroundPost(eyed, shifted, [eye.from, eye.to]);
  [2, -1, 0].forEach((value, c) => expect(kept[c]).toBeCloseTo(value, 6));
});

it('runs a standing part on, straight, before its start', () => {
  const { rope } = shapeOf('overhand');
  const longer = lengthened(rope, 4);
  expect(longer.points.length).toBeGreaterThan(rope.points.length);
  expect(longer.points.slice(-rope.points.length)).toEqual(rope.points);
  const [start, next] = [rope.points[0]!, rope.points[1]!];
  const first = longer.points[0]!;
  expect(between(first, start)).toBeCloseTo(4, 6);
  // straight on from the start, away from the rope
  const away = [start[0] - next[0], start[1] - next[1], start[2] - next[2]];
  const out = [first[0] - start[0], first[1] - start[1], first[2] - start[2]];
  const cosine =
    (away[0]! * out[0]! + away[1]! * out[1]! + away[2]! * out[2]!) / (Math.hypot(...away) * Math.hypot(...out));
  expect(cosine).toBeCloseTo(1, 6);
  expect(longer.s[0]).toBeCloseTo(rope.s[0]! - 4, 6);
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
