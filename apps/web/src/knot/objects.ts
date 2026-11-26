/**
 * What a knot is shown tied to, and where: a plate that a stopper keeps the rope from running through, or a
 * post that an eye is dropped over. They are placed from the shape the rope has, so that they stay with the
 * knot as it is tied and tightened. Pure: it knows nothing about the views.
 */
import type { Point3 } from '@idontknot/core';
import { PLATE_THICKNESS, POST_RADIUS, type SceneObject } from '../viewer/things.ts';

const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const size = (a: Point3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Point3): Point3 => {
  const l = size(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A rope as the views draw it: its centerline, the material coordinate of each point, and its thickness. */
export interface RopeShape {
  readonly points: readonly Point3[];
  readonly s: readonly number[];
  readonly radius: number;
}

/** The point of a rope at a material coordinate, and the way the rope runs there. */
function along(rope: RopeShape, at: number): { point: Point3; tangent: Point3 } {
  const { points, s } = rope;
  let i = 0;
  while (i < points.length - 2 && (s[i + 1] as number) < at) i++;
  const [a, b] = [points[i] as Point3, points[i + 1] as Point3];
  const [from, to] = [s[i] as number, s[i + 1] as number];
  const t = to > from ? Math.min(Math.max((at - from) / (to - from), 0), 1) : 0;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    tangent: unit(sub(b, a)),
  };
}

/** Where the rope first comes to lie against itself, along it: where its standing part enters the knot. */
function entersKnot(rope: RopeShape): number {
  const d = 2 * rope.radius;
  const apart = 0.95 * Math.PI * d;
  const { points, s } = rope;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if ((s[j] as number) - (s[i] as number) < apart) continue;
      if (size(sub(points[i] as Point3, points[j] as Point3)) < 1.2 * d) return s[i] as number;
    }
  }
  return 0;
}

/**
 * A plate across the standing part, a little short of where it enters the knot: the knot rests against it,
 * and keeps the rope from running out through its hole.
 */
export function plateFor(rope: RopeShape): SceneObject {
  const d = 2 * rope.radius;
  const at = Math.max(entersKnot(rope) - (0.8 + PLATE_THICKNESS / 2) * d, 0);
  const { point, tangent } = along(rope, at);
  return { kind: 'plate', at: point, axis: tangent, scale: d };
}

/**
 * A post standing up through an eye, a little short of its far end: nearly upright in the drawing, it leans
 * so as to pass over the upper side of the eye and under the lower, as a post the eye is dropped over does.
 */
export function postFor(rope: RopeShape, eye: readonly [from: number, to: number]): SceneObject {
  const d = 2 * rope.radius;
  const inside = rope.points.filter((_, i) => (rope.s[i] as number) > eye[0] && (rope.s[i] as number) < eye[1]);
  const mouth = along(rope, eye[0]).point;
  if (inside.length < 3) return { kind: 'post', at: mouth, axis: [0, 1, 0], scale: d };
  const far = inside.reduce((best, point) => (size(sub(point, mouth)) > size(sub(best, mouth)) ? point : best));
  // across the eye, at most of the way from its mouth to its far end
  const x = mouth[0] + (far[0] - mouth[0]) * POST_ALONG;
  const near = inside.filter((point) => Math.abs(point[0] - x) < 1.2 * d);
  const ys = (near.length > 1 ? near : inside).map((point) => point[1]);
  const [low, high] = [Math.min(...ys), Math.max(...ys)];
  // it passes clear of the rope at both sides, in front of the one and behind the other
  const clear = (POST_RADIUS + 0.5 + 0.15) * d;
  const axis = unit([0, high - low, 2 * clear]);
  const length = (Math.hypot(high - low, 2 * clear) + 6 * d) / d;
  return { kind: 'post', at: [x, (low + high) / 2, 0], axis, scale: d, length };
}

/** How far across an eye, from its mouth to its far end, a post stands. */
const POST_ALONG = 0.72;

/**
 * How far to move a tightened knot so that it rests against the plate it is pulled to: its side towards the
 * plate is where the knot was, tied, against it. `entry` is where the standing part comes into the knot.
 */
export function towardsPlate(
  plate: SceneObject,
  tied: RopeShape,
  tiedEntry: number,
  now: RopeShape,
  entry: number,
): Point3 {
  const front = (rope: RopeShape, from: number): number => {
    let least = Infinity;
    rope.points.forEach((point, i) => {
      if ((rope.s[i] as number) < from) return;
      least = Math.min(
        least,
        (point[0] - plate.at[0]) * plate.axis[0] +
          (point[1] - plate.at[1]) * plate.axis[1] +
          (point[2] - plate.at[2]) * plate.axis[2],
      );
    });
    return least;
  };
  const by = front(tied, tiedEntry) - front(now, entry);
  return [plate.axis[0] * by, plate.axis[1] * by, plate.axis[2] * by];
}

/** How far to move a tightened knot so that its eye stays round the post: its middle where it was, tied. */
export function aroundPost(tied: RopeShape, now: RopeShape, eye: readonly [from: number, to: number]): Point3 {
  const middle = (eye[0] + eye[1]) / 2;
  return sub(along(tied, middle).point, along(now, middle).point);
}

/** A rope with more of it before its start, straight: as a standing part runs on beyond what is drawn. */
export function lengthened(rope: RopeShape, by: number): RopeShape {
  const [first, second] = [rope.points[0] as Point3, rope.points[1] as Point3];
  const back = unit(sub(first, second));
  const step = size(sub(second, first)) || rope.radius;
  const count = Math.max(Math.round(by / step), 1);
  const before: Point3[] = [];
  const s: number[] = [];
  for (let k = count; k >= 1; k--) {
    const at = (by * k) / count;
    before.push([first[0] + back[0] * at, first[1] + back[1] * at, first[2] + back[2] * at]);
    s.push((rope.s[0] as number) - at);
  }
  return { ...rope, points: [...before, ...rope.points], s: [...s, ...rope.s] };
}
